"""Scoring a pre-transplant profile with the models saved by a completed experiment."""
import os
from typing import Any, Dict, Optional

import joblib
import pandas as pd

from app.core.database import get_experiment_record, list_experiments
from app.core.datasets import uci_bmt


def latest_cohort_experiment() -> Optional[Dict[str, Any]]:
    """Most recent completed experiment trained on the UCI cohort with cross-validated pipelines."""
    for summary in list_experiments():
        if summary["status"] != "completed":
            continue
        exp = get_experiment_record(summary["experiment_id"])
        if exp and exp["dataset_id"] == uci_bmt.DATASET_ID and exp.get("artifacts_path") and any(
            f.startswith("pipeline_") for f in os.listdir(exp["artifacts_path"]) if os.path.isdir(exp["artifacts_path"])
        ):
            return exp
    return None


def feature_frame(exp: Dict[str, Any], features: Dict[str, Any]) -> pd.DataFrame:
    values = dict(features)
    if exp["dataset_id"] == uci_bmt.DATASET_ID:
        values = uci_bmt.derive_fields(values)
    # Align to the trained feature list; anything not supplied is imputed by the fitted preprocessor.
    return pd.DataFrame([values]).reindex(columns=exp["selected_features"])


def score(exp: Dict[str, Any], model_name: str, features: Dict[str, Any]) -> float:
    """Probability of the positive class. Raises FileNotFoundError if the model was not trained."""
    artifacts = exp.get("artifacts_path") or ""
    frame = feature_frame(exp, features)
    pipeline_path = os.path.join(artifacts, f"pipeline_{model_name}.joblib")
    if os.path.exists(pipeline_path):
        return float(joblib.load(pipeline_path).predict_proba(frame)[0][1])
    if model_name == "quantum_kernel_svm":
        bundle_path = os.path.join(artifacts, "model_quantum.joblib")
        prep_path = os.path.join(artifacts, "preprocessor.joblib")
        if os.path.exists(bundle_path) and os.path.exists(prep_path):
            q = joblib.load(bundle_path)
            x = q["scaler"].transform(q["pca"].transform(joblib.load(prep_path).transform(frame)))
            return float(q["svc"].predict_proba(q["kernel"].evaluate(x_vec=x, y_vec=q["X_tr_q"]))[0][1])
    raise FileNotFoundError(f"Model '{model_name}' was not trained in experiment {exp['experiment_id']}")
