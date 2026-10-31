"""Admitting ward patients: clinician intake and example patients drawn from real UCI records."""
import uuid
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.core.database import list_patients, save_clinical_observation, save_patient
from app.core.datasets import uci_bmt


@lru_cache(maxsize=1)
def cohort() -> pd.DataFrame:
    return uci_bmt.load_cohort()


def _sign(value: Optional[str]) -> str:
    return {"Positive": "+", "Negative": "−"}.get(value or "", "?")


def build_patient(
    pretransplant: Dict[str, Any],
    label: str,
    transplant_date: str,
    conditioning: str = "Not recorded",
    source: str = "clinical",
    source_record: Optional[str] = None,
) -> Dict[str, Any]:
    """Map dictionary-named pre-transplant values onto the patients table."""
    p = pretransplant
    return {
        "patient_id": f"MQ-{uuid.uuid4().hex[:6].upper()}",
        "name": label,
        "age": float(p["recipient_age"]),
        "gender": p["recipient_sex"],
        "disease": p["disease"],
        # Every UCI recipient received an allogeneic graft; intake follows the same model scope.
        "transplant_type": "Allogeneic HSCT",
        "donor_type": f"HLA {p['hla_match']} donor · {p['stem_cell_source'].lower()} graft",
        "transplant_date": transplant_date,
        "conditioning": conditioning,
        "cell_dose_cd34": float(p["cd34_dose"]),
        "chimerism_donor_pct": None,
        "cmv_status": f"D{_sign(p.get('donor_cmv'))}/R{_sign(p.get('recipient_cmv'))}",
        "hla_match": p["hla_match"],
        "status": "Admitted",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "source_record": source_record,
        "pretransplant": p,
    }


def _record_values(row: pd.Series) -> Dict[str, Any]:
    values = {}
    for name in uci_bmt.PRE_TRANSPLANT_FEATURES:
        v = row[name]
        if pd.isna(v):
            continue
        values[name] = v.item() if isinstance(v, np.generic) else v
    return values


EXAMPLE_LAB_SOURCE = "Example: simulated by the calibrated model, consistent with the record's recovery day"


def example_counts(row: pd.Series, days: int, seed: int) -> List[Dict[str, Any]]:
    """Daily ANC and platelet counts for an example patient (Day 1..days).

    ANC: median trajectory of the calibrated granulopoiesis particles for this record's graft whose simulated
    engraftment day equals the record's recorded recovery day, with 15% log-normal assay noise. Platelets:
    log-linear course from a Day +7 nadir of 15,000/µL to 50,000/µL on the recorded platelet-recovery day.
    """
    from app.core.biology import calibrate, granulopoiesis as g

    rng = np.random.default_rng(seed)
    params = calibrate.load_params()["params"]
    z = rng.standard_normal((20000, 3))
    mtt, gamma, seed_cells = g.particle_parameters(params, calibrate.covariates(row), z)
    anc = g.to_numpy(g.simulate(mtt, gamma, seed_cells))
    eng = g.to_numpy(g.engraftment_day(anc))
    target = row.get("anc_recovery_day")
    if pd.notna(target):
        match = np.abs(eng - float(target)) <= 0.5
        if not match.any():
            match = np.abs(eng - float(target)) <= np.nanmin(np.abs(eng - float(target))) + 0.5
    else:
        match = ~np.isfinite(eng)
        if not match.any():
            match = eng >= np.nanpercentile(eng[np.isfinite(eng)], 95)
    anc_path = np.median(anc[match], axis=0)

    plt_day = row.get("plt_recovery_day")
    plt_day = float(plt_day) if pd.notna(plt_day) and plt_day > 8 else 40.0
    out = []
    for d in range(1, days + 1):
        anc_v = float(anc_path[min(d, len(anc_path) - 1)] * rng.lognormal(0, 0.15))
        if d <= 7:
            plt_v = 120000 * (15000 / 120000) ** (d / 7)
        else:
            plt_v = 15000 * (50000 / 15000) ** ((d - 7) / (plt_day - 7))
        out.append({"day": d, "anc": round(anc_v / 10) * 10, "plt": round(plt_v * rng.lognormal(0, 0.1) / 1000) * 1000})
    return out


def create_example_patients(
    count: int, seed: int, today: Optional[date] = None, with_observations: bool = False
) -> List[Dict[str, Any]]:
    """Admit `count` example patients copied from distinct UCI records not already in use.

    Records are drawn alternately from early and late engrafters so the examples span the cohort.
    Their outcomes stay in the cohort table; only pre-transplant data is copied to the ward record.
    """
    df = cohort()
    used = {p["source_record"] for p in list_patients() if p.get("source") == "example"}
    rng = np.random.default_rng(seed)
    pools = [
        list(rng.permutation(df.index[(df.early_engraftment == flag) & ~df.patient_id.isin(used)]))
        for flag in (1, 0)
    ]
    today = today or date.today()
    # Spread admissions over the first weeks after infusion, where engraftment is decided.
    days_post = [16, 11, 21, 8, 13, 19, 6, 24]
    created = []
    for i in range(count):
        pool = pools[i % 2] or pools[(i + 1) % 2]
        if not pool:
            break
        row = df.loc[pool.pop()]
        patient = build_patient(
            _record_values(row),
            label=f"Example · {row.patient_id}",
            transplant_date=(today - timedelta(days=days_post[i % len(days_post)])).isoformat(),
            source="example",
            source_record=row.patient_id,
        )
        save_patient(patient)
        if with_observations:
            transplant = date.fromisoformat(patient["transplant_date"])
            for c in example_counts(row, days_post[i % len(days_post)], seed + i):
                for metric, value, unit in (("Absolute Neutrophil Count (ANC)", c["anc"], "cells/μL"), ("Platelets", c["plt"], "/μL")):
                    save_clinical_observation({
                        "patient_id": patient["patient_id"], "day_post_tx": c["day"],
                        "recorded_date": (transplant + timedelta(days=c["day"])).isoformat(),
                        "metric_type": metric, "value": value, "unit": unit,
                        "source": EXAMPLE_LAB_SOURCE, "recorded_by": "MarrowQ example generator",
                    })
        created.append(patient)
    return created
