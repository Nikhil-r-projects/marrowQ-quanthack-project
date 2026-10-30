import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, CalendarClock, ChartLine, Droplets, ShieldCheck, Syringe } from 'lucide-react';
import { OrganType, Patient, PatientProgress, UserRole } from '../types';
import { TabId } from '../navigation';
import { fetchPatientProgress } from '../api';
import { COHORT_REFERENCE_DATE, ORGAN_LABELS, daysPostTransplant } from '../data/cohort';
import { STATUS_LABEL, organProfile } from '../data/organs';
import { engraftmentDay } from '../lib/format';

// three.js is large; load the viewer as its own chunk.
const OrganViewer3D = lazy(() => import('../components/OrganViewer3D'));

interface OverviewViewProps {
  patient: Patient;
  role: UserRole;
  onNavigate: (tab: TabId) => void;
}

const ORGAN_ORDER: OrganType[] = ['marrow', 'stem', 'heart', 'liver'];
const ORGAN_THUMBS: Record<OrganType, string> = {
  heart: '/thumbs/heart.webp',
  liver: '/thumbs/liver.webp',
  marrow: '/thumbs/marrow.webp',
  stem: '/thumbs/stem_cell.webp'
};

const TAB_LABELS: Record<OrganType, string> = { marrow: 'Marrow', stem: 'Stem cells', heart: 'Heart', liver: 'Liver' };

const STATUS_CHIP ={ normal: 'chip-green', watch: 'chip-amber', alert: 'chip-red' } as const;

const CARE_TEAM = [
  { name: 'Dr. Hanzer Jon', role: 'Transplant hematologist', tone: '' },
  { name: 'Dr. Steve Alex', role: 'BMT attending', tone: 'violet' },
  { name: 'Priya Raman, RN', role: 'Transplant nurse coordinator', tone: 'green' }
];

const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(iso).toLocaleDateString('en-GB', opts);

