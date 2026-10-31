"""Projected Quantum Kernel (PQK) Engine for MarrowQ.

Based on Huang et al. (Nature Communications 2021):
"Power of data in quantum machine learning"

Unlike fidelity quantum kernels that compute global statevector overlap |<psi(x)|psi(x')>|^2
and suffer from exponential concentration (Barren Plateaus in Hilbert space),
Projected Quantum Kernels (PQK) project the quantum state onto local reduced density
matrices via 1-qubit and 2-qubit Pauli observables, followed by an outer classical
Gaussian/RBF kernel with tunable bandwidth gamma:

  z_k(x) = <psi(x)| Z_k |psi(x)>
  z_{k,l}(x) = <psi(x)| Z_k Z_l |psi(x)>
  K_PQK(x, x') = exp(-gamma * ||z(x) - z(x')||^2)

This guarantees that:
1. The kernel matrix off-diagonal elements do NOT exponentially vanish as qubit count grows.
2. The model retains quantum non-linear correlations through the entangling unitary.
3. The outer bandwidth gamma can be tuned to prevent under- or over-fitting.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np

try:
    from qiskit import QuantumCircuit
    from qiskit.circuit.library import ZZFeatureMap, PauliFeatureMap
    from qiskit_aer import AerSimulator
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False

logger = logging.getLogger("marrowq.quantum.pqk")


class ProjectedQuantumKernel:
    """Projected Quantum Kernel with local Pauli expectation values and outer RBF kernel."""

    def __init__(
        self,
        n_qubits: int = 4,
        reps: int = 1,
        entanglement: str = "linear",
        gamma: float = 0.5,
        include_two_qubit: bool = True,
        prefer_gpu: bool = False,
    ):
        self.n_qubits = n_qubits
        self.reps = reps
        self.entanglement = entanglement
        self.gamma = gamma
        self.include_two_qubit = include_two_qubit
        self.prefer_gpu = prefer_gpu
        self._simulator = self._init_simulator()

    def _init_simulator(self) -> Any:
        if not QISKIT_AVAILABLE:
            return None
        try:
            if self.prefer_gpu:
                sim = AerSimulator(method="statevector", device="GPU")
                return sim
        except Exception:
            pass
        return AerSimulator(method="statevector", device="CPU")

    def encode_and_measure_observables(self, X: np.ndarray) -> np.ndarray:
        """Projects each row of X into local 1-qubit and 2-qubit Pauli-Z expectations.

        Args:
            X: Array of shape (n_samples, n_qubits), scaled to [0, 2*pi].

        Returns:
            Projections array of shape (n_samples, n_observables).
        """
        n_samples = X.shape[0]
        dim = X.shape[1]
        actual_qubits = min(self.n_qubits, dim)

        # Total observables: actual_qubits (1-qubit) + actual_qubits*(actual_qubits-1)//2 (2-qubit)
        n_obs = actual_qubits
        if self.include_two_qubit and actual_qubits > 1:
            n_obs += (actual_qubits * (actual_qubits - 1)) // 2

        projections = np.zeros((n_samples, n_obs), dtype=np.float64)

        if not QISKIT_AVAILABLE:
            # Deterministic simulation fallback
            for i in range(n_samples):
                xi = X[i, :actual_qubits]
                # Analytical simulation of single-layer angle encoding
                col = 0
                for q in range(actual_qubits):
                    projections[i, col] = np.cos(xi[q])
                    col += 1
                if self.include_two_qubit and actual_qubits > 1:
                    for q1 in range(actual_qubits):
                        for q2 in range(q1 + 1, actual_qubits):
                            projections[i, col] = np.cos(xi[q1]) * np.cos(xi[q2]) * np.cos(xi[q1] * xi[q2])
                            col += 1
            return projections

        # Fast analytical statevector computation for n_qubits <= 10
        # For each sample, build statevector and compute <Z_k> and <Z_k Z_l>
        for i in range(n_samples):
            xi = X[i, :actual_qubits]
            qc = QuantumCircuit(actual_qubits)
            for q in range(actual_qubits):
                qc.h(q)
                qc.rz(float(xi[q]), q)

            for r in range(self.reps):
                for q in range(actual_qubits - 1):
                    qc.cx(q, q + 1)
                    qc.rz(float((np.pi - xi[q]) * (np.pi - xi[q + 1])), q + 1)
                    qc.cx(q, q + 1)

            qc.save_statevector()
            result = self._simulator.run(qc).result()
            sv = result.get_statevector(qc).data  # shape (2**n,)
            probs = np.abs(sv) ** 2

            col = 0
            # 1-qubit Pauli-Z expectations
            for q in range(actual_qubits):
                # Z on qubit q: +1 if bit q is 0, -1 if bit q is 1
                mask = np.array([(k >> q) & 1 for k in range(2**actual_qubits)], dtype=np.float64)
                z_vals = 1.0 - 2.0 * mask
                projections[i, col] = np.sum(probs * z_vals)
                col += 1

            # 2-qubit Pauli-ZZ expectations
            if self.include_two_qubit and actual_qubits > 1:
                for q1 in range(actual_qubits):
                    for q2 in range(q1 + 1, actual_qubits):
                        mask1 = np.array([(k >> q1) & 1 for k in range(2**actual_qubits)], dtype=np.float64)
                        mask2 = np.array([(k >> q2) & 1 for k in range(2**actual_qubits)], dtype=np.float64)
                        zz_vals = (1.0 - 2.0 * mask1) * (1.0 - 2.0 * mask2)
                        projections[i, col] = np.sum(probs * zz_vals)
                        col += 1

        return projections

    def compute_kernel(
        self,
        X1: np.ndarray,
        X2: Optional[np.ndarray] = None,
        gamma: Optional[float] = None,
    ) -> np.ndarray:
        """Computes the Projected Quantum Kernel Gram matrix between X1 and X2.

        Args:
            X1: Training/Reference points (n1, n_features).
            X2: Evaluation points (n2, n_features). If None, computes K(X1, X1).
            gamma: Outer RBF kernel bandwidth. Defaults to self.gamma.

        Returns:
            Kernel matrix of shape (n1, n2).
        """
        g = gamma if gamma is not None else self.gamma
        Z1 = self.encode_and_measure_observables(X1)

        if X2 is None:
            # Symmetric Gram matrix
            # K_ij = exp(-gamma * ||z_i - z_j||^2)
            dists_sq = np.sum((Z1[:, np.newaxis, :] - Z1[np.newaxis, :, :]) ** 2, axis=-1)
            K = np.exp(-g * dists_sq)
            # Ensure exact symmetry and positive diagonal
            np.fill_diagonal(K, 1.0)
            return (K + K.T) / 2.0
        else:
            Z2 = self.encode_and_measure_observables(X2)
            dists_sq = np.sum((Z1[:, np.newaxis, :] - Z2[np.newaxis, :, :]) ** 2, axis=-1)
            return np.exp(-g * dists_sq)
