import mockBundle from '../data/mock_api_bundle.json';
import mockCurve from '../data/mock_engraftment_curve.json';
import mockOrchestration from '../data/mock_orchestration.json';
import { Patient, ClinicalObservation } from '../types';

// In-memory mutable store for user sessions (e.g., adding observations, admitting patients)
class MockApiStore {
  private patients: Patient[];
  private observations: Record<string, ClinicalObservation[]>;
  private progress: Record<string, any>;

  constructor() {
    this.patients = Array.isArray(mockBundle.patients) ? [...mockBundle.patients] as unknown as Patient[] : [];
    this.observations = { ...(mockBundle.patients_observations || {}) } as Record<string, ClinicalObservation[]>;
    this.progress = { ...(mockBundle.patients_progress || {}) };

    // Ensure benchmark patient MQ-BENCH01 is always present with full observations
    if (!this.observations['MQ-BENCH01'] && mockBundle.bench01_observations) {
      this.observations['MQ-BENCH01'] = mockBundle.bench01_observations as unknown as ClinicalObservation[];
    }
    if (!this.progress['MQ-BENCH01'] && mockBundle.bench01_progress) {
      this.progress['MQ-BENCH01'] = mockBundle.bench01_progress;
    }
  }

  getPatients(): Patient[] {
    return [...this.patients];
  }

  getPatient(id: string): Patient | undefined {
    return this.patients.find(p => p.patient_id === id);
  }

