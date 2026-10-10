import React, { useState } from 'react';
import { BarChart3, AlertCircle, Info, Clock, CheckCircle2, ChevronRight, Download } from 'lucide-react';
import { Experiment, ModelMetric } from '../types';
import { TabId } from '../components/Navigation';

interface ResultsViewProps {
  experiment: Experiment | null;
  onNavigate: (tab: TabId) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ experiment, onNavigate }) => {
  if (!experiment || Object.keys(experiment.metrics || {}).length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
        <BarChart3 size={38} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
        <h3>No Experiment Results Yet</h3>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Execute an experiment to view empirical metrics, confusion matrices, and classical vs quantum performance comparisons.
        </p>
        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => onNavigate('setup')}>
          Go to Experiment Setup
        </button>
      </div>
    );
  }

  const metrics = experiment.metrics;
  const modelKeys = Object.keys(metrics);
  const [selectedModelKey, setSelectedModelKey] = useState<string>(modelKeys[0] || '');

  const activeMetric: ModelMetric | undefined = metrics[selectedModelKey] || Object.values(metrics)[0];

  return (
    <div>
      {/* Header Summary */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <BarChart3 size={18} /> Empirical Benchmark & Comparative Evaluation
            </div>
            <div className="card-subtitle">
              Held-Out Test Set Evaluation (N_test = {experiment.test_sample_count || 'N/A'}) | Data Mode: <strong>{experiment.data_mode.toUpperCase()}</strong>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => onNavigate('report')}>
            Generate Research Report <ChevronRight size={16} />
          </button>
        </div>

        {/* Full Comparative Metric Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>Status</th>
                <th>Accuracy</th>
                <th>Balanced Acc</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-Score</th>
                <th>ROC-AUC</th>
                <th>Brier Score</th>
                <th>Train Time</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics).map(([key, m]) => {
                const isSelected = key === selectedModelKey;
                const isQuantum = key.includes('quantum');
                return (
                  <tr
                    key={key}
                    onClick={() => setSelectedModelKey(key)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? '#eef2ff' : undefined,
                      fontWeight: isQuantum ? 600 : undefined,
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4f46e5' }} />}
                        <span>{m.display_name}</span>
                        {isQuantum && (
                          <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed', fontSize: '0.65rem' }}>
                            Quantum
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${m.status === 'completed' ? 'badge-research' : 'badge-prototype'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td>{(m.accuracy * 100).toFixed(1)}%</td>
                    <td>{(m.balanced_accuracy * 100).toFixed(1)}%</td>
                    <td>{(m.precision * 100).toFixed(1)}%</td>
                    <td>{(m.recall * 100).toFixed(1)}%</td>
                    <td>{(m.f1_score * 100).toFixed(1)}%</td>
                    <td>{m.roc_auc != null ? m.roc_auc.toFixed(3) : '—'}</td>
                    <td>{m.brier_score != null ? m.brier_score.toFixed(3) : '—'}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace' }}>{m.training_time_seconds.toFixed(3)}s</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep Dive Section: Confusion Matrix & Runtime Comparison */}
      <div className="grid-2">
        {/* Confusion Matrix Card */}
        {activeMetric && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">
                  Confusion Matrix: {activeMetric.display_name}
                </div>
                <div className="card-subtitle">
                  Test sample distribution (N = {activeMetric.test_sample_count})
                </div>
              </div>
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '0.8rem' }}
                value={selectedModelKey}
                onChange={(e) => setSelectedModelKey(e.target.value)}
              >
                {modelKeys.map((k) => (
                  <option key={k} value={k}>
                    {metrics[k].display_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div className="cm-container">
                <div className="cm-grid">
                  <div></div>
                  <div style={{ fontWeight: 700, color: '#475569' }}>Pred: Delayed (0)</div>
                  <div style={{ fontWeight: 700, color: '#475569' }}>Pred: Prompt (1)</div>

                  <div style={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center' }}>
                    Actual: Delayed (0)
                  </div>
                  <div className="cm-cell cm-tn">
                    <div style={{ fontSize: '1.25rem' }}>{activeMetric.confusion_matrix[0]?.[0] ?? 0}</div>
                    <div style={{ fontSize: '0.68rem' }}>True Negative</div>
                  </div>
                  <div className="cm-cell cm-fp">
                    <div style={{ fontSize: '1.25rem' }}>{activeMetric.confusion_matrix[0]?.[1] ?? 0}</div>
                    <div style={{ fontSize: '0.68rem' }}>False Positive</div>
                  </div>

                  <div style={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center' }}>
                    Actual: Prompt (1)
                  </div>
                  <div className="cm-cell cm-fn">
                    <div style={{ fontSize: '1.25rem' }}>{activeMetric.confusion_matrix[1]?.[0] ?? 0}</div>
                    <div style={{ fontSize: '0.68rem' }}>False Negative</div>
                  </div>
                  <div className="cm-cell cm-tp">
                    <div style={{ fontSize: '1.25rem' }}>{activeMetric.confusion_matrix[1]?.[1] ?? 0}</div>
                    <div style={{ fontSize: '0.68rem' }}>True Positive</div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.75rem' }}>
                Class 1 = Prompt engraftment (ANC &ge; 500/&mu;L by Day 28) | Class 0 = Delayed engraftment (&gt; 28 days)
              </div>
            </div>
          </div>
        )}

        {/* Runtime & Resource Cost Comparison */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Clock size={18} /> Training Runtime & Resource Footprint
              </div>
              <div className="card-subtitle">
                Wall-clock duration in seconds across architectures
              </div>
            </div>
          </div>

          <div style={{ padding: '0.5rem 0' }}>
            {Object.entries(metrics).map(([key, m]) => {
              const maxTime = Math.max(...Object.values(metrics).map((x) => x.training_time_seconds), 0.001);
              const pct = Math.max(4, (m.training_time_seconds / maxTime) * 100);
              const isQuantum = key.includes('quantum');

              return (
                <div key={key} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>{m.display_name}</span>
                    <span style={{ fontFamily: 'monospace' }}>{m.training_time_seconds.toFixed(3)}s</span>
                  </div>
                  <div className="progress-bar-bg" style={{ height: '10px' }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: isQuantum ? 'linear-gradient(90deg, #8b5cf6, #c084fc)' : '#4f46e5',
                      }}
                    ></div>
                  </div>
                </div>
              );
            })}

            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', fontSize: '0.78rem', color: '#475569', marginTop: '1.25rem' }}>
              <strong>Scientific Observation:</strong> Quantum kernel evaluation computes an $N \times N$ Gram matrix of Hilbert space statevector inner products. While offering unique kernel geometries, statevector simulation incurs quadratic wall-clock scaling compared to classical models.
            </div>
          </div>
        </div>
      </div>

      {/* Honest Scientific Interpretation Notice */}
      <div className="card" style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
        <div className="card-title" style={{ fontSize: '0.95rem' }}>
          <Info size={18} color="#6366f1" /> Empirical Quantum ML Findings
        </div>
        <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: '1.6', marginTop: '0.5rem' }}>
          This benchmark was designed without prejudice toward either model family. The matched Classical RBF SVM operates on the identical compressed feature representation as the quantum model. An honest evaluation shows that while quantum kernels provide rich non-linear mappings, classical gradient ensembles and classical SVMs frequently offer competitive or superior AUC with dramatically lower computational overhead on structured clinical tabular data.
        </p>
      </div>
    </div>
  );
};
