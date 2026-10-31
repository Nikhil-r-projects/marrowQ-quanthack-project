"""Tests for QSVM nested CV and kernel diagnostics."""
import numpy as np
import pytest

from app.core.datasets.uci_bmt import load_cohort, CORE_FEATURES
from app.core.quantum.diagnostics import (
    kernel_off_diagonal_variance,
    kernel_target_alignment,
    geometric_difference,
    compute_kernel_diagnostics,
)
from app.core.quantum.qsvm_cv import evaluate_qsvm_cv


def test_kernel_diagnostics_calculation():
    # Identity matrix (extreme concentration)
    K_id = np.eye(5)
    var_res = kernel_off_diagonal_variance(K_id)
    assert var_res["off_diagonal_variance"] == 0.0
    assert var_res["off_diagonal_mean"] == 0.0

    # Non-trivial Gram matrix
    rng = np.random.default_rng(42)
    A = rng.normal(size=(6, 3))
    K = A @ A.T
    diag_inv = 1.0 / np.sqrt(np.diag(K))
    K_norm = K * np.outer(diag_inv, diag_inv)

    y = np.array([0, 0, 0, 1, 1, 1])
    diag = compute_kernel_diagnostics(K_norm, y, X_original=A)

    assert 0.0 <= diag["off_diagonal_variance"] <= 1.0
    assert -1.0 <= diag["kernel_target_alignment"] <= 1.0
    assert diag["geometric_difference_vs_rbf"] > 0.0


def test_qsvm_cv_execution_and_schema():
    df = load_cohort()
    # Fast test run: 2 splits, 1 repeat, 2 qubits
    res = evaluate_qsvm_cv(
        df=df,
        feature_cols=CORE_FEATURES,
        target_col="early_engraftment",
        n_qubits=2,
        reps=1,
        n_splits=2,
        n_repeats=1,
        random_state=42,
    )

    assert res["n_qubits"] == 2
    assert "metric" in res
    m = res["metric"]

    # Verify standard ModelMetric fields are populated
    assert m["model_name"] == "quantum_kernel_svm"
    assert 0.0 <= m["roc_auc"] <= 1.0
    assert m["roc_auc_ci"] is not None and len(m["roc_auc_ci"]) == 2
    assert m["roc_auc_ci"][0] <= m["roc_auc_ci"][1]
    assert m["balanced_accuracy_ci"] is not None
    assert "evaluation" in m and "repeated stratified CV" in m["evaluation"]
    assert "diagnostics" in res
    assert "kernel_target_alignment" in res["diagnostics"]
    assert "geometric_difference_vs_rbf" in res["diagnostics"]

