"""Classical benchmark with repeated, nested cross-validation.

Every number reported here is out-of-fold: preprocessing and hyper-parameter tuning are fitted
inside each training fold only (sklearn Pipeline inside GridSearchCV inside RepeatedStratifiedKFold).
"""
import time
import warnings
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from sklearn.base import BaseEstimator, TransformerMixin, clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, brier_score_loss, confusion_matrix,
    f1_score, precision_score, recall_score, roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, RepeatedStratifiedKFold, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC

from app.schemas import ModelMetric

Progress = Callable[[float, str], None]


class SkewLogTransformer(BaseEstimator, TransformerMixin):
    """log1p on non-negative numeric columns whose training skew exceeds `threshold` (e.g. cell doses)."""

    def __init__(self, threshold: float = 1.0):
        self.threshold = threshold

    def fit(self, X, y=None):
        X = np.asarray(X, dtype=float)
        skew = pd.DataFrame(X).skew(skipna=True).to_numpy()
        self.log_mask_ = (np.nanmin(X, axis=0) >= 0) & (np.nan_to_num(skew) > self.threshold)
        return self

    def transform(self, X):
        X = np.array(X, dtype=float, copy=True)
        X[:, self.log_mask_] = np.log1p(X[:, self.log_mask_])
        return X


def build_preprocessor(numeric: List[str], categorical: List[str]) -> ColumnTransformer:
    transformers = []
    if numeric:
        transformers.append(("num", Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("log", SkewLogTransformer()),
            ("scale", StandardScaler()),
        ]), numeric))
    if categorical:
        transformers.append(("cat", Pipeline([
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]), categorical))
    return ColumnTransformer(transformers, remainder="drop")


# key -> (display name, estimator, inner-CV hyper-parameter grid)
MODEL_SPECS: Dict[str, Tuple[str, Any, Dict[str, list]]] = {
    "dummy": ("Majority-class baseline", DummyClassifier(strategy="prior"), {}),
    "logistic_regression": (
        "Logistic regression (L2)",
        LogisticRegression(max_iter=5000, class_weight="balanced"),
        {"model__C": [0.01, 0.03, 0.1, 0.3, 1.0, 3.0]},
    ),
    "logistic_l1": (
        "Logistic regression (L1, sparse)",
        LogisticRegression(max_iter=5000, class_weight="balanced", penalty="l1", solver="liblinear"),
        {"model__C": [0.03, 0.1, 0.3, 1.0]},
    ),
    "random_forest": (
        "Random forest",
        RandomForestClassifier(n_estimators=200, class_weight="balanced_subsample", random_state=0),
        {"model__max_depth": [4, None], "model__min_samples_leaf": [1, 5]},
    ),
    "gradient_boosting": (
        "Gradient boosting",
        HistGradientBoostingClassifier(class_weight="balanced", random_state=0),
        {"model__learning_rate": [0.03, 0.1], "model__max_depth": [2, 3], "model__max_iter": [100]},
    ),
    "rbf_svm": (
        "RBF SVM",
        # Platt-calibrated probabilities (sklearn's replacement for SVC(probability=True)).
        CalibratedClassifierCV(SVC(kernel="rbf", class_weight="balanced"), ensemble=False, cv=3),
        {"model__estimator__C": [0.3, 1.0, 3.0, 10.0], "model__estimator__gamma": ["scale", 0.01, 0.03, 0.1]},
    ),
}


def make_pipeline(key: str, numeric: List[str], categorical: List[str], seed: int) -> Tuple[Pipeline, Dict[str, list]]:
    _, estimator, grid = MODEL_SPECS[key]
    est = clone(estimator)
    if "random_state" in est.get_params():
        est.set_params(random_state=seed)
    return Pipeline([("prep", build_preprocessor(numeric, categorical)), ("model", est)]), grid


def _tuned(pipe: Pipeline, grid: Dict[str, list], seed: int):
    if not grid:
        return pipe
    return GridSearchCV(pipe, grid, scoring="roc_auc", cv=StratifiedKFold(3, shuffle=True, random_state=seed), n_jobs=1)


class AveragingEnsemble:
    """Averages predict_proba of already-fitted pipelines (members are tuned independently)."""

    def __init__(self, members):
        self.members = members

    def predict_proba(self, X):
        return np.mean([m.predict_proba(X) for m in self.members], axis=0)


def _metric(key, display, y, oof, threshold, fit_seconds, best_params, n_splits, n_repeats, seed) -> Dict[str, Any]:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        repeat_auc = [roc_auc_score(y, oof[r]) for r in range(n_repeats)]
        # Each patient's probability is the mean of its out-of-fold predictions across repeats.
        p = oof.mean(axis=0)
        pred = (p >= threshold).astype(int)
        return ModelMetric(
            model_name=key,
            display_name=display,
            accuracy=round(float(accuracy_score(y, pred)), 4),
            balanced_accuracy=round(float(balanced_accuracy_score(y, pred)), 4),
            precision=round(float(precision_score(y, pred, zero_division=0)), 4),
            recall=round(float(recall_score(y, pred, zero_division=0)), 4),
            f1_score=round(float(f1_score(y, pred, zero_division=0)), 4),
            roc_auc=round(float(roc_auc_score(y, p)), 4),
            brier_score=round(float(brier_score_loss(y, p)), 4),
            confusion_matrix=confusion_matrix(y, pred, labels=[0, 1]).tolist(),
            training_time_seconds=round(fit_seconds, 4),
            inference_time_seconds=0.0,
            test_sample_count=int(len(y)),
            roc_auc_ci=_bootstrap_ci(y, p, roc_auc_score, seed=seed),
            balanced_accuracy_ci=_bootstrap_ci(y, p, lambda a, b: balanced_accuracy_score(a, (b >= threshold).astype(int)), seed=seed),
            brier_ci=_bootstrap_ci(y, p, brier_score_loss, seed=seed),
            roc_auc_repeat_sd=round(float(np.std(repeat_auc)), 4),
            calibration=_calibration(y, p),
            best_params=best_params,
            evaluation=f"{n_repeats}×{n_splits}-fold repeated stratified CV, nested tuning; threshold {threshold:.2f} (base rate)",
        ).model_dump()


