import {
  DatasetProfile, Experiment, PredictionResult, SystemHealth, AvailableModel,
  Patient, ClinicalObservation, PatientProgress, QuantumBackend, QuantumStatus,
  QuantumJob, OrchestrationResult, HospitalOverview, CohortOverview, QuantumExperimentResult
} from './types';
import { zzCircuitDepth, zzKernelMatrix } from './lib/quantumKernel';

const API_BASE = '/api';

/**
 * Thin client for the MarrowQ FastAPI server. Nothing here invents data: when the server cannot be
 * reached the call throws, and the UI says so. The one computation that runs in the browser is the
 * exact ZZ-feature-map kernel (lib/quantumKernel.ts, verified against Qiskit), labelled as such.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly detail?: unknown) {
    super(message);
  }
}

/** Turns FastAPI error bodies ({detail: string | {errors: [...]} | [...]}) into one readable message. */
function describe(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    const d = detail as { errors?: string[] };
    if (Array.isArray(d.errors)) return d.errors.join(' ');
    if (Array.isArray(detail)) return detail.map((e: { msg?: string }) => e.msg ?? String(e)).join(' ');
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 15000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new ApiError('The MarrowQ server is not reachable.', 0);
  }
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  // A static host answers unknown /api paths with index.html: treat that as "no server".
  if (!isJson) throw new ApiError('The MarrowQ server is not reachable.', 0);
  const body = await res.json();
  if (!res.ok) throw new ApiError(describe(body?.detail, `Request failed (${res.status})`), res.status, body?.detail);
  return body as T;
}

const post = <T>(path: string, body?: unknown, timeoutMs?: number) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), timeoutMs });

export async function isBackendOnline(): Promise<boolean> {
  try {
    await request<SystemHealth>('/health', { timeoutMs: 3000 });
    return true;
  } catch {
    return false;
  }
}

export const fetchHealth = () => request<SystemHealth>('/health', { timeoutMs: 3000 });

// ---- Research datasets & experiments ------------------------------------------------------------
/** The default research dataset: the real UCI paediatric HSCT cohort. */
export const fetchDemoDataset = () => request<DatasetProfile>('/datasets/demo', { timeoutMs: 30000 });

export function uploadDatasetFile(file: File): Promise<DatasetProfile> {
  const formData = new FormData();
  formData.append('file', file);
  return request<DatasetProfile>('/datasets/upload', { method: 'POST', body: formData, timeoutMs: 60000 });
}

export const fetchDatasetsList = () => request<any[]>('/datasets');
export const fetchDatasetProfile = (datasetId: string) => request<DatasetProfile>(`/datasets/${datasetId}/profile`);
export const createExperiment = (payload: unknown) => post<Experiment>('/experiments', payload);
export const startExperimentRun = (experimentId: string) => post<{ status: string }>(`/experiments/${experimentId}/run`);
export const fetchExperiment = (experimentId: string) => request<Experiment>(`/experiments/${experimentId}`);
export const fetchExperimentsList = () => request<Experiment[]>('/experiments');
export const fetchAvailableModels = () => request<AvailableModel[]>('/models');
export const predictOutcome = (payload: { experiment_id: string; model_name: string; features: Record<string, unknown> }) =>
  post<PredictionResult>('/predictions', payload, 60000);
export const fetchReport = (experimentId: string) => request<{ experiment_id: string; markdown_report: string }>(`/reports/${experimentId}`);

// ---- Cohort & patients ---------------------------------------------------------------------------
export const fetchCohort = () => request<CohortOverview>('/cohort');
export const fetchPatients = () => request<Patient[]>('/patients');
export const fetchPatientObservations = (patientId: string) => request<ClinicalObservation[]>(`/patients/${patientId}/observations`);
export const addPatientObservation = (patientId: string, obs: Omit<ClinicalObservation, 'id' | 'recorded_by' | 'status'>) =>
  post<{ status: string; observation_id: number }>(`/patients/${patientId}/observations`, obs);

export interface AdmissionResult {
  patient: Patient;
  warnings: string[];
}

export const admitPatient = (body: { label: string; transplant_date: string; conditioning?: string; pretransplant: Record<string, string | number> }) =>
  post<AdmissionResult>('/patients', body);
export const admitExamplePatients = (count = 4) => post<Patient[]>('/patients/examples', { count, seed: Date.now() % 100000 });
export const dischargePatient = (patientId: string) => request<{ status: string }>(`/patients/${patientId}`, { method: 'DELETE' });

export const fetchPatientProgress = (patient: Pick<Patient, 'patient_id'>) => request<PatientProgress>(`/patients/${patient.patient_id}/progress`);
export const fetchPatientPredictions = (patientId: string) => request<any[]>(`/patients/${patientId}/predictions`);

