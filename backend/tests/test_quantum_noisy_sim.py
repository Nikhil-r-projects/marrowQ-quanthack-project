"""Tests for Heron Fake Backend (FakeFez) noisy simulation."""
import numpy as np
import pytest

from app.core.quantum.noisy_simulation import HeronNoisySimulator, compare_ideal_vs_noisy


def test_heron_noisy_simulator_initialization():
    sim = HeronNoisySimulator(prefer_gpu=True)
    assert sim.is_available is True
    assert sim.device in ("GPU", "CPU")


def test_noisy_pair_and_matrix_evaluation():
    sim = HeronNoisySimulator(default_shots=512)
    x1 = np.array([0.5, 1.2])
    x2 = np.array([0.5, 1.2])

    # Identical state fidelity under noise should be high but <= 1.0 due to gate/readout errors
    fid_same = sim.evaluate_noisy_pair_fidelity(x1, x2, n_qubits=2, shots=512)
    assert 0.70 <= fid_same <= 1.0

    X = np.array([
        [0.1, 0.2],
        [1.5, 0.8],
        [2.3, 3.1]
    ])
    K_noisy, telemetry = sim.evaluate_noisy_kernel_matrix(X, n_qubits=2, shots=512)
    assert K_noisy.shape == (3, 3)
    assert telemetry["noise_model"] == "FakeFez (156-qubit Heron)"
    assert np.all(K_noisy >= 0.0) and np.all(K_noisy <= 1.0)


def test_compare_ideal_vs_noisy():
    rng = np.random.default_rng(42)
    X = rng.uniform(0, np.pi, size=(4, 2))
    y = np.array([0, 0, 1, 1])

    res = compare_ideal_vs_noisy(X, y, n_qubits=2, shots=512)
    assert res["n_samples"] == 4
    assert res["n_qubits"] == 2
    assert "relative_frobenius_error" in res
    assert res["relative_frobenius_error"] >= 0.0
    assert "diagonal_attenuation" in res
    assert "ideal_alignment" in res
    assert "noisy_alignment" in res

