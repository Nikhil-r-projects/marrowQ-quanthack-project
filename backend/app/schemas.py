from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class DatasetProfileResponse(BaseModel):
    dataset_id: str
    name: str
    source: str
    data_mode: str  # "synthetic" or "research"
    total_rows: int
    total_columns: int
    columns: List[str]
    column_types: Dict[str, str]
    missing_counts: Dict[str, int]
    missing_percentages: Dict[str, float]
    duplicates_count: int
    numeric_summaries: Dict[str, Dict[str, float]]
    categorical_summaries: Dict[str, Dict[str, int]]
    potential_leakage_warnings: List[str]
    suggested_target: str
    suggested_features: List[str]
    class_distribution: Optional[Dict[str, int]] = None

class ExperimentCreateRequest(BaseModel):
    dataset_id: str
    target_column: str = "early_engraftment"
    positive_class: Any = 1
    selected_features: Optional[List[str]] = None
    test_size: float = Field(default=0.25, ge=0.1, le=0.5)
    random_state: int = 42
    run_dummy: bool = True
    run_logistic: bool = True
    run_random_forest: bool = True
    run_rbf_svm: bool = True
    run_gradient_boosting: bool = True
    cv_repeats: int = Field(default=5, ge=1, le=10)
    run_quantum_svm: bool = True
    quantum_qubits: int = Field(default=2, ge=2, le=6)
    quantum_reps: int = Field(default=1, ge=1, le=3)
    quantum_max_samples: int = Field(default=80, ge=10, le=200)

class ModelMetric(BaseModel):
    model_name: str
    display_name: str
    accuracy: float
    balanced_accuracy: float
    precision: float
    recall: float
    f1_score: float
    roc_auc: Optional[float] = None
    brier_score: Optional[float] = None
    confusion_matrix: List[List[int]]
    training_time_seconds: float
    inference_time_seconds: float
    test_sample_count: int
    status: str = "completed"
    error_message: Optional[str] = None
    extra_info: Optional[Dict[str, Any]] = None
    # Cross-validated evaluation (benchmark.py)
    roc_auc_ci: Optional[List[float]] = None
    balanced_accuracy_ci: Optional[List[float]] = None
    brier_ci: Optional[List[float]] = None
    roc_auc_repeat_sd: Optional[float] = None
    calibration: Optional[List[Dict[str, float]]] = None
    best_params: Optional[Dict[str, Any]] = None
    evaluation: Optional[str] = None

class ExperimentResponse(BaseModel):
    experiment_id: str
    dataset_id: str
    dataset_name: str
    data_mode: str
    target_column: str
    positive_class: Any
    selected_features: List[str]
    test_size: float
    random_state: int
    status: str  # "created", "running", "completed", "failed"
    current_stage: str
    created_at: str
    completed_at: Optional[str] = None
    total_runtime_seconds: Optional[float] = None
    error_message: Optional[str] = None
    metrics: Dict[str, ModelMetric] = {}
    train_sample_count: Optional[int] = None
    test_sample_count: Optional[int] = None
    class_distribution_train: Optional[Dict[str, int]] = None
    class_distribution_test: Optional[Dict[str, int]] = None

class PredictionRequest(BaseModel):
    experiment_id: str
    model_name: str
    features: Dict[str, Any]

class PredictionResponse(BaseModel):
    experiment_id: str
    model_name: str
    data_mode: str
    prediction: int
    prediction_label: str
    probability: Optional[float] = None
    model_confidence_description: str
    disclaimer: str

class SyntheticGenerateRequest(BaseModel):
    n_samples: int = Field(default=500, ge=50, le=5000)
    random_state: int = 42

class QuantumSimulationRequest(BaseModel):
    x0: float = Field(default=1.57, description="Feature 1 value (radians [0, 2pi])")
    x1: float = Field(default=3.14, description="Feature 2 value (radians [0, 2pi])")
    x0_b: Optional[float] = Field(default=0.78, description="Feature 1 value for Sample B")
    x1_b: Optional[float] = Field(default=2.35, description="Feature 2 value for Sample B")
    reps: int = Field(default=1, ge=1, le=3, description="ZZFeatureMap repetitions")

class QuantumSimulationResponse(BaseModel):
    circuit_text: str
    qubits: int
    reps: int
    feature_dimension: int
    state_a: Dict[str, Any]
    state_b: Optional[Dict[str, Any]] = None
    comparison: Optional[Dict[str, Any]] = None

class PatientResponse(BaseModel):
    patient_id: str
    name: str
    age: float
    gender: str
    disease: str
    transplant_type: str
    donor_type: str
    transplant_date: str
    conditioning: str
    cell_dose_cd34: Optional[float] = None
    chimerism_donor_pct: Optional[float] = None
    cmv_status: Optional[str] = None
    hla_match: Optional[str] = None
    status: str
    created_at: str
    source: str = "clinical"
    source_record: Optional[str] = None
    pretransplant: Optional[Dict[str, Any]] = None

class PatientCreateRequest(BaseModel):
    """Intake for a transplant recipient. `pretransplant` uses the cohort data-dictionary variable names."""
    label: str = Field(min_length=1, max_length=80, description="Name or medical record number as used locally")
    transplant_date: str = Field(description="Date of stem-cell infusion (Day 0), ISO format")
    conditioning: str = Field(default="Not recorded", max_length=80)
    pretransplant: Dict[str, Any]

class ExamplePatientsRequest(BaseModel):
    count: int = Field(default=4, ge=1, le=8)
    seed: int = 7

class ObservationCreateRequest(BaseModel):
    patient_id: str
    day_post_tx: int
    recorded_date: str
    metric_type: str
    value: float
    unit: str
    source: Optional[str] = "EMR Central Lab"
    recorded_by: Optional[str] = "Clinical Staff"

class AgentOrchestrateRequest(BaseModel):
    patient_id: str
    current_labs: Optional[Dict[str, float]] = None
    quantum_backend: Optional[str] = "aer_simulator_statevector"
    execution_mode: Optional[str] = "auto_fallback" # "simulator", "hardware", "auto_fallback"

class QuantumJobSubmitRequest(BaseModel):
    backend_name: str = "aer_simulator_statevector"
    execution_mode: str = "auto_fallback" # "simulator", "hardware_only", "auto_fallback"
    shots: int = 8192
    sample_values: Optional[List[float]] = None

class QuantumExperimentRunRequest(BaseModel):
    backend_name: str = Field(default="ibm_fez", description="Target QPU backend name or local simulator")
    execution_mode: str = Field(default="simulator", description="'hardware' for physical IBM QPU or 'simulator' for local statevector")
    n_features: int = Field(default=156, ge=4, le=156, description="Features selected from pre-transplant pool (mapped to physical qubits)")
    shots: int = Field(default=1000, ge=100, le=8192, description="Measurement shots")
    max_hardware_samples: int = Field(default=8, ge=2, le=20, description="Upper bound on samples for hardware execution")
    dataset_id: Optional[str] = Field(default="cibmtr_hsct_200features", description="Source dataset")
    confirm_hardware: Optional[bool] = Field(default=False, description="Explicit user confirmation for real quantum hardware execution")

