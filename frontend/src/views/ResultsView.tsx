import React, { useState } from 'react';
import { BarChart3, FileText, Info, Timer } from 'lucide-react';
import { Experiment } from '../types';
import { TabId } from '../navigation';

interface ResultsViewProps {
  experiment: Experiment | null;
  onNavigate: (tab: TabId) => void;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const secs = (s: number) => (s < 1 ? `${(s * 1000).toFixed(s < 0.01 ? 1 : 0)} ms` : `${s.toFixed(2)} s`);

export const ResultsView: React.FC<ResultsViewProps> = ({ experiment, onNavigate }) => {
  const metrics = experiment?.metrics ?? {};
  const keys = Object.keys(metrics);
  const [selected, setSelected] = useState<string>(keys.find(k => k.includes('quantum')) ?? keys[0] ?? '');

  if (!experiment || keys.length === 0) {
    return (
      <div className="card empty-state">
        <BarChart3 size={34} />
        <h3>No results yet</h3>
        <p>{experiment?.status === 'running' ? 'The current run is still in progress.' : 'Run a benchmark to compare classical and quantum models on held-out patients.'}</p>
        <button className="btn btn-primary" onClick={() => onNavigate(experiment?.status === 'running' ? 'monitor' : 'setup')}>
          {experiment?.status === 'running' ? 'Open run monitor' : 'Configure benchmark'}
        </button>
      </div>
    );
  }

  const active = metrics[selected] ?? metrics[keys[0]];
  const entries = Object.entries(metrics);
  const scored = entries.filter(([k, m]) => m.roc_auc != null && k !== 'dummy');
  const cvMetric = entries.map(([, m]) => m).find(m => m.evaluation);
  const best = scored.reduce((a, b) => ((b[1].roc_auc ?? 0) > (a[1].roc_auc ?? 0) ? b : a), scored[0]);
  const quantum = metrics.quantum_kernel_svm;
  const matched = metrics.matched_rbf_svm;
  const overhead = quantum && matched && matched.training_time_seconds > 0 ? quantum.training_time_seconds / matched.training_time_seconds : null;

  // Log-scale runtime bars: times span several orders of magnitude.
  const times = entries.map(([, m]) => Math.max(m.training_time_seconds, 0.0005));
  const lo = Math.log10(Math.min(...times) / 2);
  const hi = Math.log10(Math.max(...times) * 1.5);
  const barPct = (t: number) => ((Math.log10(Math.max(t, 0.0005)) - lo) / (hi - lo)) * 100;

  const cm = active.confusion_matrix;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><BarChart3 size={13} /> Research · step 4 of 4</div>
          <h2>Benchmark results</h2>
          <p>{cvMetric ? `Out-of-fold evaluation on all ${cvMetric.test_sample_count} patients (${cvMetric.evaluation})` : `Held-out evaluation on ${experiment.test_sample_count ?? '—'} patients`} · {experiment.data_mode === 'synthetic' ? 'synthetic demonstration data' : 'research data'} · experiment <code>{experiment.experiment_id}</code></p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={() => onNavigate('report')}><FileText size={14} /> Research report</button>
        </div>
      </div>

      <div className="grid-4">
        <div className="card kpi">
          <span className="kpi-label">Best ROC-AUC</span>
          <span className="kpi-value">{best?.[1].roc_auc?.toFixed(3) ?? '—'}{best?.[1].roc_auc_ci && <small>95% CI {best[1].roc_auc_ci[0].toFixed(2)}–{best[1].roc_auc_ci[1].toFixed(2)}</small>}</span>
          <span className="kpi-foot">{best?.[1].display_name}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Quantum-kernel ROC-AUC</span>
          <span className="kpi-value">{quantum?.roc_auc?.toFixed(3) ?? '—'}</span>
          <span className="kpi-foot">{quantum?.roc_auc != null && quantum.roc_auc <= 0.5 ? 'No better than chance on this split' : quantum?.display_name ?? 'Not run'}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Matched classical ROC-AUC</span>
          <span className="kpi-value">{matched?.roc_auc?.toFixed(3) ?? '—'}</span>
          <span className="kpi-foot">Same 2-D inputs as the quantum model</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Quantum compute overhead</span>
          <span className="kpi-value">{overhead ? `${Math.round(overhead).toLocaleString()}×` : '—'}</span>
          <span className="kpi-foot">Training time vs the matched classical SVM</span>
        </div>
      </div>

      <section className="card flush">
        <div className="card-header divided" style={{ padding: '1.1rem 1.25rem 0.9rem', margin: 0 }}>
          <div>
            <div className="card-title">All models</div>
            <div className="card-subtitle">Select a row to inspect its confusion matrix</div>
          </div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th><th className="num">N test</th><th className="num">Accuracy</th><th className="num">Balanced acc.</th>
                <th className="num">Precision</th><th className="num">Recall</th><th className="num">F1</th><th className="num">ROC-AUC</th><th className="num">Brier</th><th className="num">Train time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([k, m]) => (
                <tr key={k} className={k === selected ? 'selected' : ''} onClick={() => setSelected(k)} style={{ cursor: 'pointer' }} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(k); } }} aria-selected={k === selected}>
                  <td>
                    <span className="row" style={{ gap: '0.45rem' }}>
                      {m.display_name}
                      {k.includes('quantum') && <span className="chip chip-violet">Quantum</span>}
                      {k === best?.[0] && <span className="chip chip-green">Best AUC</span>}
                      {m.status !== 'completed' && <span className="chip chip-red">{m.status}</span>}
                    </span>
                  </td>
                  <td className="num">{m.test_sample_count}</td>
                  <td className="num">{pct(m.accuracy)}</td>
                  <td className="num">{pct(m.balanced_accuracy)}</td>
                  <td className="num">{pct(m.precision)}</td>
                  <td className="num">{pct(m.recall)}</td>
                  <td className="num">{m.f1_score.toFixed(3)}</td>
                  <td className="num">{m.roc_auc != null ? m.roc_auc.toFixed(3) : '—'}{m.roc_auc_ci && <div className="tiny faint">{m.roc_auc_ci[0].toFixed(2)}–{m.roc_auc_ci[1].toFixed(2)}</div>}</td>
                  <td className="num">{m.brier_score != null ? m.brier_score.toFixed(3) : '—'}</td>
                  <td className="num">{secs(m.training_time_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Confusion matrix</div>
              <div className="card-subtitle">{active.display_name} · N = {active.test_sample_count}</div>
            </div>
          </div>
          <div className="cm-grid">
            <div />
            <div className="cm-head">Predicted delayed</div>
            <div className="cm-head">Predicted engrafted</div>
            <div className="cm-head" style={{ display: 'flex', alignItems: 'center' }}>Actually delayed</div>
            <div className="cm-cell cm-tn"><div className="cm-n">{cm[0]?.[0] ?? 0}</div>True negative</div>
            <div className="cm-cell cm-fp"><div className="cm-n">{cm[0]?.[1] ?? 0}</div>False positive</div>
            <div className="cm-head" style={{ display: 'flex', alignItems: 'center' }}>Actually engrafted</div>
            <div className="cm-cell cm-fn"><div className="cm-n">{cm[1]?.[0] ?? 0}</div>False negative</div>
            <div className="cm-cell cm-tp"><div className="cm-n">{cm[1]?.[1] ?? 0}</div>True positive</div>
          </div>
          <p className="tiny faint" style={{ marginTop: '0.9rem', textAlign: 'center' }}>
            False positives matter most clinically: a patient predicted to engraft on time who does not may miss early protective measures.
          </p>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><Timer size={16} /> Training time</div>
              <div className="card-subtitle">Log scale · seconds on the evaluation machine</div>
            </div>
          </div>
          <div className="stack" style={{ gap: '0.75rem' }}>
            {entries.map(([k, m]) => (
              <div key={k} className="hbar-row" title={`${m.display_name}: ${secs(m.training_time_seconds)}`}>
                <span className="hbar-label small">{m.display_name}</span>
                <span className="hbar-track">
                  <span className={`hbar ${k.includes('quantum') ? 'quantum' : ''}`} style={{ width: `${barPct(m.training_time_seconds)}%` }} />
                  <span className="hbar-value tnum tiny">{secs(m.training_time_seconds)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="alert-banner alert-info">
        <Info size={16} />
        <div>
          <strong>How to read this.</strong> The matched classical RBF SVM sees exactly the same two PCA features as the 2-qubit quantum model, so the difference between them isolates the quantum feature map.
          On this data the classical kernel is both more accurate and thousands of times faster. Quantum advantage is treated as a hypothesis to test, not an assumption.
        </div>
      </div>
    </div>
  );
};
