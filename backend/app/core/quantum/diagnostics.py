"""Diagnostics for quantum kernel matrices: concentration, geometric difference, and alignment.
"""
from typing import Any, Dict, Optional, Tuple
import numpy as np
from sklearn.metrics.pairwise import rbf_kernel


def kernel_off_diagonal_variance(K: np.ndarray) -> Dict[str, float]:
    """Computes kernel concentration metrics: off-diagonal variance and mean.

    As qubit count increases without bandwidth scaling, quantum kernels can concentrate
    exponentially around a constant off-diagonal value (barren plateau equivalent).
    """
    n = K.shape[0]
    if n <= 1:
        return {"off_diagonal_variance": 0.0, "off_diagonal_mean": 1.0}

    # Extract off-diagonal mask
    mask = ~np.eye(n, dtype=bool)
    off_diag = K[mask]

    var_off = float(np.var(off_diag))
    mean_off = float(np.mean(off_diag))
    min_off = float(np.min(off_diag))
    max_off = float(np.max(off_diag))

    return {
        "off_diagonal_variance": round(var_off, 6),
        "off_diagonal_mean": round(mean_off, 6),
        "off_diagonal_min": round(min_off, 6),
        "off_diagonal_max": round(max_off, 6),
        "is_concentrated": bool(var_off < 1e-4),
    }


def kernel_target_alignment(K: np.ndarray, y: np.ndarray) -> float:
    """Computes kernel-target alignment A(K, y) (Cristianini et al. 2001).

      A(K, y) = <K, y_pm y_pm^T>_F / (||K||_F * ||y_pm y_pm^T||_F)
              = (y_pm^T K y_pm) / (n * ||K||_F)

    where y_pm in {-1, +1}^n. Higher alignment indicates that the quantum Hilbert space
    geometry matches the class boundary.
    """
    y = np.asarray(y)
    n = len(y)
    if n <= 1:
        return 0.0

    # Map labels to {-1, +1}
    classes = np.unique(y)
    if len(classes) != 2:
        return 0.0
    y_pm = np.where(y == classes[-1], 1.0, -1.0)

    # Numerator: y_pm^T @ K @ y_pm
    numerator = float(y_pm @ K @ y_pm)

    # Denominator: n * ||K||_F
    frob_k = float(np.linalg.norm(K, "fro"))
    if frob_k < 1e-12:
        return 0.0

    alignment = numerator / (n * frob_k)
    return round(float(np.clip(alignment, -1.0, 1.0)), 5)


def geometric_difference(
    K_quantum: np.ndarray,
    X_original: Optional[np.ndarray] = None,
    K_classical: Optional[np.ndarray] = None,
    gamma: Optional[float] = None,
    regularization: float = 1e-3,
) -> float:
    """Computes geometric difference g_RBF(K_Q) (Huang et al. 2021).

      g(K_Q, K_C) = sqrt(|| K_Q^{1/2} (K_C + lambda I)^{-1} K_Q^{1/2} ||_2)

    Measures whether the quantum kernel explores geometric directions orthogonal
    to the classical RBF kernel. If g >> 1, the quantum model can potentially separate
    data in ways classical RBF cannot without exponential sample complexity.
    """
    n = K_quantum.shape[0]
    if n <= 1:
        return 1.0

    # If K_classical not provided, compute standard RBF kernel on X_original
    if K_classical is None:
        if X_original is None:
            return 1.0
        if gamma is None:
            gamma = 1.0 / X_original.shape[1] if X_original.shape[1] > 0 else 1.0
        K_classical = rbf_kernel(X_original, gamma=gamma)

    try:
        # SVD / eigendecomposition for symmetric positive semi-definite K_quantum
        eigvals_q, eigvecs_q = np.linalg.eigh(K_quantum)
        eigvals_q = np.clip(eigvals_q, 0.0, None)
        K_q_half = eigvecs_q @ np.diag(np.sqrt(eigvals_q)) @ eigvecs_q.T

        # Invert regularized classical kernel: (K_C + lambda * I)^{-1}
        K_c_reg = K_classical + regularization * np.eye(n)
        K_c_inv = np.linalg.pinv(K_c_reg)

        # M = K_Q^{1/2} @ K_C^{-1} @ K_Q^{1/2}
        M = K_q_half @ K_c_inv @ K_q_half

        # Spectral norm ||M||_2 = max eigenvalue
        eigvals_m = np.linalg.eigvalsh(M)
        max_eig = float(np.max(eigvals_m))
        if max_eig < 0:
            max_eig = 0.0

        g_diff = float(np.sqrt(max_eig))
        return round(g_diff, 4)
    except Exception:
        return 1.0


def compute_kernel_diagnostics(
    K: np.ndarray,
    y: np.ndarray,
    X_original: Optional[np.ndarray] = None,
    K_ref: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """Aggregates concentration, target alignment, and geometric difference."""
    conc = kernel_off_diagonal_variance(K)
    align = kernel_target_alignment(K, y)
    geom = geometric_difference(K, X_original=X_original, K_classical=K_ref)

    return {
        **conc,
        "kernel_target_alignment": align,
        "geometric_difference_vs_rbf": geom,
    }

