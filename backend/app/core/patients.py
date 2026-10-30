"""Admitting ward patients: clinician intake and example patients drawn from real UCI records."""
import uuid
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.core.database import list_patients, save_patient
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


def create_example_patients(count: int, seed: int, today: Optional[date] = None) -> List[Dict[str, Any]]:
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
    days_post = [5, 9, 12, 16, 3, 7, 14, 19]
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
        created.append(patient)
    return created