def _fit_fold(key, numeric, categorical, seed, fold, X_tr, y_tr, X_te):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pipe, grid = make_pipeline(key, numeric, categorical, seed)
        model = _tuned(pipe, grid, seed + fold)
        t0 = time.perf_counter()
        model.fit(X_tr, y_tr)
        return model.predict_proba(X_te)[:, 1], time.perf_counter() - t0


def _bootstrap_ci(y: np.ndarray, p: np.ndarray, metric, n: int = 1000, seed: int = 0) -> Optional[List[float]]:
    rng = np.random.default_rng(seed)
    values = []
    for _ in range(n):
        idx = rng.integers(0, len(y), len(y))
        if len(np.unique(y[idx])) < 2:
            continue
        values.append(metric(y[idx], p[idx]))
    if not values:
        return None
    lo, hi = np.percentile(values, [2.5, 97.5])
    return [round(float(lo), 4), round(float(hi), 4)]


def _calibration(y: np.ndarray, p: np.ndarray, bins: int = 5) -> List[Dict[str, float]]:
    edges = np.quantile(p, np.linspace(0, 1, bins + 1))
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p >= lo) & (p <= hi)
        if m.sum():
            out.append({"predicted": round(float(p[m].mean()), 4), "observed": round(float(y[m].mean()), 4), "n": int(m.sum())})
    return out


def split_feature_types(df: pd.DataFrame, features: List[str]) -> Tuple[List[str], List[str]]:
    numeric = [c for c in features if pd.api.types.is_numeric_dtype(df[c])]
    return numeric, [c for c in features if c not in numeric]


def binary_target(series: pd.Series) -> np.ndarray:
    classes = np.unique(series.dropna())
    if len(classes) != 2:
        raise ValueError(f"Target must have exactly 2 classes, found {list(classes)}")
    return (series.to_numpy() == classes[-1]).astype(int)


def run_cross_validated_benchmark(
    df: pd.DataFrame,
    target: str,
    features: List[str],
    model_keys: List[str],
    seed: int = 42,
    n_splits: int = 5,
    n_repeats: int = 5,
    progress: Optional[Progress] = None,
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Pipeline], Dict[str, Any]]:
    """Returns (metrics per model, final pipelines refitted on all rows, evaluation summary)."""
    data = df.dropna(subset=[target]).reset_index(drop=True)
    y = binary_target(data[target])
    X = data[features]
    numeric, categorical = split_feature_types(data, features)
    folds = list(RepeatedStratifiedKFold(n_splits=n_splits, n_repeats=n_repeats, random_state=seed).split(X, y))

    metrics: Dict[str, Dict[str, Any]] = {}
    finals: Dict[str, Any] = {}
    oof_by_model: Dict[str, np.ndarray] = {}
    # Decisions use the cohort base rate as threshold, so calibrated and class-weighted models are compared fairly.
    threshold = float(y.mean())
    total = len(model_keys) * (len(folds) + 1)
    step = 0
    for key in model_keys:
        display = MODEL_SPECS[key][0]
        oof = np.zeros((n_repeats, len(y)))
        if progress:
            progress(step / total, f"{display}: {len(folds)} cross-validation folds")
        # Outer folds are independent: run them on all CPU cores.
        results = Parallel(n_jobs=-1)(
            delayed(_fit_fold)(key, numeric, categorical, seed, f, X.iloc[tr], y[tr], X.iloc[te]) for f, (tr, te) in enumerate(folds)
        )
        for f, ((_, te), (probs, _)) in enumerate(zip(folds, results)):
            oof[f // n_splits, te] = probs
        step += len(folds)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            pipe, grid = make_pipeline(key, numeric, categorical, seed)
            final = _tuned(pipe, grid, seed)
            final.fit(X, y)
        step += 1
        finals[key] = final.best_estimator_ if hasattr(final, "best_estimator_") else final
        best_params = {k.replace("model__estimator__", "").replace("model__", ""): v for k, v in getattr(final, "best_params_", {}).items()}
        oof_by_model[key] = oof
        metrics[key] = _metric(key, display, y, oof, threshold, float(np.mean([r[1] for r in results])), best_params, n_splits, n_repeats, seed)

    # Soft-voting ensemble: averaging members' out-of-fold probabilities is exactly the ensemble's
    # out-of-fold prediction, because every member's prediction for a patient excludes that patient.
    members = [k for k in model_keys if k != "dummy"]
    if len(members) >= 2:
        oof = np.mean([oof_by_model[k] for k in members], axis=0)
        finals["ensemble"] = AveragingEnsemble([finals[k] for k in members])
        metrics["ensemble"] = _metric(
            "ensemble", f"Soft-voting ensemble ({len(members)} models)", y, oof, threshold, 0.0,
            {"members": members}, n_splits, n_repeats, seed,
        )

    summary = {
        "method": f"{n_repeats}×{n_splits}-fold repeated stratified cross-validation; hyper-parameters tuned by inner 3-fold CV on each training fold; 95% CIs from 1,000 bootstrap resamples of out-of-fold predictions.",
        "n_samples": int(len(y)),
        "class_counts": {"0": int((y == 0).sum()), "1": int((y == 1).sum())},
        "numeric_features": numeric,
        "categorical_features": categorical,
    }
    return metrics, finals, summary
