import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, BookOpen, BrainCircuit, CheckCircle2, CircleAlert, Cpu, FileText,
  ListChecks, RefreshCw, Sparkles, UserRound, XCircle
} from 'lucide-react';
import { OrchestrationResult, Patient, UserRole } from '../types';
import { runAgentOrchestration } from '../api';

interface DiagnosticIntelligenceViewProps {
  patient: Patient;
  role: UserRole;
}

type Result = OrchestrationResult & { source: 'backend' | 'browser' };

const AGENT_NAMES: Record<string, { name: string; role: string }> = {
  clinical_data_quality_agent: { name: 'Data quality', role: 'Validates ranges and flags out-of-distribution inputs' },
  clinical_feature_engineering_agent: { name: 'Feature engineering', role: 'Builds classical and quantum feature vectors' },
  classical_ml_prediction_service: { name: 'Classical models', role: 'Logistic regression, random forest, RBF SVM' },
  quantum_ml_prediction_service: { name: 'Quantum kernel model', role: 'ZZFeatureMap fidelity kernel classifier' },
  independent_prediction_validation_agent: { name: 'Independent validation', role: 'Checks agreement and variance across models' },
  evidence_clinical_context_agent: { name: 'Evidence & context', role: 'Links findings to registry evidence' },
  recovery_trajectory_agent: { name: 'Recovery trajectory', role: 'Projects ANC and platelet recovery' },
  clinical_report_agent: { name: 'Report writer', role: 'Drafts clinician and patient summaries' }
};

const MODEL_ROWS: { key: keyof OrchestrationResult['models_comparison']; label: string; quantum?: boolean }[] = [
  { key: 'logistic_regression', label: 'Logistic regression' },
  { key: 'random_forest', label: 'Random forest' },
  { key: 'classical_rbf_svm', label: 'Classical RBF SVM' },
  { key: 'quantum_kernel_svm', label: 'Quantum-kernel SVM', quantum: true }
];

const VALIDATION_COPY: Record<string, { label: string; chip: string; text: string }> = {
  VALIDATED_CONSENSUS: { label: 'Consensus', chip: 'chip-green', text: 'All models agree and variance is low.' },
  VALIDATED_WITH_DISAGREEMENT: { label: 'Models disagree', chip: 'chip-amber', text: 'Models fall on both sides of 50%. Hematologist review required.' },
  VALIDATED_HIGH_VARIANCE: { label: 'High variance', chip: 'chip-amber', text: 'Models agree on direction but spread is wide.' }
};

const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