export const runAgentOrchestration = (params: { patient: Patient; current_labs?: Record<string, number>; quantum_backend?: string; execution_mode?: string }) => {
  const { patient, ...rest } = params;
  return post<OrchestrationResult>('/agents/orchestrate', { patient_id: patient.patient_id, ...rest }, 60000);
};

export const fetchHospitalOverview = () => request<HospitalOverview>('/hospital/overview');

// ---- Quantum ----------------------------------------------------------------------------------------
export async function fetchQuantumStatus(): Promise<QuantumStatus & { backend_online: boolean }> {
  try {
    return { ...(await request<QuantumStatus>('/quantum/status')), backend_online: true };
  } catch {
    return {
      backend_online: false,
      has_ibm_runtime_installed: false,
      has_token_configured: false,
      token_masked: 'NOT_CONFIGURED',
      is_connected_to_hardware: false,
      default_backend: 'browser_statevector',
      environment_instructions: 'Start the MarrowQ server and set QISKIT_IBM_TOKEN and QISKIT_IBM_INSTANCE in its .env to use IBM Quantum hardware.',
      execution_modes_supported: ['Browser statevector simulation (exact)']
    };
  }
}

/** Only real execution targets: the server's list, or the in-browser exact simulator when it is offline. */
const BROWSER_BACKEND: QuantumBackend = {
  backend_name: 'browser_statevector',
  backend_type: 'Browser statevector simulator',
  qubits: 16,
  status: 'ONLINE',
  is_hardware: false,
  avg_queue_depth: 0,
  description: 'Exact closed-form ZZ-feature-map statevector, computed in your browser while the server is offline.',
  basis_gates: ['h', 'p', 'cx'],
  two_qubit_error_rate: 0
};

export async function fetchQuantumBackends(): Promise<QuantumBackend[]> {
  try {
    return await request<QuantumBackend[]>('/quantum/backends');
  } catch {
    return [BROWSER_BACKEND];
  }
}

export interface QuantumJobResult {
  job_id: string;
  status: string;
  kernel_matrix?: number[][];
  circuit_depth?: number;
  circuit_width?: number;
  shots?: number;
  duration_ms?: number;
  backend_used?: string;
  provenance?: string;
  is_simulator?: boolean;
  transparency_notice?: string;
  error?: string;
}

// Reference points used by the server's /quantum/jobs endpoint (replaced by cohort patients in the quantum chunk).
const QUANTUM_REFERENCES = [[3.85, 4.12], [1.2, 1.45]];
const browserJobs: QuantumJob[] = [];

export async function submitQuantumJob(params: { backend_name: string; execution_mode: string; shots: number; sample_values?: number[] }): Promise<QuantumJobResult> {
  try {
    return await post<QuantumJobResult>('/quantum/jobs', params, 120000);
  } catch (e) {
    // A server that answered with an error has spoken; only an unreachable server falls back.
    if (!(e instanceof ApiError) || e.status !== 0) throw e;
  }
  const sample = params.sample_values ?? [3.14, 1.57];
  const start = performance.now();
  const kernel = zzKernelMatrix([sample], QUANTUM_REFERENCES);
  const duration = Math.round((performance.now() - start) * 100) / 100;
  const job: QuantumJob = {
    job_id: `qjob-browser-${Math.random().toString(16).slice(2, 12)}`,
    backend_name: 'browser_statevector',
    backend_type: 'Browser statevector simulator',
    execution_mode: 'browser',
    status: 'COMPLETED',
    shots: 0,
    circuit_depth: zzCircuitDepth(sample.length),
    circuit_width: sample.length,
    submitted_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    execution_duration_ms: duration,
    kernel_evaluation_duration_ms: duration,
    result_provenance: 'browser_statevector:exact_closed_form'
  };
  browserJobs.unshift(job);
  return {
    job_id: job.job_id,
    status: 'COMPLETED',
    kernel_matrix: kernel,
    circuit_depth: job.circuit_depth,
    circuit_width: job.circuit_width,
    shots: 0,
    duration_ms: duration,
    backend_used: 'Browser statevector simulator',
    provenance: job.result_provenance,
    is_simulator: true,
    transparency_notice: params.backend_name.startsWith('ibm_')
      ? `The server is offline, so ${params.backend_name} could not be reached. The kernel was computed exactly in your browser instead.`
      : 'The server is offline, so the kernel was computed exactly in your browser.'
  };
}

