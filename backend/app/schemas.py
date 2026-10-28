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
    target_column: str = "neutrophil_recovery_day28"
    positive_class: Any = 1
    selected_features: Optional[List[str]] = None
    test_size: float = Field(default=0.25, ge=0.1, le=0.5)
    random_state: int = 42
    run_dummy: bool = True
    run_logistic: bool = True
    run_random_forest: bool = True
    run_rbf_svm: bool = True
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
