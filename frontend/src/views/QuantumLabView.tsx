import React, { useState, useEffect } from 'react';
import {
  Cpu, Server, Activity, ShieldCheck, Play, RefreshCw, AlertCircle,
  Clock, Zap, CheckCircle2, Key, ExternalLink, Check, Sparkles,
  Layers, Database, ArrowRight, AlertTriangle, Radio, BarChart3,
  Sliders, Gauge, ShieldAlert, GitCompare, Microchip
} from 'lucide-react';
import {
  QuantumBackend, QuantumStatus, QuantumJob,
  QuantumSweepResult, BackendsComparisonResult, GPUSimulateJobResult, BudgetEstimateResult
} from '../types';
import {
  fetchQuantumBackends, fetchQuantumStatus, fetchQuantumJobs,
  testQuantumConnection, fetchQuantumSweep, fetchQuantumBackendsComparison,
  estimateQuantumBudget, submitGpuSimulate, fetchComputeJob
} from '../api';

export const QuantumLabView: React.FC = () => {
  const [backends, setBackends] = useState<QuantumBackend[]>([]);
  const [qStatus, setQStatus] = useState<QuantumStatus | null>(null);
  const [jobs, setJobs] = useState<QuantumJob[]>([]);

  // Qubit Sweep state
  const [sweepResult, setSweepResult] = useState<QuantumSweepResult | null>(null);
  const [loadingSweep, setLoadingSweep] = useState<boolean>(false);
  const [sweepError, setSweepError] = useState<string | null>(null);

  // Backends Comparison state
  const [compResult, setCompResult] = useState<BackendsComparisonResult | null>(null);
  const [loadingComp, setLoadingComp] = useState<boolean>(false);
  const [compShots, setCompShots] = useState<number>(1024);
  const [compQubits, setCompQubits] = useState<number>(4);

  // GPU Simulation state
  const [simPatients, setSimPatients] = useState<number>(24);
  const [simQubits, setSimQubits] = useState<number>(4);
  const [simBandwidth, setSimBandwidth] = useState<number>(1.0);
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<{ progress: number; message: string }>({ progress: 0, message: '' });
  const [simResult, setSimResult] = useState<GPUSimulateJobResult | null>(null);

  // Budget Calculator state
  const [budgetCircuits, setBudgetCircuits] = useState<number>(120);
  const [budgetShots, setBudgetShots] = useState<number>(1024);
  const [budgetResult, setBudgetResult] = useState<BudgetEstimateResult | null>(null);

  // Connection Test Modal
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [testingConn, setTestingConn] = useState<boolean>(false);
  const [connTestResult, setConnTestResult] = useState<any>(null);

  // Active view tab: 'sweep' | 'comparison' | 'gpu_simulate' | 'budget_hw'
  const [activeTab, setActiveTab] = useState<'sweep' | 'comparison' | 'gpu_simulate' | 'budget_hw'>('sweep');

  const loadBaseData = async () => {
    try {
      const [bList, statusData, jobList] = await Promise.all([
        fetchQuantumBackends(),
        fetchQuantumStatus(),
        fetchQuantumJobs(),
      ]);
      setBackends(bList);
      setQStatus(statusData);
      setJobs(jobList);
    } catch (e) {
      console.error("Error loading base quantum data:", e);
    }
  };

  const loadSweep = async (refresh: boolean = false) => {
    setLoadingSweep(true);
    setSweepError(null);
    try {
      const data = await fetchQuantumSweep(5, 2, refresh);
      setSweepResult(data);
    } catch (err: any) {
      setSweepError(err.message || 'Failed to load qubit sweep.');
    } finally {
      setLoadingSweep(false);
    }
  };

  const loadComparison = async (refresh: boolean = false) => {
    setLoadingComp(true);
    try {
      const data = await fetchQuantumBackendsComparison(compShots, compQubits, refresh);
      setCompResult(data);
    } catch (err: any) {
      console.error("Comparison load error:", err);
    } finally {
      setLoadingComp(false);
    }
  };

  const handleEstimateBudget = async () => {
    try {
      const res = await estimateQuantumBudget(budgetCircuits, budgetShots);
      setBudgetResult(res);
    } catch (err) {
      console.error("Budget estimate error:", err);
    }
  };

  useEffect(() => {
    loadBaseData();
    loadSweep(false);
    loadComparison(false);
    handleEstimateBudget();
  }, []);

  const handleTestConnection = async () => {
    setTestingConn(true);
    setShowTestModal(true);
    setConnTestResult(null);
    try {
      const res = await testQuantumConnection();
      setConnTestResult(res);
      await loadBaseData();
    } catch (err: any) {
      setConnTestResult({
        success: false,
        error: err.message || "Failed to reach backend connection test endpoint"
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleRunGpuSimulation = async () => {
    setSimRunning(true);
    setSimResult(null);
    setSimProgress({ progress: 0.05, message: 'Submitting job to compute worker...' });

    try {
      const { job_id } = await submitGpuSimulate({
        n_patients: simPatients,
        n_qubits: simQubits,
        bandwidth: simBandwidth,
        reps: 1,
      });

      // Poll worker job
      const pollInterval = setInterval(async () => {
        try {
          const job = await fetchComputeJob(job_id);
          if (job.status === 'succeeded') {
            clearInterval(pollInterval);
            setSimRunning(false);
            setSimProgress({ progress: 1.0, message: 'Simulation completed!' });
            setSimResult(job.result);
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setSimRunning(false);
            alert(`GPU Simulation Failed: ${job.error_message || 'Worker error'}`);
          } else {
            setSimProgress({
              progress: job.progress || 0.3,
              message: job.progress_message || 'Simulating statevectors on GPU...'
            });
          }
        } catch {
          // keep polling
        }
      }, 1500);
    } catch (err: any) {
      setSimRunning(false);
      alert('Error launching GPU simulation: ' + err.message);
    }
  };

  return (
    <div className="quantum-lab-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1360px', margin: '0 auto', color: '#e2e8f0' }}>

      {/* 1. Header Card with Live IBM Quantum & GPU Service Telemetry */}
      <div className="spatial-card" style={{ padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                background: 'rgba(37, 99, 235, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa'
              }}>
                <Cpu size={22} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                Quantum Engraftment Research Lab
              </h2>

              {/* Live Authentication Badge */}
              <span style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                background: qStatus?.is_connected_to_hardware ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: qStatus?.is_connected_to_hardware ? '#34d399' : '#f87171',
                border: `1px solid ${qStatus?.is_connected_to_hardware ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: qStatus?.is_connected_to_hardware ? '#10b981' : '#ef4444' }} />
                {qStatus?.is_connected_to_hardware ? 'IBM Quantum Hardware Authenticated' : 'IBM Hardware: Unauthenticated'}
              </span>

              <span style={{
                fontSize: '0.72rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontFamily: 'monospace'
              }}>
                Cohort: UCI Paediatric HSCT (n=187)
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
              GPU-accelerated quantum statevector Gram engine, Heron FakeFez noisy simulation, and genuine physical IBM Quantum QPU execution. Zero fabricated results.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleTestConnection}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', padding: '0.55rem 1rem' }}
            >
              <Key size={15} />
              Test IBM Credentials
            </button>
            <button
              onClick={() => { loadBaseData(); loadSweep(true); loadComparison(true); }}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.55rem 0.85rem' }}
              title="Refresh Telemetry"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.25rem' }}>
          {[
            { id: 'sweep', label: 'Qubit Sweep & 5×5 CV (2–16 Qubits)', icon: BarChart3 },
            { id: 'comparison', label: 'Ideal vs Noisy vs Hardware Comparison', icon: GitCompare },
            { id: 'gpu_simulate', label: 'GPU Quantum Kernel Simulator', icon: Zap },
            { id: 'budget_hw', label: 'IBM Hardware & Budget Guard', icon: ShieldCheck },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: active ? '#60a5fa' : '#94a3b8',
                  border: 'none',
                  borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
                  padding: '0.6rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: QUBIT SWEEP & 5x5 NESTED CV
         ========================================================================= */}
      {activeTab === 'sweep' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Scientific Context Banner */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                  Target: Day +14 Neutrophil Engraftment (early_engraftment, 42% positive)
                </span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                  CORE_FEATURES (11 vars)
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                Classical Benchmark to Beat: <strong style={{ color: '#38bdf8' }}>Logistic Regression ROC-AUC 0.755 (0.685–0.819)</strong>.
                Evaluated under identical RepeatedStratifiedKFold (5×5 nested CV) with inner bandwidth (Shaydulin & Wild 2022) and margin tuning.
              </div>
            </div>

            <button
              onClick={() => loadSweep(true)}
              disabled={loadingSweep}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', padding: '0.5rem 1rem' }}
            >
              <RefreshCw size={14} className={loadingSweep ? 'animate-spin' : ''} />
              {loadingSweep ? 'Running 5×5 CV Sweep...' : 'Re-run Qubit Sweep'}
            </button>
          </div>

          {/* Sweep Table */}
          <div className="spatial-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1rem' }}>
              Qubit Scaling Benchmark (2 to 16 Qubits)
            </h3>

            {loadingSweep && (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', color: '#60a5fa' }} />
                Computing nested cross-validation across qubit dimensions on GPU...
              </div>
            )}

            {!loadingSweep && sweepResult && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', textAlign: 'left', color: '#94a3b8' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Qubits</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>ROC-AUC (95% CI)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>vs Classical Baseline (0.755)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Balanced Acc (95% CI)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Off-Diagonal Variance (Concentration)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Geometric Diff vs RBF</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Kernel Alignment</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Tuned c / C</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sweepResult.sweep_table.map((row) => {
                      const diffVsBase = row.roc_auc - sweepResult.classical_baseline_auc;
                      const isBest = sweepResult.best_qubit_setting?.qubits === row.qubits;
                      return (
                        <tr
                          key={row.qubits}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: isBest ? 'rgba(59, 130, 246, 0.08)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>{row.qubits} Qubits</span>
                              {isBest && (
                                <span style={{ fontSize: '0.65rem', background: '#2563eb', color: '#fff', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                                  TOP
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#38bdf8' }}>
                            {row.roc_auc.toFixed(3)}
                            {row.roc_auc_ci && (
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>
                                [{row.roc_auc_ci[0].toFixed(3)}–{row.roc_auc_ci[1].toFixed(3)}]
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{
                              color: diffVsBase >= 0 ? '#34d399' : '#f87171',
                              fontWeight: 600
                            }}>
                              {diffVsBase >= 0 ? `+${diffVsBase.toFixed(3)}` : diffVsBase.toFixed(3)}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#cbd5e1' }}>
                            {row.balanced_accuracy.toFixed(3)}
                            {row.balanced_accuracy_ci && (
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>
                                [{row.balanced_accuracy_ci[0].toFixed(3)}–{row.balanced_accuracy_ci[1].toFixed(3)}]
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{
                              color: row.is_concentrated ? '#f87171' : '#34d399',
                              fontFamily: 'monospace'
                            }}>
                              {row.off_diagonal_variance.toExponential(2)}
                            </span>
                            {row.is_concentrated && (
                              <span style={{ fontSize: '0.68rem', color: '#f87171', display: 'block' }}>
                                Concentrated (Barren)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#cbd5e1', fontFamily: 'monospace' }}>
                            {row.geometric_difference_vs_rbf.toFixed(3)}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#cbd5e1', fontFamily: 'monospace' }}>
                            {row.kernel_target_alignment.toFixed(4)}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                            c={row.best_bandwidth}, C={row.best_C}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#94a3b8' }}>
                            {row.training_time_seconds.toFixed(1)}s
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loadingSweep && !sweepResult && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                No sweep data loaded. Click "Re-run Qubit Sweep" to execute.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: BACKENDS COMPARISON (IDEAL VS NOISY VS HARDWARE)
         ========================================================================= */}
      {activeTab === 'comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Parameters Bar */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Qubits</label>
                <select
                  value={compQubits}
                  onChange={e => setCompQubits(Number(e.target.value))}
                  style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                >
                  {[2, 4, 8].map(q => <option key={q} value={q}>{q} Qubits</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Measurement Shots</label>
                <select
                  value={compShots}
                  onChange={e => setCompShots(Number(e.target.value))}
                  style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                >
                  <option value={512}>512 shots</option>
                  <option value={1024}>1024 shots</option>
                  <option value={2048}>2048 shots</option>
                </select>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Benchmark cohort: <strong style={{ color: '#fff' }}>UCI 16 Train / 8 Held-Out Test</strong> patients.
              </div>
            </div>

            <button
              onClick={() => loadComparison(true)}
              disabled={loadingComp}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', padding: '0.5rem 1rem' }}
            >
              <RefreshCw size={14} className={loadingComp ? 'animate-spin' : ''} />
              {loadingComp ? 'Comparing Backends...' : 'Run Comparative Evaluation'}
            </button>
          </div>

          {/* Comparison Cards Grid */}
          {compResult && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>

              {/* 1. Ideal Statevector */}
              <div className="spatial-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#38bdf8' }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                      Ideal Statevector Simulation
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderRadius: '4px' }}>
                    Zero Statistical Noise
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  Backend: {compResult.ideal.backend_type}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Frobenius Error</span>
                    <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>0.00% (Baseline)</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Kernel Alignment</span>
                    <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{compResult.ideal.alignment?.toFixed(4)}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>QSVM Test AUC</span>
                    <strong style={{ fontSize: '1.1rem', color: '#34d399' }}>{compResult.ideal.test_auc?.toFixed(3)}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Compute Time</span>
                    <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{compResult.ideal.elapsed_seconds?.toFixed(2)}s</strong>
                  </div>
                </div>

                {compResult.ideal.matrix_preview && (
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Kernel Matrix 4×4 Sub-block</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                      {compResult.ideal.matrix_preview.flatMap((row, rIdx) =>
                        row.map((val, cIdx) => (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            style={{
                              background: `rgba(56, 189, 248, ${Math.max(0.1, val)})`,
                              padding: '0.4rem 0.2rem',
                              textAlign: 'center',
                              fontSize: '0.68rem',
                              fontFamily: 'monospace',
                              borderRadius: '4px',
                              color: val > 0.5 ? '#fff' : '#94a3b8'
                            }}
                          >
                            {val.toFixed(2)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Noisy Heron Simulation */}
              <div className="spatial-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24' }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                      Noisy NISQ Simulation (FakeFez)
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', borderRadius: '4px' }}>
                    156Q Heron Noise Model
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  Physical thermal relaxation (T1, T2) + CZ gate & readout error calibration.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Frobenius Error vs Ideal</span>
                    <strong style={{ fontSize: '1.1rem', color: '#fbbf24' }}>
                      {compResult.noisy_simulation.frobenius_error_vs_ideal ? `${(compResult.noisy_simulation.frobenius_error_vs_ideal * 100).toFixed(2)}%` : 'N/A'}
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Kernel Alignment</span>
                    <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>{compResult.noisy_simulation.alignment?.toFixed(4)}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>QSVM Test AUC</span>
                    <strong style={{ fontSize: '1.1rem', color: '#fbbf24' }}>{compResult.noisy_simulation.test_auc?.toFixed(3)}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Readout Attenuation</span>
                    <strong style={{ fontSize: '1.1rem', color: '#f8fafc' }}>
                      {compResult.noisy_simulation.diagonal_attenuation ? `${(compResult.noisy_simulation.diagonal_attenuation * 100).toFixed(1)}%` : 'N/A'}
                    </strong>
                  </div>
                </div>

                {compResult.noisy_simulation.matrix_preview && (
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Kernel Matrix 4×4 Sub-block</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                      {compResult.noisy_simulation.matrix_preview.flatMap((row, rIdx) =>
                        row.map((val, cIdx) => (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            style={{
                              background: `rgba(251, 191, 36, ${Math.max(0.1, val)})`,
                              padding: '0.4rem 0.2rem',
                              textAlign: 'center',
                              fontSize: '0.68rem',
                              fontFamily: 'monospace',
                              borderRadius: '4px',
                              color: val > 0.5 ? '#fff' : '#94a3b8'
                            }}
                          >
                            {val.toFixed(2)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Physical IBM Hardware */}
              <div className="spatial-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: compResult.hardware.available ? '#34d399' : '#f87171' }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                      Physical IBM Quantum QPU
                    </h4>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.2rem 0.5rem',
                    background: compResult.hardware.available ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: compResult.hardware.available ? '#34d399' : '#f87171',
                    borderRadius: '4px'
                  }}>
                    {compResult.hardware.available ? 'Connected' : 'Unauthenticated'}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
                  {compResult.hardware.message}
                </div>

                {!compResult.hardware.available ? (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    textAlign: 'center'
                  }}>
                    <ShieldAlert size={28} style={{ color: '#f87171', margin: '0 auto 0.75rem', display: 'block' }} />
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#fca5a5', lineHeight: 1.5 }}>
                      <strong>Strict Transparency Rule:</strong> Simulator runs are never masqueraded as hardware. Configure <code style={{ color: '#fff' }}>IBM_QUANTUM_API_KEY</code> to submit circuits to live QPUs via Qiskit Runtime SamplerV2.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Target Backend</span>
                      <strong style={{ fontSize: '1rem', color: '#34d399' }}>{compResult.hardware.backend_name}</strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Provenance</span>
                      <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>ibm_quantum_hardware</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: GPU QUANTUM KERNEL SIMULATOR
         ========================================================================= */}
      {activeTab === 'gpu_simulate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="spatial-card" style={{ padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
              Real-Patient GPU Statevector Gram Engine
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              Computes genuine quantum kernel Gram matrices <span style={{ fontFamily: 'monospace' }}>K_ij = |⟨ψ(x_i)|ψ(x_j)⟩|²</span> on real UCI paediatric HSCT patients via local GPU statevector simulation.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>
                  UCI Patients Count (N)
                </label>
                <select
                  value={simPatients}
                  onChange={e => setSimPatients(Number(e.target.value))}
                  disabled={simRunning}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <option value={16}>16 Patients (Fast)</option>
                  <option value={24}>24 Patients (Standard)</option>
                  <option value={48}>48 Patients (Expanded)</option>
                  <option value={187}>187 Patients (Full Cohort)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>
                  Qubits (PCA Components)
                </label>
                <select
                  value={simQubits}
                  onChange={e => setSimQubits(Number(e.target.value))}
                  disabled={simRunning}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  {[2, 4, 8, 12, 16].map(q => <option key={q} value={q}>{q} Qubits</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>
                  Bandwidth Scaling (c)
                </label>
                <select
                  value={simBandwidth}
                  onChange={e => setSimBandwidth(Number(e.target.value))}
                  disabled={simRunning}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <option value={0.1}>c = 0.1 (Linear regime)</option>
                  <option value={0.5}>c = 0.5 (Moderate)</option>
                  <option value={1.0}>c = 1.0 (Standard)</option>
                  <option value={2.0}>c = 2.0 (High rotation)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleRunGpuSimulation}
              disabled={simRunning}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.6rem 1.25rem' }}
            >
              <Play size={16} />
              {simRunning ? 'Worker Simulating on GPU...' : 'Launch GPU Quantum Simulation'}
            </button>

            {simRunning && (
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  <span>{simProgress.message}</span>
                  <span>{Math.round(simProgress.progress * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${simProgress.progress * 100}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}

            {simResult && (
              <div style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1rem' }}>
                  Simulation Execution Results
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Device Used</span>
                    <strong style={{ fontSize: '1rem', color: '#34d399' }}>{simResult.telemetry.device} ({simResult.telemetry.matmul_accelerator})</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Kernel Alignment</span>
                    <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{simResult.diagnostics.kernel_target_alignment.toFixed(4)}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Off-Diagonal Variance</span>
                    <strong style={{ fontSize: '1rem', color: simResult.diagnostics.is_concentrated ? '#f87171' : '#38bdf8' }}>
                      {simResult.diagnostics.off_diagonal_variance.toExponential(2)}
                    </strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Elapsed Time</span>
                    <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{simResult.telemetry.elapsed_seconds.toFixed(3)}s</strong>
                  </div>
                </div>

                {simResult.kernel_matrix_preview && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>
                      Gram Matrix Preview ({simResult.kernel_shape[0]}×{simResult.kernel_shape[1]})
                    </span>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${simResult.kernel_matrix_preview.length}, 1fr)`,
                      gap: '4px',
                      maxWidth: '600px'
                    }}>
                      {simResult.kernel_matrix_preview.flatMap((row, rIdx) =>
                        row.map((val, cIdx) => (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            style={{
                              background: `rgba(59, 130, 246, ${Math.max(0.1, val)})`,
                              padding: '0.4rem 0.2rem',
                              textAlign: 'center',
                              fontSize: '0.68rem',
                              fontFamily: 'monospace',
                              borderRadius: '4px',
                              color: val > 0.5 ? '#fff' : '#94a3b8'
                            }}
                          >
                            {val.toFixed(2)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: IBM HARDWARE & BUDGET GUARD
         ========================================================================= */}
      {activeTab === 'budget_hw' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>

            {/* QPU Budget Guard Card */}
            <div className="spatial-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <ShieldCheck size={20} style={{ color: '#38bdf8' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                  QPU-Seconds Budget Guard (Open Plan Protection)
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
                Open Plan quota is strictly limited to <strong>600 QPU-seconds per 28 days</strong>. MarrowQ enforces strict refusal before submission if an experiment exceeds <code style={{ color: '#fff' }}>IBM_MAX_SECONDS_PER_RUN</code>.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>
                    Total Circuits to Submit
                  </label>
                  <input
                    type="number"
                    value={budgetCircuits}
                    onChange={e => setBudgetCircuits(Number(e.target.value))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem' }}>
                    Shots per Circuit
                  </label>
                  <input
                    type="number"
                    value={budgetShots}
                    onChange={e => setBudgetShots(Number(e.target.value))}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <button
                onClick={handleEstimateBudget}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem', marginBottom: '1.25rem' }}
              >
                Calculate Estimated QPU Time
              </button>

              {budgetResult && (
                <div style={{
                  background: budgetResult.within_budget ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${budgetResult.within_budget ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: '8px',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Estimated QPU Execution Time:</span>
                    <strong style={{ fontSize: '1.05rem', color: budgetResult.within_budget ? '#34d399' : '#f87171' }}>
                      {budgetResult.estimated_qpu_seconds} seconds
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>Budget Limit:</span>
                    <span>{budgetResult.max_allowed_budget_seconds} seconds</span>
                  </div>
                  {!budgetResult.within_budget && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#f87171' }}>
                      {budgetResult.refusal_reason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Hardware Error Mitigation (Twirling & DD) */}
            <div className="spatial-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Zap size={20} style={{ color: '#fbbf24' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                  Hardware Error Mitigation Options
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
                Available Qiskit Runtime SamplerV2 options for physical Eagle/Heron superconducting processors.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#fff', display: 'block' }}>Pauli & Measurement Twirling</strong>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Converts coherent systematic gate over-rotations into stochastic Pauli noise</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    Supported
                  </span>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#fff', display: 'block' }}>Dynamical Decoupling (XY4)</strong>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Inserts echo pulses on idle qubits to mitigate environmental dephasing</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    Supported
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Connection Test Modal */}
      {showTestModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '14px',
            padding: '2rem',
            maxWidth: '560px',
            width: '100%',
            color: '#e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={20} style={{ color: '#60a5fa' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#fff' }}>
                  IBM Quantum Credentials Test
                </h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {testingConn && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 1rem', display: 'block', color: '#60a5fa' }} />
                Testing authentication with IBM Quantum Platform...
              </div>
            )}

            {!testingConn && connTestResult && (
              <div>
                <div style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: connTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${connTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  marginBottom: '1rem'
                }}>
                  <strong style={{ color: connTestResult.success ? '#34d399' : '#f87171', display: 'block', marginBottom: '0.25rem' }}>
                    {connTestResult.success ? 'Authentication Succeeded' : 'Authentication Failed'}
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1' }}>
                    {connTestResult.message || connTestResult.error}
                  </p>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.5rem' }}>
                  <div>Channel: <code style={{ color: '#fff' }}>{connTestResult.channel || 'ibm_quantum_platform'}</code></div>
                  <div>Token configured: <code style={{ color: '#fff' }}>{connTestResult.token_configured ? 'Yes' : 'No'}</code></div>
                  {connTestResult.token_masked && <div>Token: <code style={{ color: '#fff' }}>{connTestResult.token_masked}</code></div>}
                  {connTestResult.accessible_backends_count !== undefined && (
                    <div>Accessible QPUs: <strong style={{ color: '#38bdf8' }}>{connTestResult.accessible_backends_count}</strong></div>
                  )}
                </div>

                <button
                  onClick={() => setShowTestModal(false)}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.6rem' }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
export default QuantumLabView;
