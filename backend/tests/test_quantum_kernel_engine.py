"""Test GPU Quantum Kernel Engine against Qiskit FidelityQuantumKernel."""
import numpy as np
import pytest

from app.core.quantum.kernel_engine import GPUQuantumKernelEngine

try:
    from qiskit.circuit.library import zz_feature_map
    from qiskit_machine_learning.kernels import FidelityQuantumKernel
    QISKIT_ML_AVAILABLE = True
except ImportError:
    QISKIT_ML_AVAILABLE = False


@pytest.mark.skipif(not QISKIT_ML_AVAILABLE, reason="Qiskit Machine Learning not installed")
def test_kernel_engine_matches_fidelity_quantum_kernel():
    rng = np.random.default_rng(42)
    n_qubits = 3
    n_samples = 8
    X = rng.uniform(0, np.pi, size=(n_samples, n_qubits))

    engine = GPUQuantumKernelEngine(prefer_gpu=True)
    K_engine, telemetry = engine.evaluate(X, n_qubits=n_qubits, reps=1, bandwidth=1.0)

    # Reference Qiskit FidelityQuantumKernel
    fmap = zz_feature_map(feature_dimension=n_qubits, reps=1, entanglement="linear")
    kernel_ref = FidelityQuantumKernel(feature_map=fmap)
    K_ref = kernel_ref.evaluate(x_vec=X, y_vec=X)

    # Must match to < 1e-6 (per Task A specification)
    diff = np.max(np.abs(K_engine - K_ref))
    assert diff < 1e-6, f"Max difference {diff} exceeds tolerance 1e-6"
    assert np.allclose(np.diag(K_engine), 1.0)
    assert telemetry["n_qubits"] == n_qubits
    assert telemetry["samples_shape"] == (n_samples, n_samples)
    assert telemetry["device"] in ("GPU", "CPU")


@pytest.mark.skipif(not QISKIT_ML_AVAILABLE, reason="Qiskit Machine Learning not installed")
def test_kernel_engine_rectangular_and_bandwidth():
    rng = np.random.default_rng(123)
    n_qubits = 2
    X1 = rng.uniform(0, np.pi, size=(5, n_qubits))
    X2 = rng.uniform(0, np.pi, size=(4, n_qubits))
    bandwidth = 0.5

    engine = GPUQuantumKernelEngine()
    K_rect, _ = engine.evaluate(X1, X2, n_qubits=n_qubits, reps=1, bandwidth=bandwidth)

    fmap = zz_feature_map(feature_dimension=n_qubits, reps=1, entanglement="linear")
    kernel_ref = FidelityQuantumKernel(feature_map=fmap)
    K_ref = kernel_ref.evaluate(x_vec=X1 * bandwidth, y_vec=X2 * bandwidth)

    diff = np.max(np.abs(K_rect - K_ref))
    assert diff < 1e-6, f"Rectangular max difference {diff} exceeds tolerance 1e-6"
    assert K_rect.shape == (5, 4)

