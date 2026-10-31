import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, FlaskConical, PlusCircle, Table2, TrendingDown, TrendingUp, Minus, TriangleAlert, Calendar, Activity, ShieldCheck, FileCheck } from 'lucide-react';
import { Patient, PatientProgress, UserRole } from '../types';
import { addPatientObservation, fetchPatientProgress, fetchPatientTimeline } from '../api';
import { TrajectoryChart, TrajectoryMetric } from '../components/TrajectoryChart';
import { Modal } from '../components/Modals';
import { engraftmentDay } from '../lib/format';
import { OBSERVATIONS_CHANGED, OBSERVATION_TYPES, ObservationKey, daysPostTransplant } from '../data/observations';

interface PatientProgressViewProps {
  patient: Patient;
  role: UserRole;
}

const LAB_GROUPS = [...new Set(Object.values(OBSERVATION_TYPES).map(t => t.group))];

const num = (v: number | string | undefined) => (v == null || v === '—' ? NaN : Number(v));
const fmt = (v: number, digits = 0) => (isNaN(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));

export const PatientProgressView: React.FC<PatientProgressViewProps> = ({ patient, role }) => {
  const [progress, setProgress] = useState<PatientProgress | null>(null);
  const [metric, setMetric] = useState<TrajectoryMetric>('anc');
  const [showTable, setShowTable] = useState(false);
  const [showLab, setShowLab] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const load = useCallback(async () => {
    try {
      setProgress(await fetchPatientProgress(patient));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [patient]);

  const loadTimeline = useCallback(async () => {
    if (!patient?.patient_id) return;
    setTimelineLoading(true);
    try {
      const res = await fetchPatientTimeline(patient.patient_id);
      setTimelineData(res);
    } catch (err) {
      console.error('Failed to load patient timeline:', err);
    } finally {
      setTimelineLoading(false);
    }
  }, [patient?.patient_id]);

  useEffect(() => {
    load();
    loadTimeline();
  }, [load, loadTimeline]);

  const isPatient = role === 'patient';
  const s = progress?.clinical_summary;
  const anc = num(s?.current_anc);
  const plt = num(s?.current_plt);
  const hb = num(s?.current_hb);
  const wbc = num(s?.current_wbc);
  const Velocity = s?.velocity === 'Rising' ? TrendingUp : s?.velocity === 'Falling' ? TrendingDown : Minus;

  const latest = progress?.latest_observed_day ?? 0;
  const observedRows = progress?.timeline_series.filter(p => p.is_observed) ?? [];

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow">Recovery tracker</div>
          <h2>{isPatient ? 'Your blood count recovery' : `Engraftment trajectory · ${patient.name}`}</h2>
          <p>{loadError ? `Could not load counts: ${loadError}` : s?.status_description ?? 'Loading the latest counts…'}</p>
        </div>
        {!isPatient && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setShowLab(true)}>
              <PlusCircle size={15} /> Record lab result
            </button>
          </div>
        )}
      </div>

      <div className="grid-4">
        <div className="card kpi">
          <span className="kpi-label">Neutrophils (ANC) <Velocity size={15} className="muted" aria-label={s?.velocity} /></span>
          <span className="kpi-value">{fmt(anc)}<small>cells/µL</small></span>
          <span className="kpi-foot">{progress ? (progress.is_anc_engrafted ? `≥ 500 since Day +${engraftmentDay(progress, 'anc')}` : 'Engraftment threshold 500') : ' '}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Platelets</span>
          <span className="kpi-value">{fmt(plt)}<small>/µL</small></span>
          <span className="kpi-foot">{progress ? (progress.is_plt_engrafted ? `≥ 20,000 since Day +${engraftmentDay(progress, 'plt')}` : 'Engraftment threshold 20,000') : ' '}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Hemoglobin</span>
          <span className="kpi-value">{fmt(hb, 1)}<small>g/dL</small></span>
          <span className="kpi-foot">{isNaN(hb) ? ' ' : hb < 8 ? 'Below transfusion trigger 8.0' : 'Above transfusion trigger'}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">White cells (WBC)</span>
          <span className="kpi-value">{fmt(wbc, 1)}<small>×10³/µL</small></span>
          <span className="kpi-foot">Latest draw Day +{latest}</span>
        </div>
      </div>

      <div className="progress-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">{metric === 'anc' ? 'Neutrophil recovery' : 'Platelet recovery'}</div>
              <div className="card-subtitle">Log scale · recorded draws against a generic reference curve (not fitted to this patient)</div>
            </div>
            <div className="row">
              <div className="seg" role="tablist" aria-label="Count">
                <button role="tab" aria-selected={metric === 'anc'} className={`seg-btn ${metric === 'anc' ? 'active' : ''}`} onClick={() => setMetric('anc')}>ANC</button>
                <button role="tab" aria-selected={metric === 'plt'} className={`seg-btn ${metric === 'plt' ? 'active' : ''}`} onClick={() => setMetric('plt')}>Platelets</button>
              </div>
              <button className={`icon-btn ${showTable ? 'active' : ''}`} onClick={() => setShowTable(t => !t)} aria-pressed={showTable} title="Show data table" aria-label="Show data table">
                <Table2 size={15} />
              </button>
            </div>
          </div>

          {!progress ? (
            <div className="skeleton" style={{ height: 300 }} />
          ) : showTable ? (
            <div className="table-responsive" style={{ maxHeight: 320 }}>
              <table className="data-table">
                <thead><tr><th>Day</th><th className="num">ANC /µL</th><th className="num">Platelets /µL</th><th className="num">Hb g/dL</th><th className="num">WBC ×10³/µL</th></tr></thead>
                <tbody>
                  {observedRows.map(r => (
                    <tr key={r.day}>
                      <td>{r.day >= 0 ? `+${r.day}` : r.day}</td>
                      <td className="num">{r.anc_observed?.toLocaleString() ?? '—'}</td>
                      <td className="num">{r.plt_observed?.toLocaleString() ?? '—'}</td>
                      <td className="num">{r.hb_observed ?? '—'}</td>
                      <td className="num">{r.wbc_observed ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <TrajectoryChart
              points={progress.timeline_series}
              metric={metric}
              latestDay={latest}
              threshold={metric === 'anc' ? 500 : 20000}
              thresholdLabel={metric === 'anc' ? 'Engraftment 500' : 'Engraftment 20K'}
            />
          )}

          <div className="chart-key" style={{ marginTop: '0.75rem' }}>
            <span><i className="key-dot" />Observed</span>
            <span><i className="key-line model" />Generic reference curve</span>
            <span><i className="key-band" />Illustrative range</span>
            <span><i className="key-line threshold" />Engraftment threshold</span>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div className="card-title">Transplant milestones</div></div>
          {!progress ? (
            <div className="stack" style={{ gap: '0.6rem' }}>{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}</div>
          ) : (
            <ol className="milestones">
              {progress.milestones.map(m => {
                const Icon = m.status === 'COMPLETED' ? CheckCircle2 : m.status === 'PROJECTED' ? Clock : m.status === 'DELAYED' ? TriangleAlert : Circle;
                return (
                  <li key={m.id} className={`milestone ${m.status.toLowerCase()}`}>
                    <span className="ms-icon"><Icon size={14} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="row between wrap" style={{ gap: '0.4rem' }}>
                        <strong style={{ fontSize: '0.85rem' }}>{m.name}</strong>
                        <span className="tiny faint">
                          {m.status === 'COMPLETED'
                            ? `Day +${m.actual_day ?? m.target_day}`
                            : m.forecast_interval ?? `Target Day +${m.target_day}`}
                        </span>
                      </div>
                      {m.notes && <div className="small muted">{m.notes}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* Unified Patient Journey Chronological Timeline */}
      <section className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} className="text-accent" />
              Unified Patient Journey Timeline
            </div>
            <div className="card-subtitle">
              Continuous longitudinal record from pre-transplant diagnostic workup to Day +100 recovery surveillance
            </div>
          </div>
          <div className="row wrap" style={{ gap: '0.4rem' }}>
            {['ALL', 'DIAGNOSTIC', 'THERAPEUTIC', 'TRANSPLANT', 'CLINICAL', 'MILESTONE'].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`btn ${filterCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px' }}
                onClick={() => setFilterCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {timelineLoading ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : !timelineData || !timelineData.events ? (
          <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
            <Activity size={24} className="muted" style={{ marginBottom: '0.5rem' }} />
            <div className="muted">No timeline records available for this patient.</div>
          </div>
        ) : (
          <div className="stack" style={{ gap: '1rem', marginTop: '0.5rem' }}>
            <div className="row between wrap" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <span>Span: <strong>{timelineData.timeline_span}</strong></span>
              <span>Events: <strong>{timelineData.total_events} documented</strong></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <ShieldCheck size={14} className="text-success" />
                {timelineData.clinical_governance?.protocol || 'Harmonized BMT Protocol'}
              </span>
            </div>

            <div className="timeline-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {timelineData.events
                .filter((e: any) => filterCategory === 'ALL' || e.category === filterCategory)
                .map((ev: any) => {
                  const dayBadge = ev.day_relative >= 0 ? `Day +${ev.day_relative}` : `Day ${ev.day_relative}`;
                  const isWarning = ev.severity === 'WARNING';
                  const isSuccess = ev.category === 'TRANSPLANT' || ev.category === 'MILESTONE';

                  return (
                    <div
                      key={ev.event_id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '6px',
                        borderLeft: `4px solid ${isWarning ? '#f59e0b' : isSuccess ? '#10b981' : '#3b82f6'}`,
                        background: 'var(--surface-2)',
                        borderTop: '1px solid var(--border)',
                        borderRight: '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div className="row between wrap" style={{ gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: isWarning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: isWarning ? '#d97706' : '#2563eb',
                            }}
                          >
                            {dayBadge}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {ev.phase}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Verified: {ev.verified_by}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        {ev.summary}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </section>

      {showLab && (
        <RecordLabModal
          patient={patient}
          defaultDay={Math.max(0, daysPostTransplant(patient))}
          onClose={() => setShowLab(false)}
          onSaved={async () => { setShowLab(false); window.dispatchEvent(new Event(OBSERVATIONS_CHANGED)); await load(); }}
        />
      )}
    </div>
  );
};

const RecordLabModal: React.FC<{ patient: Patient; defaultDay: number; onClose: () => void; onSaved: () => void }> = ({ patient, defaultDay, onClose, onSaved }) => {
  const [lab, setLab] = useState<ObservationKey>('anc');
  const [day, setDay] = useState(String(defaultDay));
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const opt = OBSERVATION_TYPES[lab];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(value);
    const d = Number(day);
    if (value.trim() === '' || !Number.isFinite(v) || v < opt.min || v > opt.max) {
      setError(`Enter a value between ${opt.min.toLocaleString()} and ${opt.max.toLocaleString()} ${opt.unit}.`);
      return;
    }
    if (!Number.isInteger(d) || d < -30 || d > 365) {
      setError('Day post-transplant must be a whole number between -30 and 365.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addPatientObservation(patient.patient_id, {
        patient_id: patient.patient_id,
        day_post_tx: d,
        recorded_date: new Date().toISOString().slice(0, 10),
        metric_type: opt.label,
        value: v,
        unit: opt.unit,
        source: 'Manual entry'
      });
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save the observation.');
      setSaving(false);
    }
  };

  return (
    <Modal title="Record lab result" subtitle={`${patient.name} · ${patient.patient_id}`} onClose={onClose} width={460}>
      <form onSubmit={submit} noValidate>
        <div className="form-group">
          <label className="form-label" htmlFor="lab-type">Measurement</label>
          <select id="lab-type" className="form-select" value={lab} onChange={e => setLab(e.target.value as ObservationKey)}>
            {LAB_GROUPS.map(g => (
              <optgroup key={g} label={g}>
                {(Object.keys(OBSERVATION_TYPES) as ObservationKey[]).filter(k => OBSERVATION_TYPES[k].group === g).map(k => (
                  <option key={k} value={k}>{OBSERVATION_TYPES[k].label} ({OBSERVATION_TYPES[k].unit})</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid-2" style={{ gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="lab-day">Day post-transplant</label>
            <input id="lab-day" className="form-input" type="number" value={day} onChange={e => setDay(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="lab-value">Value ({opt.unit})</label>
            <input id="lab-value" className="form-input" type="number" step="any" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} placeholder={lab === 'anc' ? 'e.g. 450' : ''} />
          </div>
        </div>
        {error && <div className="alert-banner alert-error"><FlaskConical size={15} /><div>{error}</div></div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save result'}</button>
        </div>
      </form>
    </Modal>
  );
};
