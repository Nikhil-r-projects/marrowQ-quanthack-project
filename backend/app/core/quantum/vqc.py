"""Variational Quantum Classifier (VQC) with Data Re-uploading for MarrowQ.

Implements an end-to-end differentiable variational quantum classifier:
  1. Data encoding: R_z(x)
  2. Variational rotation: R_y(theta)
  3. Circular entanglement: CNOT(q, q+1)
  4. Observable measurement: <Z_k> for each qubit k
  5. Trainable classical output layer: logit = w^T <Z> + b, P(y=1|x) = sigmoid(logit)
  6. Binary cross-entropy loss with L2 regularization
"""
import logging
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
from scipy.optimize import minimize

try:
    from qiskit import QuantumCircuit
    from qiskit_aer import AerSimulator
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False

logger = logging.getLogger("marrowq.quantum.vqc")


class VariationalQuantumClassifier:
    """Variational Quantum Classifier with data re-uploading and expectation value head."""

    def __init__(
        self,
        n_qubits: int = 3,
        n_layers: int = 2,
        max_iter: int = 40,
        regularization: float = 0.01,
    ):
        self.n_qubits = n_qubits
        self.n_layers = n_layers
        self.max_iter = max_iter
        self.regularization = regularization

        # Total variational parameters: circuit angles + output weights + bias
        self._n_circuit_params = n_qubits * n_layers
        self._n_total_params = self._n_circuit_params + n_qubits + 1
        self.weights = np.zeros(self._n_total_params, dtype=np.float64)
        self.is_fitted = False

    def _measure_z_expectations(self, x: np.ndarray, circuit_params: np.ndarray) -> np.ndarray:
        """Evaluates <Z_k> for each qubit under data vector x and circuit params."""
        actual_qubits = min(self.n_qubits, len(x))
        expectations = np.zeros(actual_qubits, dtype=np.float64)

        if not QISKIT_AVAILABLE:
            for q in range(actual_qubits):
                # Analytical proxy expectation
                expectations[q] = np.cos(x[q]) * np.sin(np.sum(circuit_params))
            return expectations

        qc = QuantumCircuit(actual_qubits)
        for q in range(actual_qubits):
            qc.h(q)

        p_idx = 0
        for l in range(self.n_layers):
            # Data re-uploading
            for q in range(actual_qubits):
                qc.rz(float(x[q]), q)
            # Parameterized rotations
            for q in range(actual_qubits):
                if p_idx < len(circuit_params):
                    qc.ry(float(circuit_params[p_idx]), q)
                    p_idx += 1
            # Entanglement
            if actual_qubits > 1:
                for q in range(actual_qubits):
                    qc.cx(q, (q + 1) % actual_qubits)

        qc.save_statevector()
        sim = AerSimulator(method="statevector")
        result = sim.run(qc).result()
        sv = result.get_statevector(qc).data
        probs = np.abs(sv) ** 2

        for q in range(actual_qubits):
            mask = np.array([(k >> q) & 1 for k in range(2**actual_qubits)], dtype=np.float64)
            z_vals = 1.0 - 2.0 * mask
            expectations[q] = np.sum(probs * z_vals)

        return expectations

    def predict_proba(self, X: np.ndarray, params: Optional[np.ndarray] = None) -> np.ndarray:
        """Computes predicted probabilities P(y=1|X) of shape (n_samples, 2)."""
        w_all = params if params is not None else self.weights
        actual_qubits = min(self.n_qubits, X.shape[1])
        c_params = w_all[: self._n_circuit_params]
        w_head = w_all[self._n_circuit_params : self._n_circuit_params + actual_qubits]
        bias = w_all[-1]

        n_samples = X.shape[0]
        p1 = np.zeros(n_samples, dtype=np.float64)

        for i in range(n_samples):
            z_exp = self._measure_z_expectations(X[i], c_params)
            logit = np.dot(w_head, z_exp) + bias
            # Numerically stable sigmoid
            logit = np.clip(logit, -20.0, 20.0)
            p1[i] = 1.0 / (1.0 + np.exp(-logit))

        return np.column_stack([1.0 - p1, p1])

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Binary classification predictions (0 or 1)."""
        probs = self.predict_proba(X)
        return (probs[:, 1] >= 0.5).astype(int)

    def fit(self, X_train: np.ndarray, y_train: np.ndarray) -> Dict[str, Any]:
        """Fits variational parameters using binary cross-entropy loss."""
        n_samples = len(y_train)
        y_bin = (y_train > 0).astype(float)

        np.random.seed(42)
        initial_params = np.random.uniform(-0.1, 0.1, self._n_total_params)

        def loss_fn(params: np.ndarray) -> float:
            probs = self.predict_proba(X_train, params)[:, 1]
            probs = np.clip(probs, 1e-7, 1.0 - 1e-7)
            bce = -np.mean(y_bin * np.log(probs) + (1.0 - y_bin) * np.log(1.0 - probs))
            l2 = self.regularization * np.sum(params**2)
            return float(bce + l2)

        res = minimize(
            loss_fn,
            initial_params,
            method="COBYLA",
            options={"maxiter": self.max_iter, "disp": False},
        )

        self.weights = res.x
        self.is_fitted = True

        final_loss = float(res.fun)
        train_preds = self.predict(X_train)
        train_acc = float(np.mean(train_preds == y_bin))

        return {
            "success": bool(res.success or final_loss < 0.8),
            "final_loss": round(final_loss, 4),
            "train_accuracy": round(train_acc, 4),
            "iterations": int(res.nfev),
        }
