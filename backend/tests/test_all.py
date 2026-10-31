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


@pytest.fixture(scope="module")
def ward_patient():
    """A ward patient admitted from a real UCI record (the app no longer ships invented patients)."""
    res = client.post("/api/patients/examples", json={"count": 1})
    assert res.status_code == 201
    return res.json()[0]

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
        "target_column": "early_engraftment",
        "selected_features": ["recipient_age", "cd34_dose", "recipient_sex", "stem_cell_source"],
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
            "recipient_age": 9.5,
            "cd34_dose": 5.2,
            "recipient_sex": "Male",
            "stem_cell_source": "Peripheral blood"
        }
    }
    pred_res = client.post("/api/predictions", json=pred_payload)
    assert pred_res.status_code == 200
    pred_data = pred_res.json()
    assert pred_data["prediction"] in [0, 1]
    assert "NOT CLINICAL ADVICE" in pred_data["disclaimer"]
    
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

# =========================================================================
# MARROWQ 2.0 TESTS
# =========================================================================

def test_patients_and_observations_api(ward_patient):
    pid = ward_patient["patient_id"]
    patients = client.get("/api/patients").json()
    assert any(p["patient_id"] == pid for p in patients)
    assert not any(p["patient_id"] == "PT-9042-BMT" for p in patients), "invented seed patient must be gone"

    data = client.get(f"/api/patients/{pid}").json()
    assert data["source"] == "example" and data["source_record"].startswith("UCI-")
    assert data["name"] == f"Example · {data['source_record']}"
    assert data["transplant_type"] == "Allogeneic HSCT"
    # Outcomes must never be copied onto the ward record.
    assert not set(data["pretransplant"]) & {"anc_recovery_day", "early_engraftment", "died"}

    # A newly admitted patient has no labs until someone records them.
    assert client.get(f"/api/patients/{pid}/observations").json() == []

def test_patient_progress_and_trajectory(ward_patient):
    res = client.get(f"/api/patients/{ward_patient['patient_id']}/progress")
    assert res.status_code == 200
    data = res.json()
    assert "timeline_series" in data
    assert len(data["timeline_series"]) > 40
    assert "milestones" in data
    assert any("Neutrophil" in m["name"] for m in data["milestones"])
    assert "clinical_summary" in data

    # Check 95% confidence bounds
    point = data["timeline_series"][20]
    assert point["anc_lower_95"] <= point["anc_predicted"] <= point["anc_upper_95"]
    assert point["plt_lower_95"] <= point["plt_predicted"] <= point["plt_upper_95"]

def test_add_observation(ward_patient):
    payload = {
        "patient_id": ward_patient["patient_id"],
        "day_post_tx": 15,
        "recorded_date": "2026-10-29",
        "metric_type": "Absolute Neutrophil Count (ANC)",
        "value": 520.0,
        "unit": "cells/μL"
    }
    res = client.post(f"/api/patients/{ward_patient['patient_id']}/observations", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "SUCCESS"

def test_quantum_backends_and_status():
    res_status = client.get("/api/quantum/status")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["has_ibm_runtime_installed"] is True
    assert "aer_simulator_statevector" in status_data["default_backend"]

    res_backends = client.get("/api/quantum/backends")
    assert res_backends.status_code == 200
    backends = res_backends.json()
    # Without IBM credentials only the local simulators may be listed, never a static hardware catalogue.
    assert not any(b["is_hardware"] for b in backends)
    assert any(b["backend_name"] == "aer_simulator_statevector" for b in backends)

def test_multi_agent_orchestrator(ward_patient):
    payload = {
        "patient_id": ward_patient["patient_id"],
        "current_labs": {"anc": 420.0, "platelets": 18500.0},
        "quantum_backend": "aer_simulator_statevector",
        "execution_mode": "auto_fallback"
    }
    res = client.post("/api/agents/orchestrate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert "models_comparison" in data
    assert "quantum_kernel_svm" in data["models_comparison"]
    assert "agent_trail" in data
    assert len(data["agent_trail"]) == 8 # All 8 specialized agents
    assert "reports" in data
    assert "physician_technical_report" in data["reports"]
    assert "patient_friendly_summary" in data["reports"]

def test_hospital_operational_overview():
    res = client.get("/api/hospital/overview")
    assert res.status_code == 200
    data = res.json()
    assert "cohort_summary" in data
    assert data["cohort_summary"]["total_active_patients"] >= 0
    assert data["service_health"]["database"] == "ONLINE"
    assert "uptime_pct" not in data["service_health"], "no hard-coded uptime figure"
    assert data["quantum_service_health"]["hardware_backends_available"] == 0



