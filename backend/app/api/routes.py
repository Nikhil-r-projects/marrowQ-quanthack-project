import os
import uuid
import time
import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from typing import Dict, Any, List

from app.schemas import (
    DatasetProfileResponse, ExperimentCreateRequest, ExperimentResponse,
    PredictionRequest, PredictionResponse, SyntheticGenerateRequest, ModelMetric
)
from app.core.synthetic import generate_hsct_synthetic_dataset
from app.core.profiler import profile_dataset
from app.core.pipeline import prepare_train_test_split
from app.core.classical import (
    train_dummy_model, train_logistic_regression, train_random_forest, train_rbf_svm
)
from app.core.quantum import train_quantum_kernel_svm, QISKIT_AVAILABLE, QISKIT_VERSION
from app.core.database import (
    save_dataset_meta, get_dataset_meta, list_datasets,
    save_experiment_record, get_experiment_record, list_experiments
)
from app.core.reporter import generate_markdown_report

router = APIRouter(prefix="/api")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "artifacts")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

# In-memory datasets cache for quick lookup
_DATASET_CACHE: Dict[str, pd.DataFrame] = {}

def get_or_load_dataset(dataset_id: str) -> pd.DataFrame:
    if dataset_id in _DATASET_CACHE:
        return _DATASET_CACHE[dataset_id]
    meta = get_dataset_meta(dataset_id)
    if not meta or not meta.get("filepath") or not os.path.exists(meta["filepath"]):
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
    df = pd.read_csv(meta["filepath"])
    _DATASET_CACHE[dataset_id] = df
    return df

@router.get("/health")
def get_health():
    import sklearn
    return {
        "status": "healthy",
        "service": "MarrowQ API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "versions": {
            "qiskit": QISKIT_VERSION if QISKIT_AVAILABLE else "unavailable",
            "qiskit_available": QISKIT_AVAILABLE,
            "scikit_learn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__
        }
    }

@router.get("/datasets/demo")
def get_or_create_demo_dataset():
    dataset_id = "demo_synthetic_hsct"
    filepath = os.path.join(DATA_DIR, f"{dataset_id}.csv")
    
    df = generate_hsct_synthetic_dataset(n_samples=500, random_state=42)
    df.to_csv(filepath, index=False)
    _DATASET_CACHE[dataset_id] = df
    
    profile = profile_dataset(
        df=df,
        dataset_id=dataset_id,
        name="CIBMTR-Grounded Synthetic HSCT Cohort (N=500)",
        source="MarrowQ Clinically Grounded Synthetic Generator",
        data_mode="synthetic"
    )
    
    save_dataset_meta(
        dataset_id=dataset_id,
        name=profile.name,
        source=profile.source,
        data_mode=profile.data_mode,
        filepath=filepath,
        row_count=profile.total_rows,
        col_count=profile.total_columns,
        profile_dict=profile.model_dump()
    )
    
    return profile

@router.post("/datasets/synthetic/generate")
def generate_synthetic_dataset(req: SyntheticGenerateRequest):
    dataset_id = f"synthetic_{uuid.uuid4().hex[:8]}"
    filepath = os.path.join(DATA_DIR, f"{dataset_id}.csv")
    
    df = generate_hsct_synthetic_dataset(n_samples=req.n_samples, random_state=req.random_state)
    df.to_csv(filepath, index=False)
    _DATASET_CACHE[dataset_id] = df
    
    profile = profile_dataset(
        df=df,
        dataset_id=dataset_id,
        name=f"Synthetic HSCT Cohort (N={req.n_samples})",
        source="MarrowQ Clinically Grounded Synthetic Generator",
        data_mode="synthetic"
    )
    
    save_dataset_meta(
        dataset_id=dataset_id,
        name=profile.name,
        source=profile.source,
        data_mode=profile.data_mode,
        filepath=filepath,
        row_count=profile.total_rows,
        col_count=profile.total_columns,
        profile_dict=profile.model_dump()
    )
    return profile

