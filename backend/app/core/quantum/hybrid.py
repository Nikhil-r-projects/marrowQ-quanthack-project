"""Hybrid Classical-Quantum Stacking Ensemble for MarrowQ.

Evaluates whether quantum kernel models contribute complementary, orthogonal
predictive information beyond classical models (Logistic Regression, Random Forest, RBF SVM).

Protocol:
1. Performs out-of-fold cross-validation on the training set to generate meta-features:
     z_i = [p_logreg(x_i), p_rf(x_i), p_rbf(x_i), p_pqk(x_i), p_nqk(x_i)]
2. Fits an L2-regularized logistic meta-learner:
     P(y=1|z) = sigmoid(w_meta^T z + b_meta)
3. Evaluates on the held-out test split.
4. Reports meta-weights to quantify the exact contribution of each quantum and classical model.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (
    roc_auc_score, balanced_accuracy_score, brier_score_loss,
    precision_score, recall_score, f1_score
)

from app.core.quantum.pqk import ProjectedQuantumKernel
from app.core.quantum.neural_kernel import NeuralQuantumKernel

logger = logging.getLogger("marrowq.quantum.hybrid")


class HybridQuantumStackingEnsemble:
    """Stacking ensemble combining classical classifiers and quantum kernels."""

    def __init__(
        self,
        n_qubits: int = 4,
        meta_C: float = 1.0,
        n_splits: int = 3,
        random_state: int = 42,
    ):
        self.n_qubits = n_qubits
        self.meta_C = meta_C
        self.n_splits = n_splits
        self.random_state = random_state

        self.meta_model = LogisticRegression(C=meta_C, penalty="l2", solver="lbfgs")
        self.base_models: Dict[str, Any] = {}
        self.model_names = ["LogisticRegression", "RandomForest", "RBF_SVM", "Projected_Quantum_Kernel"]
        self.meta_weights: Dict[str, float] = {}
        self.is_fitted = False

    def fit(self, X_train: np.ndarray, y_train: np.ndarray) -> Dict[str, Any]:
        """Fits base models and meta-learner using out-of-fold cross-validation."""
        n_samples = len(y_train)
        n_models = len(self.model_names)
        oof_preds = np.zeros((n_samples, n_models), dtype=np.float64)

        skf = StratifiedKFold(n_splits=self.n_splits, shuffle=True, random_state=self.random_state)

        for train_idx, val_idx in skf.split(X_train, y_train):
            X_tr, y_tr = X_train[train_idx], y_train[train_idx]
            X_val, y_val = X_train[val_idx], y_train[val_idx]

            # 1. Classical Logistic Regression
            clf_lr = LogisticRegression(C=1.0, max_iter=200)
            clf_lr.fit(X_tr, y_tr)
            oof_preds[val_idx, 0] = clf_lr.predict_proba(X_val)[:, 1]

            # 2. Classical Random Forest
            clf_rf = RandomForestClassifier(n_estimators=50, random_state=self.random_state)
            clf_rf.fit(X_tr, y_tr)
            oof_preds[val_idx, 1] = clf_rf.predict_proba(X_val)[:, 1]

            # 3. Classical RBF SVM
            clf_svm = SVC(C=1.0, kernel="rbf", probability=True, random_state=self.random_state)
            clf_svm.fit(X_tr, y_tr)
            oof_preds[val_idx, 2] = clf_svm.predict_proba(X_val)[:, 1]

            # 4. Projected Quantum Kernel (PQK)
            pqk = ProjectedQuantumKernel(n_qubits=self.n_qubits, gamma=0.5)
            # Normalize X for quantum angle encoding
            X_tr_q = (X_tr - np.min(X_tr, axis=0, keepdims=True)) / (np.ptp(X_tr, axis=0, keepdims=True) + 1e-6) * np.pi
            X_val_q = (X_val - np.min(X_tr, axis=0, keepdims=True)) / (np.ptp(X_tr, axis=0, keepdims=True) + 1e-6) * np.pi

            K_tr = pqk.compute_kernel(X_tr_q)
            K_val = pqk.compute_kernel(X_val_q, X_tr_q)
            q_svm = SVC(C=1.0, kernel="precomputed", probability=True)
            q_svm.fit(K_tr, y_tr)
            oof_preds[val_idx, 3] = q_svm.predict_proba(K_val)[:, 1]

        # Train meta-learner on out-of-fold predictions
        self.meta_model.fit(oof_preds, y_train)

        # Fit final base models on all training data
        self.base_models["LogisticRegression"] = LogisticRegression(C=1.0, max_iter=200).fit(X_train, y_train)
        self.base_models["RandomForest"] = RandomForestClassifier(n_estimators=50, random_state=self.random_state).fit(X_train, y_train)
        self.base_models["RBF_SVM"] = SVC(C=1.0, kernel="rbf", probability=True, random_state=self.random_state).fit(X_train, y_train)

        # Final PQK on full training set
        X_train_q = (X_train - np.min(X_train, axis=0, keepdims=True)) / (np.ptp(X_train, axis=0, keepdims=True) + 1e-6) * np.pi
        final_pqk = ProjectedQuantumKernel(n_qubits=self.n_qubits, gamma=0.5)
        K_all = final_pqk.compute_kernel(X_train_q)
        final_q_svm = SVC(C=1.0, kernel="precomputed", probability=True)
        final_q_svm.fit(K_all, y_train)

        self.base_models["PQK_Engine"] = final_pqk
        self.base_models["PQK_SVM"] = final_q_svm
        self.base_models["X_train_min"] = np.min(X_train, axis=0, keepdims=True)
        self.base_models["X_train_ptp"] = np.ptp(X_train, axis=0, keepdims=True) + 1e-6
        self.base_models["X_train_q"] = X_train_q

        # Extract normalized meta-weights
        raw_weights = self.meta_model.coef_[0]
        abs_sum = np.sum(np.abs(raw_weights)) + 1e-9
        for name, w in zip(self.model_names, raw_weights):
            self.meta_weights[name] = round(float(w / abs_sum), 4)

        self.is_fitted = True

        return {
            "meta_weights": self.meta_weights,
            "meta_intercept": round(float(self.meta_model.intercept_[0]), 4),
            "oof_roc_auc": round(float(roc_auc_score(y_train, self.meta_model.predict_proba(oof_preds)[:, 1])), 4),
        }

    def predict_proba(self, X_test: np.ndarray) -> np.ndarray:
        """Computes stacked probabilities P(y=1|X_test)."""
        if not self.is_fitted:
            raise RuntimeError("HybridQuantumStackingEnsemble must be fitted before predict_proba")

        n_samples = len(X_test)
        meta_features = np.zeros((n_samples, len(self.model_names)), dtype=np.float64)

        meta_features[:, 0] = self.base_models["LogisticRegression"].predict_proba(X_test)[:, 1]
        meta_features[:, 1] = self.base_models["RandomForest"].predict_proba(X_test)[:, 1]
        meta_features[:, 2] = self.base_models["RBF_SVM"].predict_proba(X_test)[:, 1]

        # PQK prediction
        X_test_q = (X_test - self.base_models["X_train_min"]) / self.base_models["X_train_ptp"] * np.pi
        pqk = self.base_models["PQK_Engine"]
        K_test = pqk.compute_kernel(X_test_q, self.base_models["X_train_q"])
        meta_features[:, 3] = self.base_models["PQK_SVM"].predict_proba(K_test)[:, 1]

        return self.meta_model.predict_proba(meta_features)

    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        """Evaluates ensemble metrics on held-out test set."""
        probs = self.predict_proba(X_test)[:, 1]
        preds = (probs >= 0.5).astype(int)

        return {
            "roc_auc": round(float(roc_auc_score(y_test, probs)), 4),
            "balanced_accuracy": round(float(balanced_accuracy_score(y_test, preds)), 4),
            "brier_score": round(float(brier_score_loss(y_test, probs)), 4),
            "precision": round(float(precision_score(y_test, preds, zero_division=0)), 4),
            "recall": round(float(recall_score(y_test, preds, zero_division=0)), 4),
            "f1_score": round(float(f1_score(y_test, preds, zero_division=0)), 4),
            "meta_weights": self.meta_weights,
        }

