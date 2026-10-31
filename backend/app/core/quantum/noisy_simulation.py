"""Noisy quantum simulation on GPU using Heron Fake Backend (FakeFez).

Replaces heuristic Gaussian shot noise with genuine NISQ noise modeling:
- Physical gate error rates (CZ / SX / X)
- Thermal relaxation (T1, T2)
- Readout measurement errors
- Measured via inversion test U(x_i) U(x_j)^dagger with all-zeros bitstring detection
"""
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("marrowq.quantum.noisy_simulation")

try:
    from qiskit import QuantumCircuit, transpile
    from qiskit.circuit.library import zz_feature_map, z_feature_map
    from qiskit_aer import AerSimulator
    from qiskit_ibm_runtime.fake_provider import FakeFez
    HAS_NOISY_COMPONENTS = True
except ImportError:
    HAS_NOISY_COMPONENTS = False
    FakeFez = None

from app.core.quantum.kernel_engine import GPUQuantumKernelEngine
from app.core.quantum.diagnostics import compute_kernel_diagnostics


class HeronNoisySimulator:
    """Simulates quantum kernels under realistic 156-qubit IBM Heron (FakeFez) noise."""

    def __init__(self, prefer_gpu: bool = True, default_shots: int = 1024):
        self.prefer_gpu = prefer_gpu
        self.default_shots = default_shots
        self._device = "CPU"
        self._simulator = None
        self._fake_backend = None
        self._initialize_simulator()

    def _initialize_simulator(self) -> None:
        if not HAS_NOISY_COMPONENTS:
            logger.warning("FakeFez or Qiskit Aer is not available in environment")
            return

        try:
            self._fake_backend = FakeFez()
            target_device = "GPU" if self.prefer_gpu and "GPU" in AerSimulator().available_devices() else "CPU"
            try:
                self._simulator = AerSimulator.from_backend(self._fake_backend, device=target_device)
                self._device = target_device
            except Exception as exc:
                logger.warning("GPU AerSimulator.from_backend failed (%s), falling back to CPU", exc)
                self._simulator = AerSimulator.from_backend(self._fake_backend, device="CPU")
                self._device = "CPU"
        except Exception as exc:
            logger.error("Failed to initialize Heron FakeFez simulator: %s", exc)

    @property
    def device(self) -> str:
        return self._device

    @property
    def is_available(self) -> bool:
        return self._simulator is not None

    def evaluate_noisy_pair_fidelity(
        self,
        x1: np.ndarray,
        x2: np.ndarray,
        n_qubits: int,
        reps: int = 1,
        shots: Optional[int] = None,
        bandwidth: float = 1.0,
    ) -> float:
        """Evaluates fidelity between two samples via noisy inversion test."""
        if not self.is_available:
            raise RuntimeError("HeronNoisySimulator is not available")

        num_shots = shots or self.default_shots
        x1_scaled = np.asarray(x1, dtype=float) * bandwidth
        x2_scaled = np.asarray(x2, dtype=float) * bandwidth

        fmap = zz_feature_map(feature_dimension=n_qubits, reps=reps, entanglement="linear")
        u1 = fmap.assign_parameters(x1_scaled)
        u2 = fmap.assign_parameters(x2_scaled)

        # Inversion circuit: U(x1) @ U(x2)^dagger
        inv_circuit = QuantumCircuit(n_qubits, n_qubits)
        inv_circuit.compose(u1, inplace=True)
        inv_circuit.compose(u2.inverse(), inplace=True)
        inv_circuit.measure(range(n_qubits), range(n_qubits))

        compiled = transpile(inv_circuit, self._simulator)
        job = self._simulator.run(compiled, shots=num_shots)
        counts = job.result().get_counts()

        zero_target = "0" * n_qubits
        zero_counts = counts.get(zero_target, 0)
        return float(zero_counts / num_shots)

    def evaluate_noisy_kernel_matrix(
        self,
        X1: np.ndarray,
        X2: Optional[np.ndarray] = None,
        n_qubits: Optional[int] = None,
        reps: int = 1,
        shots: Optional[int] = None,
        bandwidth: float = 1.0,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Evaluates the full noisy Gram matrix for X1 (and optionally X2)."""
        if not self.is_available:
            raise RuntimeError("HeronNoisySimulator is not available")

        t0 = time.perf_counter()
        num_shots = shots or self.default_shots
        X1 = np.asarray(X1, dtype=float)
        N1 = len(X1)
        if n_qubits is None:
            n_qubits = X1.shape[1]

        is_symmetric = X2 is None or X2 is X1
        X2 = X1 if is_symmetric else np.asarray(X2, dtype=float)
        N2 = len(X2)

        K_noisy = np.zeros((N1, N2), dtype=float)
        circuits: List[QuantumCircuit] = []
        coord_map: List[Tuple[int, int]] = []

        fmap = zz_feature_map(feature_dimension=n_qubits, reps=reps, entanglement="linear")

        # Build pair circuits
        for i in range(N1):
            x1_scaled = X1[i] * bandwidth
            u1 = fmap.assign_parameters(x1_scaled)
            end_j = (i + 1) if is_symmetric else N2

            for j in range(end_j):
                x2_scaled = X2[j] * bandwidth
                u2 = fmap.assign_parameters(x2_scaled)

                qc = QuantumCircuit(n_qubits, n_qubits)
                qc.compose(u1, inplace=True)
                qc.compose(u2.inverse(), inplace=True)
                qc.measure(range(n_qubits), range(n_qubits))

                circuits.append(qc)
                coord_map.append((i, j))

        # Transpile batch against Heron noise model and basis gates
        compiled_circuits = transpile(circuits, self._simulator)
        job = self._simulator.run(compiled_circuits, shots=num_shots)
        result = job.result()

        zero_target = "0" * n_qubits
        for idx, (i, j) in enumerate(coord_map):
            counts = result.get_counts(idx)
            val = float(counts.get(zero_target, 0) / num_shots)
            K_noisy[i, j] = val
            if is_symmetric:
                K_noisy[j, i] = val

        np.clip(K_noisy, 0.0, 1.0, out=K_noisy)
        elapsed = time.perf_counter() - t0

        telemetry = {
            "device": self._device,
            "noise_model": "FakeFez (156-qubit Heron)",
            "n_qubits": n_qubits,
            "shots": num_shots,
            "bandwidth": bandwidth,
            "shape": (N1, N2),
            "elapsed_seconds": round(elapsed, 4),
            "diagonal_mean": round(float(np.mean(np.diag(K_noisy))), 4) if is_symmetric else None,
        }
        return K_noisy, telemetry


def compare_ideal_vs_noisy(
    X: np.ndarray,
    y: np.ndarray,
    n_qubits: int = 4,
    shots: int = 1024,
    bandwidth: float = 1.0,
    reps: int = 1,
) -> Dict[str, Any]:
    """Compares ideal statevector simulation vs Heron FakeFez noisy simulation.

    Computes:
    - Frobenius error: ||K_noisy - K_ideal||_F / ||K_ideal||_F
    - Mean absolute error: mean(|K_noisy - K_ideal|)
    - Diagonal readout/gate degradation: 1.0 - mean(diag(K_noisy))
    - Alignment: A(K_ideal, y) vs A(K_noisy, y)
    """
    ideal_engine = GPUQuantumKernelEngine(prefer_gpu=True)
    noisy_sim = HeronNoisySimulator(prefer_gpu=True, default_shots=shots)

    K_ideal, ideal_meta = ideal_engine.evaluate(X, n_qubits=n_qubits, reps=reps, bandwidth=bandwidth)
    K_noisy, noisy_meta = noisy_sim.evaluate_noisy_kernel_matrix(X, n_qubits=n_qubits, reps=reps, shots=shots, bandwidth=bandwidth)

    # Frobenius error
    frob_ideal = float(np.linalg.norm(K_ideal, "fro"))
    diff_frob = float(np.linalg.norm(K_noisy - K_ideal, "fro"))
    relative_frob_error = diff_frob / frob_ideal if frob_ideal > 0 else 0.0
    mae = float(np.mean(np.abs(K_noisy - K_ideal)))

    ideal_diag = compute_kernel_diagnostics(K_ideal, y, X_original=X)
    noisy_diag = compute_kernel_diagnostics(K_noisy, y, X_original=X)

    diag_attenuation = float(1.0 - np.mean(np.diag(K_noisy)))

    return {
        "n_samples": len(X),
        "n_qubits": n_qubits,
        "shots": shots,
        "ideal_telemetry": ideal_meta,
        "noisy_telemetry": noisy_meta,
        "relative_frobenius_error": round(relative_frob_error, 5),
        "mean_absolute_error": round(mae, 5),
        "diagonal_attenuation": round(diag_attenuation, 4),
        "ideal_alignment": ideal_diag["kernel_target_alignment"],
        "noisy_alignment": noisy_diag["kernel_target_alignment"],
        "ideal_geometric_difference": ideal_diag["geometric_difference_vs_rbf"],
        "noisy_geometric_difference": noisy_diag["geometric_difference_vs_rbf"],
        "ideal_matrix_preview": K_ideal[:5, :5].round(4).tolist(),
        "noisy_matrix_preview": K_noisy[:5, :5].round(4).tolist(),
    }

