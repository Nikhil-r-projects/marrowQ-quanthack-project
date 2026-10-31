"""Recovery tracker: recorded counts plus the patient-specific GPU neutrophil forecast.

Neutrophils: posterior median and 80/95% bands from the particle filter (biology/forecast.py), calibrated to
the UCI cohort's recovery days and updated with this patient's own draws. Platelets: recorded values only
(no calibrated platelet model exists, so none is drawn).
"""
import math
from typing import Any, Dict, List, Optional

from app.core.biology.forecast import forecast as neutrophil_forecast
from app.core.database import get_patient, get_patient_observations

ANC_THRESHOLD = 500.0
PLT_THRESHOLD = 20000.0


def _by_day(observations: List[Dict[str, Any]], *keys: str) -> Dict[int, float]:
    out: Dict[int, float] = {}
    for o in observations:
        if any(k in o["metric_type"] for k in keys):
            out[int(o["day_post_tx"])] = float(o["value"])  # ordered by day; a later entry for the same day wins
    return out


def neutrophil_engraftment_day(anc: Dict[int, float]) -> Optional[int]:
    """First of three consecutive post-infusion days with ANC ≥ 500/µL after nadir (EBMT/CIBMTR definition)."""
    post = {d: v for d, v in anc.items() if d > 0}
    if not post:
        return None
    # Find nadir / aplasia period (ANC < 500)
    days_below = [d for d, v in post.items() if v < ANC_THRESHOLD]
    start_search = max(days_below) if days_below else 0
    for day in sorted(d for d in post if d > start_search):
        if all(post.get(day + k, -1) >= ANC_THRESHOLD for k in range(3)):
            return day
        # Or if 2 consecutive days at the latest boundary of observations
        if all(post.get(day + k, -1) >= ANC_THRESHOLD for k in range(2)) and (day + 1) >= max(post):
            return day
    return None


def _latest(values: Dict[int, float]):
    if not values:
        return None, None
    day = max(values)
    return day, values[day]


