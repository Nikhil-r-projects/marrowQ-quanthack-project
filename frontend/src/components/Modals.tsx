import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, X } from 'lucide-react';
import { OrganType, Patient } from '../types';
import { COHORT_REFERENCE_DATE, ORGAN_LABELS } from '../data/cohort';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

/** Accessible modal: Escape and backdrop click close it, focus moves inside and returns afterwards. */
export const Modal: React.FC<ModalProps> = ({ title, subtitle, onClose, children, width = 520 }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Close" data-close>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const CallModal: React.FC<{ onClose: () => void; contactName: string; contactRole: string }> = ({ onClose, contactName, contactRole }) => {
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <Modal title="Consultation call" subtitle="Demo telehealth session, no audio is transmitted" onClose={onClose} width={420}>
      <div style={{ textAlign: 'center' }}>
        <div className="avatar" style={{ width: 72, height: 72, fontSize: '1.4rem', margin: '0 auto 0.9rem', boxShadow: '0 0 0 8px rgba(59,130,246,0.12), 0 0 40px rgba(59,130,246,0.45)' }}>
          {contactName.split(' ').slice(-2).map(s => s[0]).join('')}
        </div>
        <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{contactName}</div>
        <div className="small muted">{contactRole}</div>
        <div className="tnum small" style={{ marginTop: '0.4rem', color: 'var(--green-text)' }}>● Connected · {mm}:{ss}</div>

        <div className="inset" style={{ margin: '1.25rem 0', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} aria-hidden>
          {[14, 28, 42, 18, 36, 48, 22, 38, 16, 32, 24, 12].map((h, i) => (
            <div key={i} style={{ width: 4, height: muted ? 4 : h, background: 'var(--accent)', borderRadius: 2, transition: 'height 0.25s ease' }} />
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: '1rem' }}>
          <button className={`icon-btn ${muted ? 'active' : ''}`} style={{ width: 46, height: 46, borderRadius: '50%' }} onClick={() => setMuted(m => !m)} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
            {muted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button className="btn btn-danger" style={{ width: 54, height: 54, borderRadius: '50%', padding: 0 }} onClick={onClose} aria-label="End call">
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface NewPatientModalProps {
  onClose: () => void;
  onAdmit: (patient: Patient) => void;
  existingIds: string[];
}

export const NewPatientModal: React.FC<NewPatientModalProps> = ({ onClose, onAdmit, existingIds }) => {
  const [form, setForm] = useState({
    name: '',
    age: '45',
    gender: 'Female',
    disease: 'Acute Myeloid Leukemia (AML)',
    transplant_type: 'Allogeneic HSCT',
    donor_type: 'Matched Sibling Donor',
    hla_match: '10/10',
    transplant_date: COHORT_REFERENCE_DATE,
    conditioning: 'Flu/Bu Myeloablative',
    cell_dose_cd34: '5.0',
    cmv_status: 'D-/R- (Low Risk)',
    organ: 'marrow' as OrganType
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const age = Number(form.age);
    const dose = Number(form.cell_dose_cd34);
    if (form.name.trim().length < 2) errs.name = 'Enter the patient’s full name';
    if (!Number.isFinite(age) || age < 0 || age > 110) errs.age = 'Age must be between 0 and 110';
    if (!Number.isFinite(dose) || dose < 0.5 || dose > 25) errs.cell_dose_cd34 = 'Typical range is 0.5 – 25 ×10⁶/kg';
    if (!form.transplant_date) errs.transplant_date = 'Required';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    let id: string;
    do { id = `PT-${Math.floor(1000 + Math.random() * 9000)}-BMT`; } while (existingIds.includes(id));
    const auto = form.transplant_type.startsWith('Auto');
    onAdmit({
      patient_id: id,
      name: form.name.trim(),
      age,
      gender: form.gender,
      disease: form.disease,
      transplant_type: form.transplant_type,
      donor_type: auto ? 'Autologous Mobilized Harvest' : form.donor_type,
      transplant_date: form.transplant_date,
      conditioning: form.conditioning,
      cell_dose_cd34: dose,
      chimerism_donor_pct: undefined,
      cmv_status: form.cmv_status,
      hla_match: auto ? 'Autologous' : form.hla_match,
      status: 'New Admission - Pre-Engraftment',
      created_at: new Date().toISOString(),
      primary_organ_type: form.organ,
      organ_label: ORGAN_LABELS[form.organ],
      organ_diagnosis: 'Admission work-up'
    });
  };

  const field = (label: string, key: keyof typeof form, input: React.ReactNode) => (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label" htmlFor={`np-${key}`}>{label}</label>
      {input}
      {errors[key] && <div className="form-hint" style={{ color: 'var(--red-text)' }}>{errors[key]}</div>}
    </div>
  );

  const auto = form.transplant_type.startsWith('Auto');

  return (
    <Modal title="Admit new patient" subtitle="Added to this session’s cohort. Saving to the clinical database comes with the backend patient API." onClose={onClose} width={620}>
      <form onSubmit={submit} noValidate>
        <div className="grid-2" style={{ gap: '0.9rem 1rem' }}>
          {field('Full name', 'name', <input id="np-name" className="form-input" value={form.name} onChange={set('name')} placeholder="e.g. Kira Nerys" autoComplete="off" />)}
          <div className="grid-2" style={{ gap: '0.75rem' }}>
            {field('Age', 'age', <input id="np-age" className="form-input" type="number" min={0} max={110} value={form.age} onChange={set('age')} />)}
            {field('Sex', 'gender', (
              <select id="np-gender" className="form-select" value={form.gender} onChange={set('gender')}>
                <option>Female</option><option>Male</option>
              </select>
            ))}
          </div>
          {field('Diagnosis', 'disease', (
            <select id="np-disease" className="form-select" value={form.disease} onChange={set('disease')}>
              <option>Acute Myeloid Leukemia (AML)</option>
              <option>B-Cell Acute Lymphoblastic Leukemia (B-ALL)</option>
              <option>Myelodysplastic Syndrome (MDS)</option>
              <option>Multiple Myeloma</option>
              <option>Hodgkin Lymphoma</option>
              <option>Aplastic Anemia</option>
            </select>
          ))}
          {field('Transplant type', 'transplant_type', (
            <select id="np-transplant_type" className="form-select" value={form.transplant_type} onChange={set('transplant_type')}>
              <option>Allogeneic HSCT</option>
              <option>Autologous PBSCT</option>
            </select>
          ))}
          {field('Donor', 'donor_type', (
            <select id="np-donor_type" className="form-select" value={auto ? 'Autologous' : form.donor_type} onChange={set('donor_type')} disabled={auto}>
              {auto ? <option>Autologous</option> : <>
                <option>Matched Sibling Donor</option>
                <option>10/10 Matched Unrelated Donor</option>
                <option>9/10 Mismatched Unrelated Donor</option>
                <option>Haploidentical Related Donor</option>
                <option>Umbilical Cord Blood</option>
              </>}
            </select>
          ))}
          {field('HLA match', 'hla_match', (
            <select id="np-hla_match" className="form-select" value={auto ? 'Autologous' : form.hla_match} onChange={set('hla_match')} disabled={auto}>
              {auto ? <option>Autologous</option> : <>
                <option>10/10</option><option>9/10</option><option>8/10</option><option>5/10 Haplo</option>
              </>}
            </select>
          ))}
          {field('Transplant date (Day 0)', 'transplant_date', <input id="np-transplant_date" className="form-input" type="date" value={form.transplant_date} onChange={set('transplant_date')} />)}
          {field('Conditioning', 'conditioning', (
            <select id="np-conditioning" className="form-select" value={form.conditioning} onChange={set('conditioning')}>
              <option>Flu/Bu Myeloablative</option>
              <option>Bu/Cy Myeloablative</option>
              <option>TBI/Cy Myeloablative</option>
              <option>Flu/Mel Reduced Intensity</option>
              <option>High-Dose Melphalan 200 mg/m²</option>
            </select>
          ))}
          {field('CD34+ dose (×10⁶/kg)', 'cell_dose_cd34', <input id="np-cell_dose_cd34" className="form-input" type="number" step="0.1" value={form.cell_dose_cd34} onChange={set('cell_dose_cd34')} />)}
          {field('CMV serostatus', 'cmv_status', (
            <select id="np-cmv_status" className="form-select" value={form.cmv_status} onChange={set('cmv_status')}>
              <option>D-/R- (Low Risk)</option>
              <option>D+/R- (High Risk)</option>
              <option>D-/R+ (Intermediate)</option>
              <option>D+/R+ (Intermediate)</option>
            </select>
          ))}
          {field('Organ to monitor', 'organ', (
            <select id="np-organ" className="form-select" value={form.organ} onChange={set('organ')}>
              {(Object.keys(ORGAN_LABELS) as OrganType[]).map(o => <option key={o} value={o}>{ORGAN_LABELS[o]}</option>)}
            </select>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Admit patient</button>
        </div>
      </form>
    </Modal>
  );
};
