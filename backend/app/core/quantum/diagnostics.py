"""Diagnostics for quantum kernel matrices: concentration, geometric difference,
eigenvalue spectrum, condition number, class separation, and alignment.
"""
from typing import Any, Dict, List, Optional, Tuple
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


def eigenvalue_and_condition_diagnostics(K: np.ndarray) -> Dict[str, Any]:
    """Computes eigenvalue spectrum, condition number, and positive semi-definiteness."""
    n = K.shape[0]
    if n <= 1:
        return {
            "condition_number": 1.0,
            "is_positive_semidefinite": True,
            "top_eigenvalues": [1.0],
            "spectral_entropy": 0.0,
        }

    try:
        # Use eigvalsh for symmetric matrices
        eigvals = np.linalg.eigvalsh(K)
        eigvals = np.sort(eigvals)[::-1]  # Descending order

        max_eig = float(eigvals[0])
        min_eig = float(eigvals[-1])
        cond_num = float(max_eig / max(abs(min_eig), 1e-12))
        is_psd = bool(min_eig >= -1e-4)

        # Normalize eigenvalues to compute spectral entropy
        pos_eigs = np.clip(eigvals, 1e-12, None)
        norm_eigs = pos_eigs / np.sum(pos_eigs)
        spectral_entropy = -float(np.sum(norm_eigs * np.log2(norm_eigs)))

        # Top 10 normalized eigenvalues
        top_k = min(10, len(norm_eigs))
        top_eigenvalues = [round(float(e), 5) for e in norm_eigs[:top_k]]

        return {
            "condition_number": round(min(cond_num, 1e6), 2),
            "is_positive_semidefinite": is_psd,
            "min_eigenvalue": round(min_eig, 6),
            "max_eigenvalue": round(max_eig, 6),
            "spectral_entropy": round(spectral_entropy, 3),
            "top_eigenvalues": top_eigenvalues,
        }
    except Exception as exc:
        return {
            "condition_number": 1.0,
            "is_positive_semidefinite": False,
            "min_eigenvalue": 0.0,
            "max_eigenvalue": 1.0,
            "spectral_entropy": 0.0,
            "top_eigenvalues": [1.0],
            "error": str(exc),
        }


def class_similarity_separation(K: np.ndarray, y: np.ndarray) -> Dict[str, float]:
    """Computes mean within-class vs between-class similarity and separation ratio."""
    y = np.asarray(y)
    n = len(y)
    if n <= 1 or len(np.unique(y)) < 2:
        return {"within_class_mean": 1.0, "between_class_mean": 0.0, "separation_ratio": 1.0}

    # Off-diagonal mask
    mask_off = ~np.eye(n, dtype=bool)

    # Within-class mask
    mask_same = (y[:, np.newaxis] == y[np.newaxis, :]) & mask_off
    # Between-class mask
    mask_diff = (y[:, np.newaxis] != y[np.newaxis, :]) & mask_off

    within_mean = float(np.mean(K[mask_same])) if np.any(mask_same) else 0.0
    between_mean = float(np.mean(K[mask_diff])) if np.any(mask_diff) else 0.0
    separation_ratio = float(within_mean / max(between_mean, 1e-6))

    return {
        "within_class_mean": round(within_mean, 4),
        "between_class_mean": round(between_mean, 4),
        "separation_ratio": round(separation_ratio, 3),
    }


def extract_downsampled_heatmap(K: np.ndarray, grid_size: int = 16) -> List[List[float]]:
    """Downsamples an NxN kernel matrix into a fixed grid_size x grid_size heatmap for UI."""
    n = K.shape[0]
    if n <= grid_size:
        return [[round(float(v), 3) for v in row] for row in K]

    # Block averaging
    step = n / grid_size
    heatmap = []
    for r in range(grid_size):
        r_start = int(r * step)
        r_end = int((r + 1) * step)
        row = []
        for c in range(grid_size):
            c_start = int(c * step)
            c_end = int((c + 1) * step)
            val = float(np.mean(K[r_start:r_end, c_start:c_end]))
            row.append(round(val, 3))
        heatmap.append(row)
    return heatmap


def geometric_difference(
    K_quantum: np.ndarray,
    X_original: Optional[np.ndarray] = None,
    K_classical: Optional[np.ndarray] = None,
    gamma: Optional[float] = None,
    regularization: float = 1e-3,
) -> float:
    """Computes geometric difference g_RBF(K_Q) (Huang et al. 2021)."""
    n = K_quantum.shape[0]
    if n <= 1:
        return 1.0

    if K_classical is None:
        if X_original is None:
            return 1.0
        if gamma is None:
            gamma = 1.0 / X_original.shape[1] if X_original.shape[1] > 0 else 1.0
        K_classical = rbf_kernel(X_original, gamma=gamma)

    try:
        eigvals_q, eigvecs_q = np.linalg.eigh(K_quantum)
        eigvals_q = np.clip(eigvals_q, 0.0, None)
        K_q_half = eigvecs_q @ np.diag(np.sqrt(eigvals_q)) @ eigvecs_q.T

        K_c_reg = K_classical + regularization * np.eye(n)
        K_c_inv = np.linalg.pinv(K_c_reg)

        M = K_q_half @ K_c_inv @ K_q_half
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
    """Aggregates all kernel diagnostic metrics."""
    conc = kernel_off_diagonal_variance(K)
    align = kernel_target_alignment(K, y)
    geom = geometric_difference(K, X_original=X_original, K_classical=K_ref)
    eig_diag = eigenvalue_and_condition_diagnostics(K)
    class_sep = class_similarity_separation(K, y)
    heatmap = extract_downsampled_heatmap(K, grid_size=16)

    return {
        **conc,
        "kernel_target_alignment": align,
        "geometric_difference_vs_rbf": geom,
        **eig_diag,
        **class_sep,
        "heatmap": heatmap,
    }