@router.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
        
    dataset_id = f"upload_{uuid.uuid4().hex[:8]}"
    filepath = os.path.join(DATA_DIR, f"{dataset_id}.csv")
    
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=400, detail="File size exceeds maximum permitted 20MB limit.")
        
    with open(filepath, "wb") as f:
        f.write(content)
        
    try:
        df = pd.read_csv(filepath)
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")
        
    _DATASET_CACHE[dataset_id] = df
    profile = profile_dataset(
        df=df,
        dataset_id=dataset_id,
        name=file.filename,
        source="User Uploaded Research Dataset",
        data_mode="research"
    )
    
    save_dataset_meta(
        dataset_id=dataset_id,
        name=profile.name,
        source=profile.source,
        data_mode=profile.data_mode,
        filepath=filepath,
        row_count=profile.total_rows,
        col_count=profile.total_columns,
        profile_dict=profile.model_dump()
    )
    return profile

@router.get("/datasets")
def get_all_datasets():
    return list_datasets()

@router.get("/datasets/{dataset_id}/profile")
def get_dataset_profile(dataset_id: str):
    meta = get_dataset_meta(dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return meta["profile"]

def execute_experiment_pipeline(experiment_id: str, req_data: Dict[str, Any]):
    """Background worker executing the complete ML training pipeline."""
    t_start = time.perf_counter()
    record = get_experiment_record(experiment_id)
    if not record:
        return
        
    try:
        record["status"] = "running"
        record["current_stage"] = "validating_and_splitting"
        save_experiment_record(record)
        
        df = get_or_load_dataset(record["dataset_id"])
        target_col = record["target_column"]
        feature_cols = record["selected_features"]
        
        # Leakage-safe split & train-only preprocessor fit
        (
            X_train_df, X_test_df, y_train, y_test,
            preprocessor, num_cols, cat_cols
        ) = prepare_train_test_split(
            df=df,
            target_column=target_col,
            feature_columns=feature_cols,
            test_size=record["test_size"],
            random_state=record["random_state"]
        )
        
        X_train_trans = preprocessor.transform(X_train_df)
        X_test_trans = preprocessor.transform(X_test_df)
        
        record["train_sample_count"] = len(y_train)
        record["test_sample_count"] = len(y_test)
        record["class_distribution_train"] = {
            "0": int(np.sum(y_train == 0)),
            "1": int(np.sum(y_train == 1))
        }
        record["class_distribution_test"] = {
            "0": int(np.sum(y_test == 0)),
            "1": int(np.sum(y_test == 1))
        }
        
        # Save pipeline artifact
        exp_artifact_dir = os.path.join(ARTIFACTS_DIR, experiment_id)
        os.makedirs(exp_artifact_dir, exist_ok=True)
        joblib.dump(preprocessor, os.path.join(exp_artifact_dir, "preprocessor.joblib"))
        
        metrics: Dict[str, Any] = {}
        
        # Classical training
        record["current_stage"] = "training_classical_models"
        save_experiment_record(record)
        
        if req_data.get("run_dummy", True):
            clf, m = train_dummy_model(X_train_trans, y_train, X_test_trans, y_test, random_state=record["random_state"])
            joblib.dump(clf, os.path.join(exp_artifact_dir, "model_dummy.joblib"))
            metrics["dummy"] = m.model_dump()
            
        if req_data.get("run_logistic", True):
            clf, m = train_logistic_regression(X_train_trans, y_train, X_test_trans, y_test, random_state=record["random_state"])
            joblib.dump(clf, os.path.join(exp_artifact_dir, "model_logistic.joblib"))
            metrics["logistic_regression"] = m.model_dump()
            
        if req_data.get("run_random_forest", True):
            clf, m = train_random_forest(X_train_trans, y_train, X_test_trans, y_test, random_state=record["random_state"])
            joblib.dump(clf, os.path.join(exp_artifact_dir, "model_random_forest.joblib"))
            metrics["random_forest"] = m.model_dump()
            
        if req_data.get("run_rbf_svm", True):
            clf, m = train_rbf_svm(X_train_trans, y_train, X_test_trans, y_test, random_state=record["random_state"])
            joblib.dump(clf, os.path.join(exp_artifact_dir, "model_rbf_svm.joblib"))
            metrics["rbf_svm"] = m.model_dump()
            
        # Quantum training
        if req_data.get("run_quantum_svm", True):
            record["current_stage"] = "computing_quantum_kernel"
            save_experiment_record(record)
            
            q_bundle, q_metric, matched_rbf_metric = train_quantum_kernel_svm(
                X_train=X_train_trans,
                y_train=y_train,
                X_test=X_test_trans,
                y_test=y_test,
                n_qubits=req_data.get("quantum_qubits", 2),
                reps=req_data.get("quantum_reps", 1),
                max_samples=req_data.get("quantum_max_samples", 80),
                random_state=record["random_state"]
            )
            
            if matched_rbf_metric:
                metrics["matched_rbf_svm"] = matched_rbf_metric.model_dump()
            if q_metric:
                metrics["quantum_kernel_svm"] = q_metric.model_dump()
            if q_bundle:
                joblib.dump(q_bundle, os.path.join(exp_artifact_dir, "model_quantum.joblib"))

        total_runtime = time.perf_counter() - t_start
        record["status"] = "completed"
        record["current_stage"] = "completed"
        record["completed_at"] = datetime.now(timezone.utc).isoformat()
        record["total_runtime_seconds"] = round(total_runtime, 3)
        record["metrics"] = metrics
        record["artifacts_path"] = exp_artifact_dir
        save_experiment_record(record)
        
    except Exception as exc:
        record["status"] = "failed"
        record["current_stage"] = "failed"
        record["error_message"] = str(exc)
        record["completed_at"] = datetime.now(timezone.utc).isoformat()
        record["total_runtime_seconds"] = round(time.perf_counter() - t_start, 3)
        save_experiment_record(record)

@router.post("/experiments", response_model=ExperimentResponse)
def create_experiment(req: ExperimentCreateRequest):
    d_meta = get_dataset_meta(req.dataset_id)
    if not d_meta:
        raise HTTPException(status_code=404, detail="Selected dataset not found.")
        
    experiment_id = f"exp_{uuid.uuid4().hex[:8]}"
    profile = d_meta["profile"]
    
    selected_features = req.selected_features or profile.get("suggested_features", [])
    if not selected_features:
        raise HTTPException(status_code=400, detail="At least one feature must be selected.")
        
    record = {
        "experiment_id": experiment_id,
        "dataset_id": req.dataset_id,
        "dataset_name": d_meta["name"],
        "data_mode": d_meta["data_mode"],
        "target_column": req.target_column,
        "positive_class": str(req.positive_class),
        "selected_features": selected_features,
        "test_size": req.test_size,
        "random_state": req.random_state,
        "status": "created",
        "current_stage": "initialized",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "config": req.model_dump(),
        "metrics": {}
    }
    
    save_experiment_record(record)
    return ExperimentResponse(**record)

@router.post("/experiments/{experiment_id}/run")
def run_experiment(experiment_id: str, background_tasks: BackgroundTasks):
    record = get_experiment_record(experiment_id)
    if not record:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    if record["status"] == "running":
        return {"message": "Experiment already running.", "experiment_id": experiment_id}
        
    config = record.get("config", {})
    # Run synchronously or in background
    # Running synchronously or via background task:
    background_tasks.add_task(execute_experiment_pipeline, experiment_id, config)
    return {"message": "Experiment started.", "experiment_id": experiment_id, "status": "running"}

@router.get("/experiments", response_model=List[Dict[str, Any]])
def get_experiments():
    return list_experiments()

@router.get("/experiments/{experiment_id}")
def get_experiment(experiment_id: str):
    record = get_experiment_record(experiment_id)
    if not record:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return record

@router.get("/experiments/{experiment_id}/results")
def get_experiment_results(experiment_id: str):
    record = get_experiment_record(experiment_id)
    if not record:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return {
        "experiment_id": record["experiment_id"],
        "status": record["status"],
        "data_mode": record["data_mode"],
        "target_column": record["target_column"],
        "total_runtime_seconds": record["total_runtime_seconds"],
        "metrics": record["metrics"],
        "class_distribution_test": record["class_distribution_test"]
    }

@router.get("/models")
def get_available_trained_models():
    exps = list_experiments()
    models = []
    for exp in exps:
        if exp["status"] == "completed":
            full = get_experiment_record(exp["experiment_id"])
            if not full:
                continue
            for m_key, m_val in full.get("metrics", {}).items():
                if m_val.get("status") == "completed":
                    models.append({
                        "experiment_id": exp["experiment_id"],
                        "dataset_name": exp["dataset_name"],
                        "data_mode": exp["data_mode"],
                        "model_key": m_key,
                        "display_name": m_val.get("display_name", m_key),
                        "accuracy": m_val.get("accuracy"),
                        "roc_auc": m_val.get("roc_auc"),
                        "features": full.get("selected_features", [])
                    })
    return models

@router.post("/predictions", response_model=PredictionResponse)
def generate_prediction(req: PredictionRequest):
    exp = get_experiment_record(req.experiment_id)
    if not exp or exp["status"] != "completed":
        raise HTTPException(status_code=404, detail="Completed experiment not found.")
        
    artifact_dir = exp.get("artifacts_path")
    if not artifact_dir or not os.path.exists(artifact_dir):
        raise HTTPException(status_code=404, detail="Model artifact directory not found.")
        
    preprocessor_path = os.path.join(artifact_dir, "preprocessor.joblib")
    if not os.path.exists(preprocessor_path):
        raise HTTPException(status_code=404, detail="Fitted preprocessor artifact not found.")
        
    preprocessor = joblib.load(preprocessor_path)
    
    # Input DataFrame
    input_df = pd.DataFrame([req.features])
    
    # Preprocess
    try:
        X_trans = preprocessor.transform(input_df)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Input validation/transformation error: {str(e)}")
        
    prob = None
    pred = 0
    
    if req.model_name in ["dummy", "logistic_regression", "random_forest", "rbf_svm"]:
        m_file = {
            "dummy": "model_dummy.joblib",
            "logistic_regression": "model_logistic.joblib",
            "random_forest": "model_random_forest.joblib",
            "rbf_svm": "model_rbf_svm.joblib"
        }[req.model_name]
        
        m_path = os.path.join(artifact_dir, m_file)
        if not os.path.exists(m_path):
            raise HTTPException(status_code=404, detail=f"Model artifact '{m_file}' not found.")
        model = joblib.load(m_path)
        pred = int(model.predict(X_trans)[0])
        if hasattr(model, "predict_proba"):
            try:
                prob = float(model.predict_proba(X_trans)[0][1])
            except Exception:
                prob = None
                
    elif req.model_name == "quantum_kernel_svm":
        q_path = os.path.join(artifact_dir, "model_quantum.joblib")
        if not os.path.exists(q_path):
            raise HTTPException(status_code=404, detail="Quantum model artifact not found.")
        q_bundle = joblib.load(q_path)
        pca = q_bundle["pca"]
        scaler = q_bundle["scaler"]
        svc = q_bundle["svc"]
        kernel = q_bundle["kernel"]
        X_tr_q = q_bundle["X_tr_q"]
        
        X_q_reduced = pca.transform(X_trans)
        X_q = scaler.transform(X_q_reduced)
        K_infer = kernel.evaluate(x_vec=X_q, y_vec=X_tr_q)
        pred = int(svc.predict(K_infer)[0])
        if hasattr(svc, "predict_proba"):
            try:
                prob = float(svc.predict_proba(K_infer)[0][1])
            except Exception:
                prob = None
    else:
        raise HTTPException(status_code=400, detail=f"Unknown model name '{req.model_name}'.")
        
    label_str = "Prompt Recovery (Day <= 28)" if pred == 1 else "Delayed Recovery (> Day 28)"
    
    disclaimer = (
        "SYNTHETIC DEMONSTRATION DATA — NOT CLINICAL EVIDENCE. "
        "Strictly for pipeline feasibility demonstration. Never use for actual clinical decision-making."
        if exp["data_mode"] == "synthetic" else
        "RESEARCH PROTOTYPE EVALUATION — NOT CLINICAL ADVICE. strictly for secondary research analysis."
    )
    
    conf_desc = f"Model estimated {prob*100:.1f}% probability of timely engraftment by Day 28." if prob is not None else "Binary classification score without calibrated probability."
    
    return PredictionResponse(
        experiment_id=req.experiment_id,
        model_name=req.model_name,
        data_mode=exp["data_mode"],
        prediction=pred,
        prediction_label=label_str,
        probability=round(prob, 4) if prob is not None else None,
        model_confidence_description=conf_desc,
        disclaimer=disclaimer
    )

@router.get("/reports/{experiment_id}")
def get_report(experiment_id: str):
    record = get_experiment_record(experiment_id)
    if not record:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    md_content = generate_markdown_report(record)
    return {"experiment_id": experiment_id, "markdown_report": md_content}
