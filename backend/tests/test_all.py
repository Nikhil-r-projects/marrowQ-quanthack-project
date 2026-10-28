import os
import sys
import pytest
import numpy as np
import pandas as pd

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.synthetic import generate_hsct_synthetic_dataset
from app.core.profiler import profile_dataset
from app.core.pipeline import prepare_train_test_split, LeakageSafePreprocessor
from app.core.classical import (
    train_dummy_model, train_logistic_regression, train_random_forest, train_rbf_svm
)
from app.core.quantum import train_quantum_kernel_svm, QISKIT_AVAILABLE
from app.core.database import init_db, save_experiment_record, get_experiment_record
from app.core.reporter import generate_markdown_report
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "versions" in data

def test_synthetic_generation_repeatability():
    df1 = generate_hsct_synthetic_dataset(n_samples=100, random_state=42)
    df2 = generate_hsct_synthetic_dataset(n_samples=100, random_state=42)
    pd.testing.assert_frame_equal(df1, df2)
    assert len(df1) == 100
    assert "neutrophil_recovery_day28" in df1.columns
    assert set(df1["neutrophil_recovery_day28"].unique()).issubset({0, 1})

def test_data_profiler_and_leakage_detection():
    df = generate_hsct_synthetic_dataset(n_samples=50, random_state=42)
    # Add a mock leakage column
    df["post_tx_chimerism_day30"] = np.random.uniform(80, 100, size=len(df))
    profile = profile_dataset(df, "test_ds", "Test Dataset", data_mode="synthetic")
    assert profile.total_rows == 50
    assert len(profile.potential_leakage_warnings) > 0
    assert any("chimerism" in w.lower() for w in profile.potential_leakage_warnings)

def test_leakage_safe_splitting():
    df = generate_hsct_synthetic_dataset(n_samples=100, random_state=42)
    features = ["recipient_age", "recipient_gender", "cd34_dose", "primary_disease"]
    X_train, X_test, y_train, y_test, preprocessor, num_cols, cat_cols = prepare_train_test_split(
        df=df,
        target_column="neutrophil_recovery_day28",
        feature_columns=features,
        test_size=0.3,
        random_state=42
    )
    assert len(X_train) == 70
    assert len(X_test) == 30
    assert len(y_train) == 70
    assert len(y_test) == 30
    
    # Preprocessor transform
    X_train_trans = preprocessor.transform(X_train)
    X_test_trans = preprocessor.transform(X_test)
    assert X_train_trans.shape[0] == 70
    assert X_test_trans.shape[0] == 30
    assert X_train_trans.shape[1] == X_test_trans.shape[1]

def test_error_single_class_target():
    df = generate_hsct_synthetic_dataset(n_samples=50, random_state=42)
    df["neutrophil_recovery_day28"] = 1  # Force single class
    features = ["recipient_age", "cd34_dose"]
    with pytest.raises(ValueError, match="at least 2 distinct classes"):
        prepare_train_test_split(df, "neutrophil_recovery_day28", features)

def test_classical_model_training():
    df = generate_hsct_synthetic_dataset(n_samples=100, random_state=42)
    features = ["recipient_age", "cd34_dose", "recipient_gender", "primary_disease"]
    X_train, X_test, y_train, y_test, preprocessor, _, _ = prepare_train_test_split(
        df, "neutrophil_recovery_day28", features, test_size=0.25, random_state=42
    )
    X_tr = preprocessor.transform(X_train)
    X_te = preprocessor.transform(X_test)
    
    # Dummy
    _, d_metric = train_dummy_model(X_tr, y_train, X_te, y_test)
    assert d_metric.status == "completed"
    assert 0.0 <= d_metric.accuracy <= 1.0
    
    # Logistic
    _, lr_metric = train_logistic_regression(X_tr, y_train, X_te, y_test)
    assert lr_metric.status == "completed"
    assert lr_metric.roc_auc is not None
    
    # Random Forest
    _, rf_metric = train_random_forest(X_tr, y_train, X_te, y_test)
    assert rf_metric.status == "completed"
    
    # RBF SVM
    _, svm_metric = train_rbf_svm(X_tr, y_train, X_te, y_test)
    assert svm_metric.status == "completed"

