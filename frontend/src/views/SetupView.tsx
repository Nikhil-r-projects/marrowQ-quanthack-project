import React, { useState } from 'react';
import { Sliders, Cpu, Play, CheckSquare, Square, ShieldCheck, AlertCircle } from 'lucide-react';
import { DatasetProfile, Experiment } from '../types';
import { createExperiment, startExperimentRun } from '../api';

interface SetupViewProps {
  dataset: DatasetProfile | null;
  onExperimentStarted: (exp: Experiment) => void;
}

export const SetupView: React.FC<SetupViewProps> = ({ dataset, onExperimentStarted }) => {
  if (!dataset) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <AlertCircle size={36} style={{ margin: '0 auto 0.75rem', color: '#6366f1' }} />
        <h3>No Dataset Available</h3>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Please load or upload a dataset before configuring an experiment.</p>
      </div>
    );
  }

  const [targetColumn, setTargetColumn] = useState<string>(dataset.suggested_target || 'neutrophil_recovery_day28');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(dataset.suggested_features || []);
  const [testSize, setTestSize] = useState<number>(0.25);
  const [randomSeed, setRandomSeed] = useState<number>(42);

  // Model toggles
  const [runDummy, setRunDummy] = useState<boolean>(true);
  const [runLogistic, setRunLogistic] = useState<boolean>(true);
  const [runRandomForest, setRunRandomForest] = useState<boolean>(true);
  const [runRbfSvm, setRunRbfSvm] = useState<boolean>(true);
  const [runQuantumSvm, setRunQuantumSvm] = useState<boolean>(true);

  // Quantum settings
  const [quantumQubits, setQuantumQubits] = useState<number>(2);
  const [quantumReps, setQuantumReps] = useState<number>(1);
  const [quantumMaxSamples, setQuantumMaxSamples] = useState<number>(80);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleFeature = (feat: string) => {
    if (selectedFeatures.includes(feat)) {
      setSelectedFeatures(selectedFeatures.filter((f) => f !== feat));
    } else {
      setSelectedFeatures([...selectedFeatures, feat]);
    }
  };

  const selectAllFeatures = () => {
    setSelectedFeatures(dataset.columns.filter((c) => c !== targetColumn && !c.toLowerCase().endsWith('_id')));
  };

  const clearAllFeatures = () => {
    setSelectedFeatures([]);
  };

  const handleRunExperiment = async () => {
    if (selectedFeatures.length === 0) {
      setErrorMessage('Please select at least one feature for model training.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const exp = await createExperiment({
        dataset_id: dataset.dataset_id,
        target_column: targetColumn,
        selected_features: selectedFeatures,
        test_size: testSize,
        random_state: randomSeed,
        run_dummy: runDummy,
        run_logistic: runLogistic,
        run_random_forest: runRandomForest,
        run_rbf_svm: runRbfSvm,
        run_quantum_svm: runQuantumSvm,
        quantum_qubits: quantumQubits,
        quantum_reps: quantumReps,
        quantum_max_samples: quantumMaxSamples,
      });

      // Start run in background
      await startExperimentRun(exp.experiment_id);
      onExperimentStarted(exp);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start experiment');
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Sliders size={18} /> Configure Scientific Benchmark
            </div>
            <div className="card-subtitle">
              Strictly enforce training-only transformations and evaluate quantum kernel SVM alongside classical baselines.
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleRunExperiment}
            disabled={isSubmitting || selectedFeatures.length === 0}
          >
            <Play size={16} />
            {isSubmitting ? 'Starting...' : 'Execute Benchmark'}
          </button>
        </div>

        {errorMessage && (
          <div className="alert-banner alert-error" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={16} />
            <div>{errorMessage}</div>
          </div>
        )}

        <div className="grid-2">
          {/* Target & Feature Space */}
          <div>
            <div className="form-group">
              <label className="form-label">Prediction Target (Binary Clinical Outcome)</label>
              <select
                className="form-select"
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
              >
                {dataset.columns.map((c) => (
                  <option key={c} value={c}>
                    {c} {c === dataset.suggested_target ? '(Recommended Endpoint)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Permitted Covariates ({selectedFeatures.length} selected)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={selectAllFeatures}
                  >
                    Select All
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={clearAllFeatures}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  padding: '0.5rem',
                  background: '#f8fafc',
                }}
              >
                {dataset.columns
                  .filter((col) => col !== targetColumn && !col.toLowerCase().endsWith('_id'))
                  .map((col) => {
                    const isChecked = selectedFeatures.includes(col);
                    return (
                      <div
                        key={col}
                        className="checkbox-item"
                        onClick={() => toggleFeature(col)}
                      >
                        {isChecked ? (
                          <CheckSquare size={16} color="#4f46e5" />
                        ) : (
                          <Square size={16} color="#94a3b8" />
                        )}
                        <span style={{ fontSize: '0.825rem' }}>
                          <code>{col}</code> ({dataset.column_types[col]})
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Split & Seed */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Held-Out Test Ratio: {(testSize * 100).toFixed(0)}%</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="0.10"
                    max="0.40"
                    step="0.05"
                    className="form-slider"
                    value={testSize}
                    onChange={(e) => setTestSize(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Random Seed</label>
                <input
                  type="number"
                  className="form-input"
                  value={randomSeed}
                  onChange={(e) => setRandomSeed(parseInt(e.target.value) || 42)}
                />
              </div>
            </div>
          </div>

          {/* Model Suite Selection & Quantum Parameters */}
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.5rem' }}>
                Classical Baseline Suite
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <label className="checkbox-item">
                  <input type="checkbox" checked={runDummy} onChange={(e) => setRunDummy(e.target.checked)} />
                  <span>Dummy Classifier</span>
                </label>
                <label className="checkbox-item">
                  <input type="checkbox" checked={runLogistic} onChange={(e) => setRunLogistic(e.target.checked)} />
                  <span>Logistic Regression</span>
                </label>
                <label className="checkbox-item">
                  <input type="checkbox" checked={runRandomForest} onChange={(e) => setRunRandomForest(e.target.checked)} />
                  <span>Random Forest</span>
                </label>
                <label className="checkbox-item">
                  <input type="checkbox" checked={runRbfSvm} onChange={(e) => setRunRbfSvm(e.target.checked)} />
                  <span>Classical RBF SVM</span>
                </label>
              </div>
            </div>

            {/* Quantum Experiment Box */}
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: '#4338ca' }}>
                  <Cpu size={18} /> Quantum-Kernel SVM (Qiskit ML)
                </div>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                  checked={runQuantumSvm}
                  onChange={(e) => setRunQuantumSvm(e.target.checked)}
                />
              </div>

              {runQuantumSvm && (
                <div>
                  <p style={{ fontSize: '0.78rem', color: '#6d28d9', marginBottom: '0.85rem' }}>
                    Constructs a <code>FidelityQuantumKernel</code> with <code>ZZFeatureMap</code>. Features are compressed via training-fitted PCA to match qubit dimension.
                  </p>

                  <div className="grid-3">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Qubits</label>
                      <select
                        className="form-select"
                        value={quantumQubits}
                        onChange={(e) => setQuantumQubits(parseInt(e.target.value))}
                      >
                        <option value={2}>2 Qubits</option>
                        <option value={3}>3 Qubits</option>
                        <option value={4}>4 Qubits</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Circuit Reps</label>
                      <select
                        className="form-select"
                        value={quantumReps}
                        onChange={(e) => setQuantumReps(parseInt(e.target.value))}
                      >
                        <option value={1}>1 Rep</option>
                        <option value={2}>2 Reps</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Sample Cap</label>
                      <select
                        className="form-select"
                        value={quantumMaxSamples}
                        onChange={(e) => setQuantumMaxSamples(parseInt(e.target.value))}
                      >
                        <option value={40}>N = 40 (Fast)</option>
                        <option value={80}>N = 80 (Standard)</option>
                        <option value={120}>N = 120 (Deep)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Leakage Protection Guarantee */}
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#059669' }}>
              <ShieldCheck size={16} />
              <span>Strict Scikit-Learn Leakage Protection Protocol Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