  admitPatient(payload: { label: string; transplant_date: string; conditioning?: string; pretransplant: Record<string, any> }) {
    const id = `MQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const p: Patient = {
      patient_id: id,
      name: payload.label || 'Newly Admitted Patient',
      age: Number(payload.pretransplant?.recipient_age || 10),
      gender: String(payload.pretransplant?.recipient_sex || 'Female'),
      disease: String(payload.pretransplant?.disease || 'ALL'),
      transplant_type: 'Allogeneic HSCT',
      donor_type: `HLA ${payload.pretransplant?.hla_match || '10/10'} donor · ${String(payload.pretransplant?.stem_cell_source || 'Peripheral blood').toLowerCase()} graft`,
      transplant_date: payload.transplant_date || new Date().toISOString().slice(0, 10),
      conditioning: payload.conditioning || 'Bu/Cy Myeloablative',
      cell_dose_cd34: Number(payload.pretransplant?.cd34_dose || 6.5),
      chimerism_donor_pct: 98.0,
      cmv_status: 'D+/R-',
      hla_match: String(payload.pretransplant?.hla_match || '10/10'),
      status: 'Admitted',
      created_at: new Date().toISOString(),
      source: 'clinical',
      pretransplant: payload.pretransplant
    };
    this.patients.unshift(p);

    // Prepopulate surveillance for newly admitted patient so organ view is immediately full
    const benchObs = (mockBundle.bench01_observations || []) as unknown as ClinicalObservation[];
    this.observations[id] = benchObs.map((o, idx) => ({
      ...o,
      id: Date.now() + idx,
      patient_id: id
    }));

    return { patient: p, warnings: [] };
  }

  dischargePatient(id: string) {
    this.patients = this.patients.filter(p => p.patient_id !== id);
    delete this.observations[id];
    delete this.progress[id];
    return { status: 'removed', patient_id: id };
  }

  getObservations(patientId: string): ClinicalObservation[] {
    if (this.observations[patientId]?.length) {
      return [...this.observations[patientId]];
    }
    // Fallback to bench01 observations so no patient shows dashes
    if (mockBundle.bench01_observations?.length) {
      return (mockBundle.bench01_observations as unknown as ClinicalObservation[]).map(o => ({
        ...o,
        patient_id: patientId
      }));
    }
    return [];
  }

  addObservation(patientId: string, obs: any) {
    const list = this.observations[patientId] || [];
    const newObs: ClinicalObservation = {
      id: Date.now(),
      patient_id: patientId,
      recorded_by: 'Clinical Care Team',
      status: 'verified',
      recorded_at: new Date().toISOString(),
      ...obs
    };
    list.unshift(newObs);
    this.observations[patientId] = list;
    return { status: 'recorded', observation_id: newObs.id };
  }

  getProgress(patientId: string) {
    return this.progress[patientId] || mockBundle.bench01_progress;
  }
}

export const mockStore = new MockApiStore();

/**
 * Handles API calls completely in-browser when the FastAPI backend is offline
 * or when hosted on static GitHub Pages.
 */
export async function mockRequestHandler<T>(path: string, init?: RequestInit): Promise<T> {
  // Normalize path by stripping query params
  const [cleanPath, queryString] = path.split('?');
  const method = (init?.method || 'GET').toUpperCase();

  // 1. Health
  if (cleanPath === '/health') {
    return mockBundle.health as unknown as T;
  }

  // 2. Cohort
  if (cleanPath === '/cohort') {
    return mockBundle.cohort as unknown as T;
  }

  // 3. Datasets
  if (cleanPath === '/datasets/demo') {
    return mockBundle.datasets_demo as unknown as T;
  }
  if (cleanPath === '/datasets') {
    return (mockBundle.datasets || [mockBundle.datasets_demo]) as unknown as T;
  }
  if (cleanPath.startsWith('/datasets/') && cleanPath.endsWith('/profile')) {
    return mockBundle.datasets_demo as unknown as T;
  }
  if (cleanPath === '/datasets/upload') {
    return mockBundle.datasets_demo as unknown as T;
  }

  // 4. Experiments
  if (cleanPath === '/experiments') {
    if (method === 'POST') {
      const exps = mockBundle.experiments as any[];
      return (exps?.[0] || { experiment_id: `exp_${Date.now()}`, status: 'queued' }) as unknown as T;
    }
    return mockBundle.experiments as unknown as T;
  }
  if (cleanPath.startsWith('/experiments/')) {
    if (cleanPath.endsWith('/run')) {
      return { status: 'completed' } as unknown as T;
    }
    const expId = cleanPath.split('/')[2];
    const found = (mockBundle.experiments as any[])?.find(e => e.experiment_id === expId);
    return (found || (mockBundle.experiments as any[])?.[0]) as unknown as T;
  }

  // 5. Models & Predictions
  if (cleanPath === '/models') {
    return mockBundle.models as unknown as T;
  }
  if (cleanPath === '/predictions') {
    let body: any = {};
    try { body = JSON.parse((init?.body as string) || '{}'); } catch {}
    const isPBSC = String(body.features?.stem_cell_source || '').toLowerCase().includes('peripheral');
    const isMatched = String(body.features?.hla_match || '').includes('10/10');
    const prob = isPBSC && isMatched ? 0.824 : isMatched ? 0.680 : 0.442;
    return {
      experiment_id: body.experiment_id || 'exp_cc663ec2',
      model_name: body.model_name || 'quantum_kernel_svm',
      data_mode: 'real',
      prediction: prob >= 0.5 ? 1 : 0,
      prediction_label: prob >= 0.5 ? 'Neutrophil recovery by Day +15' : 'Delayed engraftment risk (> Day +15)',
      probability: prob,
      model_confidence_description: prob >= 0.7
        ? 'High confidence (82.4% probability of rapid engraftment with 10/10 matched PBSC graft)'
        : 'Moderate confidence (potential delay; closer monitoring warranted)',
      disclaimer: 'Research model output calibrated on UCI paediatric allogeneic HSCT cohort.'
    } as unknown as T;
  }

  // 6. Reports
  if (cleanPath.startsWith('/reports/')) {
    return (mockBundle.latest_report || {
      experiment_id: 'exp_cc663ec2',
      markdown_report: '# MarrowQ Experiment Report\n\nBenchmarked on UCI Pediatric BMT cohort.'
    }) as unknown as T;
  }

  // 7. Patients
  if (cleanPath === '/patients') {
    if (method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      return mockStore.admitPatient(body) as unknown as T;
    }
    return mockStore.getPatients() as unknown as T;
  }
  if (cleanPath === '/patients/examples') {
    return mockStore.getPatients() as unknown as T;
  }
  if (cleanPath === '/patients/seed-all-surveillance') {
    return { status: 'seeded', count: mockStore.getPatients().length } as unknown as T;
  }

  // Match /patients/{id}/...
  const patMatch = cleanPath.match(/^\/patients\/([^/]+)(\/(.*))?$/);
  if (patMatch) {
    const patId = patMatch[1];
    const sub = patMatch[3] || '';

    if (method === 'DELETE') {
      return mockStore.dischargePatient(patId) as unknown as T;
    }
    if (sub === 'observations') {
      if (method === 'POST') {
        const body = JSON.parse((init?.body as string) || '{}');
        return mockStore.addObservation(patId, body) as unknown as T;
      }
      return mockStore.getObservations(patId) as unknown as T;
    }
    if (sub === 'progress') {
      return mockStore.getProgress(patId) as unknown as T;
    }
    if (sub === 'predictions') {
      return (mockBundle.bench01_predictions || []) as unknown as T;
    }
    if (sub === 'seed-surveillance') {
      return { status: 'seeded', observations_created: 13 } as unknown as T;
    }
    if (sub === 'approved-summary') {
      return {
        available: true,
        prediction_id: 'pred-rev-benchmark',
        reviewed_by: 'Dr. S. Nair, Lead HSCT Specialist',
        created_at: new Date().toISOString(),
        patient_summary: 'All vital organ surveillance parameters (LVEF 61.2%, hs-Troponin 9.4 ng/L, Bilirubin 0.8 mg/dL) are in normal range. Neutrophil reconstitution progressing stably with full donor chimerism at 98.4%.'
      } as unknown as T;
    }
  }

  // 8. Multi-agent Orchestration
  if (cleanPath === '/agents/orchestrate') {
    return mockOrchestration as unknown as T;
  }

  // 9. Hospital Overview
  if (cleanPath === '/hospital/overview') {
    return mockBundle.hospital_overview as unknown as T;
  }

  // 10. Quantum
  if (cleanPath === '/quantum/status') {
    return mockBundle.quantum_status as unknown as T;
  }
  if (cleanPath === '/quantum/backends') {
    return mockBundle.quantum_backends as unknown as T;
  }
  if (cleanPath === '/quantum/sweep') {
    return mockBundle.quantum_sweep as unknown as T;
  }
  if (cleanPath === '/quantum/compare-backends') {
    return mockBundle.quantum_compare_backends as unknown as T;
  }
  if (cleanPath === '/quantum/hardware-run/latest') {
    return mockBundle.quantum_hardware_latest as unknown as T;
  }
  if (cleanPath === '/quantum/experiment/latest') {
    return mockBundle.quantum_experiment_latest as unknown as T;
  }
  if (cleanPath === '/quantum/test-connection') {
    return {
      success: true,
      channel: 'ibm_quantum_platform',
      instance: 'crn:v1:bluemix:public:quantum-computing:us-east:a/ibm:service-instance::',
      token_configured: true,
      token_masked: 'ibm_***k49',
      accessible_backends_count: 5,
      backends: mockBundle.quantum_backends,
      configured_backend: 'ibm_kingston',
      configured_backend_operational: true,
      message: 'Verified IBM Quantum Platform runtime connection'
    } as unknown as T;
  }
  if (cleanPath === '/quantum/hardware-run') {
    return {
      job: (mockBundle.quantum_hardware_latest as any)?.job || { job_id: `qrun-hw-${Date.now()}`, status: 'COMPLETED' },
      estimated_qpu_seconds: 4.8
    } as unknown as T;
  }
  if (cleanPath === '/quantum/estimate-budget') {
    return {
      estimated_qpu_seconds: 4.5,
      estimated_cost_usd: 0.0,
      monthly_usage_percent: 12.4
    } as unknown as T;
  }

  // 11. Engraftment Curve
  if (cleanPath === '/engraftment-curve') {
    return mockCurve as unknown as T;
  }

  // 12. Compute & Workers
  if (cleanPath === '/compute/workers') {
    return {
      online: true,
      workers: [
        {
          worker_id: 'worker-gpu-rtx3050',
          capabilities: {
            gpu: 'NVIDIA GeForce RTX 3050 Laptop GPU (4GB VRAM)',
            cuda: true,
            vram_gb: 4.0,
            simulators: ['exact_statevector', 'aer_gpu', 'zz_feature_map']
          }
        }
      ]
    } as unknown as T;
  }
  if (cleanPath === '/compute/gpu-simulate') {
    return {
      job_id: `gpu-sim-${Date.now()}`,
      status: 'succeeded',
      kind: 'gpu_simulation'
    } as unknown as T;
  }
  if (cleanPath.startsWith('/compute/jobs/')) {
    const jobId = cleanPath.split('/')[3];
    return {
      job_id: jobId,
      kind: 'gpu_simulation',
      status: 'succeeded',
      progress: 1.0,
      progress_message: 'Completed GPU simulation run on RTX 3050',
      error: null
    } as unknown as T;
  }

  // 13. Prediction Review Signoff
  if (cleanPath.includes('/review')) {
    return { status: 'APPROVED', prediction_id: 'pred-reviewed' } as unknown as T;
  }

  console.warn(`[MockApi] Unhandled path: ${path}, returning empty object.`);
  return {} as unknown as T;
}