def test_quantum_kernel_svm_execution():
    if not QISKIT_AVAILABLE:
        pytest.skip("Qiskit ML not installed")
    df = generate_hsct_synthetic_dataset(n_samples=40, random_state=42)
    features = ["recipient_age", "cd34_dose", "recipient_kps"]
    X_train, X_test, y_train, y_test, preprocessor, _, _ = prepare_train_test_split(
        df, "neutrophil_recovery_day28", features, test_size=0.25, random_state=42
    )
    X_tr = preprocessor.transform(X_train)
    X_te = preprocessor.transform(X_test)
    
    q_bundle, q_metric, matched_rbf = train_quantum_kernel_svm(
        X_tr, y_train, X_te, y_test,
        n_qubits=2, reps=1, max_samples=30, random_state=42
    )
    assert q_metric.status == "completed"
    assert q_bundle is not None
    assert matched_rbf is not None
    assert 0.0 <= q_metric.accuracy <= 1.0
    assert q_metric.training_time_seconds > 0.0

def test_api_demo_dataset_and_experiment_lifecycle():
    # 1. Get demo dataset
    demo_res = client.get("/api/datasets/demo")
    assert demo_res.status_code == 200
    demo_data = demo_res.json()
    dataset_id = demo_data["dataset_id"]
    
    # 2. Create experiment
    create_payload = {
        "dataset_id": dataset_id,
        "target_column": "neutrophil_recovery_day28",
        "selected_features": ["recipient_age", "cd34_dose", "recipient_gender", "graft_source"],
        "test_size": 0.25,
        "random_state": 42,
        "run_dummy": True,
        "run_logistic": True,
        "run_random_forest": True,
        "run_rbf_svm": True,
        "run_quantum_svm": True,
        "quantum_qubits": 2,
        "quantum_reps": 1,
        "quantum_max_samples": 40
    }
    exp_res = client.post("/api/experiments", json=create_payload)
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    exp_id = exp_data["experiment_id"]
    
    # 3. Run synchronous execution directly for testing
    from app.api.routes import execute_experiment_pipeline
    execute_experiment_pipeline(exp_id, create_payload)
    
    # 4. Check results
    res_check = client.get(f"/api/experiments/{exp_id}")
    assert res_check.status_code == 200
    finished_exp = res_check.json()
    assert finished_exp["status"] == "completed"
    assert "logistic_regression" in finished_exp["metrics"]
    assert "quantum_kernel_svm" in finished_exp["metrics"]
    
    # 5. Prediction
    pred_payload = {
        "experiment_id": exp_id,
        "model_name": "logistic_regression",
        "features": {
            "recipient_age": 45,
            "cd34_dose": 5.2,
            "recipient_gender": "M",
            "graft_source": "PBSC"
        }
    }
    pred_res = client.post("/api/predictions", json=pred_payload)
    assert pred_res.status_code == 200
    pred_data = pred_res.json()
    assert pred_data["prediction"] in [0, 1]
    assert "SYNTHETIC DEMONSTRATION" in pred_data["disclaimer"]
    
    # 6. Report
    rep_res = client.get(f"/api/reports/{exp_id}")
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert "MarrowQ Experiment Research Report" in rep_data["markdown_report"]

def test_invalid_experiment_and_model_ids():
    # Non-existent experiment
    res = client.get("/api/experiments/exp_nonexistent")
    assert res.status_code == 404

    # Non-existent report
    res_rep = client.get("/api/reports/exp_nonexistent")
    assert res_rep.status_code == 404

    # Prediction with non-existent experiment
    res_pred = client.post("/api/predictions", json={
        "experiment_id": "exp_nonexistent",
        "model_name": "logistic_regression",
        "features": {"recipient_age": 50}
    })
    assert res_pred.status_code == 404

def test_frontend_static_serving():
    res = client.get("/")
    assert res.status_code == 200
    assert "MarrowQ" in res.text

def test_quantum_simulation_api():
    payload = {
        "x0": 1.57,
        "x1": 3.14,
        "x0_b": 0.78,
        "x1_b": 2.35,
        "reps": 1
    }
    res = client.post("/api/quantum/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["qubits"] == 2
    assert "state_a" in data
    assert "probabilities" in data["state_a"]
    assert "00" in data["state_a"]["probabilities"]
    assert "bloch_q0" in data["state_a"]
    assert "comparison" in data
    assert 0.0 <= data["comparison"]["quantum_fidelity"] <= 1.0


