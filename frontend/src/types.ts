export interface DatasetProfile {
  dataset_id: string;
  name: string;
  source: string;
  data_mode: 'synthetic' | 'research';
  total_rows: number;
  total_columns: number;
  columns: string[];
  column_types: Record<string, string>;
  missing_counts: Record<string, number>;
  missing_percentages: Record<string, number>;
  duplicates_count: number;
  numeric_summaries: Record<string, {
    mean: number;
    std: number;
    min: number;
    q25: number;
    median: number;
    q75: number;
    max: number;
  }>;
  categorical_summaries: Record<string, Record<string, number>>;
  potential_leakage_warnings: string[];
  suggested_target: string;
  suggested_features: string[];
  class_distribution?: Record<string, number>;
}

export interface ModelMetric {
  model_name: string;
  display_name: string;
  accuracy: number;
  balanced_accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  roc_auc?: number | null;
  brier_score?: number | null;
  confusion_matrix: number[][];
  training_time_seconds: number;
  inference_time_seconds: number;
  test_sample_count: number;
  status: 'completed' | 'failed';
  error_message?: string;
  extra_info?: Record<string, any>;
}

export interface Experiment {
  experiment_id: string;
  dataset_id: string;
  dataset_name: string;
  data_mode: 'synthetic' | 'research';
  target_column: string;
  positive_class: string;
  selected_features: string[];
  test_size: number;
  random_state: number;
  status: 'created' | 'running' | 'completed' | 'failed';
  current_stage: string;
  created_at: string;
  completed_at?: string;
  total_runtime_seconds?: number;
  error_message?: string;
  train_sample_count?: number;
  test_sample_count?: number;
  class_distribution_train?: Record<string, number>;
  class_distribution_test?: Record<string, number>;
  metrics: Record<string, ModelMetric>;
  config?: any;
}

export interface AvailableModel {
  experiment_id: string;
  dataset_name: string;
  data_mode: string;
  model_key: string;
  display_name: string;
  accuracy: number;
  roc_auc?: number;
  features: string[];
}

export interface PredictionResult {
  experiment_id: string;
  model_name: string;
  data_mode: string;
  prediction: number;
  prediction_label: string;
  probability?: number | null;
  model_confidence_description: string;
  disclaimer: string;
}

export interface SystemHealth {
  status: string;
  service: string;
  timestamp: string;
  versions: {
    qiskit: string;
    qiskit_available: boolean;
    scikit_learn: string;
    pandas: string;
    numpy: string;
  };
}

// ==========================================
// MARROWQ 2.0 ADVANCED TYPES
// ==========================================

export type UserRole = 'doctor' | 'researcher' | 'patient' | 'hospital_admin';

export interface Patient {
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  disease: string;
  transplant_type: string;
  donor_type: string;
  transplant_date: string;
  conditioning: string;
  cell_dose_cd34?: number;
  chimerism_donor_pct?: number;
  cmv_status?: string;
  hla_match?: string;
  status: string;
  created_at: string;
  primary_organ_type?: 'heart' | 'marrow' | 'liver' | 'stem';
  organ_label?: string;
  organ_diagnosis?: string;
}

export interface ClinicalObservation {
  id: number;
  patient_id: string;
  day_post_tx: number;
  recorded_date: string;
  metric_type: string;
  value: number;
  unit: string;
  source: string;
  recorded_by?: string;
  status: string;
}

export interface TrajectoryPoint {
  day: number;
  is_observed: boolean;
  anc_observed?: number;
  anc_predicted: number;
  anc_lower_95: number;
  anc_upper_95: number;
  plt_observed?: number;
  plt_predicted: number;
  plt_lower_95: number;
  plt_upper_95: number;
  hb_observed?: number;
  wbc_observed?: number;
}

export interface Milestone {
  id: string;
  name: string;
  target_day: number;
  status: 'COMPLETED' | 'PROJECTED' | 'PENDING' | 'DELAYED';
  actual_date?: string;
  actual_day?: number;
  projected_day?: number;
  forecast_interval?: string;
  notes?: string;
}

export interface PatientProgress {
  patient_id: string;
  patient_name: string;
  transplant_date: string;
  latest_observed_day: number;
  expected_anc_engraft_day: number;
  expected_plt_engraft_day: number;
  is_anc_engrafted: boolean;
  is_plt_engrafted: boolean;
  timeline_series: TrajectoryPoint[];
  milestones: Milestone[];
  clinical_summary: {
    current_anc: number | string;
    current_plt: number | string;
    current_hb: number | string;
    current_wbc: number | string;
    velocity: string;
    status_description: string;
  };
}

export interface QuantumBackend {
  backend_name: string;
  backend_type: string;
  qubits: number;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  is_hardware: boolean;
  avg_queue_depth: number;
  description: string;
  basis_gates: string[];
  avg_t1_us?: number;
  avg_t2_us?: number;
  two_qubit_error_rate: number;
}

export interface QuantumStatus {
  has_ibm_runtime_installed: boolean;
  has_token_configured: boolean;
  token_masked: string;
  channel?: string;
  configured_instance?: string;
  is_connected_to_hardware: boolean;
  default_backend: string;
  environment_instructions?: string;
  execution_modes_supported?: any;
}

export interface QuantumJob {
  job_id: string;
  backend_name: string;
  backend_type: string;
  execution_mode: string;
  status: string;
  shots: number;
  circuit_depth?: number;
  circuit_width?: number;
  submitted_at: string;
  completed_at?: string;
  execution_duration_ms?: number;
  kernel_evaluation_duration_ms?: number;
  error_message?: string;
  result_provenance: string;
}

export interface AgentTrailItem {
  agent_id: string;
  task_id: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  output_data: Record<string, any>;
  warnings: string[];
  errors: string[];
  confidence?: number;
  timestamp: string;
}

export interface OrchestrationResult {
  task_id: string;
  prediction_id: string;
  patient_id: string;
  status: string;
  duration_ms: number;
  validation_status: string;
  disagreement_detected: boolean;
  models_comparison: {
    logistic_regression: any;
    random_forest: any;
    classical_rbf_svm: any;
    quantum_kernel_svm: any;
  };
  evidence: Array<{
    factor: string;
    observation: string;
    clinical_impact: string;
    reference_registry: string;
  }>;
  trajectory_summary?: any;
  reports: {
    physician_technical_report: string;
    patient_friendly_summary: string;
    generated_at: string;
  };
  agent_trail: AgentTrailItem[];
}

export interface HospitalOverview {
  cohort_summary: {
    total_active_patients: number;
    impending_engraftments: number;
    pending_clinician_reviews: number;
    allogeneic_count: number;
    autologous_count: number;
  };
  quantum_service_health: {
    active_backends_online: number;
    total_quantum_jobs_executed: number;
    default_backend: string;
    hardware_readiness: string;
  };
  service_health: {
    api_status: string;
    database: string;
    orchestrator_agents_active: number;
    uptime_pct: number;
  };
}

export interface QuantumExperimentResult {
  status: string;
  timestamp: string;
  backend_used: string;
  execution_mode: string;
  is_simulator: boolean;
  job_id: string;
  shots: number;
  circuits_submitted: number;
  circuit_depth: number;
  circuit_width: number;
  duration_ms: number;
  total_pre_transplant_features_available: number;
  selected_features_count: number;
  selected_features: string[];
  sample_split: {
    train_samples: number;
    test_samples: number;
    total_evaluated: number;
  };
  metrics: {
    quantum_kernel_svm: ModelMetric;
    matched_rbf_svm: ModelMetric;
  };
  provenance: string;
  leakage_safeguard: string;
}
