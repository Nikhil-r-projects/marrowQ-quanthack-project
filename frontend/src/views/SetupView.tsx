import React, { useState } from 'react';
import { Atom, CircleAlert, Database, Play, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { DatasetProfile, Experiment } from '../types';
import { createExperiment, startExperimentRun } from '../api';
import { TabId } from '../navigation';

interface SetupViewProps {
  dataset: DatasetProfile | null;
  onExperimentStarted: (exp: Experiment) => void;
  onNavigate: (tab: TabId) => void;
}

const CLASSICAL = [
  { key: 'runDummy', label: 'Majority-class baseline', hint: 'Floor every model must beat' },
  { key: 'runLogistic', label: 'Logistic regression (L2)', hint: 'Interpretable clinical reference' },
  { key: 'runRandomForest', label: 'Random forest', hint: '200 trees, tuned depth' },
  { key: 'runGradientBoosting', label: 'Gradient boosting', hint: 'Histogram boosting, tuned' },
  { key: 'runRbfSvm', label: 'RBF SVM', hint: 'Tuned C and gamma, calibrated' }
] as const;

export const SetupView: React.FC<SetupViewProps> = ({ dataset, onExperimentStarted, onNavigate }) => {
  const candidateColumns = (dataset?.columns ?? []).filter(c => !c.toLowerCase().endsWith('_id'));
  const [targetColumn, setTargetColumn] = useState<string>(dataset?.suggested_target || 'neutrophil_recovery_day28');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(dataset?.suggested_features || []);
  const [testSize, setTestSize] = useState(0.25);
  const [randomSeed, setRandomSeed] = useState(42);
  const [models, setModels] = useState({ runDummy: true, runLogistic: true, runRandomForest: true, runGradientBoosting: true, runRbfSvm: true, runQuantumSvm: true });
  const [quantumQubits, setQuantumQubits] = useState(2);
  const [quantumReps, setQuantumReps] = useState(1);
  const [quantumMaxSamples, setQuantumMaxSamples] = useState(80);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!dataset) {
    return (
      <div className="card empty-state">
        <Database size={34} />
        <h3>No dataset loaded</h3>
        <p>Load the synthetic cohort or upload a research extract before configuring a benchmark.</p>
        <button className="btn btn-primary" onClick={() => onNavigate('dataset')}>Go to datasets</button>
      </div>
    );
  }

  const featureOptions = candidateColumns.filter(c => c !== targetColumn);
  const toggleFeature = (f: string) => setSelectedFeatures(s => (s.includes(f) ? s.filter(x => x !== f) : [...s, f]));
  const leakageCols = new Set(dataset.potential_leakage_warnings.flatMap(w => dataset.columns.filter(c => w.includes(c))));

  const handleRun = async () => {
    if (selectedFeatures.length === 0) { setErrorMessage('Select at least one feature.'); return; }
    if (!Object.values(models).some(Boolean)) { setErrorMessage('Select at least one model.'); return; }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const exp = await createExperiment({
        dataset_id: dataset.dataset_id,
        target_column: targetColumn,
        selected_features: selectedFeatures,
        test_size: testSize,
        random_state: randomSeed,
        run_dummy: models.runDummy,
        run_logistic: models.runLogistic,
        run_random_forest: models.runRandomForest,
        run_rbf_svm: models.runRbfSvm,
        run_gradient_boosting: models.runGradientBoosting,
        run_quantum_svm: models.runQuantumSvm,
        quantum_qubits: quantumQubits,
        quantum_reps: quantumReps,
        quantum_max_samples: quantumMaxSamples
      });
      await startExperimentRun(exp.experiment_id);
      onExperimentStarted({ ...exp, status: 'running' });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to start the experiment');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><SlidersHorizontal size={13} /> Research · step 2 of 4</div>
          <h2>Configure benchmark</h2>
          <p>Classical models are scored by 5×5 repeated cross-validation with nested tuning, so every patient is predicted by a model that never saw them. Preprocessing is fitted inside each training fold.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary btn-lg" onClick={handleRun} disabled={isSubmitting || selectedFeatures.length === 0}>
            <Play size={15} /> {isSubmitting ? 'Starting…' : 'Run benchmark'}
          </button>
        </div>
      </div>

      {errorMessage && <div className="alert-banner alert-error"><CircleAlert size={16} /><div>{errorMessage}</div></div>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card-header"><div className="card-title">Target & features</div></div>
          <div className="form-group">
            <label className="form-label" htmlFor="target">Outcome (binary)</label>
            <select id="target" className="form-select" value={targetColumn} onChange={e => { setTargetColumn(e.target.value); setSelectedFeatures(s => s.filter(f => f !== e.target.value)); }}>
              {candidateColumns.map(c => <option key={c} value={c}>{c}{c === dataset.suggested_target ? ' (recommended)' : ''}</option>)}
            </select>
          </div>

          <div className="row between" style={{ marginBottom: '0.4rem' }}>
            <span className="form-label" style={{ margin: 0 }}>Pre-transplant features · {selectedFeatures.length} selected</span>
            <div className="row" style={{ gap: '0.35rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFeatures(featureOptions.filter(f => !leakageCols.has(f)))}>All</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFeatures([])}>None</button>
            </div>
          </div>
          <div className="inset feature-list">
            {featureOptions.map(col => (
              <label key={col} className="checkbox-item">
                <input type="checkbox" checked={selectedFeatures.includes(col)} onChange={() => toggleFeature(col)} />
                <code>{col}</code>
                <span className="tiny faint">{dataset.column_types[col]}</span>
                {leakageCols.has(col) && <span className="chip chip-red" style={{ marginLeft: 'auto' }}>Leakage risk</span>}
              </label>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: '1rem', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="test-size">Quantum-model test set · {(testSize * 100).toFixed(0)}%</label>
              <input id="test-size" type="range" className="form-slider" min={0.1} max={0.4} step={0.05} value={testSize} onChange={e => setTestSize(parseFloat(e.target.value))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="seed">Random seed</label>
              <input id="seed" type="number" className="form-input" value={randomSeed} onChange={e => setRandomSeed(parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-header"><div className="card-title">Classical baselines</div></div>
            {CLASSICAL.map(m => (
              <label key={m.key} className="checkbox-item">
                <input type="checkbox" checked={models[m.key]} onChange={e => setModels(s => ({ ...s, [m.key]: e.target.checked }))} />
                <span style={{ flex: 1 }}>{m.label}</span>
                <span className="tiny faint">{m.hint}</span>
              </label>
            ))}
          </section>

          <section className="card" style={{ borderColor: models.runQuantumSvm ? 'color-mix(in srgb, var(--violet) 40%, transparent)' : undefined }}>
            <div className="card-header" style={{ marginBottom: models.runQuantumSvm ? '1rem' : 0, flexWrap: 'nowrap' }}>
              <div>
                <div className="card-title"><Atom size={16} style={{ color: 'var(--violet-text)' }} /> Quantum-kernel SVM</div>
                <div className="card-subtitle">Qiskit FidelityQuantumKernel with a ZZ feature map. Features are compressed with training-fitted PCA to one per qubit.</div>
              </div>
              <label className="checkbox-item" style={{ padding: 0 }}>
                <input type="checkbox" checked={models.runQuantumSvm} onChange={e => setModels(s => ({ ...s, runQuantumSvm: e.target.checked }))} aria-label="Include quantum-kernel SVM" />
              </label>
            </div>
            {models.runQuantumSvm && (
              <div className="grid-3" style={{ gap: '0.75rem' }}>
                <div>
                  <label className="form-label" htmlFor="qubits">Qubits</label>
                  <select id="qubits" className="form-select" value={quantumQubits} onChange={e => setQuantumQubits(parseInt(e.target.value, 10))}>
                    {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="reps">Circuit reps</label>
                  <select id="reps" className="form-select" value={quantumReps} onChange={e => setQuantumReps(parseInt(e.target.value, 10))}>
                    {[1, 2].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="cap">Sample cap</label>
                  <select id="cap" className="form-select" value={quantumMaxSamples} onChange={e => setQuantumMaxSamples(parseInt(e.target.value, 10))}>
                    <option value={40}>40 · fast</option>
                    <option value={80}>80 · standard</option>
                    <option value={120}>120 · slow</option>
                  </select>
                </div>
              </div>
            )}
            {models.runQuantumSvm && <p className="tiny faint" style={{ marginTop: '0.75rem' }}>Kernel cost grows with the square of the sample cap, so 120 samples takes roughly 2.3× as long as 80.</p>}
          </section>

          <div className="row small" style={{ color: 'var(--green-text)' }}>
            <ShieldCheck size={15} /> Imputation, scaling, encoding and PCA are fitted on training data only.
          </div>
        </div>
      </div>
    </div>
  );
};
