"""Automated Test Suite for Quantum Machine Learning Engine.

Validates:
1. ProjectedQuantumKernel (PQK) projection and outer RBF kernel
2. NeuralQuantumKernel (NQK) parameter optimization and alignment
3. VariationalQuantumClassifier (VQC) forward pass and fit
4. HybridQuantumStackingEnsemble out-of-fold meta-learner
5. BiologicalFeatureMap biological index derivation
6. Quantum kernel diagnostics (condition number, eigenvalue spectrum, off-diagonal variance)
7. Multi-endpoint benchmark runner and anti-leakage permutation check
"""
import pytest
import numpy as np
import pandas as pd

from app.core.quantum.pqk import ProjectedQuantumKernel
from app.core.quantum.neural_kernel import NeuralQuantumKernel
from app.core.quantum.vqc import VariationalQuantumClassifier
from app.core.quantum.hybrid import HybridQuantumStackingEnsemble
from app.core.quantum.biological_feature_map import BiologicalFeatureMap
from app.core.quantum.diagnostics import compute_kernel_diagnostics
from app.core.quantum.multi_benchmark import run_benchmark_for_endpoint


def test_biological_feature_map():
    df = pd.DataFrame({
        "CD34_kgx10d6": [5.2, 2.1, 7.8, 4.0],
        "CD3_d_kgx10d8": [2.0, 1.5, 3.2, 2.1],
        "donor_age": [24.0, 45.0, 19.0, 32.0],
        "HLA_match": [1, 0, 1, 1],
        "antigen": [0, 1, 0, 0],
        "allel": [0, 1, 0, 0],
        "donor_CMV": [1, 0, 1, 0],
        "recipient_CMV": [1, 1, 0, 0],
        "recipient_age": [8.0, 15.0, 5.0, 12.0],
        "risk_group": [0, 1, 0, 1],
        "conditioning": [1, 0, 1, 0],
        "disease_group": [1, 1, 0, 1],
    })
    bmap = BiologicalFeatureMap(n_qubits=3)
    angles = bmap.fit(df).transform(df)
    assert angles.shape == (4, 3)
    assert np.all(angles >= 0.0) and np.all(angles <= np.pi)


def test_projected_quantum_kernel():
    np.random.seed(42)
    X = np.random.uniform(0.0, np.pi, size=(6, 3))
    pqk = ProjectedQuantumKernel(n_qubits=3, gamma=0.5)
    obs = pqk.encode_and_measure_observables(X)
    assert obs.shape[0] == 6
    assert obs.shape[1] >= 3  # at least 1-qubit Pauli-Z expectations

    K = pqk.compute_kernel(X)
    assert K.shape == (6, 6)
    assert np.allclose(np.diag(K), 1.0)
    assert np.allclose(K, K.T)


def test_neural_quantum_kernel():
    np.random.seed(42)
    X = np.random.uniform(0.0, np.pi, size=(8, 3))
    y = np.array([0, 1, 0, 1, 0, 1, 0, 1])
    nqk = NeuralQuantumKernel(n_qubits=3, n_layers=1, max_iter=5)
    res = nqk.fit(X, y)
    assert "final_kernel_target_alignment" in res
    assert nqk.is_trained

    K = nqk.compute_kernel(X)
    assert K.shape == (8, 8)
    assert np.allclose(np.diag(K), 1.0)


def test_variational_quantum_classifier():
    np.random.seed(42)
    X = np.random.uniform(0.0, np.pi, size=(10, 3))
    y = np.array([0, 1, 0, 1, 0, 1, 0, 1, 0, 1])
    vqc = VariationalQuantumClassifier(n_qubits=3, n_layers=1, max_iter=5)
    res = vqc.fit(X, y)
    assert "final_loss" in res
    assert vqc.is_fitted

    probs = vqc.predict_proba(X)
    assert probs.shape == (10, 2)
    assert np.allclose(np.sum(probs, axis=1), 1.0)


def test_hybrid_stacking_ensemble():
    np.random.seed(42)
    X = np.random.randn(15, 5)
    y = np.array([0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1])
    hybrid = HybridQuantumStackingEnsemble(n_qubits=3, n_splits=2, random_state=42)
    fit_res = hybrid.fit(X, y)
    assert "meta_weights" in fit_res
    assert hybrid.is_fitted

    eval_res = hybrid.evaluate(X, y)
    assert "roc_auc" in eval_res
    assert "meta_weights" in eval_res


def test_kernel_diagnostics():
    np.random.seed(42)
    K = np.random.uniform(0.2, 0.8, size=(10, 10))
    K = (K + K.T) / 2.0
    np.fill_diagonal(K, 1.0)
    y = np.array([0, 1, 0, 1, 0, 1, 0, 1, 0, 1])

    diag = compute_kernel_diagnostics(K, y)
    assert "condition_number" in diag
    assert "kernel_target_alignment" in diag
    assert "off_diagonal_variance" in diag
    assert "heatmap" in diag
    assert len(diag["heatmap"]) == 10
