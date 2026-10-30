import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Cpu, Database, Droplets, Hospital, Server, UserPlus, Users } from 'lucide-react';
import { ClinicalObservation, HospitalOverview, Patient } from '../types';
import { fetchHospitalOverview, fetchPatientObservations } from '../api';
import { TabId } from '../navigation';
import { OBSERVATION_TYPES, daysPostTransplant, latestReadings } from '../data/observations';
import { abnormalMetrics } from '../data/organs';
import { avatarTone, initials } from '../lib/format';

interface HospitalAnalyticsViewProps {
  patients: Patient[];
  onOpenPatient: (patientId: string, tab: TabId) => void;
  onAdmit: () => void;
}

/** First post-infusion day with a recorded ANC ≥ 500/µL, if any. */
function firstAncAbove500(observations: ClinicalObservation[]): number | null {
  const days = observations
    .filter(o => o.metric_type === OBSERVATION_TYPES.anc.label && o.day_post_tx > 0 && o.value >= 500)
    .map(o => o.day_post_tx);
  return days.length ? Math.min(...days) : null;
}

export const HospitalAnalyticsView: React.FC<HospitalAnalyticsViewProps> = ({ patients, onOpenPatient, onAdmit }) => {
  const [overview, setOverview] = useState<HospitalOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [observations, setObservations] = useState<Record<string, ClinicalObservation[]> | null>(null);

  useEffect(() => {
    fetchHospitalOverview().then(setOverview).catch((e: Error) => setOverviewError(e.message));
  }, []);

  useEffect(() => {
    let live = true;
    Promise.all(patients.map(async p => [p.patient_id, await fetchPatientObservations(p.patient_id).catch(() => [])] as const))
      .then(entries => { if (live) setObservations(Object.fromEntries(entries)); });
    return () => { live = false; };
  }, [patients]);

  const rows = useMemo(() => patients.map(p => {
    const obs = observations?.[p.patient_id] ?? [];
    const flags = abnormalMetrics(p, obs);
    const anc = latestReadings(obs).anc;
    const above = firstAncAbove500(obs);
    const recovered = anc != null && anc.value >= 500;
    // Priority: alerts first, then flagged, then patients still below the threshold.
    const priority = (flags.some(f => f.status === 'alert') ? 0 : flags.length ? 1 : 2) * 2 + (recovered ? 1 : 0);
    return { p, flags, anc, above, recovered, day: daysPostTransplant(p), priority };
  }).sort((a, b) => a.priority - b.priority || a.day - b.day), [patients, observations]);

  const below = rows.filter(r => !r.recovered).length;
  const recoveryDays = rows.map(r => r.above).filter((d): d is number => d != null).sort((a, b) => a - b);
  const median = recoveryDays.length ? recoveryDays[Math.floor((recoveryDays.length - 1) / 2)] : null;
  const flagged = rows.filter(r => r.flags.length > 0).length;
  const examples = patients.filter(p => p.source === 'example').length;
  const health = overview?.service_health;
  const quantum = overview?.quantum_service_health;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Hospital size={13} /> Transplant unit</div>
          <h2>Ward & cohort triage</h2>
          <p>Every admitted transplant patient, sorted so the people who need attention today are at the top. Flags come only from recorded observations.</p>
        </div>
        <div className="actions"><button className="btn btn-primary" onClick={onAdmit}><UserPlus size={15} /> Admit patient</button></div>
      </div>

      <div className="grid-4">
        <div className="card kpi">
          <span className="kpi-label">Admitted patients <Users size={15} /></span>
          <span className="kpi-value">{patients.length}</span>
          <span className="kpi-foot">{examples ? `${examples} example${examples === 1 ? '' : 's'} from UCI records` : 'All admitted through intake'}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Below ANC 500 <Droplets size={15} /></span>
          <span className="kpi-value">{observations ? below : '—'}</span>
          <span className="kpi-foot">Latest neutrophil count under 500/µL or not yet recorded</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Median day ANC ≥ 500</span>
          <span className="kpi-value">{median != null ? `Day +${median}` : '—'}</span>
          <span className="kpi-foot">{recoveryDays.length} patient{recoveryDays.length === 1 ? '' : 's'} with a recorded count ≥ 500</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Needs review</span>
          <span className="kpi-value">{observations ? flagged : '—'}</span>
          <span className="kpi-foot">{overview ? `Readings out of range · ${overview.cohort_summary.pending_clinician_reviews} prediction${overview.cohort_summary.pending_clinician_reviews === 1 ? '' : 's'} awaiting sign-off` : 'Readings out of range'}</span>
        </div>
      </div>

      <section className="card flush">
        <div className="card-header divided" style={{ padding: '1.1rem 1.25rem 0.9rem', margin: 0 }}>
          <div>
            <div className="card-title"><Activity size={16} /> Ward triage</div>
            <div className="card-subtitle">Sorted by open alerts, then by neutrophil recovery</div>
          </div>
        </div>
        {patients.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem 1.5rem' }}>
            <p>No patients admitted yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Day</th>
                  <th>Transplant</th>
                  <th>Neutrophils</th>
                  <th className="num">Latest ANC /µL</th>
                  <th>Flags</th>
                  <th style={{ textAlign: 'right' }}>Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, flags, anc, above, recovered, day }) => (
                  <tr key={p.patient_id}>
                    <td>
                      <div className="row">
                        <span className={`avatar ${avatarTone(p.patient_id)}`}>{initials(p.name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div className="tiny faint mono">{p.patient_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="tnum">{day >= 0 ? `+${day}` : day}</td>
                    <td>
                      <div className="small">{p.disease}</div>
                      <div className="tiny faint">{p.donor_type}</div>
                    </td>
                    <td>
                      {!observations ? <span className="skeleton" style={{ display: 'inline-block', width: 90, height: 20 }} />
                        : !anc ? <span className="chip chip-neutral">No ANC yet</span>
                        : recovered ? <span className="chip chip-green">≥ 500{above != null ? ` since +${above}` : ''}</span>
                        : <span className="chip chip-amber">Below 500</span>}
                    </td>
                    <td className="num tnum">{anc ? `${anc.value.toLocaleString()} (+${anc.day})` : '—'}</td>
                    <td>
                      {flags.length > 0
                        ? <div className="tiny" style={{ color: flags.some(f => f.status === 'alert') ? 'var(--red-text)' : 'var(--amber-text)' }}>{flags.map(f => f.label).join(', ')}</div>
                        : <div className="tiny faint">No flags</div>}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onOpenPatient(p.patient_id, 'overview')}>Overview</button>
                      <button className="btn btn-secondary btn-sm" style={{ marginLeft: 6 }} onClick={() => onOpenPatient(p.patient_id, 'progress')}>
                        Recovery <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header"><div className="card-title"><Server size={16} /> Platform health</div></div>
        {overviewError && <div className="small" style={{ color: 'var(--red-text)' }}>{overviewError}</div>}
        {!overview && !overviewError ? <div className="skeleton" style={{ height: 60 }} /> : health && quantum && (
          <div className="grid-4">
            <div className="stat-box">
              <span className="stat-label">API</span>
              <span className="stat-value" style={{ fontSize: '1.1rem' }}>{health.api_status === 'ONLINE' ? 'Online' : 'Offline'}</span>
              <span className="stat-sub">Answering requests now</span>
            </div>
            <div className="stat-box">
              <span className="stat-label"><Database size={11} style={{ display: 'inline', marginRight: 4 }} />Database</span>
              <span className="stat-value" style={{ fontSize: '1.1rem' }}>{health.database === 'ONLINE' ? 'Connected' : 'Unavailable'}</span>
              <span className="stat-sub">Patients, observations, audit log</span>
            </div>
            <div className="stat-box">
              <span className="stat-label"><Cpu size={11} style={{ display: 'inline', marginRight: 4 }} />Compute worker</span>
              <span className="stat-value" style={{ fontSize: '1.1rem' }}>{health.workers_online ? `${health.workers_online} online` : 'Offline'}</span>
              <span className="stat-sub">{health.gpu ?? (health.workers_online ? 'CPU only' : 'Start with python -m app.worker')}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Quantum service</span>
              <span className="stat-value" style={{ fontSize: '1.1rem' }}>{quantum.total_quantum_jobs_executed} jobs</span>
              <span className="stat-sub">{quantum.ibm_connected ? `${quantum.hardware_backends_available} IBM processors available` : `${quantum.backends_available} local simulators · IBM not connected`}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