export async function testQuantumConnection(): Promise<{
  success: boolean;
  channel?: string;
  instance?: string;
  token_configured?: boolean;
  token_masked?: string;
  accessible_backends_count?: number;
  backends?: Array<{ name: string; qubits: number; operational: boolean; pending_jobs: number; is_configured_target: boolean }>;
  configured_backend?: string;
  configured_backend_operational?: boolean;
  message?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/quantum/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  return await res.json();
}

export async function runQuantumKernelExperiment(params: {
  backend_name: string;
  execution_mode: 'hardware' | 'simulator';
  n_features?: number;
  shots?: number;
  max_hardware_samples?: number;
  confirm_hardware?: boolean;
}): Promise<QuantumExperimentResult> {
  const res = await fetch(`${API_BASE}/quantum/experiment/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      backend_name: params.backend_name,
      execution_mode: params.execution_mode,
      n_features: params.n_features || 20,
      shots: params.shots || 1000,
      max_hardware_samples: params.max_hardware_samples || 8,
      confirm_hardware: params.confirm_hardware ?? (params.execution_mode === 'hardware')
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to execute quantum experiment");
  }
  return await res.json();
}

export async function fetchLatestQuantumExperiment(): Promise<QuantumExperimentResult | null> {
  try {
    const res = await fetch(`${API_BASE}/quantum/experiment/latest`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function fetchQuantumJobs(): Promise<QuantumJob[]> {
  try {
    return await request<QuantumJob[]>('/quantum/jobs');
  } catch {
    return [...browserJobs];
  }
}


export async function fetchQuantumSweep(splits: number = 5, repeats: number = 2, refresh: boolean = false): Promise<any> {
  const res = await fetch(`${API_BASE}/quantum/sweep?splits=${splits}&repeats=${repeats}&refresh=${refresh}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch qubit sweep");
  }
  return await res.json();
}

export async function fetchQuantumBackendsComparison(shots: number = 1024, n_qubits: number = 4, refresh: boolean = false): Promise<any> {
  const res = await fetch(`${API_BASE}/quantum/compare-backends?shots=${shots}&n_qubits=${n_qubits}&refresh=${refresh}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch backends comparison");
  }
  return await res.json();
}

export async function estimateQuantumBudget(totalCircuits: number, shots: number): Promise<any> {
  const res = await fetch(`${API_BASE}/quantum/estimate-budget?total_circuits=${totalCircuits}&shots=${shots}`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to estimate quantum budget");
  }
  return await res.json();
}

export async function submitGpuSimulate(params: { n_patients?: number; n_qubits?: number; bandwidth?: number; reps?: number }): Promise<{ job_id: string; status: string; kind: string }> {
  const res = await fetch(`${API_BASE}/compute/gpu-simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to submit GPU simulation");
  }
  return await res.json();
}

export async function fetchComputeJob(jobId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/compute/jobs/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch compute job");
  }
  return await res.json();
}

// ---- Multimodal Biological Data, Disease Intelligence, PGx & HLA ----

export const fetchBiologicalProfile = (patientId: string) =>
  request<any>(`/v2/biological/patient/${patientId}/profile`);

export const evaluateAML = (payload: { blast_percentage: number; mutations?: string[]; cytogenetics?: string; age?: number }) =>
  post<any>('/v2/diseases/aml', payload);

export const evaluateMDS = (payload: { bone_marrow_blast_pct: number; hemoglobin: number; platelets: number; anc: number; cytogenetics_category?: string; mutations?: string[] }) =>
  post<any>('/v2/diseases/mds', payload);

export const evaluateSAA = (payload: { cellularity_pct: number; anc: number; platelets: number; reticulocytes: number }) =>
  post<any>('/v2/diseases/aplastic-anemia', payload);

export const evaluateKidney = (payload: { serum_creatinine: number; age?: number; sex?: string; baseline_creatinine?: number }) =>
  post<any>('/v2/diseases/nephrology', payload);

export const evaluateLiver = (payload: { total_bilirubin: number; serum_creatinine: number; inr: number; serum_sodium?: number; ast?: number; alt?: number; platelets?: number; age?: number }) =>
  post<any>('/v2/diseases/hepatology', payload);

export const evaluateCardio = (payload: { age: number; total_cholesterol: number; hdl: number; systolic_bp: number; is_smoker?: boolean; has_diabetes?: boolean; is_female?: boolean }) =>
  post<any>('/v2/diseases/cardiology', payload);

export const evaluatePGx = (payload: { genotypes: Record<string, string>; intended_medications?: string[] }) =>
  post<any>('/v2/pgx/evaluate', payload);

export const evaluateHLA = (payload: any) =>
  post<any>('/v2/hla/evaluate', payload);

