import time
import numpy as np
from typing import Dict, Any, Tuple, Optional
from sklearn.svm import SVC
from sklearn.decomposition import PCA
from sklearn.preprocessing import MinMaxScaler
from app.core.evaluator import evaluate_model_performance
from app.schemas import ModelMetric

try:
    import qiskit
    from qiskit.circuit.library import zz_feature_map
    from qiskit_machine_learning.kernels import FidelityQuantumKernel
    QISKIT_AVAILABLE = True
    QISKIT_VERSION = qiskit.__version__
except Exception as e:
    QISKIT_AVAILABLE = False
    QISKIT_VERSION = str(e)

def train_quantum_kernel_svm(
    X_train: np.ndarray, y_train: np.ndarray,
    X_test: np.ndarray, y_test: np.ndarray,
    n_qubits: int = 2,
    reps: int = 1,
    max_samples: int = 80,
    random_state: int = 42
) -> Tuple[Optional[Any], ModelMetric, Optional[ModelMetric]]:
    """
    Executes a Qiskit Fidelity-based Quantum Kernel SVM experiment:
    1. Reduces features to n_qubits using PCA fitted solely on X_train.
    2. Scales reduced features to [0, 2*pi] using MinMaxScaler fitted solely on X_train.
    3. Truncates/samples max_samples if dataset is larger (quantum statevector simulation scaling).
    4. Evaluates K_train and K_test using FidelityQuantumKernel with ZZ feature map.
    5. Trains SVC(kernel='precomputed').
    6. Also computes an apples-to-apples matched Classical RBF SVM on the identical reduced feature space!
    """
    if not QISKIT_AVAILABLE:
        err_metric = ModelMetric(
            model_name="quantum_kernel_svm",
            display_name="Quantum-Kernel SVM (ZZFeatureMap)",
            accuracy=0.0,
            balanced_accuracy=0.0,
            precision=0.0,
            recall=0.0,
            f1_score=0.0,
            confusion_matrix=[[0, 0], [0, 0]],
            training_time_seconds=0.0,
            inference_time_seconds=0.0,
            test_sample_count=len(y_test),
            status="failed",
            error_message=f"Qiskit ML is not available in environment: {QISKIT_VERSION}"
        )
        return None, err_metric, None

    # Subsample if requested for simulator practicality
    n_train = len(X_train)
    n_test = len(X_test)
    
    if n_train > max_samples:
        rng = np.random.default_rng(random_state)
        train_idx = rng.choice(n_train, size=max_samples, replace=False)
        X_tr = X_train[train_idx]
        y_tr = y_train[train_idx]
    else:
        X_tr = X_train
        y_tr = y_train
        
    test_max = max(10, int(max_samples * 0.35))
    if n_test > test_max:
        rng = np.random.default_rng(random_state + 1)
        test_idx = rng.choice(n_test, size=test_max, replace=False)
        X_te = X_test[test_idx]
        y_te = y_test[test_idx]
    else:
        X_te = X_test
        y_te = y_test

    # 1. Dimensionality reduction & scaling fitted STRICTLY on X_tr
    n_components = min(n_qubits, X_tr.shape[1])
    pca = PCA(n_components=n_components, random_state=random_state)
    scaler = MinMaxScaler(feature_range=(0, 2 * np.pi))
    
    X_tr_reduced = pca.fit_transform(X_tr)
    X_tr_q = scaler.fit_transform(X_tr_reduced)
    
    X_te_reduced = pca.transform(X_te)
    X_te_q = scaler.transform(X_te_reduced)
    
    # Run matched classical RBF SVM on the identical reduced features for fair comparator
    t0_class = time.perf_counter()
    clf_matched = SVC(kernel="rbf", probability=True, random_state=random_state)
    clf_matched.fit(X_tr_q, y_tr)
    t_train_matched = time.perf_counter() - t0_class
    
    t0_class_inf = time.perf_counter()
    y_pred_matched = clf_matched.predict(X_te_q)
    y_prob_matched = clf_matched.predict_proba(X_te_q)[:, 1]
    t_infer_matched = time.perf_counter() - t0_class_inf
    
    matched_rbf_metric = evaluate_model_performance(
        model_name="matched_rbf_svm",
        display_name=f"Classical RBF SVM (Matched {n_components}-dim)",
        y_test=y_te,
        y_pred=y_pred_matched,
        y_prob=y_prob_matched,
        training_time_seconds=t_train_matched,
        inference_time_seconds=t_infer_matched,
        extra_info={
            "feature_dimension": n_components,
            "reduced_space": True,
            "sample_count": len(y_tr)
        }
    )

    try:
        # Build Quantum Feature Map & Fidelity Kernel
        t0_q_train = time.perf_counter()
        fmap = zz_feature_map(feature_dimension=n_components, reps=reps)
        kernel = FidelityQuantumKernel(feature_map=fmap)
        
        # Compute Gram Matrix
        K_train = kernel.evaluate(x_vec=X_tr_q, y_vec=X_tr_q)
        
        # Fit precomputed SVC
        svc = SVC(kernel="precomputed", probability=True, random_state=random_state)
        svc.fit(K_train, y_tr)
        t_train_q = time.perf_counter() - t0_q_train
        
        # Inference
        t0_q_infer = time.perf_counter()
        K_test = kernel.evaluate(x_vec=X_te_q, y_vec=X_tr_q)
        y_pred_q = svc.predict(K_test)
        y_prob_q = svc.predict_proba(K_test)[:, 1]
        t_infer_q = time.perf_counter() - t0_q_infer
        
        quantum_metric = evaluate_model_performance(
            model_name="quantum_kernel_svm",
            display_name=f"Quantum-Kernel SVM ({n_components} Qubits, ZZ Map)",
            y_test=y_te,
            y_pred=y_pred_q,
            y_prob=y_prob_q,
            training_time_seconds=t_train_q,
            inference_time_seconds=t_infer_q,
            extra_info={
                "qubit_count": n_components,
                "feature_map": "ZZFeatureMap",
                "repetitions": reps,
                "execution_mode": "Local Statevector Simulator (Fidelity)",
                "train_sample_count": len(y_tr),
                "qiskit_version": QISKIT_VERSION
            }
        )
        
        quantum_bundle = {
            "svc": svc,
            "kernel": kernel,
            "pca": pca,
            "scaler": scaler,
            "X_tr_q": X_tr_q
        }
        
        return quantum_bundle, quantum_metric, matched_rbf_metric
        
    except Exception as exc:
        err_metric = ModelMetric(
            model_name="quantum_kernel_svm",
            display_name="Quantum-Kernel SVM",
            accuracy=0.0,
            balanced_accuracy=0.0,
            precision=0.0,
            recall=0.0,
            f1_score=0.0,
            confusion_matrix=[[0, 0], [0, 0]],
            training_time_seconds=0.0,
            inference_time_seconds=0.0,
            test_sample_count=len(y_te),
            status="failed",
            error_message=str(exc)
        )
        return None, err_metric, matched_rbf_metric
