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
