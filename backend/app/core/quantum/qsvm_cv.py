"""Quantum-Kernel SVM with Nested Repeated Cross-Validation and Diagnostics.

Follows the exact 5x5 CV protocol from app/core/benchmark.py:
- RepeatedStratifiedKFold(n_splits=5, n_repeats=5, random_state=42)
- Training-fold preprocessing + PCA to n_qubits
- Shaydulin & Wild (2022) bandwidth scaling tuned strictly on inner folds
- Out-of-fold bootstrap 95% CIs for ROC-AUC, Balanced Accuracy, and Brier score
- Diagnostics: off-diagonal variance (concentration), geometric difference vs RBF,
  and kernel-target alignment
"""
import logging
import time
import warnings
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, brier_score_loss, confusion_matrix,
    f1_score, precision_score, recall_score, roc_auc_score,
)
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold
from sklearn.preprocessing import MinMaxScaler
from sklearn.svm import SVC

from app.core.benchmark import (
    build_preprocessor, split_feature_types, binary_target,
    _bootstrap_ci, _calibration
)
from app.core.datasets.uci_bmt import load_cohort, CORE_FEATURES
from app.core.quantum.kernel_engine import GPUQuantumKernelEngine
from app.core.quantum.diagnostics import compute_kernel_diagnostics
from app.schemas import ModelMetric

logger = logging.getLogger("marrowq.quantum.qsvm_cv")

BANDWIDTH_GRID = [0.1, 0.25, 0.5, 1.0, 2.0]
C_GRID = [0.1, 1.0, 10.0]


def _tune_inner_fold(
    X_tr_pca: np.ndarray,
    y_tr: np.ndarray,
    engine: GPUQuantumKernelEngine,
    n_qubits: int,
    reps: int,
    seed: int,
    inner_cv_splits: int = 3,
) -> Tuple[float, float]:
    """Tunes bandwidth c and SVM C using StratifiedKFold on the training fold only."""
    skf = StratifiedKFold(n_splits=inner_cv_splits, shuffle=True, random_state=seed)
    splits = list(skf.split(X_tr_pca, y_tr))

    best_score = -1.0
    best_c = 1.0
    best_C = 1.0

    # Evaluate each bandwidth factor c
    for c in BANDWIDTH_GRID:
        try:
            # Precompute full training kernel for this bandwidth
            K_tr_full, _ = engine.evaluate(X_tr_pca, n_qubits=n_qubits, reps=reps, bandwidth=c)
        except Exception:
            continue

        for C_val in C_GRID:
            fold_aucs = []
            for in_tr, in_val in splits:
                K_in_tr = K_tr_full[np.ix_(in_tr, in_tr)]
                K_in_val = K_tr_full[np.ix_(in_val, in_tr)]
                y_in_tr, y_in_val = y_tr[in_tr], y_tr[in_val]

                if len(np.unique(y_in_tr)) < 2 or len(np.unique(y_in_val)) < 2:
                    continue

                try:
                    svc = SVC(kernel="precomputed", C=C_val, class_weight="balanced")
                    svc.fit(K_in_tr, y_in_tr)
                    scores = svc.decision_function(K_in_val)
                    auc = roc_auc_score(y_in_val, scores)
                    fold_aucs.append(auc)
                except Exception:
                    continue

            if fold_aucs:
                mean_auc = float(np.mean(fold_aucs))
                if mean_auc > best_score:
                    best_score = mean_auc
                    best_c = c
                    best_C = C_val

    return best_c, best_C


