import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, Sparkles, X } from 'lucide-react';
import { CohortOverview, CohortVariable, Patient } from '../types';
import { ApiError, admitPatient, fetchCohort } from '../api';

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

/* Intake follows the cohort's pre-transplant variables. Fields the server derives from others
   (malignant flag, ABO mismatch, CD34:CD3 ratio, allele differences) are not asked for. */
const SECTIONS: { title: string; fields: string[] }[] = [
  { title: 'Recipient', fields: ['recipient_age', 'recipient_sex', 'recipient_body_mass', 'recipient_abo', 'recipient_rh', 'recipient_cmv'] },
  { title: 'Disease', fields: ['disease', 'high_risk', 'second_transplant'] },
  { title: 'Donor & compatibility', fields: ['donor_age', 'donor_abo', 'donor_cmv', 'hla_match', 'hla_antigen_differences', 'female_to_male'] },
  { title: 'Graft', fields: ['stem_cell_source', 'cd34_dose', 'cd3_dose'] }
];

const todayIso = () => new Date().toISOString().slice(0, 10);

interface NewPatientModalProps {
  onClose: () => void;
  onAdmitted: (patient: Patient, warnings: string[]) => void;
}

export const NewPatientModal: React.FC<NewPatientModalProps> = ({ onClose, onAdmitted }) => {
  const [cohort, setCohort] = useState<CohortOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [transplantDate, setTransplantDate] = useState(todayIso());
  const [conditioning, setConditioning] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCohort().then(setCohort).catch((e: Error) => setLoadError(e.message));
  }, []);

  const dictionary = useMemo(() => new Map((cohort?.dictionary ?? []).map(v => [v.name, v])), [cohort]);
  const required = new Set(cohort?.required_for_intake ?? []);
  const set = (name: string, value: string) => setValues(v => ({ ...v, [name]: value }));
  const hla = values.hla_match;

  const loadBenchmarkCase = () => {
    setLabel('Demo Case: Paediatric ALL (10/10 MUD)');
    setConditioning('Bu/Cy Myeloablative');
    setValues({
      recipient_age: '8.5',
      recipient_sex: 'Female',
      recipient_body_mass: '28.4',
      recipient_abo: 'A',
      recipient_rh: '1',
      recipient_cmv: 'Negative',
      disease: 'ALL',
      high_risk: '0',
      second_transplant: '0',
      donor_age: '31.0',
      donor_abo: 'A',
      donor_cmv: 'Positive',
      hla_match: '10/10',
      hla_antigen_differences: '0',
      female_to_male: '0',
      stem_cell_source: 'Peripheral blood',
      cd34_dose: '9.2',
      cd3_dose: '4.1'
    });
    setErrors([]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const local: string[] = [];
    if (!label.trim()) local.push('Enter a name or medical record number.');
    if (!transplantDate) local.push('Enter the stem-cell infusion date (Day 0).');
    for (const name of required) if (!values[name]) local.push(`${dictionary.get(name)?.label ?? name} is required.`);
    setErrors(local);
    if (local.length) return;

    const pretransplant: Record<string, string | number> = {};
    for (const [name, raw] of Object.entries(values)) {
      if (raw === '') continue;
      const kind = dictionary.get(name)?.kind;
      pretransplant[name] = kind === 'categorical' ? raw : Number(raw);
    }
    setSaving(true);
    try {
      const res = await admitPatient({ label: label.trim(), transplant_date: transplantDate, conditioning: conditioning.trim() || undefined, pretransplant });
      onAdmitted(res.patient, res.warnings);
    } catch (err) {
      const detail = err instanceof ApiError ? (err.detail as { errors?: string[] } | undefined) : undefined;
      setErrors(detail?.errors ?? [(err as Error).message]);
      setSaving(false);
    }
  };

  const renderField = (v: CohortVariable) => {
    const id = `np-${v.name}`;
    const isRequired = required.has(v.name);
    let input: React.ReactNode;
    if (v.kind === 'categorical') {
      input = (
        <select id={id} className="form-select" value={values[v.name] ?? ''} onChange={e => set(v.name, e.target.value)}>
          <option value="">{isRequired ? 'Select…' : 'Not recorded'}</option>
          {v.categories?.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      );
    } else if (v.kind === 'binary') {
      input = (
        <select id={id} className="form-select" value={values[v.name] ?? ''} onChange={e => set(v.name, e.target.value)}>
          <option value="">Not recorded</option>
          <option value="1">Yes</option>
          <option value="0">No</option>
        </select>
      );
    } else {
      // Antigen differences only make sense once a mismatched HLA grade is chosen.
      const disabled = v.name === 'hla_antigen_differences' && (!hla || hla === '10/10');
      const max = v.name === 'hla_antigen_differences' && hla ? 10 - Number(hla.split('/')[0]) : undefined;
      input = (
        <input
          id={id} className="form-input" type="number" step="any" min={0} max={max}
          value={disabled ? '' : values[v.name] ?? ''} disabled={disabled}
          placeholder={v.observed_min != null ? `${v.observed_min}–${v.observed_max}` : undefined}
          onChange={e => set(v.name, e.target.value)}
        />
      );
    }
    return (
      <div className="form-group" style={{ marginBottom: 0 }} key={v.name}>
        <label className="form-label" htmlFor={id}>
          {v.label}{v.unit ? ` (${v.unit})` : ''}{isRequired && <span className="faint"> *</span>}
        </label>
        {input}
      </div>
    );
  };

  return (
    <Modal
      title="Admit patient"
      subtitle="Pre-transplant variables follow the UCI cohort the models are trained on. Fields marked * are required; the rest are imputed if unknown."
      onClose={onClose}
      width={720}
    >
      {loadError && <div className="alert-banner alert-error"><CircleAlert /><div>Could not load the intake form: {loadError}</div></div>}
      {!cohort && !loadError && <div className="skeleton" style={{ height: 320 }} />}
      {cohort && (
        <form onSubmit={submit} noValidate className="stack" style={{ gap: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-0.3rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadBenchmarkCase}>
              <Sparkles size={13} /> Load Benchmark Demo Patient (Paediatric ALL · 10/10 MUD)
            </button>
          </div>
          <div className="grid-3" style={{ gap: '0.9rem 1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="np-label">Name or record number <span className="faint">*</span></label>
              <input id="np-label" className="form-input" value={label} onChange={e => setLabel(e.target.value)} autoComplete="off" maxLength={80} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="np-date">Infusion date (Day 0) <span className="faint">*</span></label>
              <input id="np-date" className="form-input" type="date" value={transplantDate} onChange={e => setTransplantDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="np-cond">Conditioning regimen</label>
              <input id="np-cond" className="form-input" value={conditioning} onChange={e => setConditioning(e.target.value)} placeholder="e.g. Bu/Cy myeloablative" maxLength={80} />
            </div>
          </div>
          {SECTIONS.map(section => (
            <fieldset key={section.title} style={{ border: 'none' }}>
              <legend className="small" style={{ fontWeight: 600, marginBottom: '0.6rem' }}>{section.title}</legend>
              <div className="grid-3" style={{ gap: '0.9rem 1rem' }}>
                {section.fields.map(name => dictionary.get(name)).filter((v): v is CohortVariable => !!v).map(renderField)}
              </div>
            </fieldset>
          ))}
          {errors.length > 0 && (
            <div className="alert-banner alert-error" role="alert">
              <CircleAlert />
              <div>{errors.map(e => <div key={e}>{e}</div>)}</div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Admitting…' : 'Admit patient'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
};
