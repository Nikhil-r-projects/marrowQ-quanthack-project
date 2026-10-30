import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BrainCircuit, ChartLine, Droplets, Dna, Syringe } from 'lucide-react';
import { ClinicalObservation, OrganType, Patient, UserRole } from '../types';
import { TabId } from '../navigation';
import { fetchPatientObservations } from '../api';
import { daysPostTransplant, latestReadings } from '../data/observations';
import { ORGANS, ORGAN_LABELS, STATUS_LABEL, organProfile } from '../data/organs';

// three.js is large; load the viewer as its own chunk.
const OrganViewer3D = lazy(() => import('../components/OrganViewer3D'));

interface OverviewViewProps {
  patient: Patient;
  role: UserRole;
  onNavigate: (tab: TabId) => void;
}

const ORGAN_THUMBS: Record<OrganType, string> = {
  heart: '/thumbs/heart.webp',
  liver: '/thumbs/liver.webp',
  marrow: '/thumbs/marrow.webp',
  stem: '/thumbs/stem_cell.webp'
};

const TAB_LABELS: Record<OrganType, string> = { marrow: 'Marrow', stem: 'Stem cells', heart: 'Heart', liver: 'Liver' };

const STATUS_CHIP = { normal: 'chip-green', watch: 'chip-amber', alert: 'chip-red', missing: 'chip-neutral' } as const;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtAge = (years: number) => (years < 2 ? `${Math.round(years * 12)} mo` : `${Math.round(years * 10) / 10} y`);

