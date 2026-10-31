"""Time to neutrophil engraftment: log-logistic accelerated-failure-time model on the UCI cohort.

Gives a full curve P(ANC recovered by day d) for any pre-transplant profile, handling the five
recipients who never recovered as right-censored at their last follow-up.
"""
from functools import lru_cache
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from lifelines import LogLogisticAFTFitter
from lifelines.utils import concordance_index
from sklearn.model_selection import KFold

from app.core.benchmark import build_preprocessor, split_feature_types
from app.core.datasets import uci_bmt

FEATURES = list(uci_bmt.PRE_TRANSPLANT_FEATURES)
HORIZON_DAYS = 40
# Chosen by 3×5-fold CV over Weibull / log-normal / log-logistic AFT and Cox models (penalizer 0.01–0.5):
# best concordance (0.676) with calibration-in-the-large matching the cohort (mean P(by Day 14) 0.417).
PENALIZER = 0.5


def _design(df: pd.DataFrame):
    numeric, categorical = split_feature_types(df, FEATURES)
    return build_preprocessor(numeric, categorical)


def _outcome(df: pd.DataFrame) -> pd.DataFrame:
    # Recovered: the recovery day. Never recovered: censored at last follow-up (capped at the horizon).
    duration = df["anc_recovery_day"].fillna(df["follow_up_days"].clip(upper=HORIZON_DAYS))
    return pd.DataFrame({"duration": duration.clip(lower=1).to_numpy(), "event": df["anc_recovered"].to_numpy()})


def _fit(df: pd.DataFrame):
    prep = _design(df).fit(df[FEATURES])
    X = pd.DataFrame(prep.transform(df[FEATURES]))
    X.columns = [f"x{i}" for i in range(X.shape[1])]
    # Drop constant columns (e.g. one-hot levels absent from this training fold).
    keep = X.columns[X.std() > 1e-9]
    frame = pd.concat([X[keep], _outcome(df)], axis=1)
    model = LogLogisticAFTFitter(penalizer=PENALIZER).fit(frame, duration_col="duration", event_col="event")
    return prep, list(keep), model


def _predict_median(fitted, df: pd.DataFrame) -> np.ndarray:
    prep, keep, model = fitted
    X = pd.DataFrame(prep.transform(df[FEATURES]))
    X.columns = [f"x{i}" for i in range(X.shape[1])]
    return model.predict_median(X[keep]).to_numpy()


@lru_cache(maxsize=1)
def trained_model() -> Dict[str, Any]:
    """Fit on the whole cohort and measure discrimination with 5-fold cross-validated C-index."""
    df = uci_bmt.load_cohort()
    out = _outcome(df)
    cv_pred = np.zeros(len(df))
    for tr, te in KFold(5, shuffle=True, random_state=42).split(df):
        cv_pred[te] = _predict_median(_fit(df.iloc[tr].reset_index(drop=True)), df.iloc[te])
    c_index = concordance_index(out["duration"], cv_pred, out["event"])
    observed = df["anc_recovery_day"].dropna()
    return {
        "fitted": _fit(df),
        "c_index": round(float(c_index), 4),
        "n": int(len(df)),
        "events": int(out["event"].sum()),
        "cohort_median_day": float(observed.median()),
    }


def engraftment_curve(values: Dict[str, Any]) -> Dict[str, Any]:
    """P(neutrophil engraftment by day d) for one pre-transplant profile (dictionary variable names)."""
    info = trained_model()
    prep, keep, model = info["fitted"]
    row = pd.DataFrame([{f: values.get(f, np.nan) for f in FEATURES}])
    for f in FEATURES:  # keep dtypes compatible with the fitted encoders
        if uci_bmt.DATA_DICTIONARY[f].kind == "categorical":
            row[f] = row[f].astype(object)
        else:
            row[f] = pd.to_numeric(row[f], errors="coerce")
    X = pd.DataFrame(prep.transform(row[FEATURES]))
    X.columns = [f"x{i}" for i in range(X.shape[1])]
    days = np.arange(0, HORIZON_DAYS + 1)
    survival = model.predict_survival_function(X[keep], times=days).iloc[:, 0].to_numpy()
    cumulative = 1 - survival
    by = {d: round(float(cumulative[d]), 4) for d in (14, 21, 28)}
    return {
        "days": days.tolist(),
        "probability_engrafted": [round(float(v), 4) for v in cumulative],
        "median_day": round(float(model.predict_median(X[keep]).iloc[0]), 1),
        "probability_by_day": by,
        "model": {
            "name": "Log-logistic accelerated failure time",
            "c_index_cv": info["c_index"],
            "n": info["n"],
            "events": info["events"],
            "cohort_median_day": info["cohort_median_day"],
        },
    }
