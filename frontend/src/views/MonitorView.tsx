import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertCircle, Clock, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { Experiment } from '../types';
import { fetchExperiment } from '../api';
import { TabId } from '../components/Navigation';

interface MonitorViewProps {
  currentExperiment: Experiment | null;
  onExperimentUpdated: (exp: Experiment) => void;
  onNavigate: (tab: TabId) => void;
}

export const MonitorView: React.FC<MonitorViewProps> = ({
  currentExperiment,
  onExperimentUpdated,
  onNavigate,
}) => {
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!currentExperiment || currentExperiment.status === 'completed' || currentExperiment.status === 'failed') {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const updated = await fetchExperiment(currentExperiment.experiment_id);
        onExperimentUpdated(updated);
        setPollCount((prev) => prev + 1);
      } catch (e) {
        console.error('Failed to poll experiment status', e);
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [currentExperiment, onExperimentUpdated]);

  if (!currentExperiment) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <Clock size={36} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
        <h3>No Experiment in Progress</h3>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Configure and execute a new benchmark in Experiment Setup to monitor its execution lifecycle here.
        </p>
        <button
          className="btn btn-primary"
          style={{ marginTop: '1rem' }}
          onClick={() => onNavigate('setup')}
        >
          Go to Setup
        </button>
      </div>
    );
  }

  const isRunning = currentExperiment.status === 'running' || currentExperiment.status === 'created';
  const isDone = currentExperiment.status === 'completed';
  const isFailed = currentExperiment.status === 'failed';

  const stages = [
    { id: 'validating_and_splitting', label: '1. Validation & Leakage-Safe Splitting' },
    { id: 'training_classical_models', label: '2. Fitting Classical Baselines (4 Models)' },
    { id: 'computing_quantum_kernel', label: '3. Qiskit Statevector Fidelity Kernel' },
    { id: 'completed', label: '4. Evaluation & Artifact Persistence' },
  ];

  const getStageIndex = (stage: string) => {
    if (stage === 'validating_and_splitting') return 0;
    if (stage === 'training_classical_models') return 1;
    if (stage === 'computing_quantum_kernel') return 2;
    if (stage === 'completed') return 4;
    return 0;
  };

  const currentIdx = getStageIndex(currentExperiment.current_stage);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Activity size={18} /> Experiment Execution Lifecycle
            </div>
            <div className="card-subtitle">
              ID: <code>{currentExperiment.experiment_id}</code> | Cohort: {currentExperiment.dataset_name} ({currentExperiment.data_mode.toUpperCase()})
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isRunning && (
              <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                <Loader2 size={12} className="spin" /> Running
              </span>
            )}
            {isDone && (
              <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>
                <CheckCircle2 size={12} /> Completed ({currentExperiment.total_runtime_seconds}s)
              </span>
            )}
            {isFailed && (
              <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>
                <AlertCircle size={12} /> Failed
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar & Stage Stepper */}
        <div style={{ margin: '1.5rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            {stages.map((st, idx) => {
              const isPast = isDone || currentIdx > idx;
              const isCurrent = isRunning && currentIdx === idx;
              return (
                <div
                  key={st.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: isPast ? '#059669' : isCurrent ? '#4f46e5' : '#94a3b8',
                  }}
                >
                  {isPast ? (
                    <CheckCircle2 size={16} />
                  ) : isCurrent ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #cbd5e1' }} />
                  )}
                  <span>{st.label}</span>
                </div>
              );
            })}
          </div>

          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{
                width: isDone ? '100%' : isRunning ? `${Math.max(25, (currentIdx + 1) * 25)}%` : '5%',
              }}
            ></div>
          </div>
        </div>

        {/* Error Alert */}
        {isFailed && (
          <div className="alert-banner alert-error">
            <AlertCircle size={18} />
            <div>
              <strong>Execution Error:</strong> {currentExperiment.error_message}
            </div>
          </div>
        )}

        {/* Live Execution Logs Window */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
            Non-Sensitive Telemetry & Execution Log
          </div>
          <div className="logs-box">
            <div>[INFO] Initialized experiment {currentExperiment.experiment_id}</div>
            <div>[INFO] Dataset: {currentExperiment.dataset_id} | Test size: {currentExperiment.test_size}</div>
            <div>[INFO] Permitted pre-transplant features: {currentExperiment.selected_features.join(', ')}</div>
            <div>[INFO] Imputer & Scaler fitted strictly on training partition (Zero test leakage).</div>
            {currentExperiment.train_sample_count && (
              <div>[INFO] Partition sizes: N_train={currentExperiment.train_sample_count}, N_test={currentExperiment.test_sample_count}</div>
            )}
            {Object.keys(currentExperiment.metrics).map((mKey) => (
              <div key={mKey}>
                [DONE] {currentExperiment.metrics[mKey].display_name}: Acc = {(currentExperiment.metrics[mKey].accuracy * 100).toFixed(1)}%, Duration = {currentExperiment.metrics[mKey].training_time_seconds.toFixed(3)}s
              </div>
            ))}
            {isDone && (
              <div style={{ color: '#4ade80' }}>
                [SUCCESS] Benchmark completed in {currentExperiment.total_runtime_seconds}s. Model artifacts persisted to SQLite and disk.
              </div>
            )}
          </div>
        </div>

        {isDone && (
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('results')}>
              View Detailed Validation Results <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