export const OverviewView: React.FC<OverviewViewProps> = ({ patient, role, onNavigate }) => {
  const [observations, setObservations] = useState<ClinicalObservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [organ, setOrgan] = useState<OrganType>('marrow');
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchPatientObservations(patient.patient_id)
      .then(o => { if (live) setObservations(o); })
      .catch((e: Error) => { if (live) setLoadError(e.message); });
    return () => { live = false; };
  }, [patient.patient_id]);

  const profile = useMemo(() => organProfile(organ, patient, observations ?? []), [organ, patient, observations]);
  // Highlight the first out-of-range reading, else the first metric.
  const selectedKey = activeKey ?? (profile.metrics.find(m => m.status === 'alert' || m.status === 'watch') ?? profile.metrics[0]).key;

  const selectOrgan = (o: OrganType) => {
    setOrgan(o);
    setActiveKey(null);
  };

  const day = daysPostTransplant(patient);
  const isPatient = role === 'patient';
  const anc = latestReadings(observations ?? []).anc;
  const ancPct = anc ? Math.min(100, (anc.value / 500) * 100) : 0;
  const flagged = profile.metrics.filter(m => m.status === 'watch' || m.status === 'alert').length;
  const recorded = profile.metrics.filter(m => m.status !== 'missing').length;
  const p = patient.pretransplant ?? {};

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow">{isPatient ? 'Your recovery' : 'Patient overview'}</div>
          <h2>{patient.name}</h2>
          <div className="row wrap" style={{ marginTop: '0.5rem', gap: '0.45rem' }}>
            <span className="chip chip-neutral mono">{patient.patient_id}</span>
            <span className="chip chip-neutral">{fmtAge(patient.age)} · {patient.gender}</span>
            <span className="chip chip-neutral">{patient.disease}</span>
            <span className="chip chip-blue">Day {day >= 0 ? `+${day}` : day} post-transplant</span>
            {patient.source === 'example' && (
              <span className="chip chip-violet" title="Pre-transplant data copied from a real UCI cohort record; labs are entered here.">
                Example · {patient.source_record}
              </span>
            )}
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

      {loadError && <div className="alert-banner alert-error"><div>Could not load observations: {loadError}</div></div>}

      <div className="overview-grid">
        {/* 3D organ stage */}
        <section className="card flush organ-card" aria-label="3D organ view">
          <div className="organ-tabs" role="tablist" aria-label="Organ">
            {ORGANS.map(o => (
              <button key={o} role="tab" aria-selected={organ === o} className={`organ-tab ${organ === o ? 'active' : ''}`} onClick={() => selectOrgan(o)}>
                <img src={ORGAN_THUMBS[o]} alt="" width={36} height={36} loading="lazy" />
                <span><span className="organ-tab-name">{TAB_LABELS[o]}</span></span>
              </button>
            ))}
          </div>
          <Suspense fallback={<div className="organ-stage"><div className="viewer-status"><div className="loader"><div className="ring" /><span>Loading 3D viewer</span></div></div></div>}>
            <OrganViewer3D
              organType={organ}
              metrics={profile.metrics}
              activeMetricKey={selectedKey}
              onSelectMetric={setActiveKey}
              height="clamp(420px, 58vh, 600px)"
            />
          </Suspense>
        </section>

        {/* Organ-specific monitoring */}
        <section className="card monitor-card" aria-label={`${ORGAN_LABELS[organ]} monitoring`}>
          <div className="card-header" style={{ marginBottom: '0.6rem' }}>
            <div>
              <div className="card-title">{profile.title}</div>
              <div className="card-subtitle">{ORGAN_LABELS[organ]}</div>
            </div>
            <span className={`chip ${flagged ? 'chip-amber' : recorded ? 'chip-green' : 'chip-neutral'}`}>
              {flagged ? `${flagged} to watch` : recorded ? 'Recorded values in range' : 'No readings yet'}
            </span>
          </div>
          <p className="small muted" style={{ marginBottom: '1rem' }}>{profile.rationale}</p>

          <div className="metric-list" role="list">
            {profile.metrics.map(m => (
              <button
                key={m.key}
                role="listitem"
                className={`metric-row ${selectedKey === m.key ? 'active' : ''} ${m.status}`}
                onClick={() => setActiveKey(m.key)}
                aria-pressed={selectedKey === m.key}
              >
                <span className="metric-main">
                  <span className="metric-label">{m.label}</span>
                  <span className="metric-value">{m.value}{m.unit && m.value !== '—' && <small>{m.unit}</small>}</span>
                </span>
                <span className="metric-meta">
                  <span className={`chip ${STATUS_CHIP[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                  <span className="tiny faint">Ref {m.reference}</span>
                </span>
                {selectedKey === m.key && <span className="metric-note">{m.note}</span>}
              </button>
            ))}
          </div>
          <div className="tiny faint" style={{ marginTop: '0.9rem' }}>
            {organ === 'stem' ? 'Graft values come from the intake record.' : 'Values are the latest recorded observations.'} Select a reading to locate it on the 3D model.
          </div>
        </section>
      </div>

      <div className="grid-3">
        <section className="card">
          <div className="card-header"><div className="card-title"><Syringe size={16} /> Transplant</div></div>
          <dl className="kv">
            <dt>Type</dt><dd>{patient.transplant_type}</dd>
            <dt>Day 0</dt><dd>{formatDate(patient.transplant_date)}</dd>
            <dt>Conditioning</dt><dd>{patient.conditioning}</dd>
            <dt>Disease risk</dt><dd>{p.high_risk == null ? '—' : p.high_risk ? 'High' : 'Low'}</dd>
            <dt>Second transplant</dt><dd>{p.second_transplant == null ? '—' : p.second_transplant ? 'Yes' : 'No'}</dd>
            <dt>Body mass</dt><dd>{p.recipient_body_mass != null ? `${p.recipient_body_mass} kg` : '—'}</dd>
          </dl>
        </section>

        <section className="card">
          <div className="card-header">
            <div className="card-title"><Droplets size={16} /> Neutrophil engraftment</div>
            {observations && <span className={`chip ${anc && anc.value >= 500 ? 'chip-green' : 'chip-neutral'}`}>{anc ? (anc.value >= 500 ? 'Above threshold' : 'Below threshold') : 'No ANC yet'}</span>}
          </div>
          {!observations ? (
            <div className="stack" style={{ gap: '0.6rem' }}>
              <div className="skeleton" style={{ height: 34, width: '55%' }} />
              <div className="skeleton" style={{ height: 8 }} />
            </div>
          ) : anc ? (
            <>
              <div className="kpi-value">{anc.value.toLocaleString()}<small>ANC cells/µL · Day +{anc.day}</small></div>
              <div className="progress-bar-bg" style={{ margin: '0.9rem 0 0.4rem' }} role="progressbar" aria-valuenow={Math.round(ancPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to 500 cells/µL">
                <div className="progress-bar-fill" style={{ width: `${ancPct}%`, background: ancPct >= 100 ? 'var(--green)' : undefined }} />
              </div>
              <div className="row between tiny faint"><span>0</span><span>Engraftment threshold 500</span></div>
              <p className="small muted" style={{ marginTop: '0.9rem' }}>Engraftment is confirmed by three consecutive daily counts ≥ 500/µL.</p>
            </>
          ) : (
            <p className="small muted">No neutrophil count recorded yet. Record the first draw on the recovery tracker.</p>
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.6rem', paddingLeft: 0 }} onClick={() => onNavigate('progress')}>
            Open recovery tracker <ArrowRight size={13} />
          </button>
        </section>

        <section className="card">
          <div className="card-header"><div className="card-title"><Dna size={16} /> Donor & graft</div></div>
          <dl className="kv">
            <dt>Graft</dt><dd>{p.stem_cell_source ?? '—'}</dd>
            <dt>HLA match</dt><dd>{patient.hla_match ?? '—'}</dd>
            <dt>CD34+ dose</dt><dd>{patient.cell_dose_cd34 != null ? `${patient.cell_dose_cd34} ×10⁶/kg` : '—'}</dd>
            <dt>Donor age</dt><dd>{p.donor_age != null ? `${p.donor_age} y` : '—'}</dd>
            <dt>ABO (D/R)</dt><dd>{p.donor_abo ?? '?'} / {p.recipient_abo ?? '?'}</dd>
            <dt>CMV (D/R)</dt><dd>{patient.cmv_status ?? '—'}</dd>
          </dl>
        </section>
      </div>
    </div>
  );
};
