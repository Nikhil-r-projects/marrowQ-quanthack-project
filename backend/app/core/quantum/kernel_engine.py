"""GPU Quantum-Kernel Engine for MarrowQ.

Computes exact quantum statevector fidelity kernel Gram matrices:
  K_ij = |<psi(x_i)|psi(x_j)>|^2
using AerSimulator(method="statevector", device="GPU") with graceful CPU fallback.
Matches Qiskit Machine Learning FidelityQuantumKernel to < 1e-6.
"""
import logging
import math
import time
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

logger = logging.getLogger("marrowq.quantum.kernel_engine")

try:
    import cupy as cp
    HAS_CUPY = True
except ImportError:
    cp = None
    HAS_CUPY = False

try:
    from qiskit import transpile
    from qiskit.circuit.library import zz_feature_map, z_feature_map
    from qiskit_aer import AerSimulator
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False


class GPUQuantumKernelEngine:
    """Evaluates Quantum Statevector Kernels using Aer GPU statevector simulation.

    Instead of simulating O(N^2) inversion test circuits, evaluates O(N) statevectors
    and computes the Gram matrix via batch inner products:
      M = V_1 @ V_2^H,  K = |M|^2
    accelerated by CuPy (on GPU) or NumPy (on CPU).
    """

    def __init__(self, prefer_gpu: bool = True, batch_size: int = 64):
        self.prefer_gpu = prefer_gpu
        self.batch_size = batch_size
        self._device = self._detect_device()

    def _detect_device(self) -> str:
        """Determines whether GPU statevector simulation is available."""
        if not QISKIT_AVAILABLE:
            return "CPU"
        if not self.prefer_gpu:
            return "CPU"
        try:
            available = AerSimulator().available_devices()
            if "GPU" in available:
                # Test initializing Aer with GPU
                sim = AerSimulator(method="statevector", device="GPU")
                return "GPU"
        except Exception as exc:
            logger.warning("GPU AerSimulator detection failed (%s), falling back to CPU", exc)
        return "CPU"

    @property
    def device(self) -> str:
        return self._device

    def get_simulator(self, device: Optional[str] = None) -> Any:
        target_device = device or self._device
        try:
            return AerSimulator(method="statevector", device=target_device)
        except Exception as exc:
            logger.warning("Failed to initialize simulator on %s (%s), falling back to CPU", target_device, exc)
            self._device = "CPU"
            return AerSimulator(method="statevector", device="CPU")

    def compute_statevectors(
        self,
        X: np.ndarray,
        n_qubits: int,
        reps: int = 1,
        entanglement: str = "linear",
        bandwidth: float = 1.0,
        feature_map_type: str = "zz",
    ) -> Tuple[np.ndarray, str]:
        """Simulates and returns statevectors for all rows in X.

        Args:
            X: Array of shape (n_samples, n_qubits).
            n_qubits: Number of qubits.
            reps: Repetitions in the feature map.
            entanglement: Entanglement topology ('linear', 'full', 'circular').
            bandwidth: Bandwidth factor c (Shaydulin & Wild 2022); scales X by c.
            feature_map_type: 'zz' or 'z'.

        Returns:
            (statevectors_matrix, device_used) where statevectors_matrix is
            a complex128 array of shape (n_samples, 2**n_qubits).
        """
        if not QISKIT_AVAILABLE:
            raise RuntimeError("Qiskit and Qiskit-Aer are required for GPUQuantumKernelEngine")

        X = np.asarray(X, dtype=np.float64)
        n_samples, n_features = X.shape
        if n_features != n_qubits:
            raise ValueError(f"Feature dimension ({n_features}) must match n_qubits ({n_qubits})")

        # Scale features with bandwidth factor
        X_scaled = X * bandwidth

        # Construct template feature map
        if feature_map_type.lower() == "z":
            template = z_feature_map(feature_dimension=n_qubits, reps=reps)
        else:
            template = zz_feature_map(feature_dimension=n_qubits, reps=reps, entanglement=entanglement)

        template.save_statevector()

        device_used = self._device
        sim = self.get_simulator(device_used)
        try:
            compiled_template = transpile(template, sim)
        except Exception:
            sim = self.get_simulator("CPU")
            compiled_template = transpile(template, sim)
            device_used = "CPU"

        dim = 2 ** n_qubits
        statevectors = np.empty((n_samples, dim), dtype=np.complex128)

        # Batch execution to prevent host/device memory exhaustion
        for start_idx in range(0, n_samples, self.batch_size):
            end_idx = min(start_idx + self.batch_size, n_samples)
            batch_X = X_scaled[start_idx:end_idx]

            circuits = [
                compiled_template.assign_parameters(row)
                for row in batch_X
            ]

            try:
                job = sim.run(circuits)
                res = job.result()
                for i in range(len(circuits)):
                    sv = np.asarray(res.get_statevector(i), dtype=np.complex128)
                    statevectors[start_idx + i] = sv
            except Exception as exc:
                if device_used == "GPU":
                    logger.warning("GPU execution failed on batch [%d:%d]: %s. Falling back to CPU.", start_idx, end_idx, exc)
                    sim = self.get_simulator("CPU")
                    device_used = "CPU"
                    job = sim.run(circuits)
                    res = job.result()
                    for i in range(len(circuits)):
                        sv = np.asarray(res.get_statevector(i), dtype=np.complex128)
                        statevectors[start_idx + i] = sv
                else:
                    raise

        return statevectors, device_used

    def evaluate_gram_matrix(
        self,
        V1: np.ndarray,
        V2: Optional[np.ndarray] = None,
        use_gpu_matmul: bool = True,
    ) -> Tuple[np.ndarray, str]:
        """Computes K = |V1 @ V2^H|^2 using CuPy (if GPU available) or NumPy.

        Args:
            V1: Statevectors of shape (N1, 2**n).
            V2: Statevectors of shape (N2, 2**n). If None, computes V1 @ V1^H.
            use_gpu_matmul: Whether to use CuPy for GPU accelerated matrix product.

        Returns:
            (K, accelerator_label) where K is of shape (N1, N2) with values in [0, 1].
        """
        is_symmetric = V2 is None or V2 is V1
        accelerator = "CPU (NumPy)"

        if use_gpu_matmul and HAS_CUPY and self._device == "GPU":
            try:
                V1_gpu = cp.asarray(V1)
                if is_symmetric:
                    M_gpu = cp.matmul(V1_gpu, V1_gpu.conj().T)
                else:
                    V2_gpu = cp.asarray(V2)
                    M_gpu = cp.matmul(V1_gpu, V2_gpu.conj().T)

                K_gpu = cp.abs(M_gpu) ** 2
                K = cp.asnumpy(K_gpu)
                accelerator = "GPU (CuPy)"
            except Exception as exc:
                logger.warning("CuPy matrix multiplication failed: %s; falling back to NumPy", exc)
                if is_symmetric:
                    M = np.matmul(V1, V1.conj().T)
                else:
                    M = np.matmul(V1, V2.conj().T)
                K = np.abs(M) ** 2
                accelerator = "CPU (NumPy)"
        else:
            if is_symmetric:
                M = np.matmul(V1, V1.conj().T)
            else:
                M = np.matmul(V1, V2.conj().T)
            K = np.abs(M) ** 2

        # Enforce exact identity diagonal for self-kernel
        if is_symmetric:
            np.fill_diagonal(K, 1.0)

        # Clip numerical precision artifacts
        np.clip(K, 0.0, 1.0, out=K)
        return K, accelerator

    def evaluate(
        self,
        X1: np.ndarray,
        X2: Optional[np.ndarray] = None,
        n_qubits: Optional[int] = None,
        reps: int = 1,
        entanglement: str = "linear",
        bandwidth: float = 1.0,
        feature_map_type: str = "zz",
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Computes quantum kernel Gram matrix between X1 and X2 (or X1 and X1).

        Returns:
            (K, telemetry_dict)
        """
        t0 = time.perf_counter()
        X1 = np.asarray(X1, dtype=np.float64)
        if n_qubits is None:
            n_qubits = X1.shape[1]

        V1, device_used = self.compute_statevectors(
            X1,
            n_qubits=n_qubits,
            reps=reps,
            entanglement=entanglement,
            bandwidth=bandwidth,
            feature_map_type=feature_map_type,
        )

        if X2 is not None and X2 is not X1:
            X2 = np.asarray(X2, dtype=np.float64)
            V2, _ = self.compute_statevectors(
                X2,
                n_qubits=n_qubits,
                reps=reps,
                entanglement=entanglement,
                bandwidth=bandwidth,
                feature_map_type=feature_map_type,
            )
        else:
            V2 = None

        K, matmul_accelerator = self.evaluate_gram_matrix(V1, V2)
        elapsed = time.perf_counter() - t0

        telemetry = {
            "device": device_used,
            "matmul_accelerator": matmul_accelerator,
            "n_qubits": n_qubits,
            "reps": reps,
            "bandwidth": bandwidth,
            "feature_map": f"{feature_map_type.upper()}FeatureMap",
            "samples_shape": (len(X1), len(X2) if X2 is not None else len(X1)),
            "elapsed_seconds": round(elapsed, 4),
        }
        return K, telemetry

