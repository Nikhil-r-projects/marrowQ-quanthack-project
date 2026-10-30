import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldAlert, Sparkles, Target, Trash2, TriangleAlert, Trophy } from 'lucide-react';
import { AvailableModel, Experiment, Patient, PredictionResult } from '../types';
import { fetchAvailableModels, predictOutcome } from '../api';

interface PredictionViewProps {
  currentExperiment: Experiment | null;
  /** Prefills the recipient from the selected patient (clinical roles). */
  patient: Patient | null;
}

interface Recipient {
  recipient_age: number;
  recipient_gender: 'M' | 'F';
  recipient_kps: number;
  recipient_cmv: 'Positive' | 'Negative';
  comorbidity_index: number;
  primary_disease: string;
  disease_status: string;
}

interface GraftOption {
  id: number;
  name: string;
  donor_type: string;
  donor_age: number;
  donor_gender: 'M' | 'F';
  donor_cmv: 'Positive' | 'Negative';
  graft_source: string;
  hla_match_score: number;
  cd34_dose: number;
  total_nucleated_cells: number;
  conditioning_intensity: string;
}

const DISEASE_CODE = (disease: string) =>
  /myeloid leuk/i.test(disease) ? 'AML' : /lymphoblastic/i.test(disease) ? 'ALL' : /myelodysplastic|MDS/i.test(disease) ? 'MDS' : /lymphoma/i.test(disease) ? 'Lymphoma' : 'AML';

const recipientFrom = (p: Patient | null): Recipient => ({
  recipient_age: p?.age ?? 48,
  recipient_gender: p?.gender === 'Male' ? 'M' : 'F',
  recipient_kps: 90,
  recipient_cmv: p?.cmv_status?.includes('R+') ? 'Positive' : 'Negative',
  comorbidity_index: 1,
  primary_disease: p ? DISEASE_CODE(p.disease) : 'AML',
  disease_status: 'CR1'
});

const DEFAULT_OPTIONS: Omit<GraftOption, 'id'>[] = [
  { name: 'Matched sibling · PBSC', donor_type: 'Matched_Sibling', donor_age: 44, donor_gender: 'F', donor_cmv: 'Negative', graft_source: 'PBSC', hla_match_score: 8, cd34_dose: 6.0, total_nucleated_cells: 5.5, conditioning_intensity: 'MAC' },
  { name: 'Haploidentical · bone marrow', donor_type: 'Haploidentical', donor_age: 24, donor_gender: 'M', donor_cmv: 'Negative', graft_source: 'Bone_Marrow', hla_match_score: 6, cd34_dose: 3.2, total_nucleated_cells: 3.4, conditioning_intensity: 'RIC' }
];

const NEW_OPTION: Omit<GraftOption, 'id' | 'name'> = { donor_type: 'MUD', donor_age: 30, donor_gender: 'M', donor_cmv: 'Negative', graft_source: 'PBSC', hla_match_score: 8, cd34_dose: 5.0, total_nucleated_cells: 4.8, conditioning_intensity: 'MAC' };

const MAX_OPTIONS = 4;