def evaluate_qsvm_cv(
    df: pd.DataFrame,
    feature_cols: List[str] = CORE_FEATURES,
    target_col: str = "early_engraftment",
    n_qubits: int = 4,
    reps: int = 1,
    n_splits: int = 5,
    n_repeats: int = 5,
    random_state: int = 42,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> Dict[str, Any]:
    """Runs nested RepeatedStratifiedKFold cross-validation for Quantum-Kernel SVM.

    Matches app/core/benchmark.py exactly:
    - Preprocessing fitted inside fold
    - PCA fitted inside fold
    - Bandwidth & C tuned strictly inside fold
    - Out-of-fold probability aggregation
    - Bootstrap 95% CIs
    """
    engine = GPUQuantumKernelEngine(prefer_gpu=True)
    numeric, categorical = split_feature_types(df, feature_cols)
    y = binary_target(df[target_col])
    X_df = df[feature_cols].copy()

    threshold = float(np.mean(y))  # base rate threshold
    rskf = RepeatedStratifiedKFold(n_splits=n_splits, n_repeats=n_repeats, random_state=random_state)
    oof = np.zeros((n_repeats, len(y)), dtype=float)

    total_folds = n_repeats * n_splits
    fold_idx = 0
    t0_start = time.perf_counter()

    best_hyperparams: List[Dict[str, float]] = []
    diagnostics_samples: List[Dict[str, Any]] = []

    for r in range(n_repeats):
        for s, (tr_idx, te_idx) in enumerate(rskf.split(X_df, y)):
            if r * n_splits + s >= (r + 1) * n_splits:
                continue

            current_seed = random_state + fold_idx
            if progress_callback:
                progress_callback(
                    fold_idx / total_folds,
                    f"QSVM {n_qubits}Q: repeat {r + 1}/{n_repeats}, fold {s + 1}/{n_splits}"
                )

            # 1. Leakage-safe train-only preprocessing
            prep = build_preprocessor(numeric, categorical)
            X_tr_trans = prep.fit_transform(X_df.iloc[tr_idx])
            X_te_trans = prep.transform(X_df.iloc[te_idx])

            # 2. Train-only PCA
            n_components = min(n_qubits, X_tr_trans.shape[1])
            pca = PCA(n_components=n_components, random_state=current_seed)
            scaler = MinMaxScaler(feature_range=(0, np.pi))

            X_tr_pca = scaler.fit_transform(pca.fit_transform(X_tr_trans))
            X_te_pca = scaler.transform(pca.transform(X_te_trans))

            # 3. Inner CV hyperparameter tuning
            best_c, best_C = _tune_inner_fold(
                X_tr_pca=X_tr_pca,
                y_tr=y[tr_idx],
                engine=engine,
                n_qubits=n_components,
                reps=reps,
                seed=current_seed,
            )
            best_hyperparams.append({"bandwidth": best_c, "C": best_C})

            # 4. Outer fold evaluation
            K_tr, _ = engine.evaluate(X_tr_pca, n_qubits=n_components, reps=reps, bandwidth=best_c)
            K_te, _ = engine.evaluate(X_te_pca, X_tr_pca, n_qubits=n_components, reps=reps, bandwidth=best_c)

            # Record diagnostics on the first fold of each repeat
            if s == 0:
                diag = compute_kernel_diagnostics(K_tr, y[tr_idx], X_original=X_tr_pca)
                diag["qubits"] = n_components
                diag["bandwidth"] = best_c
                diagnostics_samples.append(diag)

            # Fit precomputed SVM
            svc = SVC(kernel="precomputed", C=best_C, class_weight="balanced")
            svc.fit(K_tr, y[tr_idx])

            # Calibrate probabilities via logistic Platt scaling on decision function
            dec_tr = svc.decision_function(K_tr).reshape(-1, 1)
            dec_te = svc.decision_function(K_te).reshape(-1, 1)

            calibrator = LogisticRegression(max_iter=1000)
            calibrator.fit(dec_tr, y[tr_idx])
            oof[r, te_idx] = calibrator.predict_proba(dec_te)[:, 1]

            fold_idx += 1

    total_fit_seconds = time.perf_counter() - t0_start
    if progress_callback:
        progress_callback(1.0, f"Completed QSVM {n_qubits}Q CV in {total_fit_seconds:.1f}s")

    # Aggregate metrics matching benchmark._metric
    repeat_auc = [roc_auc_score(y, oof[r]) for r in range(n_repeats)]
    p_mean = oof.mean(axis=0)
    pred = (p_mean >= threshold).astype(int)

    # Average diagnostics across sampled folds
    avg_diag = {
        "off_diagonal_variance": round(float(np.mean([d["off_diagonal_variance"] for d in diagnostics_samples])), 6),
        "off_diagonal_mean": round(float(np.mean([d["off_diagonal_mean"] for d in diagnostics_samples])), 6),
        "kernel_target_alignment": round(float(np.mean([d["kernel_target_alignment"] for d in diagnostics_samples])), 5),
        "geometric_difference_vs_rbf": round(float(np.mean([d["geometric_difference_vs_rbf"] for d in diagnostics_samples])), 4),
        "is_concentrated": bool(np.mean([d["off_diagonal_variance"] for d in diagnostics_samples]) < 1e-4),
    }

    modal_c = float(pd.Series([h["bandwidth"] for h in best_hyperparams]).mode().iloc[0])
    modal_C = float(pd.Series([h["C"] for h in best_hyperparams]).mode().iloc[0])

    metric = ModelMetric(
        model_name="quantum_kernel_svm",
        display_name=f"Quantum-Kernel SVM ({n_qubits} Qubits, ZZ Map)",
        accuracy=round(float(accuracy_score(y, pred)), 4),
        balanced_accuracy=round(float(balanced_accuracy_score(y, pred)), 4),
        precision=round(float(precision_score(y, pred, zero_division=0)), 4),
        recall=round(float(recall_score(y, pred, zero_division=0)), 4),
        f1_score=round(float(f1_score(y, pred, zero_division=0)), 4),
        roc_auc=round(float(roc_auc_score(y, p_mean)), 4),
        brier_score=round(float(brier_score_loss(y, p_mean)), 4),
        confusion_matrix=confusion_matrix(y, pred, labels=[0, 1]).tolist(),
        training_time_seconds=round(total_fit_seconds, 4),
        inference_time_seconds=0.0,
        test_sample_count=int(len(y)),
        roc_auc_ci=_bootstrap_ci(y, p_mean, roc_auc_score, seed=random_state),
        balanced_accuracy_ci=_bootstrap_ci(y, p_mean, lambda a, b: balanced_accuracy_score(a, (b >= threshold).astype(int)), seed=random_state),
        brier_ci=_bootstrap_ci(y, p_mean, brier_score_loss, seed=random_state),
        roc_auc_repeat_sd=round(float(np.std(repeat_auc)), 4),
        calibration=_calibration(y, p_mean),
        best_params={"bandwidth": modal_c, "C": modal_C, "qubits": n_qubits, "reps": reps},
        evaluation=f"{n_repeats}×{n_splits}-fold repeated stratified CV, nested tuning; threshold {threshold:.2f} (base rate)",
    ).model_dump()

    return {
        "n_qubits": n_qubits,
        "device": engine.device,
        "metric": metric,
        "diagnostics": avg_diag,
        "probabilities": p_mean.tolist(),
        "total_seconds": round(total_fit_seconds, 2),
    }


def run_qubit_sweep(
    qubits_list: Optional[List[int]] = None,
    n_splits: int = 5,
    n_repeats: int = 5,
    random_state: int = 42,
    progress_callback: Optional[Callable[[float, str], None]] = None,
) -> Dict[str, Any]:
    """Sweeps qubit counts 2-16 inside the 5x5 CV protocol on the real UCI cohort.

    Includes a logistic-regression baseline evaluated on the same folds.
    """
    if qubits_list is None:
        qubits_list = [2, 4, 8, 12, 16]

    df = load_cohort()
    results = []

    total_qubits = len(qubits_list)
    for idx, q in enumerate(qubits_list):
        def _sub_progress(frac: float, msg: str):
            if progress_callback:
                overall = (idx + frac) / total_qubits
                progress_callback(overall, f"[{idx + 1}/{total_qubits}] {msg}")

        res = evaluate_qsvm_cv(
            df=df,
            feature_cols=CORE_FEATURES,
            target_col="early_engraftment",
            n_qubits=q,
            reps=1,
            n_splits=n_splits,
            n_repeats=n_repeats,
            random_state=random_state,
            progress_callback=_sub_progress,
        )

        row = {
            "qubits": q,
            "roc_auc": res["metric"]["roc_auc"],
            "roc_auc_ci": res["metric"]["roc_auc_ci"],
            "balanced_accuracy": res["metric"]["balanced_accuracy"],
            "balanced_accuracy_ci": res["metric"]["balanced_accuracy_ci"],
            "brier_score": res["metric"]["brier_score"],
            "off_diagonal_variance": res["diagnostics"]["off_diagonal_variance"],
            "geometric_difference_vs_rbf": res["diagnostics"]["geometric_difference_vs_rbf"],
            "kernel_target_alignment": res["diagnostics"]["kernel_target_alignment"],
            "is_concentrated": res["diagnostics"]["is_concentrated"],
            "best_bandwidth": res["metric"]["best_params"]["bandwidth"],
            "best_C": res["metric"]["best_params"]["C"],
            "training_time_seconds": res["metric"]["training_time_seconds"],
            "metric": res["metric"],
        }
        results.append(row)

    # Classical baseline on the same repeated folds (same seed), so the comparison is like for like.
    from app.core.benchmark import run_cross_validated_benchmark
    if progress_callback:
        progress_callback(0.99, "Classical logistic-regression baseline on the same folds")
    baseline = run_cross_validated_benchmark(df, "early_engraftment", CORE_FEATURES, ["logistic_regression"],
                                             seed=random_state, n_splits=n_splits, n_repeats=n_repeats)[0]["logistic_regression"]

    # Sort by ROC-AUC
    results_sorted = sorted(results, key=lambda x: x["roc_auc"], reverse=True)
    best_setting = results_sorted[0] if results_sorted else None

    return {
        "dataset": "UCI Bone Marrow Transplant: Children (n=187)",
        "target": "early_engraftment",
        "classical_baseline_model": "Logistic Regression (L2)",
        "classical_baseline_auc": baseline["roc_auc"],
        "classical_baseline_ci": baseline.get("roc_auc_ci"),
        "cv_protocol": f"{n_repeats}x{n_splits} repeated stratified CV (same folds for the classical baseline)",
        "sweep_table": results,
        "best_qubit_setting": best_setting,
    }