export const OverviewView: React.FC<OverviewViewProps> = ({ patient, role, onNavigate }) => {
  const focusOrgan = patient.primary_organ_type ?? 'marrow';
  // Highlight the first out-of-range reading by default.
  const defaultKey = (o: OrganType) => {
    const metrics = organProfile(o, patient, null).metrics;
    return (metrics.find(m => m.status !== 'normal' && m.value !== '—') ?? metrics[0]).key;
  };
  const [organ, setOrgan] = useState<OrganType>(focusOrgan);
  const [activeKey, setActiveKey] = useState<string | null>(() => defaultKey(focusOrgan));
  const [progress, setProgress] = useState<PatientProgress | null>(null);

  useEffect(() => {
    let live = true;
    fetchPatientProgress(patient).then(p => { if (live) setProgress(p); });
    return () => { live = false; };
  }, [patient]);

  const profile = useMemo(() => organProfile(organ, patient, progress), [organ, patient, progress]);

  const selectOrgan = (o: OrganType) => {
    setOrgan(o);
    setActiveKey(defaultKey(o));
  };

  const day = daysPostTransplant(patient);
  const isPatient = role === 'patient';
  const anc = Number(progress?.clinical_summary.current_anc ?? NaN);
  const ancPct = isNaN(anc) ? 0 : Math.min(100, (anc / 500) * 100);
  const nextReview = new Date(Date.parse(COHORT_REFERENCE_DATE) + 2 * 86400000).toISOString();
  const flagged = profile.metrics.filter(m => m.status !== 'normal').length;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow">{isPatient ? 'Your recovery' : 'Patient overview'}</div>
          <h2>{patient.name}</h2>
          <div className="row wrap" style={{ marginTop: '0.5rem', gap: '0.45rem' }}>
            <span className="chip chip-neutral mono">{patient.patient_id}</span>
            <span className="chip chip-neutral">{patient.age} y · {patient.gender}</span>
            <span className="chip chip-neutral">{patient.disease}</span>
            <span className="chip chip-blue">Day {day >= 0 ? `+${day}` : day} post-transplant</span>
            <span className={`chip ${progress?.is_anc_engrafted ? 'chip-green' : 'chip-amber'}`}>
              <span className="chip-dot" />{patient.status}
            </span>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => onNavigate('progress')}>
            <ChartLine size={15} /> Recovery tracker
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('diagnostic')}>
            <BrainCircuit size={15} /> {isPatient ? 'My care summary' : 'Run clinical review'}
          </button>
        </div>
      </div>

      <div className="overview-grid">
        {/* 3D organ stage */}
        <section className="card flush organ-card" aria-label="3D organ view">
          <div className="organ-tabs" role="tablist" aria-label="Organ">
            {ORGAN_ORDER.map(o => (
              <button
                key={o}
                role="tab"
                aria-selected={organ === o}
                className={`organ-tab ${organ === o ? 'active' : ''}`}
                onClick={() => selectOrgan(o)}
              >
                <img src={ORGAN_THUMBS[o]} alt="" width={36} height={36} loading="lazy" />
                <span>
                  <span className="organ-tab-name">{TAB_LABELS[o]}</span>
                  {o === focusOrgan && <span className="organ-tab-tag">Focus</span>}
                </span>
              </button>
            ))}
          </div>
          <Suspense fallback={<div className="organ-stage"><div className="viewer-status"><div className="loader"><div className="ring" /><span>Loading 3D viewer</span></div></div></div>}>
            <OrganViewer3D
              organType={organ}
              metrics={profile.metrics}
              activeMetricKey={activeKey}
              onSelectMetric={setActiveKey}
              bpm={organ === 'heart' && patient.patient_id === 'PT-9042-BMT' ? 96 : 72}
              height="clamp(420px, 58vh, 600px)"
            />
          </Suspense>
        </section>

        {/* Organ-specific monitoring */}
        <section className="card monitor-card" aria-label={`${ORGAN_LABELS[organ]} monitoring`}>
          <div className="card-header" style={{ marginBottom: '0.6rem' }}>
            <div>
              <div className="card-title">{profile.title}</div>
              <div className="card-subtitle">{ORGAN_LABELS[organ]}{organ === focusOrgan ? ` · ${patient.organ_diagnosis}` : ''}</div>
            </div>
            <span className={`chip ${flagged ? 'chip-amber' : 'chip-green'}`}>
              {flagged ? `${flagged} to watch` : 'All in range'}
            </span>
          </div>
          <p className="small muted" style={{ marginBottom: '1rem' }}>{profile.rationale}</p>

          <div className="metric-list" role="list">
            {profile.metrics.map(m => (
              <button
                key={m.key}
                role="listitem"
                className={`metric-row ${activeKey === m.key ? 'active' : ''} ${m.status}`}
                onClick={() => setActiveKey(m.key)}
                aria-pressed={activeKey === m.key}
              >
                <span className="metric-main">
                  <span className="metric-label">{m.label}</span>
                  <span className="metric-value">{m.value}{m.unit && <small>{m.unit}</small>}</span>
                </span>
                <span className="metric-meta">
                  <span className={`chip ${STATUS_CHIP[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                  <span className="tiny faint">Ref {m.reference}</span>
                </span>
                {activeKey === m.key && <span className="metric-note">{m.note}</span>}
              </button>
            ))}
          </div>
          <div className="tiny faint" style={{ marginTop: '0.9rem' }}>
            Select a reading to locate it on the 3D model. Readings are synthetic demonstration values.
          </div>
        </section>
      </div>

      <div className="grid-3">
        <section className="card">
          <div className="card-header"><div className="card-title"><Syringe size={16} /> Transplant</div></div>
          <dl className="kv">
            <dt>Type</dt><dd>{patient.transplant_type}</dd>
            <dt>Donor</dt><dd>{patient.donor_type}</dd>
            <dt>HLA match</dt><dd>{patient.hla_match ?? '—'}</dd>
            <dt>Conditioning</dt><dd>{patient.conditioning}</dd>
            <dt>CD34+ dose</dt><dd>{patient.cell_dose_cd34 != null ? `${patient.cell_dose_cd34} ×10⁶/kg` : '—'}</dd>
            <dt>CMV</dt><dd>{patient.cmv_status ?? '—'}</dd>
            <dt>Day 0</dt><dd>{formatDate(patient.transplant_date)}</dd>
          </dl>
        </section>

        <section className="card">
          <div className="card-header">
            <div className="card-title"><Droplets size={16} /> Neutrophil engraftment</div>
            {progress && <span className={`chip ${progress.is_anc_engrafted ? 'chip-green' : 'chip-amber'}`}>{progress.is_anc_engrafted ? 'Engrafted' : 'Pending'}</span>}
          </div>
          {progress ? (
            <>
              <div className="kpi-value">{isNaN(anc) ? '—' : anc.toLocaleString()}<small>ANC cells/µL</small></div>
              <div className="progress-bar-bg" style={{ margin: '0.9rem 0 0.4rem' }} role="progressbar" aria-valuenow={Math.round(ancPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to 500 cells/µL">
                <div className="progress-bar-fill" style={{ width: `${ancPct}%`, background: ancPct >= 100 ? 'var(--green)' : undefined }} />
              </div>
              <div className="row between tiny faint"><span>0</span><span>Engraftment threshold 500</span></div>
              <p className="small muted" style={{ marginTop: '0.9rem' }}>
                {progress.is_anc_engrafted
                  ? `Engrafted on Day +${engraftmentDay(progress, 'anc')}. Platelets ${progress.is_plt_engrafted ? 'have also engrafted' : `expected around Day +${progress.expected_plt_engraft_day}`}.`
                  : `Projected around Day +${progress.expected_anc_engraft_day}. Trend: ${progress.clinical_summary.velocity.toLowerCase()}.`}
              </p>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.6rem', paddingLeft: 0 }} onClick={() => onNavigate('progress')}>
                Open recovery tracker <ArrowRight size={13} />
              </button>
            </>
          ) : (
            <div className="stack" style={{ gap: '0.6rem' }}>
              <div className="skeleton" style={{ height: 34, width: '55%' }} />
              <div className="skeleton" style={{ height: 8 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div className="card-title"><ShieldCheck size={16} /> Care team</div>
          </div>
          <div className="stack" style={{ gap: '0.75rem' }}>
            {CARE_TEAM.map(c => (
              <div className="row" key={c.name}>
                <span className={`avatar ${c.tone}`}>{c.name.replace('Dr. ', '').split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.name}</div>
                  <div className="tiny muted">{c.role}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="inset row" style={{ marginTop: '1rem', padding: '0.7rem 0.85rem' }}>
            <CalendarClock size={16} className="muted" />
            <div className="small">
              Next review <strong>{formatDate(nextReview, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