export const PredictionView: React.FC<PredictionViewProps> = ({ currentExperiment, patient }) => {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [expId, setExpId] = useState(currentExperiment?.experiment_id ?? '');
  const [modelKey, setModelKey] = useState('logistic_regression');
  const [recipient, setRecipient] = useState<Recipient>(() => recipientFrom(patient));
  const [options, setOptions] = useState<GraftOption[]>(() => DEFAULT_OPTIONS.map((o, i) => ({ ...o, id: i + 1 })));
  const [results, setResults] = useState<Record<number, PredictionResult>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableModels()
      .then(list => {
        setModels(list);
        const exp = list.find(m => m.experiment_id === currentExperiment?.experiment_id) ?? list[0];
        if (exp) {
          setExpId(e => e || exp.experiment_id);
          // Default to the most accurate classical model for this experiment.
          const best = list.filter(m => m.experiment_id === exp.experiment_id && m.model_key !== 'dummy').sort((a, b) => (b.roc_auc ?? 0) - (a.roc_auc ?? 0))[0];
          if (best) setModelKey(best.model_key);
        }
      })
      .catch(() => setError('Could not load trained models.'));
  }, [currentExperiment?.experiment_id]);

  const experimentIds = useMemo(() => Array.from(new Set(models.map(m => m.experiment_id))), [models]);
  const expModels = models.filter(m => m.experiment_id === expId && m.model_key !== 'dummy');
  const activeModel = expModels.find(m => m.model_key === modelKey);

  const setR = <K extends keyof Recipient>(k: K, v: Recipient[K]) => { setRecipient(r => ({ ...r, [k]: v })); setResults({}); };
  const setO = (id: number, patch: Partial<GraftOption>) => { setOptions(os => os.map(o => (o.id === id ? { ...o, ...patch } : o))); setResults({}); };

  const compare = async () => {
    if (!expId) { setError('No trained model is available yet. Run a benchmark first.'); return; }
    const bad = options.find(o => !(o.cd34_dose > 0 && o.cd34_dose <= 25) || !(o.donor_age >= 0 && o.donor_age <= 90));
    if (bad) { setError(`Check “${bad.name}”: CD34+ dose must be 0–25 ×10⁶/kg and donor age 0–90.`); return; }
    if (!(recipient.recipient_age >= 0 && recipient.recipient_age <= 110)) { setError('Recipient age must be 0–110.'); return; }
    setRunning(true);
    setError(null);
    try {
      const entries = await Promise.all(options.map(async o => {
        const { id, name, ...graft } = o;
        void name;
        const res = await predictOutcome({ experiment_id: expId, model_name: modelKey, features: { ...recipient, ...graft } });
        return [id, res] as const;
      }));
      setResults(Object.fromEntries(entries));
    } catch (e: any) {
      setError(e?.message ?? 'Prediction failed');
    } finally {
      setRunning(false);
    }
  };

  const ranked = options
    .map(o => ({ o, r: results[o.id] }))
    .filter(x => x.r?.probability != null)
    .sort((a, b) => (b.r!.probability ?? 0) - (a.r!.probability ?? 0));
  const bestId = ranked[0]?.o.id;
  const spread = ranked.length > 1 ? (ranked[0].r!.probability! - ranked[ranked.length - 1].r!.probability!) : 0;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Target size={13} /> Pre-transplant decision support</div>
          <h2>Engraftment predictor</h2>
          <p>
            Compare candidate donor and graft options for one recipient. Each option is scored for the chance of neutrophil engraftment by Day +28,
            using only information available before transplant.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary btn-lg" onClick={compare} disabled={running || !expId}>
            <Sparkles size={15} /> {running ? 'Scoring…' : `Compare ${options.length} options`}
          </button>
        </div>
      </div>

      <div className="alert-banner alert-warn">
        <ShieldAlert size={16} />
        <div>Decision support only. Trained on synthetic data and not validated for clinical use. Donor selection remains a clinical judgement.</div>
      </div>

      {error && <div className="alert-banner alert-error"><TriangleAlert size={16} /><div>{error}</div></div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recipient</div>
              <div className="card-subtitle">{patient ? `Prefilled from ${patient.name}. Adjust as needed.` : 'Baseline factors at transplant planning.'}</div>
            </div>
          </div>
          <div className="grid-2" style={{ gap: '0.8rem 1rem' }}>
            <Field label="Age"><input className="form-input" type="number" min={0} max={110} value={recipient.recipient_age} onChange={e => setR('recipient_age', Number(e.target.value))} /></Field>
            <Field label="Sex">
              <select className="form-select" value={recipient.recipient_gender} onChange={e => setR('recipient_gender', e.target.value as 'M' | 'F')}><option value="F">Female</option><option value="M">Male</option></select>
            </Field>
            <Field label="Diagnosis">
              <select className="form-select" value={recipient.primary_disease} onChange={e => setR('primary_disease', e.target.value)}>
                <option value="AML">AML</option><option value="ALL">ALL</option><option value="MDS">MDS</option><option value="MPN">MPN</option><option value="Lymphoma">Lymphoma</option>
              </select>
            </Field>
            <Field label="Disease status">
              <select className="form-select" value={recipient.disease_status} onChange={e => setR('disease_status', e.target.value)}>
                <option value="CR1">First remission (CR1)</option><option value="CR2+">CR2 or later</option><option value="Active_Disease">Active disease</option>
              </select>
            </Field>
            <Field label="Karnofsky score">
              <select className="form-select" value={recipient.recipient_kps} onChange={e => setR('recipient_kps', Number(e.target.value))}>
                {[100, 90, 80, 70, 60].map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
            </Field>
            <Field label="HCT-CI comorbidity">
              <input className="form-input" type="number" min={0} max={10} value={recipient.comorbidity_index} onChange={e => setR('comorbidity_index', Number(e.target.value))} />
            </Field>
            <Field label="Recipient CMV">
              <select className="form-select" value={recipient.recipient_cmv} onChange={e => setR('recipient_cmv', e.target.value as Recipient['recipient_cmv'])}><option>Negative</option><option>Positive</option></select>
            </Field>
          </div>

          <div className="menu-sep" style={{ margin: '1.1rem 0' }} />
          <div className="grid-2" style={{ gap: '0.8rem 1rem' }}>
            <Field label="Trained experiment">
              <select className="form-select" value={expId} onChange={e => { setExpId(e.target.value); setResults({}); }}>
                {experimentIds.length === 0 && <option value="">No trained models</option>}
                {experimentIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </Field>
            <Field label="Model">
              <select className="form-select" value={modelKey} onChange={e => { setModelKey(e.target.value); setResults({}); }}>
                {expModels.map(m => <option key={m.model_key} value={m.model_key}>{m.display_name}{m.roc_auc != null ? ` · AUC ${m.roc_auc.toFixed(2)}` : ''}</option>)}
              </select>
            </Field>
          </div>
          {activeModel?.model_key.includes('quantum') && (
            <p className="tiny" style={{ color: 'var(--amber-text)', marginTop: '0.6rem' }}>The quantum-kernel model performed at chance level in the benchmark. Use it for research comparison only.</p>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><Trophy size={16} /> Comparison</div>
              <div className="card-subtitle">Probability of neutrophil engraftment by Day +28</div>
            </div>
          </div>
          {ranked.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <Target size={28} />
              <p>Set up the options below, then press <strong>Compare</strong>.</p>
            </div>
          ) : (
            <>
              <div className="stack" style={{ gap: '0.9rem' }}>
                {ranked.map(({ o, r }) => (
                  <div key={o.id}>
                    <div className="row between small" style={{ marginBottom: '0.35rem' }}>
                      <span className="row" style={{ gap: '0.45rem' }}>
                        {o.name}
                        {o.id === bestId && ranked.length > 1 && <span className="chip chip-green">Highest</span>}
                      </span>
                      <strong className="tnum">{((r!.probability ?? 0) * 100).toFixed(1)}%</strong>
                    </div>
                    <div className="prob-track">
                      <div className="prob-fill" style={{ width: `${(r!.probability ?? 0) * 100}%` }} />
                      <span className="prob-threshold" />
                    </div>
                    <div className="tiny faint" style={{ marginTop: '0.25rem' }}>{r!.prediction_label}</div>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: '1rem' }}>
                {spread < 0.05
                  ? 'The options score within 5 points of each other. The model cannot meaningfully separate them.'
                  : `“${ranked[0].o.name}” scores ${(spread * 100).toFixed(0)} points above the lowest option. Consider GvHD risk, donor availability and timing alongside this.`}
              </p>
              <p className="tiny faint" style={{ marginTop: '0.5rem' }}>Model: {activeModel?.display_name ?? modelKey} · experiment {expId}</p>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Donor & graft options</div>
            <div className="card-subtitle">Up to {MAX_OPTIONS} options for the same recipient</div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={options.length >= MAX_OPTIONS}
            onClick={() => { const id = Math.max(0, ...options.map(o => o.id)) + 1; setOptions(os => [...os, { ...NEW_OPTION, id, name: `Option ${id}` }]); setResults({}); }}
          >
            <Plus size={13} /> Add option
          </button>
        </div>
        <div className="options-grid">
          {options.map(o => (
            <div key={o.id} className={`option-card ${o.id === bestId && ranked.length > 1 ? 'best' : ''}`}>
              <div className="row between" style={{ marginBottom: '0.75rem' }}>
                <input className="option-name" value={o.name} onChange={e => setO(o.id, { name: e.target.value })} aria-label="Option name" />
                <button className="icon-btn ghost" style={{ width: 30, height: 30 }} onClick={() => { setOptions(os => os.filter(x => x.id !== o.id)); setResults({}); }} disabled={options.length <= 1} aria-label={`Remove ${o.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid-2" style={{ gap: '0.65rem 0.75rem' }}>
                <Field label="Donor">
                  <select className="form-select" value={o.donor_type} onChange={e => setO(o.id, { donor_type: e.target.value })}>
                    <option value="Matched_Sibling">Matched sibling</option><option value="MUD">Matched unrelated</option><option value="MMUD">Mismatched unrelated</option><option value="Haploidentical">Haploidentical</option>
                  </select>
                </Field>
                <Field label="Graft source">
                  <select className="form-select" value={o.graft_source} onChange={e => setO(o.id, { graft_source: e.target.value })}>
                    <option value="PBSC">Peripheral blood</option><option value="Bone_Marrow">Bone marrow</option><option value="Cord_Blood">Cord blood</option>
                  </select>
                </Field>
                <Field label="HLA match (of 8)">
                  <select className="form-select" value={o.hla_match_score} onChange={e => setO(o.id, { hla_match_score: Number(e.target.value) })}>
                    {[8, 7, 6, 5, 4].map(v => <option key={v} value={v}>{v}/8</option>)}
                  </select>
                </Field>
                <Field label="Conditioning">
                  <select className="form-select" value={o.conditioning_intensity} onChange={e => setO(o.id, { conditioning_intensity: e.target.value })}>
                    <option value="MAC">Myeloablative</option><option value="RIC">Reduced intensity</option><option value="NMA">Non-myeloablative</option>
                  </select>
                </Field>
                <Field label="CD34+ ×10⁶/kg">
                  <input className="form-input" type="number" step={0.1} min={0} max={25} value={o.cd34_dose} onChange={e => setO(o.id, { cd34_dose: Number(e.target.value) })} />
                </Field>
                <Field label="Donor age">
                  <input className="form-input" type="number" min={0} max={90} value={o.donor_age} onChange={e => setO(o.id, { donor_age: Number(e.target.value) })} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={{ display: 'block' }}>
    <span className="form-label">{label}</span>
    {children}
  </label>
);
