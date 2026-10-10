import React from 'react';
import { ShieldAlert, ArrowRight, CheckCircle2, AlertCircle, Cpu, Zap, Activity, Award } from 'lucide-react';
import { DatasetProfile, Experiment } from '../types';
import { TabId } from '../components/Navigation';

interface OverviewViewProps {
  dataset: DatasetProfile | null;
  latestExperiment: Experiment | null;
  onNavigate: (tab: TabId) => void;
  onLoadDemo: () => void;
  isLoadingDemo: boolean;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  dataset,
  latestExperiment,
  onNavigate,
  onLoadDemo,
  isLoadingDemo,
}) => {
  const isSynthetic = !dataset || dataset.data_mode === 'synthetic';

  return (
    <div>
      {/* Disclaimer Banner */}
      <div className="alert-banner alert-synthetic">
        <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>RESEARCH PROTOTYPE NOTICE & CLINICAL BOUNDARY:</strong>
          <p style={{ marginTop: '0.25rem' }}>
            {isSynthetic ? (
              <>
                <strong>SYNTHETIC DEMONSTRATION DATA — NOT CLINICAL EVIDENCE.</strong> This software evaluates machine learning and quantum computing pipelines on simulated clinical covariates modeled after CIBMTR published registry distributions. It is strictly for algorithmic benchmarking and must never be used for therapeutic guidance or real patient care.
              </>
            ) : (
              <>
                <strong>SECONDARY RESEARCH DATASET LOADED:</strong> Operating in Research Cohort Mode under de-identified study protocols. Results are exploratory and not approved for clinical decision support.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Main Hero Card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        <div style={{ maxWidth: '850px' }}>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>
            Quantum-Assisted Hematopoietic Stem Cell Recovery Prediction
          </h1>
          <p style={{ marginTop: '0.75rem', color: '#475569', fontSize: '0.95rem', lineHeight: '1.6' }}>
            MarrowQ investigates whether quantum-kernel support vector methods (Qiskit ML FidelityQuantumKernel with ZZFeatureMap) offer representational utility over established classical baselines (Logistic Regression, Random Forest, Classical RBF SVM) in predicting timely neutrophil engraftment (Absolute Neutrophil Count &ge; 500/&mu;L on or before Day 28) following allogeneic hematopoietic cell transplantation.
          </p>

          <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            {!dataset && (
              <button className="btn btn-primary" onClick={onLoadDemo} disabled={isLoadingDemo}>
                <Zap size={16} />
                {isLoadingDemo ? 'Generating Cohort...' : 'Load CIBMTR Synthetic Demo (N=500)'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => onNavigate('dataset')}>
              Inspect Dataset & Schema <ArrowRight size={16} />
            </button>
            {dataset && (
              <button className="btn btn-primary" onClick={() => onNavigate('setup')}>
                Configure Experiment <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3 Pillar Summary Grid */}
      <div className="grid-3">
        <div className="stat-box">
          <div className="stat-label">1. Clinical Endpoint</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', marginTop: '0.4rem' }}>
            Neutrophil Day 28
          </div>
          <div className="stat-sub">
            Binary horizon benchmark: timely ANC recovery (&ge; 500/&mu;L for 3 days) vs delayed recovery (&gt; Day 28).
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">2. Leakage Protection</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', marginTop: '0.4rem', color: '#059669' }}>
            Zero Leakage
          </div>
          <div className="stat-sub">
            Pre-transplant features only. Preprocessors, imputers, scalers, and encoders are fit strictly on training splits.
          </div>
        </div>

        <div className="stat-box">
          <div className="stat-label">3. Quantum Evaluation</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', marginTop: '0.4rem', color: '#6366f1' }}>
            Fidelity Kernel
          </div>
          <div className="stat-sub">
            Qiskit FidelityQuantumKernel with statevector simulator matched against Classical RBF SVM on equal dimensions.
          </div>
        </div>
      </div>

      {/* Visual System Architecture & Flowchart Card */}
      <div className="card" style={{ marginTop: '1.5rem', background: '#ffffff' }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ fontSize: '1rem' }}>
              <Activity size={18} color="#6366f1" /> End-to-End Clinical & Quantum Pipeline Flowchart
            </div>
            <div className="card-subtitle">
              Leakage-safe data orchestration from baseline clinical covariates to quantum-kernel statevector simulation
            </div>
          </div>
          <span className="badge badge-health">
            Live Automated Pipeline
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
          {/* Stage 1 */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>1</div>
              <strong style={{ fontSize: '0.85rem' }}>Pre-Tx Covariates</strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.5' }}>
              Recipient age, KPS, CMV, comorbidity, donor match, graft source (PBSC/BM/Cord), and CD34+ cell dose at Day 0.
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <span className="badge badge-prototype" style={{ fontSize: '0.68rem' }}>18 Features</span>
            </div>
          </div>

          {/* Stage 2 */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>2</div>
              <strong style={{ fontSize: '0.85rem' }}>Leakage Sentry & Split</strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.5' }}>
              Excludes post-tx complications (aGVHD, infection dates). Stratified 75/25 split. Imputers & scalers fit solely on train.
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <span className="badge badge-research" style={{ fontSize: '0.68rem' }}>Zero Leakage</span>
            </div>
          </div>

          {/* Stage 3 */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f5f3ff', color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>3</div>
              <strong style={{ fontSize: '0.85rem' }}>Model Comparator Suite</strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.5' }}>
              Fits Dummy, Logistic Reg (L2), Random Forest, and RBF SVM. Compresses subspace to 2-qubit ZZ Fidelity Quantum Kernel.
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6', fontSize: '0.68rem' }}>5 Models</span>
            </div>
          </div>

          {/* Stage 4 */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ffedd5', color: '#9a3412', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>4</div>
              <strong style={{ fontSize: '0.85rem' }}>Evaluation & Report</strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.5' }}>
              Computes held-out accuracy, ROC-AUC, confusion matrices, quadratic runtime overhead, and exportable research reports.
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <span className="badge badge-synthetic" style={{ fontSize: '0.68rem' }}>Empirical Verification</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dataset Readiness & Latest Experiment Comparison */}
      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <CheckCircle2 size={18} color="#059669" /> Dataset Status & Readiness
              </div>
              <div className="card-subtitle">Active cohort characteristics and validation profile</div>
            </div>
            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => onNavigate('dataset')}>
              Manage
            </button>
          </div>

          {dataset ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Records</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{dataset.total_rows}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Covariates</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{dataset.total_columns}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                <strong>Active Target:</strong> <code>{dataset.suggested_target}</code>
              </div>
              {dataset.class_distribution && (
                <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Class Balance: 0 (Delayed): {dataset.class_distribution['0'] || 0} | 1 (Prompt): {dataset.class_distribution['1'] || 0}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
              <AlertCircle size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.875rem' }}>No active dataset loaded in memory.</p>
              <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={onLoadDemo} disabled={isLoadingDemo}>
                Load Synthetic Cohort
              </button>
            </div>
          )}
        </div>

        {/* Latest Experiment Snapshot */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Award size={18} color="#6366f1" /> Latest Experiment Benchmark
              </div>
              <div className="card-subtitle">Classical vs Quantum comparison summary</div>
            </div>
            {latestExperiment && (
              <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => onNavigate('results')}>
                Full Results
              </button>
            )}
          </div>

          {latestExperiment && latestExperiment.status === 'completed' ? (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
                Run ID: <code>{latestExperiment.experiment_id}</code> | Samples: N_test = {latestExperiment.test_sample_count}
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Accuracy</th>
                      <th>ROC-AUC</th>
                      <th>Runtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(latestExperiment.metrics).map(([key, metric]) => (
                      <tr key={key}>
                        <td style={{ fontWeight: 600 }}>{metric.display_name}</td>
                        <td>{(metric.accuracy * 100).toFixed(1)}%</td>
                        <td>{metric.roc_auc != null ? metric.roc_auc.toFixed(3) : 'N/A'}</td>
                        <td>{metric.training_time_seconds.toFixed(3)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
              <Activity size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.875rem' }}>No experiment completed yet.</p>
              <button
                className="btn btn-secondary"
                style={{ marginTop: '0.75rem' }}
                onClick={() => onNavigate('setup')}
                disabled={!dataset}
              >
                Go to Experiment Setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
