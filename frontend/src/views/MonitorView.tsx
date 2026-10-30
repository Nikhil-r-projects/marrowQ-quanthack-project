import React, { useEffect } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, Clock, Gauge, Info, LoaderCircle } from 'lucide-react';
import { Experiment } from '../types';
import { fetchExperiment } from '../api';
import { TabId } from '../navigation';

interface MonitorViewProps {
  currentExperiment: Experiment | null;
  onExperimentUpdated: (exp: Experiment) => void;
  onNavigate: (tab: TabId) => void;
}

const STAGES = [
  { id: 'validating_and_splitting', label: 'Validate & split', detail: 'Leakage screen, stratified train/test split' },
  { id: 'training_classical_models', label: 'Classical baselines', detail: 'Baseline, logistic regression, random forest, RBF SVM' },
  { id: 'computing_quantum_kernel', label: 'Quantum kernel', detail: 'Fidelity Gram matrix and precomputed-kernel SVM' },
  { id: 'completed', label: 'Evaluate & save', detail: 'Held-out metrics, artifacts, report' }
];

const stageIndex = (stage: string) => {
  const i = STAGES.findIndex(s => s.id === stage);
  return i === -1 ? 0 : i;
};

export const MonitorView: React.FC<MonitorViewProps> = ({ currentExperiment, onExperimentUpdated, onNavigate }) => {
  const id = currentExperiment?.experiment_id;
  const status = currentExperiment?.status;

  useEffect(() => {
    if (!id || status === 'completed' || status === 'failed') return;
    const timer = window.setInterval(async () => {
      try {
        onExperimentUpdated(await fetchExperiment(id));
      } catch (e) {
        console.error('Failed to poll experiment status', e);
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [id, status, onExperimentUpdated]);

  if (!currentExperiment) {
    return (
      <div className="card empty-state">
        <Clock size={34} />
        <h3>No run in progress</h3>
        <p>Configure and start a benchmark to follow its stages here.</p>
        <button className="btn btn-primary" onClick={() => onNavigate('setup')}>Configure benchmark</button>
      </div>
    );
  }

  const exp = currentExperiment;
  const isDone = exp.status === 'completed';
  const isFailed = exp.status === 'failed';
  const isRunning = !isDone && !isFailed;
  const current = isDone ? STAGES.length : stageIndex(exp.current_stage);
  const pct = isDone ? 100 : Math.max(8, (current / STAGES.length) * 100 + 8);
  const offlineReplay = exp.config?.offline_replay_of;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Gauge size={13} /> Research · step 3 of 4</div>
          <h2>Run monitor</h2>
          <p>Experiment <code>{exp.experiment_id}</code> on {exp.dataset_name}</p>
        </div>
        <div className="actions">
          {isRunning && <span className="chip chip-blue"><LoaderCircle size={12} className="spin" /> Running</span>}
          {isDone && <span className="chip chip-green"><CheckCircle2 size={12} /> Completed{exp.total_runtime_seconds != null ? ` in ${exp.total_runtime_seconds}s` : ''}</span>}
          {isFailed && <span className="chip chip-red"><CircleAlert size={12} /> Failed</span>}
          {isDone && <button className="btn btn-primary" onClick={() => onNavigate('results')}>View results <ArrowRight size={14} /></button>}
        </div>
      </div>

      {offlineReplay && (
        <div className="alert-banner alert-info">
          <Info size={16} />
          <div>The backend is offline, so no models were trained in this run. It replays the stored reference benchmark (<code>{offlineReplay}</code>) to demonstrate the workflow.</div>
        </div>
      )}

      <section className="card">
        <ol className="stepper">
          {STAGES.map((s, i) => {
            const state = isDone || i < current ? 'done' : isRunning && i === current ? 'active' : isFailed && i === current ? 'failed' : 'todo';
            return (
              <li key={s.id} className={`step ${state}`}>
                <span className="step-icon">
                  {state === 'done' ? <CheckCircle2 size={16} /> : state === 'active' ? <LoaderCircle size={16} className="spin" /> : state === 'failed' ? <CircleAlert size={16} /> : i + 1}
                </span>
                <div>
                  <div className="step-label">{s.label}</div>
                  <div className="tiny muted">{s.detail}</div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="progress-bar-bg" style={{ marginTop: '1.25rem' }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Run progress">
          <div className="progress-bar-fill" style={{ width: `${pct}%`, background: isFailed ? 'var(--red)' : isDone ? 'var(--green)' : undefined }} />
        </div>
      </section>

      {isFailed && (
        <div className="alert-banner alert-error"><CircleAlert size={16} /><div><strong>Run failed.</strong> {exp.error_message}</div></div>
      )}

      <section className="card">
        <div className="card-header"><div className="card-title">Execution log</div><span className="tiny faint">No patient-level data is logged</span></div>
        <div className="logs-box" aria-live="polite">
          <div><span className="log-info">[info]</span> Experiment {exp.experiment_id} initialised</div>
          <div><span className="log-info">[info]</span> Dataset {exp.dataset_id} · test size {exp.test_size} · seed {exp.random_state}</div>
          <div><span className="log-info">[info]</span> Features ({exp.selected_features.length}): {exp.selected_features.join(', ')}</div>
          <div><span className="log-info">[info]</span> Imputer, scaler and encoder fitted on the training partition only</div>
          {exp.train_sample_count != null && <div><span className="log-info">[info]</span> N_train = {exp.train_sample_count}, N_test = {exp.test_sample_count}</div>}
          {isRunning && <div><span className="log-info">[info]</span> Stage: {STAGES[current]?.label ?? exp.current_stage}…</div>}
          {Object.entries(exp.metrics).map(([k, m]) => (
            <div key={k}><span className="log-done">[done]</span> {m.display_name}: accuracy {(m.accuracy * 100).toFixed(1)}%, AUC {m.roc_auc != null ? m.roc_auc.toFixed(3) : '—'}, {m.training_time_seconds.toFixed(3)}s</div>
          ))}
          {isDone && <div><span className="log-done">[done]</span> Benchmark complete. Artifacts saved.</div>}
          {isFailed && <div><span className="log-err">[error]</span> {exp.error_message}</div>}
        </div>
      </section>
    </div>
  );
};
