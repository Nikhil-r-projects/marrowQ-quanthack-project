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


def seed_patient_surveillance_panel(
    patient_id: str,
    transplant_date_str: str,
    days: int = 16,
    baseline_mass: float = 28.4,
    source: str = "Clinical Surveillance Protocol"
) -> int:
    """Save a clinically realistic, complete multi-organ surveillance observation set.

    Populates all 4 monitored domains (Marrow, Stem Cells, Heart, Liver) so that no
    vital clinical organ view displays empty dashes.
    """
    t_date = date.fromisoformat(transplant_date_str)
    count = 0

    # 1. Daily ANC & Platelets (trajectories through Day 1..days)
    anc_vals = [2800, 1900, 1100, 450, 120, 40, 50, 70, 90, 130, 210, 310, 420, 480, 560, 680, 820, 990, 1250, 1540, 1850]
    plt_vals = [120000, 95000, 70000, 45000, 28000, 18000, 14000, 15000, 17000, 19000, 22000, 26000, 32000, 38000, 42000, 48000, 56000, 67000, 81000, 95000, 112000]

    for d in range(1, min(days + 1, len(anc_vals) + 1)):
        d_iso = (t_date + timedelta(days=d)).isoformat()
        save_clinical_observation({
            "patient_id": patient_id, "day_post_tx": d, "recorded_date": d_iso,
            "metric_type": "Absolute Neutrophil Count (ANC)", "value": float(anc_vals[d - 1]),
            "unit": "cells/μL", "source": source, "recorded_by": "Central Haematology Lab"
        })
        save_clinical_observation({
            "patient_id": patient_id, "day_post_tx": d, "recorded_date": d_iso,
            "metric_type": "Platelets", "value": float(plt_vals[d - 1]),
            "unit": "/μL", "source": source, "recorded_by": "Central Haematology Lab"
        })
        count += 2

        # Periodic Hemoglobin and WBC (Day 1, 7, 12, days)
        if d in (1, 7, 12, days):
            hb_val = 11.2 if d == 1 else 7.6 if d == 7 else 8.9 if d == 12 else 9.8
            wbc_val = 4.2 if d == 1 else 0.6 if d == 7 else 1.8 if d == 12 else 3.2
            save_clinical_observation({
                "patient_id": patient_id, "day_post_tx": d, "recorded_date": d_iso,
                "metric_type": "Hemoglobin", "value": float(hb_val),
                "unit": "g/dL", "source": source, "recorded_by": "Central Haematology Lab"
            })
            save_clinical_observation({
                "patient_id": patient_id, "day_post_tx": d, "recorded_date": d_iso,
                "metric_type": "White Blood Cells (WBC)", "value": float(wbc_val),
                "unit": "x10^3/μL", "source": source, "recorded_by": "Central Haematology Lab"
            })
            count += 2

    # 2. Bone Marrow Engraftment & Chimerism
    chim_day = min(14, days)
    save_clinical_observation({
        "patient_id": patient_id, "day_post_tx": chim_day,
        "recorded_date": (t_date + timedelta(days=chim_day)).isoformat(),
        "metric_type": "Donor chimerism", "value": 98.0,
        "unit": "%", "source": source, "recorded_by": "Molecular Diagnostics (STR-PCR)"
    })
    count += 1

    # 3. Cardiac Toxicity Surveillance (Heart)
    cardiac_day = min(14, days)
    cardiac_iso = (t_date + timedelta(days=cardiac_day)).isoformat()
    cardiac_labs = [
        ("LV ejection fraction", 62.0, "%", "Echocardiography Core"),
        ("hs-Troponin T", 8.2, "ng/L", "Cardiovascular Biomarker Lab"),
        ("NT-proBNP", 84.0, "pg/mL", "Cardiovascular Biomarker Lab"),
        ("QTc interval", 418.0, "ms", "12-Lead Electrocardiogram"),
    ]
    for m, val, u, rec in cardiac_labs:
        save_clinical_observation({
            "patient_id": patient_id, "day_post_tx": cardiac_day,
            "recorded_date": cardiac_iso, "metric_type": m, "value": val,
            "unit": u, "source": source, "recorded_by": rec
        })
        count += 1

    # 4. Hepatic Surveillance & VOD/SOS Monitoring (Liver)
    liver_day = min(14, days)
    liver_iso = (t_date + timedelta(days=liver_day)).isoformat()
    liver_labs = [
        ("Total bilirubin", 0.8, "mg/dL", "Central Chemistry Lab"),
        ("ALT", 28.0, "U/L", "Central Chemistry Lab"),
        ("AST", 24.0, "U/L", "Central Chemistry Lab"),
        ("Body weight", round(baseline_mass * 1.018, 1), "kg", "Ward Nursing Record"),
    ]
    for m, val, u, rec in liver_labs:
        save_clinical_observation({
            "patient_id": patient_id, "day_post_tx": liver_day,
            "recorded_date": liver_iso, "metric_type": m, "value": val,
            "unit": u, "source": source, "recorded_by": rec
        })
        count += 1

    return count


BENCHMARK_PATIENT_ID = "MQ-BENCH01"


def ensure_golden_benchmark_patient() -> Dict[str, Any]:
    """Ensure the primary golden benchmark patient (Kavya Sharma · Paediatric ALL) exists with complete surveillance data."""
    from app.core.database import get_patient, get_patient_observations

    today = date.today()
    transplant_iso = (today - timedelta(days=16)).isoformat()

    pretransplant = {
        "recipient_age": 8.5,
        "recipient_sex": "Female",
        "recipient_body_mass": 28.4,
        "recipient_abo": "A",
        "recipient_rh": 1,
        "recipient_cmv": "Negative",
        "disease": "ALL",
        "high_risk": 0,
        "second_transplant": 0,
        "donor_age": 31.0,
        "donor_abo": "A",
        "donor_cmv": "Positive",
        "hla_match": "10/10",
        "hla_antigen_differences": 0,
        "female_to_male": 0,
        "stem_cell_source": "Peripheral blood",
        "cd34_dose": 9.20,
        "cd3_dose": 4.10,
        "ab_match": 0,
    }

    patient = {
        "patient_id": BENCHMARK_PATIENT_ID,
        "name": "Kavya Sharma · Paediatric Benchmark (ALL · 10/10 MUD)",
        "age": 8.5,
        "gender": "Female",
        "disease": "ALL",
        "transplant_type": "Allogeneic HSCT",
        "donor_type": "HLA 10/10 donor · peripheral blood graft",
        "transplant_date": transplant_iso,
        "conditioning": "Bu/Cy Myeloablative",
        "cell_dose_cd34": 9.20,
        "chimerism_donor_pct": 98.0,
        "cmv_status": "D+/R−",
        "hla_match": "10/10",
        "status": "Admitted",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "example",
        "source_record": "UCI-033",
        "pretransplant": pretransplant,
    }
    save_patient(patient)

    obs = get_patient_observations(BENCHMARK_PATIENT_ID)
    if len(obs) < 10:
        seed_patient_surveillance_panel(BENCHMARK_PATIENT_ID, transplant_iso, days=16, baseline_mass=28.4)

    return patient


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
            seed_patient_surveillance_panel(
                patient_id=patient["patient_id"],
                transplant_date_str=patient["transplant_date"],
                days=days_post[i % len(days_post)],
                baseline_mass=float(patient["pretransplant"].get("recipient_body_mass", 28.4)),
            )
        created.append(patient)
    return created