export const DiagnosticIntelligenceView: React.FC<DiagnosticIntelligenceViewProps> = ({ patient, role }) => {
  const isPatient = role === 'patient';
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportTab, setReportTab] = useState<'doctor' | 'patient'>(isPatient ? 'patient' : 'doctor');

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      setResult(await runAgentOrchestration({ patient, quantum_backend: 'aer_simulator_statevector', execution_mode: 'auto_fallback' }));
    } catch (e: any) {
      setError(e?.message ?? 'Clinical review failed');
    } finally {
      setRunning(false);
    }
  }, [patient]);

  useEffect(() => { run(); }, [run]);

  const validation = result ? VALIDATION_COPY[result.validation_status] ?? { label: result.validation_status, chip: 'chip-neutral', text: '' } : null;
  const probs = result ? MODEL_ROWS.map(r => Number(result.models_comparison[r.key]?.probability ?? 0)) : [];
  const mean = probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : 0;
  const votesYes = probs.filter(p => p >= 0.5).length;
  const quantum = result?.models_comparison.quantum_kernel_svm;
  const warnings = result?.agent_trail.flatMap(a => a.warnings) ?? [];

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><BrainCircuit size={13} /> {isPatient ? 'Care summary' : 'Multi-agent clinical review'}</div>
          <h2>{isPatient ? 'How your recovery is going' : `Engraftment review for ${patient.name}`}</h2>
          <p>
            {isPatient
              ? 'A plain-language summary prepared for you and your family. Your transplant team reviews every result.'
              : 'Eight bounded agents validate the record, run four models, check their agreement and draft reports. Every output stays a draft until a hematologist reviews it.'}
          </p>
        </div>
        <div className="actions">
          {result && (
            <span className={`chip ${result.source === 'backend' ? 'chip-green' : 'chip-neutral'}`} title={result.source === 'backend' ? 'Computed by the MarrowQ API' : 'Backend offline, computed in your browser'}>
              {result.source === 'backend' ? 'Live backend' : 'Computed in browser'}
            </span>
          )}
          <button className="btn btn-primary" onClick={run} disabled={running}>
            <RefreshCw size={15} className={running ? 'spin' : ''} />
            {running ? 'Running agents…' : 'Re-run review'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-banner alert-error"><XCircle size={16} /><div>{error}</div></div>
      )}

      {!result ? (
        <div className="grid-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="card"><div className="skeleton" style={{ height: 14, width: '60%' }} /><div className="skeleton" style={{ height: 34, width: '45%', marginTop: 14 }} /><div className="skeleton" style={{ height: 12, width: '80%', marginTop: 14 }} /></div>)}
        </div>
      ) : isPatient ? (
        <div className="card">
          <div className="card-header"><div className="card-title"><UserRound size={16} /> Your update</div></div>
          <div className="markdown-view" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: '0.95rem' }}>
            {result.reports.patient_friendly_summary}
          </div>
          <p className="small muted" style={{ marginTop: '0.9rem' }}>
            Questions about this update? Use the phone button at the top of the page to contact your care team.
          </p>
        </div>
      ) : (
        <>
          <div className="grid-4">
            <div className="card kpi">
              <span className="kpi-label">Ensemble engraftment likelihood</span>
              <span className="kpi-value">{pct(mean)}</span>
              <span className="kpi-foot">Mean of 4 models · Day +28 neutrophil recovery</span>
            </div>
            <div className="card kpi">
              <span className="kpi-label">Validation</span>
              <span className="kpi-value" style={{ fontSize: '1.25rem' }}><span className={`chip ${validation!.chip}`} style={{ fontSize: '0.85rem' }}>{validation!.label}</span></span>
              <span className="kpi-foot">{validation!.text}</span>
            </div>
            <div className="card kpi">
              <span className="kpi-label">Model agreement</span>
              <span className="kpi-value">{votesYes}/4<small>predict engraftment</small></span>
              <span className="kpi-foot">Inter-model variance σ² = {(probs.reduce((a, p) => a + (p - mean) ** 2, 0) / 4).toFixed(4)}</span>
            </div>
            <div className="card kpi">
              <span className="kpi-label">Quantum execution</span>
              <span className="kpi-value" style={{ fontSize: '1.05rem', lineHeight: 1.35 }}>{quantum?.backend_used ?? '—'}</span>
              <span className="kpi-foot">{quantum?.circuit_width ?? 2} qubits · depth {quantum?.circuit_depth ?? '—'} · {result.duration_ms} ms total</span>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="alert-banner alert-warn">
              <AlertTriangle size={16} />
              <div>
                <strong>{warnings.length} flag{warnings.length > 1 ? 's' : ''} raised by the agents</strong>
                <ul style={{ margin: '0.35rem 0 0 1.1rem' }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            </div>
          )}

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="card-title"><Cpu size={16} /> Model comparison</div>
                  <div className="card-subtitle">Probability of neutrophil engraftment by Day +28</div>
                </div>
              </div>
              <div className="stack" style={{ gap: '0.9rem' }}>
                {MODEL_ROWS.map((r, i) => {
                  const p = probs[i];
                  return (
                    <div key={r.key}>
                      <div className="row between small" style={{ marginBottom: '0.35rem' }}>
                        <span className="row" style={{ gap: '0.45rem' }}>
                          {r.label}
                          {r.quantum && <span className="chip chip-violet">Experimental</span>}
                        </span>
                        <strong className="tnum">{pct(p)}</strong>
                      </div>
                      <div className="prob-track">
                        <div className={`prob-fill ${r.quantum ? 'quantum' : ''}`} style={{ width: `${p * 100}%` }} />
                        <span className="prob-threshold" title="Decision threshold 50%" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="inset small muted" style={{ marginTop: '1.1rem', lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--violet-text)' }}>About the quantum model.</strong>{' '}
                In MarrowQ’s held-out benchmark the 2-qubit quantum kernel reached ROC-AUC 0.48, against 0.77 for logistic regression.
                It is shown for research comparison and should not drive decisions.
                {quantum?.fidelity_to_engraftment_state != null && <> Kernel fidelity to the engrafted reference state: <span className="tnum">{quantum.fidelity_to_engraftment_state}</span>.</>}
              </div>
              {quantum?.transparency_notice && <p className="tiny faint" style={{ marginTop: '0.6rem' }}>{quantum.transparency_notice}</p>}
            </section>

            <section className="card">
              <div className="card-header">
                <div className="card-title"><BookOpen size={16} /> Evidence</div>
              </div>
              <div className="stack" style={{ gap: '0.7rem' }}>
                {result.evidence.map((e, i) => (
                  <div key={i} className="inset" style={{ padding: '0.8rem 0.9rem' }}>
                    <div className="row between" style={{ alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '0.86rem' }}>{e.factor}</strong>
                      <span className="tiny faint" style={{ textAlign: 'right' }}>{e.reference_registry}</span>
                    </div>
                    <div className="small muted" style={{ marginTop: '0.2rem' }}>{e.observation}</div>
                    <div className="small" style={{ marginTop: '0.35rem' }}>{e.clinical_impact}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="card">
            <div className="card-header divided">
              <div className="card-title"><FileText size={16} /> Draft reports</div>
              <div className="seg" role="tablist">
                <button role="tab" aria-selected={reportTab === 'doctor'} className={`seg-btn ${reportTab === 'doctor' ? 'active' : ''}`} onClick={() => setReportTab('doctor')}>For clinicians</button>
                <button role="tab" aria-selected={reportTab === 'patient'} className={`seg-btn ${reportTab === 'patient' ? 'active' : ''}`} onClick={() => setReportTab('patient')}>For the patient</button>
              </div>
            </div>
            <div className="markdown-view" style={{ whiteSpace: 'pre-wrap', fontFamily: reportTab === 'doctor' ? 'var(--font-mono)' : 'var(--font-body)', fontSize: reportTab === 'doctor' ? '0.8rem' : '0.9rem' }}>
              {reportTab === 'doctor' ? result.reports.physician_technical_report : result.reports.patient_friendly_summary}
            </div>
            <div className="row between tiny faint" style={{ marginTop: '0.7rem' }}>
              <span>Generated {new Date(result.reports.generated_at).toLocaleString('en-GB')}</span>
              <span className="mono">{result.prediction_id}</span>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title"><ListChecks size={16} /> Agent audit trail</div>
                <div className="card-subtitle">Bounded, sequential execution. Task <span className="mono">{result.task_id}</span></div>
              </div>
            </div>
            <ol className="agent-trail">
              {result.agent_trail.map((a, i) => {
                const meta = AGENT_NAMES[a.agent_id] ?? { name: a.agent_id, role: '' };
                const Icon = a.status === 'SUCCESS' ? CheckCircle2 : a.status === 'WARNING' ? CircleAlert : XCircle;
                return (
                  <li key={i} className={`agent-step ${a.status.toLowerCase()}`}>
                    <span className="agent-icon"><Icon size={16} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="row between wrap">
                        <strong style={{ fontSize: '0.86rem' }}>{i + 1}. {meta.name}</strong>
                        {a.confidence != null && <span className="tiny faint tnum">confidence {(a.confidence * 100).toFixed(0)}%</span>}
                      </div>
                      <div className="small muted">{meta.role}</div>
                      {a.warnings.length > 0 && <div className="small" style={{ color: 'var(--amber-text)', marginTop: '0.25rem' }}>{a.warnings.join(' ')}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="row tiny faint" style={{ marginTop: '0.75rem' }}>
              <Sparkles size={12} /> Review status: pending clinician sign-off
            </div>
          </section>
        </>
      )}
    </div>
  );
};
