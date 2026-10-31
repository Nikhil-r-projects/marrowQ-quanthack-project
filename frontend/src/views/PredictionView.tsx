import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkles, Target, Trash2, TriangleAlert, Trophy } from 'lucide-react';
import { AvailableModel, CohortOverview, CohortVariable, EngraftmentCurve, Experiment, Patient, PredictionResult } from '../types';
import { fetchAvailableModels, fetchCohort, fetchEngraftmentCurve, predictOutcome } from '../api';
import { EngraftmentCurves } from '../components/EngraftmentCurves';

interface PredictionViewProps {
  currentExperiment: Experiment | null;
  /** Prefills the recipient (and the first option) from the selected patient's intake record. */
  patient: Patient | null;
}

type Values = Record<string, string>;

// Variables from the cohort data dictionary; the server derives malignant flag, ABO mismatch and dose ratio.
const RECIPIENT_FIELDS = ['recipient_age', 'recipient_sex', 'recipient_body_mass', 'disease', 'high_risk', 'recipient_abo', 'recipient_cmv'];
const OPTION_FIELDS = ['hla_match', 'stem_cell_source', 'cd34_dose', 'cd3_dose', 'donor_age', 'donor_abo', 'donor_cmv'];
const MAX_OPTIONS = 4;

interface GraftOption { id: number; name: string; values: Values }

const pick = (source: Record<string, unknown> | null | undefined, fields: string[]): Values =>
  Object.fromEntries(fields.filter(f => source?.[f] != null).map(f => [f, String(source![f])]));

