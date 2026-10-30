import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BedDouble, Database, Hospital, Server, Users } from 'lucide-react';
import { HospitalOverview, Patient, PatientProgress } from '../types';
import { fetchCohortProgress, fetchHospitalOverview } from '../api';
import { TabId } from '../navigation';
import { daysPostTransplant } from '../data/cohort';
import { organProfile } from '../data/organs';
import { avatarTone, engraftmentDay, initials } from '../lib/format';

interface HospitalAnalyticsViewProps {
  patients: Patient[];
  onOpenPatient: (patientId: string, tab: TabId) => void;
}

export const HospitalAnalyticsView: React.FC<HospitalAnalyticsViewProps> = ({ patients, onOpenPatient }) => {
  const [overview, setOverview] = useState<HospitalOverview | null>(null);
  const [progress, setProgress] = useState<Record<string, PatientProgress>>({});

  useEffect(() => {
    fetchHospitalOverview().then(setOverview);
  }, []);

  useEffect(() => {
    fetchCohortProgress(patients).then(setProgress);
  }, [patients]);

  const rows = useMemo(() => patients.map(p => {
    const pr = progress[p.patient_id];
    const flags = organProfile(p.primary_organ_type ?? 'marrow', p, pr ?? null).metrics.filter(m => m.status !== 'normal' && m.value !== '—');
    const engrafted = pr?.is_anc_engrafted ?? false;
    // Priority: alerts first, then pre-engraftment patients, then the rest.
    const priority = (flags.some(f => f.status === 'alert') ? 0 : flags.length ? 1 : 2) * 2 + (engrafted ? 1 : 0);
    return { p, pr, flags, engrafted, day: daysPostTransplant(p), priority };
  }).sort((a, b) => a.priority - b.priority || a.day - b.day), [patients, progress]);

  const loaded = Object.keys(progress).length > 0;
  const preEngraftment = rows.filter(r => !r.engrafted);
  const engraftDays = rows.filter(r => r.engrafted && r.pr).map(r => engraftmentDay(r.pr!, 'anc')).sort((a, b) => a - b);
  const median = engraftDays.length ? engraftDays[Math.floor((engraftDays.length - 1) / 2)] : null;
  const flagged = rows.filter(r => r.flags.length > 0).length;
  const allo = patients.filter(p => p.transplant_type.includes('Allogeneic')).length;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Hospital size={13} /> Transplant unit</div>
          <h2>Ward & cohort triage</h2>
          <p>Every active transplant patient, sorted so the people who need attention today are at the top.</p>
        </div>
      </div>

      <div className="grid-4">
        <div className="card kpi">
          <span className="kpi-label">Active patients <Users size={15} className="muted" /></span>
          <span className="kpi-value">{patients.length}</span>
          <span className="kpi-foot">{allo} allogeneic · {patients.length - allo} autologous</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Protective isolation <BedDouble size={15} className="muted" /></span>
          <span className="kpi-value">{loaded ? preEngraftment.length : '—'}</span>
          <span className="kpi-foot">Pre-engraftment, need HEPA-filtered rooms</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Median days to ANC engraftment</span>
          <span className="kpi-value">{median != null ? `Day +${median}` : '—'}</span>
          <span className="kpi-foot">{engraftDays.length} engrafted patient{engraftDays.length === 1 ? '' : 's'} so far</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Needs review</span>
          <span className="kpi-value">{flagged}</span>
          <span className="kpi-foot">{overview ? `${overview.cohort_summary.pending_clinician_reviews} model prediction${overview.cohort_summary.pending_clinician_reviews === 1 ? '' : 's'} awaiting sign-off` : 'Organ readings out of range'}</span>
        </div>
      </div>

      <section className="card flush">
        <div className="card-header divided" style={{ padding: '1.1rem 1.25rem 0.9rem', margin: 0 }}>
          <div>
            <div className="card-title"><Activity size={16} /> Cohort triage</div>
            <div className="card-subtitle">Sorted by open alerts, then engraftment status</div>
          </div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Day</th>
                <th>Transplant</th>
                <th>Engraftment</th>
                <th className="num">ANC /µL</th>
                <th>Focus & flags</th>
                <th style={{ textAlign: 'right' }}>Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, pr, flags, engrafted, day }) => (
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
                    <div className="small">{p.disease.split(' (')[0]}</div>
                    <div className="tiny faint">{p.donor_type}</div>
                  </td>
                  <td>
                    {!pr ? <span className="skeleton" style={{ display: 'inline-block', width: 90, height: 20 }} /> : engrafted
                      ? <span className="chip chip-green">Engrafted +{engraftmentDay(pr, 'anc')}</span>
                      : <span className="chip chip-amber">Projected +{pr.expected_anc_engraft_day}</span>}
                  </td>
                  <td className="num tnum">{pr ? Number(pr.clinical_summary.current_anc).toLocaleString() : '—'}</td>
                  <td>
                    <div className="small">{p.organ_label}</div>
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
      </section>

      <section className="card">
        <div className="card-header"><div className="card-title"><Server size={16} /> Platform health</div></div>
        {!overview ? <div className="skeleton" style={{ height: 60 }} /> : (
          <div className="grid-4">
            <div className="stat-box">
              <span className="stat-label">API</span>
              <span className="stat-value" style={{ fontSize: '1.1rem' }}>{overview.service_health.api_status === 'ONLINE' ? 'Online' : 'Offline'}</span>
              <span className="stat-sub">{overview.service_health.api_status === 'ONLINE' ? `${overview.service_health.uptime_pct}% uptime` : 'Static site, computing in the browser'}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label"><Database size={11} style={{ display: 'inline', marginRight: 4 }} />Database</span>
              <span className="stat-value" style={{ fontSize: '1.1rem' }}>{overview.service_health.database.includes('ONLINE') ? 'Connected' : 'Unavailable'}</span>
              <span className="stat-sub">Patients, observations, audit log</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Clinical agents</span>
              <span className="stat-value" style={{ fontSize: '1.1rem' }}>{overview.service_health.orchestrator_agents_active} active</span>
              <span className="stat-sub">Bounded orchestration pipeline</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Quantum service</span>
              <span className="stat-value" style={{ fontSize: '1.1rem' }}>{overview.quantum_service_health.total_quantum_jobs_executed} jobs</span>
              <span className="stat-sub">{overview.quantum_service_health.hardware_readiness === 'AVAILABLE_UPON_TOKEN_CONFIG' ? 'Hardware available once a token is set' : overview.quantum_service_health.hardware_readiness === 'BACKEND_OFFLINE' ? 'Backend offline' : overview.quantum_service_health.hardware_readiness.replace(/_/g, ' ').toLowerCase()}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
