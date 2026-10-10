import { DatasetProfile, Experiment, PredictionResult, SystemHealth, AvailableModel } from './types';

const API_BASE = '/api';

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchDemoDataset(): Promise<DatasetProfile> {
  const res = await fetch(`${API_BASE}/datasets/demo`);
  if (!res.ok) throw new Error('Failed to load demo dataset');
  return res.json();
}

export async function uploadDatasetFile(file: File): Promise<DatasetProfile> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/datasets/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function fetchDatasetsList(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/datasets`);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

export async function fetchDatasetProfile(datasetId: string): Promise<DatasetProfile> {
  const res = await fetch(`${API_BASE}/datasets/${datasetId}/profile`);
  if (!res.ok) throw new Error('Failed to fetch dataset profile');
  return res.json();
}

export async function createExperiment(payload: {
  dataset_id: string;
  target_column: string;
  selected_features: string[];
  test_size: number;
  random_state: number;
  run_dummy: boolean;
  run_logistic: boolean;
  run_random_forest: boolean;
  run_rbf_svm: boolean;
  run_quantum_svm: boolean;
  quantum_qubits: number;
  quantum_reps: number;
  quantum_max_samples: number;
}): Promise<Experiment> {
  const res = await fetch(`${API_BASE}/experiments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create experiment' }));
    throw new Error(err.detail || 'Failed to create experiment');
  }
  return res.json();
}

export async function startExperimentRun(experimentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/experiments/${experimentId}/run`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to start experiment' }));
    throw new Error(err.detail || 'Failed to start experiment');
  }
  return res.json();
}

export async function fetchExperiment(experimentId: string): Promise<Experiment> {
  const res = await fetch(`${API_BASE}/experiments/${experimentId}`);
  if (!res.ok) throw new Error('Failed to fetch experiment details');
  return res.json();
}

export async function fetchExperimentsList(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/experiments`);
  if (!res.ok) throw new Error('Failed to fetch experiments list');
  return res.json();
}

export async function fetchAvailableModels(): Promise<AvailableModel[]> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function predictOutcome(payload: {
  experiment_id: string;
  model_name: string;
  features: Record<string, any>;
}): Promise<PredictionResult> {
  const res = await fetch(`${API_BASE}/predictions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Prediction failed' }));
    throw new Error(err.detail || 'Prediction failed');
  }
  return res.json();
}

export async function fetchReport(experimentId: string): Promise<{ experiment_id: string; markdown_report: string }> {
  const res = await fetch(`${API_BASE}/reports/${experimentId}`);
  if (!res.ok) throw new Error('Failed to fetch research report');
  return res.json();
}