def compute_patient_trajectory(patient_id: str) -> Dict[str, Any]:
    patient = get_patient(patient_id)
    if not patient:
        return {"error": f"Patient {patient_id} not found"}
    observations = get_patient_observations(patient_id)
    anc = _by_day(observations, "ANC", "Neutrophil")
    plt = _by_day(observations, "Platelet")
    hb = _by_day(observations, "Hemoglobin")
    wbc = _by_day(observations, "WBC", "White Blood")

    fc = neutrophil_forecast(patient.get("pretransplant") or {"cd34_dose": patient.get("cell_dose_cd34")},
                             [{"day": d, "value": v} for d, v in anc.items() if d > 0])
    engrafted_day = neutrophil_engraftment_day(anc)
    plt_first = next((d for d in sorted(plt) if d > 0 and plt[d] >= PLT_THRESHOLD), None)
    latest_day = max([d for d in (*anc, *plt, *hb, *wbc)], default=0)

    timeline = [{
        "day": day,
        "is_observed": day in anc or day in plt,
        "anc_observed": anc.get(day),
        "anc_predicted": fc["median"][day],
        "anc_lower_95": fc["lower_95"][day],
        "anc_upper_95": fc["upper_95"][day],
        "anc_lower_80": fc["lower_80"][day],
        "anc_upper_80": fc["upper_80"][day],
        "plt_observed": plt.get(day),
        "plt_predicted": None,
        "plt_lower_95": None,
        "plt_upper_95": None,
        "hb_observed": hb.get(day),
        "wbc_observed": wbc.get(day),
    } for day in fc["days"]]

    lo80, hi80 = fc["engraftment_day_80"]
    post = {d: v for d, v in anc.items() if d > 0}
    nadir_day, nadir_value = (min(post, key=post.get), min(post.values())) if post else (None, None)
    milestones = [
        {"id": "infusion", "name": "Stem-cell infusion (Day 0)", "target_day": 0, "status": "COMPLETED", "actual_day": 0,
         "actual_date": patient["transplant_date"],
         "notes": f"CD34+ dose {patient['cell_dose_cd34']:g} ×10⁶/kg" if patient.get("cell_dose_cd34") is not None else None},
        {"id": "nadir", "name": "Neutrophil nadir (lowest recorded)", "target_day": nadir_day or 0,
         "status": "COMPLETED" if nadir_day is not None else "PENDING", "actual_day": nadir_day,
         "notes": f"{nadir_value:,.0f} cells/µL" if nadir_value is not None else "No post-infusion count recorded yet"},
        {"id": "anc_engraftment", "name": "Neutrophil engraftment (ANC ≥ 500 on 3 consecutive days)",
         "target_day": engrafted_day or (fc["median_engraftment_day"] or 0),
         "status": "COMPLETED" if engrafted_day else ("DELAYED" if fc["delayed_engraftment_risk"] else "PROJECTED"),
         "actual_day": engrafted_day,
         "projected_day": None if engrafted_day else fc["median_engraftment_day"],
         "forecast_interval": None if engrafted_day or lo80 is None else f"Day {lo80:g}–{hi80:g} (80%)" if hi80 else f"after Day {lo80:g}",
         "notes": "Confirmed from recorded draws" if engrafted_day else
                  f"Forecast: P(by Day +14) {fc['probability_engrafted_by'][14]:.0%}, by Day +21 {fc['probability_engrafted_by'][21]:.0%}, by Day +28 {fc['probability_engrafted_by'][28]:.0%}"},
        {"id": "plt_threshold", "name": "Platelets ≥ 20,000/µL", "target_day": plt_first or 0,
         "status": "COMPLETED" if plt_first else "PENDING", "actual_day": plt_first,
         "notes": "First recorded count above threshold; transfusion independence for 7 days is confirmed clinically" if plt_first else "No recorded count above threshold yet"},
    ]

    last_two = sorted(post)[-2:]
    if len(last_two) == 2 and post[last_two[0]] > 0:
        change = math.log(max(post[last_two[1]], 1) / max(post[last_two[0]], 1))
        velocity = "Rising" if change > 0.15 else "Falling" if change < -0.15 else "Stable"
    else:
        velocity = "Unknown"

    if engrafted_day:
        status = f"Neutrophil engraftment confirmed on Day +{engrafted_day}."
    elif not post:
        status = (f"No post-infusion neutrophil count yet. Expected engraftment around Day +{fc['median_engraftment_day']:g} "
                  f"from the graft profile; record draws to personalise the forecast.") if fc["median_engraftment_day"] else "No post-infusion neutrophil count yet."
    else:
        status = (f"Forecast from {fc['draws_used']} recorded draw{'s' if fc['draws_used'] != 1 else ''}: engraftment most likely around "
                  f"Day +{fc['median_engraftment_day']:g}" + (f" (80% range Day {lo80:g}–{hi80:g})" if lo80 is not None and hi80 is not None else "") + ".")
        if fc["delayed_engraftment_risk"]:
            status += " Delayed engraftment risk: review graft function."

    return {
        "patient_id": patient_id,
        "patient_name": patient["name"],
        "transplant_date": patient["transplant_date"],
        "latest_observed_day": latest_day,
        "expected_anc_engraft_day": engrafted_day or fc["median_engraftment_day"],
        "expected_plt_engraft_day": plt_first,
        "is_anc_engrafted": engrafted_day is not None,
        "is_plt_engrafted": plt_first is not None,
        "timeline_series": timeline,
        "milestones": milestones,
        "forecast": {k: fc[k] for k in ("probability_engrafted_by", "median_engraftment_day", "engraftment_day_80",
                                         "delayed_engraftment_risk", "draws_used", "effective_sample_size", "particles",
                                         "device", "calibration", "measurement_sd")},
        "clinical_summary": {
            "current_anc": _latest(anc)[1] if anc else "—",
            "current_plt": _latest(plt)[1] if plt else "—",
            "current_hb": _latest(hb)[1] if hb else "—",
            "current_wbc": _latest(wbc)[1] if wbc else "—",
            "velocity": velocity,
            "status_description": status,
        },
    }