export const PredictionView: React.FC<PredictionViewProps> = ({ currentExperiment, patient }) => {
  const [cohort, setCohort] = useState<CohortOverview | null>(null);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [expId, setExpId] = useState('');
  const [modelKey, setModelKey] = useState('logistic_regression');
  const [recipient, setRecipient] = useState<Values>(() => pick(patient?.pretransplant, RECIPIENT_FIELDS));
  const [options, setOptions] = useState<GraftOption[]>(() => {
    const planned = pick(patient?.pretransplant, OPTION_FIELDS);
    return [
      { id: 1, name: patient ? 'Planned donor' : 'Option A', values: Object.keys(planned).length ? planned : { hla_match: '10/10', stem_cell_source: 'Peripheral blood' } },
      { id: 2, name: 'Alternative', values: { hla_match: '9/10', stem_cell_source: 'Bone marrow' } }
    ];
  });
  const [results, setResults] = useState<Record<number, PredictionResult>>({});
  const [curves, setCurves] = useState<Record<number, EngraftmentCurve>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCohort().then(setCohort).catch((e: Error) => setError(e.message));
    fetchAvailableModels()
      .then(all => {
        // Only models trained on the real cohort understand these variables.
        const list = all.filter(m => m.dataset_name?.startsWith('UCI'));
        setModels(list);
        const exp = list.find(m => m.experiment_id === currentExperiment?.experiment_id) ?? list[0];
        if (exp) {
          setExpId(exp.experiment_id);
          const best = list.filter(m => m.experiment_id === exp.experiment_id && m.model_key !== 'dummy').sort((a, b) => (b.roc_auc ?? 0) - (a.roc_auc ?? 0))[0];
          if (best) setModelKey(best.model_key);
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [currentExperiment?.experiment_id]);

  const dictionary = useMemo(() => new Map((cohort?.dictionary ?? []).map(v => [v.name, v])), [cohort]);
  const experimentIds = useMemo(() => Array.from(new Set(models.map(m => m.experiment_id))), [models]);
  const expModels = models.filter(m => m.experiment_id === expId && m.model_key !== 'dummy');
  const activeModel = expModels.find(m => m.model_key === modelKey);

  const setR = (k: string, v: string) => { setRecipient(r => ({ ...r, [k]: v })); setResults({}); setCurves({}); };
  const setO = (id: number, patch: Partial<GraftOption>) => { setOptions(os => os.map(o => (o.id === id ? { ...o, ...patch } : o))); setResults({}); setCurves({}); };

  const toFeatures = (values: Values) => Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== '').map(([k, v]) => [k, dictionary.get(k)?.kind === 'categorical' ? v : Number(v)])
  );

  const compare = async () => {
    if (!expId) { setError('No model trained on the UCI cohort yet. Run a benchmark from Research → Datasets first.'); return; }
    setRunning(true);
    setError(null);
    try {
      const entries = await Promise.all(options.map(async o => {
        const features = { ...toFeatures(recipient), ...toFeatures(o.values) };
        const [res, curve] = await Promise.all([
          predictOutcome({ experiment_id: expId, model_name: modelKey, features }),
          fetchEngraftmentCurve(features as Record<string, string | number>)
        ]);
        return [o.id, res, curve] as const;
      }));
      setResults(Object.fromEntries(entries.map(([id, r]) => [id, r])));
      setCurves(Object.fromEntries(entries.map(([id, , c]) => [id, c])));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const loadBenchmarkScenario = () => {
    setRecipient({
      recipient_age: '8.5',
      recipient_sex: 'Female',
      recipient_body_mass: '28.4',
      disease: 'ALL',
      high_risk: '0',
      recipient_abo: 'A',
      recipient_cmv: 'Negative',
    });
    setOptions([
      {
        id: 1,
        name: 'Option A: 10/10 MUD (PBSC · CD34 9.2)',
        values: {
          hla_match: '10/10',
          stem_cell_source: 'Peripheral blood',
          cd34_dose: '9.2',
          cd3_dose: '4.1',
          donor_age: '31.0',
          donor_abo: 'A',
          donor_cmv: 'Positive'
        }
      },
      {
        id: 2,
        name: 'Option B: 9/10 MUD (BM · CD34 4.5)',
        values: {
          hla_match: '9/10',
          stem_cell_source: 'Bone marrow',
          cd34_dose: '4.5',
          cd3_dose: '1.8',
          donor_age: '24.0',
          donor_abo: 'O',
          donor_cmv: 'Negative'
        }
      }
    ]);
    setResults({});
    setCurves({});
  };

  const ranked = options
    .map(o => ({ o, r: results[o.id] }))
    .filter(x => x.r?.probability != null)
    .sort((a, b) => (b.r!.probability ?? 0) - (a.r!.probability ?? 0));
  const bestId = ranked[0]?.o.id;
  const spread = ranked.length > 1 ? (ranked[0].r!.probability! - ranked[ranked.length - 1].r!.probability!) : 0;
  const ageRange = cohort?.summary.recipient_age_range;

  const renderInput = (name: string, value: string | undefined, onChange: (v: string) => void) => {
    const v: CohortVariable | undefined = dictionary.get(name);
    if (!v) return null;
    const control = v.kind === 'categorical' ? (
      <select className="form-select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">Not recorded</option>
        {v.categories?.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    ) : v.kind === 'binary' ? (
      <select className="form-select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">Not recorded</option><option value="1">Yes</option><option value="0">No</option>
      </select>
    ) : (
      <input className="form-input" type="number" step="any" min={0} value={value ?? ''} placeholder={v.observed_min != null ? `${v.observed_min}–${v.observed_max}` : undefined} onChange={e => onChange(e.target.value)} />
    );
    return <Field key={name} label={`${v.label}${v.unit ? ` (${v.unit})` : ''}`}>{control}</Field>;
  };

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Target size={13} /> Pre-transplant decision support</div>
          <h2>Engraftment predictor</h2>
          <p>
            Compare candidate donor and graft options for one recipient. Each option is scored by a model trained on the UCI cohort,
            using only information available before transplant.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={loadBenchmarkScenario} type="button">
            <Sparkles size={14} /> Load Demo Clinical Scenario
          </button>
          <button className="btn btn-primary btn-lg" onClick={compare} disabled={running || !expId || !cohort}>
            <Sparkles size={15} /> {running ? 'Scoring…' : `Compare ${options.length} options`}
          </button>
        </div>
      </div>

      {error && <div className="alert-banner alert-error"><TriangleAlert size={16} /><div>{error}</div></div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recipient</div>
              <div className="card-subtitle">{patient?.pretransplant ? `Prefilled from ${patient.name}'s intake record.` : 'Baseline factors at transplant planning.'}</div>
            </div>
          </div>
          {!cohort ? <div className="skeleton" style={{ height: 200 }} /> : (
            <div className="grid-2" style={{ gap: '0.8rem 1rem' }}>
              {RECIPIENT_FIELDS.map(f => renderInput(f, recipient[f], v => setR(f, v)))}
            </div>
          )}

          <div className="menu-sep" style={{ margin: '1.1rem 0' }} />
          <div className="grid-2" style={{ gap: '0.8rem 1rem' }}>
            <Field label="Trained experiment">
              <select className="form-select" value={expId} onChange={e => { setExpId(e.target.value); setResults({}); }}>
                {experimentIds.length === 0 && <option value="">No UCI-trained models yet</option>}
                {experimentIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </Field>
            <Field label="Model">
              <select className="form-select" value={modelKey} onChange={e => { setModelKey(e.target.value); setResults({}); }}>
                {expModels.map(m => <option key={m.model_key} value={m.model_key}>{m.display_name}{m.roc_auc != null ? ` · AUC ${m.roc_auc.toFixed(2)}` : ''}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><Trophy size={16} /> Comparison</div>
              <div className="card-subtitle">Model probability for each option</div>
            </div>
          </div>
          {ranked.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <Target size={28} />
              <p>{expId ? <>Set up the options below, then press <strong>Compare</strong>.</> : 'Train a model on the UCI cohort first (Research → Datasets → Run benchmark).'}</p>
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
                    <div className="tiny faint" style={{ marginTop: '0.25rem' }}>
                      {r!.model_confidence_description}
                      {curves[o.id] && ` Expected recovery: median Day +${curves[o.id].median_day}.`}
                    </div>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: '1rem' }}>
                {spread < 0.05
                  ? 'The options score within 5 points of each other. The model cannot meaningfully separate them.'
                  : `“${ranked[0].o.name}” scores ${(spread * 100).toFixed(0)} points above the lowest option. Weigh GvHD risk, donor availability and timing alongside this.`}
              </p>
              <p className="tiny faint" style={{ marginTop: '0.5rem' }}>Model: {activeModel?.display_name ?? modelKey} · experiment {expId}</p>
            </>
          )}
        </section>
      </div>

      {Object.keys(curves).length > 0 && (() => {
        const series = options.filter(o => curves[o.id]).map(o => ({ id: o.id, name: o.name, curve: curves[o.id] }));
        const model = series[0].curve.model;
        return (
          <section className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Time to neutrophil engraftment</div>
                <div className="card-subtitle">
                  Probability of ANC &gt; 500/µL by each day · {model.name} model, cross-validated C-index {model.c_index_cv.toFixed(2)} (n = {model.n})
                </div>
              </div>
            </div>
            <EngraftmentCurves series={series} />
            <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
              <table className="data-table">
                <thead><tr><th>Option</th><th className="num">Median day</th><th className="num">By Day +14</th><th className="num">By Day +21</th><th className="num">By Day +28</th></tr></thead>
                <tbody>
                  {series.map((sr, i) => (
                    <tr key={sr.id}>
                      <td><span className="row" style={{ gap: '0.5rem' }}><i className="swatch" style={{ background: `var(--series-${i % 4})` }} />{sr.name}</span></td>
                      <td className="num">+{sr.curve.median_day}</td>
                      {[14, 21, 28].map(d => <td key={d} className="num">{(sr.curve.probability_by_day[d] * 100).toFixed(0)}%</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Donor & graft options</div>
            <div className="card-subtitle">Up to {MAX_OPTIONS} options for the same recipient</div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={options.length >= MAX_OPTIONS}
            onClick={() => { const id = Math.max(0, ...options.map(o => o.id)) + 1; setOptions(os => [...os, { id, name: `Option ${id}`, values: {} }]); setResults({}); }}
          >
            <Plus size={13} /> Add option
          </button>
        </div>
        {!cohort ? <div className="skeleton" style={{ height: 180 }} /> : (
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
                  {OPTION_FIELDS.map(f => renderInput(f, o.values[f], v => setO(o.id, { values: { ...o.values, [f]: v } })))}
                </div>
              </div>
            ))}
          </div>
        )}
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
