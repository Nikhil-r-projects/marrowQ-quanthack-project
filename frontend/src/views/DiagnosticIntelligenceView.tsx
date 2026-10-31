import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, BrainCircuit, CheckCircle2, CircleAlert, Cpu, FileText, ListChecks, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { OrchestrationResult, Patient, UserRole } from '../types';
import { fetchApprovedSummary, runAgentOrchestration, signOffReview } from '../api';

interface DiagnosticIntelligenceViewProps {
  patient: Patient;
  role: UserRole;
}

const STEP_NAMES: Record<string, { name: string; role: string }> = {
  data_quality: { name: 'Data quality', role: 'Ranges, completeness and fit to the training cohort' },
  model_scoring: { name: 'Model scoring', role: 'Trained, cross-validated models score the pre-transplant record' },
  engraftment_time: { name: 'Engraftment time', role: 'Time-to-engraftment model and the GPU forecast' },
  agreement: { name: 'Agreement', role: 'Spread and vote across the trained models' },
  evidence: { name: 'Evidence', role: 'Cohort statistics and the patient’s own counts' },
  report: { name: 'Report', role: 'Draft written from the computed results only' }
};

const pct = (p: number) => `${(p * 100).toFixed(0)}%`;

export const DiagnosticIntelligenceView: React.FC<DiagnosticIntelligenceViewProps> = ({ patient, role }) => {
  const isPatient = role === 'patient';
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [running, setRunning] = useState(!isPatient);
  const [error, setError] = useState<string | null>(null);
  const [reportTab, setReportTab] = useState<'doctor' | 'patient'>('doctor');
  const [reviewer, setReviewer] = useState('');
  const [notes, setNotes] = useState('');
  const [signing, setSigning] = useState(false);
  const [approved, setApproved] = useState<{ available: boolean; patient_summary?: string; reviewed_by?: string; created_at?: string } | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      setResult(await runAgentOrchestration({ patient }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, [patient]);

  useEffect(() => {
    if (isPatient) fetchApprovedSummary(patient.patient_id).then(setApproved).catch(e => setError((e as Error).message));
    else run();
  }, [isPatient, patient.patient_id, run]);

  const signOff = async (decision: 'approve' | 'reject') => {
    if (!result || reviewer.trim().length < 2) return;
    setSigning(true);
    try {
      await signOffReview(result.prediction_id, { decision, reviewer: reviewer.trim(), notes: notes.trim() || undefined });
      setResult({ ...result, review_status: decision === 'approve' ? 'APPROVED' : 'REJECTED' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSigning(false);
    }
  };

  if (isPatient) {
    return (
      <div className="stack">
        <div className="page-header">
          <div>
            <div className="eyebrow"><BrainCircuit size={13} /> Care summary</div>
            <h2>How your recovery is going</h2>
            <p>A plain-language summary your transplant team has reviewed and approved.</p>
          </div>
        </div>
        {error && <div className="alert-banner alert-error"><CircleAlert size={16} /><div>{error}</div></div>}
        {!approved ? <div className="skeleton" style={{ height: 160 }} /> : approved.available ? (
          <section className="card">
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{approved.patient_summary}</p>
            <p className="tiny faint" style={{ marginTop: '1rem' }}>Reviewed by {approved.reviewed_by} · {approved.created_at ? new Date(approved.created_at).toLocaleDateString('en-GB') : ''}</p>
          </section>
        ) : (
          <div className="card empty-state"><FileText size={30} /><p>Your team has not approved a summary yet. It will appear here once they have reviewed your latest results.</p></div>
        )}
      </div>
    );
  }

  const core = result?.models.filter(m => !m.experimental) ?? [];
  const fc = result?.engraftment_time.forecast;
  const warnings = result?.agent_trail.flatMap(a => a.warnings) ?? [];

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><BrainCircuit size={13} /> Clinical review</div>
          <h2>Engraftment review for {patient.name}</h2>
          <p>Trained models score the pre-transplant record, the GPU forecast follows the recorded counts, and a draft report is written from those results only. Nothing is final until a haematologist signs it off.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={run} disabled={running}>
            <RefreshCw size={15} className={running ? 'spin' : ''} /> {running ? 'Running review…' : 'Re-run review'}
          </button>
        </div>
      </div>

      {error && <div className="alert-banner alert-error"><CircleAlert size={16} /><div>{error}</div></div>}
      {running && !result && <div className="skeleton" style={{ height: 320 }} />}

      {result && (
        <>
          <div className="grid-4">
            <div className="card kpi">
              <span className="kpi-label">Trained-model estimate</span>
              <span className="kpi-value">{result.agreement.mean_probability != null ? pct(result.agreement.mean_probability) : '—'}</span>
              <span className="kpi-foot">Mean of {core.length} models · {result.target}</span>
            </div>
            <div className="card kpi">
              <span className="kpi-label">Agreement</span>
              <span className={`chip ${result.agreement.status === 'VALIDATED_CONSENSUS' ? 'chip-green' : 'chip-amber'}`} style={{ alignSelf: 'flex-start' }}>{result.agreement.label}</span>
              <span className="kpi-foot">{result.agreement.variance != null ? `Variance ${result.agreement.variance.toFixed(3)}` : result.model_note ?? ''}</span>
            </div>
            <div className="card kpi">
              <span className="kpi-label">Forecast engraftment</span>
              <span className="kpi-value">{result.engraftment_time.engrafted ? 'Engrafted' : fc?.median_engraftment_day != null ? `Day +${fc.median_engraftment_day}` : '—'}</span>
              <span className="kpi-foot">{fc ? `P(by Day +14) ${pct(fc.probability_engrafted_by[14])} · ${fc.draws_used} draws used` : ''}</span>
            </div>
            <div className="card kpi">
              <span className="kpi-label">Review status</span>
              <span className={`chip ${result.review_status === 'APPROVED' ? 'chip-green' : result.review_status === 'REJECTED' ? 'chip-red' : 'chip-amber'}`} style={{ alignSelf: 'flex-start' }}>
                {result.review_status === 'PENDING_REVIEW' ? 'Awaiting sign-off' : result.review_status === 'APPROVED' ? 'Approved' : 'Rejected'}
              </span>
              <span className="kpi-foot">Review {result.prediction_id}</span>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="alert-banner alert-warn">
              <AlertTriangle size={16} />
              <div>
                <strong>{warnings.length} point{warnings.length === 1 ? '' : 's'} to check</strong>
                <ul style={{ margin: '0.35rem 0 0 1.1rem' }}>{warnings.map(w => <li key={w}>{w}</li>)}</ul>
              </div>
            </div>
          )}

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="card-title"><Cpu size={16} /> Trained models</div>
                  <div className="card-subtitle">Probability of {result.target} · experiment {result.experiment_id ?? '—'}</div>
                </div>
              </div>
              {result.models.length === 0 ? <p className="small muted">{result.model_note}</p> : (
                <div className="stack" style={{ gap: '0.85rem' }}>
                  {result.models.map(m => (
                    <div key={m.key}>
                      <div className="row between small" style={{ marginBottom: '0.3rem' }}>
                        <span className="row" style={{ gap: '0.4rem' }}>{m.display_name}{m.experimental && <span className="chip chip-violet">Experimental</span>}</span>
                        <strong className="tnum">{pct(m.probability)}</strong>
                      </div>
                      <div className="prob-track">
                        <div className={`prob-fill ${m.experimental ? 'quantum' : ''}`} style={{ width: `${m.probability * 100}%` }} />
                        {result.decision_threshold != null && <span className="prob-threshold" style={{ left: `${result.decision_threshold * 100}%` }} />}
                      </div>
                      <div className="tiny faint" style={{ marginTop: '0.2rem' }}>
                        {m.roc_auc_cv != null ? `ROC-AUC ${m.roc_auc_cv.toFixed(2)}${m.roc_auc_ci ? ` (${m.roc_auc_ci[0].toFixed(2)}–${m.roc_auc_ci[1].toFixed(2)})` : ''} · ${m.evaluation}` : m.evaluation}
                      </div>
                    </div>
                  ))}
                  {result.decision_threshold != null && <p className="tiny faint">Marker: decision threshold {pct(result.decision_threshold)} (cohort base rate).</p>}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-header"><div className="card-title"><BookOpen size={16} /> Evidence</div></div>
              <div className="stack" style={{ gap: '0.75rem' }}>
                {result.evidence.map(e => (
                  <div key={e.factor} className="inset">
                    <div className="row between wrap" style={{ gap: '0.4rem' }}>
                      <strong style={{ fontSize: '0.88rem' }}>{e.factor}</strong>
                      <span className="tiny faint">{e.reference_registry}</span>
                    </div>
                    <div className="small muted" style={{ marginTop: '0.2rem' }}>{e.observation}</div>
                    <div className="small" style={{ marginTop: '0.35rem' }}>{e.clinical_impact}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <section className="card">
              <div className="card-header">
                <div>
                  <div className="card-title"><FileText size={16} /> Draft reports</div>
                  <div className="card-subtitle">{result.reports.author === 'template' ? `Written from the template · ${result.reports.note}` : `Drafted by ${result.reports.author} · ${result.reports.note}`}</div>
                </div>
                <div className="seg" role="tablist">
                  <button role="tab" aria-selected={reportTab === 'doctor'} className={`seg-btn ${reportTab === 'doctor' ? 'active' : ''}`} onClick={() => setReportTab('doctor')}>Clinician</button>
                  <button role="tab" aria-selected={reportTab === 'patient'} className={`seg-btn ${reportTab === 'patient' ? 'active' : ''}`} onClick={() => setReportTab('patient')}>Patient</button>
                </div>
              </div>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }} className="small">
                {reportTab === 'doctor' ? result.reports.physician_report : result.reports.patient_summary}
              </p>
            </section>

            <section className="card">
              <div className="card-header"><div className="card-title"><ShieldCheck size={16} /> Sign-off</div></div>
              {result.review_status === 'PENDING_REVIEW' ? (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reviewer">Reviewing haematologist</label>
                    <input id="reviewer" className="form-input" value={reviewer} onChange={e => setReviewer(e.target.value)} maxLength={80} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="review-notes">Notes (optional)</label>
                    <textarea id="review-notes" className="form-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} />
                  </div>
                  <div className="row">
                    <button className="btn btn-primary" disabled={signing || reviewer.trim().length < 2} onClick={() => signOff('approve')}><CheckCircle2 size={15} /> Approve</button>
                    <button className="btn btn-secondary" disabled={signing || reviewer.trim().length < 2} onClick={() => signOff('reject')}><XCircle size={15} /> Reject</button>
                  </div>
                  <p className="tiny faint" style={{ marginTop: '0.6rem' }}>Approval releases the patient summary to the patient view and is recorded in the audit log.</p>
                </>
              ) : (
                <p className="small">This review was {result.review_status === 'APPROVED' ? 'approved' : 'rejected'} and recorded in the audit log.</p>
              )}
            </section>
          </div>

          <section className="card">
            <div className="card-header">
              <div className="card-title"><ListChecks size={16} /> Review steps</div>
              <span className="tiny faint">{(result.duration_ms / 1000).toFixed(1)} s</span>
            </div>
            <ol className="agent-trail">
              {result.agent_trail.map(a => (
                <li key={a.agent_id} className={`agent-step ${a.status.toLowerCase()}`}>
                  <span className="agent-icon">{a.status === 'SUCCESS' ? <CheckCircle2 size={15} /> : a.status === 'WARNING' ? <AlertTriangle size={15} /> : <XCircle size={15} />}</span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: '0.85rem' }}>{STEP_NAMES[a.agent_id]?.name ?? a.agent_id}</strong>
                    <div className="tiny muted">{STEP_NAMES[a.agent_id]?.role}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
};
