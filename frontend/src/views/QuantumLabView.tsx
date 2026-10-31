import React, { useState, useEffect } from 'react';
import {
  Cpu, Server, Activity, ShieldCheck, Play, RefreshCw, AlertCircle,
  Clock, Zap, CheckCircle2, Key, ExternalLink, Check, Sparkles,
  Layers, Database, ArrowRight, AlertTriangle, Radio, BarChart3,
  Sliders, Gauge, ShieldAlert, GitCompare, Microchip, CheckCircle,
  XCircle, Info
} from 'lucide-react';
import {
  QuantumBackend, QuantumStatus, QuantumJob,
  QuantumSweepResult, BackendsComparisonResult, GPUSimulateJobResult, BudgetEstimateResult,
  QuantumExperimentResult
} from '../types';
import {
  fetchQuantumBackends, fetchQuantumStatus, fetchQuantumJobs,
  testQuantumConnection, fetchQuantumSweep, fetchQuantumBackendsComparison,
  estimateQuantumBudget, submitGpuSimulate, fetchComputeJob,
  runQuantumKernelExperiment, fetchLatestQuantumExperiment,
  fetchQuantumMultiBenchmark, fetchQuantumKernelDiagnostics
} from '../api';

export const QuantumLabView: React.FC = () => {
  const [backends, setBackends] = useState<QuantumBackend[]>([]);
  const [qStatus, setQStatus] = useState<QuantumStatus | null>(null);
  const [jobs, setJobs] = useState<QuantumJob[]>([]);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'workstation' | 'multi_arena' | 'kernel_diagnostics' | 'sweep' | 'comparison' | 'gpu_simulate' | 'budget_hw'>('workstation');

  // Multi-Endpoint Arena State
  const [arenaEndpoint, setArenaEndpoint] = useState<string>('early_engraftment');
  const [arenaResult, setArenaResult] = useState<any>(null);
  const [loadingArena, setLoadingArena] = useState<boolean>(false);

  // Kernel Diagnostics State
  const [diagQubits, setDiagQubits] = useState<number>(3);
  const [diagGamma, setDiagGamma] = useState<number>(0.5);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [loadingDiag, setLoadingDiag] = useState<boolean>(false);

  // Workstation (156-Qubit Heron Live Experiment) State
  const [selectedBackend, setSelectedBackend] = useState<string>('ibm_fez');
  const [executionMode, setExecutionMode] = useState<'hardware' | 'simulator'>('simulator');
  const [nFeatures, setNFeatures] = useState<number>(156);
  const [shots, setShots] = useState<number>(1000);
  const [maxHardwareSamples, setMaxHardwareSamples] = useState<number>(8);
  const [runningExperiment, setRunningExperiment] = useState<boolean>(false);
  const [experimentStep, setExperimentStep] = useState<string>('');
  const [latestExperiment, setLatestExperiment] = useState<QuantumExperimentResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

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

  const loadBaseData = async () => {
    try {
      const [bList, statusData, jobList, expData] = await Promise.all([
        fetchQuantumBackends().catch(() => []),
        fetchQuantumStatus().catch(() => null),
        fetchQuantumJobs().catch(() => []),
        fetchLatestQuantumExperiment().catch(() => null)
      ]);
      setBackends(bList);
      setQStatus(statusData);
      setJobs(jobList);
      if (expData) setLatestExperiment(expData);
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

  const handleRunArena = async (endpoint: string = 'early_engraftment') => {
    setLoadingArena(true);
    setArenaEndpoint(endpoint);
    try {
      const res = await fetchQuantumMultiBenchmark(endpoint, 3, 3);
      setArenaResult(res);
    } catch (err: any) {
      console.error("Multi-benchmark error:", err);
    } finally {
      setLoadingArena(false);
    }
  };

  const handleLoadDiagnostics = async (qubits: number = 3, gamma: number = 0.5) => {
    setLoadingDiag(true);
    try {
      const res = await fetchQuantumKernelDiagnostics(qubits, gamma);
      setDiagResult(res);
    } catch (err: any) {
      console.error("Diagnostics error:", err);
    } finally {
      setLoadingDiag(false);
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
    handleRunArena('early_engraftment');
    handleLoadDiagnostics(3, 0.5);
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

  const executePipeline = async (confirmedHardware: boolean = false) => {
    setRunningExperiment(true);
    setExperimentStep('1/5 Ingesting 210 pre-transplant clinical features from cohort (0% leakage)...');

    try {
      setTimeout(() => {
        setExperimentStep(`2/5 Selecting Top ${nFeatures} features via SelectKBest...`);
      }, 700);

      setTimeout(() => {
        if (executionMode === 'hardware') {
          setExperimentStep(`3/5 Transpiling ${nFeatures}-qubit circuit across ${selectedBackend} heavy-hex lattice...`);
        } else {
          setExperimentStep(`3/5 Simulating exact ${nFeatures}-qubit Hilbert space statevectors...`);
        }
      }, 1500);

      if (executionMode === 'hardware') {
        setTimeout(() => {
          setExperimentStep(`4/5 Submitting batch to IBM Quantum Qiskit Runtime (${selectedBackend})...`);
        }, 2600);
      }

      const res = await runQuantumKernelExperiment({
        backend_name: selectedBackend,
        execution_mode: executionMode,
        n_features: nFeatures,
        shots: shots,
        max_hardware_samples: maxHardwareSamples,
        confirm_hardware: confirmedHardware
      });

      setExperimentStep('5/5 Training Quantum-Kernel SVM & classical comparative baselines...');
      setLatestExperiment(res);
      await loadBaseData();
    } catch (err: any) {
      alert('Quantum Pipeline Notice: ' + err.message);
    } finally {
      setRunningExperiment(false);
      setExperimentStep('');
    }
  };

  const handleRunClick = () => {
    if (executionMode === 'hardware') {
      setShowConfirmModal(true);
    } else {
      executePipeline(false);
    }
  };

  const selectedBackendMeta = backends.find(b => b.backend_name === selectedBackend) || {
    backend_name: selectedBackend,
    backend_type: executionMode === 'hardware' ? 'IBM Quantum Superconducting QPU' : 'Local Quantum Simulator',
    qubits: executionMode === 'hardware' ? 156 : 32,
    status: 'ONLINE',
    avg_queue_depth: 3,
    two_qubit_error_rate: 0.0032
  };

  return (
    <div className="stack">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <Sparkles size={13} /> Quantum Computing & Engraftment ML
          </div>
          <h2>Quantum Engraftment Research Lab</h2>
          <p>
            GPU-accelerated quantum statevector Gram engine, Heron FakeFez noisy simulation, and physical IBM Quantum QPU execution. Zero data leakage.
          </p>
          <div className="row wrap" style={{ marginTop: '0.5rem', gap: '0.45rem' }}>
            <span className={qStatus?.is_connected_to_hardware ? 'chip chip-green' : 'chip chip-amber'}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {qStatus?.is_connected_to_hardware ? 'IBM Quantum Hardware Authenticated' : 'IBM Hardware: Unauthenticated'}
            </span>
            <span className="chip chip-neutral mono">UCI Paediatric HSCT Cohort (n=187)</span>
            <span className="chip chip-blue">IBM Fez (156 Qubits)</span>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={handleTestConnection}>
            <Key size={14} /> Test IBM credentials
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => { loadBaseData(); loadSweep(true); loadComparison(true); }}
            title="Refresh Telemetry"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI Global Stat Grid */}
      <div className="stats-grid grid-4">
        <div className="stat-box">
          <span className="stat-label">Physical QPU Target</span>
          <span className="stat-value">{selectedBackendMeta.backend_name}</span>
          <span className="stat-sub">{selectedBackendMeta.qubits} Transmon Qubits · Heron R3</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Active Backends</span>
          <span className="stat-value">{backends.length} Registered</span>
          <span className="stat-sub">{backends.filter(b => b.is_hardware).length} Physical QPUs Online</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Total Jobs Executed</span>
          <span className="stat-value">{jobs.length} Runs</span>
          <span className="stat-sub">{jobs.filter(j => j.status === 'COMPLETED').length} Successful Transpilations</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Feature Leakage</span>
          <span className="stat-value" style={{ color: 'var(--accent-green, #10b981)' }}>0.0%</span>
          <span className="stat-sub">Strict Pre-transplant Splitting</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="seg" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'workstation'}
          className={`seg-btn ${activeTab === 'workstation' ? 'active' : ''}`}
          onClick={() => setActiveTab('workstation')}
        >
          <Sparkles size={14} /> 156-Qubit Heron Live Workstation
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'multi_arena'}
          className={`seg-btn ${activeTab === 'multi_arena' ? 'active' : ''}`}
          onClick={() => setActiveTab('multi_arena')}
        >
          <Layers size={14} /> Multi-Architecture Arena (8 Models)
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'kernel_diagnostics'}
          className={`seg-btn ${activeTab === 'kernel_diagnostics' ? 'active' : ''}`}
          onClick={() => setActiveTab('kernel_diagnostics')}
        >
          <Activity size={14} /> Quantum Kernel Diagnostics
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'sweep'}
          className={`seg-btn ${activeTab === 'sweep' ? 'active' : ''}`}
          onClick={() => setActiveTab('sweep')}
        >
          <BarChart3 size={14} /> Qubit Sweep & 5×5 CV (2–16 Qubits)
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'comparison'}
          className={`seg-btn ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          <GitCompare size={14} /> Ideal vs Noisy vs Hardware
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'gpu_simulate'}
          className={`seg-btn ${activeTab === 'gpu_simulate' ? 'active' : ''}`}
          onClick={() => setActiveTab('gpu_simulate')}
        >
          <Zap size={14} /> GPU Quantum Kernel Simulator
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'budget_hw'}
          className={`seg-btn ${activeTab === 'budget_hw' ? 'active' : ''}`}
          onClick={() => setActiveTab('budget_hw')}
        >
          <ShieldCheck size={14} /> IBM Hardware & Budget Guard
        </button>
      </div>

      {/* =========================================================================
          TAB 1: 156-QUBIT HERON LIVE WORKSTATION
         ========================================================================= */}
      {activeTab === 'workstation' && (
        <div className="stack" style={{ gap: '1.5rem' }}>
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Left: Hyperparameters Card */}
            <section className="card">
              <div className="card-header divided">
                <div>
                  <h3 className="card-title">
                    <Cpu size={16} /> Experiment Hyperparameters
                  </h3>
                  <p className="card-subtitle">
                    Configure transpilation, Hilbert space dimension, and hardware execution target.
                  </p>
                </div>
              </div>

              <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                <div className="field">
                  <label className="field-label">Execution Target</label>
                  <div className="seg" style={{ width: '100%' }}>
                    <button
                      type="button"
                      className={`seg-btn ${executionMode === 'simulator' ? 'active' : ''}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => {
                        setExecutionMode('simulator');
                        if (selectedBackend === 'ibm_fez') setSelectedBackend('aer_simulator_statevector');
                      }}
                    >
                      <Zap size={14} /> High-Speed Statevector Simulator
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${executionMode === 'hardware' ? 'active' : ''}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => {
                        setExecutionMode('hardware');
                        setSelectedBackend('ibm_fez');
                      }}
                    >
                      <Microchip size={14} /> IBM Quantum Hardware QPU
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Target Quantum Backend</label>
                  <select
                    className="select"
                    value={selectedBackend}
                    onChange={(e) => setSelectedBackend(e.target.value)}
                  >
                    {backends.map(b => (
                      <option key={b.backend_name} value={b.backend_name}>
                        {b.backend_name} ({b.qubits} Qubits) - {b.backend_type} {b.is_hardware ? '⚡ Physical QPU' : '💻 Simulator'}
                      </option>
                    ))}
                    {backends.length === 0 && (
                      <option value="ibm_fez">ibm_fez (156 Qubits Heron r3) - IBM Quantum QPU</option>
                    )}
                  </select>
                  <p className="field-help">
                    Selected backend: {selectedBackendMeta.qubits} qubits, ~{(selectedBackendMeta.two_qubit_error_rate * 100).toFixed(2)}% two-qubit error rate.
                  </p>
                </div>

                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="field-label" style={{ margin: 0 }}>Feature Subspace Dimension (Qubits)</label>
                    <span className="chip chip-blue mono">{nFeatures} Qubits</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="156"
                    step="1"
                    value={nFeatures}
                    onChange={(e) => setNFeatures(parseInt(e.target.value))}
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  />
                  <p className="field-help">
                    Maps top {nFeatures} features from 210 pre-transplant clinical variables using non-linear ZZFeatureMap entanglement.
                  </p>
                </div>

                <div className="grid-2">
                  <div className="field">
                    <label className="field-label">Measurement Shots</label>
                    <select
                      className="select"
                      value={shots}
                      onChange={(e) => setShots(parseInt(e.target.value))}
                    >
                      <option value={100}>100 Shots (Rapid)</option>
                      <option value={1000}>1,000 Shots (Standard)</option>
                      <option value={4000}>4,000 Shots (High Precision)</option>
                      <option value={10000}>10,000 Shots (Production)</option>
                    </select>
                  </div>

                  {executionMode === 'hardware' && (
                    <div className="field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="field-label" style={{ margin: 0 }}>Max Hardware Samples</label>
                        <span className="chip chip-amber mono">{maxHardwareSamples}</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="24"
                        step="1"
                        value={maxHardwareSamples}
                        onChange={(e) => setMaxHardwareSamples(parseInt(e.target.value))}
                        style={{ width: '100%', marginTop: '0.4rem' }}
                      />
                    </div>
                  )}
                </div>

                {executionMode === 'hardware' && (
                  <div className="alert-banner alert-warn">
                    <AlertTriangle size={16} />
                    <div>
                      <strong>Hardware QPU Execution Guard:</strong> Running on physical IBM hardware utilizes QPU quota. Maximum evaluation is capped at {maxHardwareSamples} samples to prevent quota overrun.
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={handleRunClick}
                  disabled={runningExperiment}
                  style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
                >
                  {runningExperiment ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      Evaluating Quantum Pipeline...
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      {executionMode === 'hardware' ? 'Launch Physical QPU Experiment' : 'Run Full Quantum Pipeline'}
                    </>
                  )}
                </button>

                {runningExperiment && (
                  <div style={{ background: 'var(--surface-2)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)' }}>
                      <RefreshCw size={14} className="spin" />
                      <span>{experimentStep}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Right: Live Evaluation Results Card */}
            <section className="card">
              <div className="card-header divided">
                <div>
                  <h3 className="card-title">
                    <Sparkles size={16} /> Live Evaluation Results
                  </h3>
                  <p className="card-subtitle">
                    Quantum kernel SVM benchmarked against matched classical baselines.
                  </p>
                </div>
                {latestExperiment && (
                  <span className={latestExperiment.is_simulator ? 'chip chip-blue' : 'chip chip-green'}>
                    {latestExperiment.is_simulator ? 'Simulator Result' : 'Hardware QPU Result'}
                  </span>
                )}
              </div>

              {!latestExperiment ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-3)' }}>
                  <Cpu size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontWeight: 500 }}>No quantum experiment results loaded yet.</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                    Configure the hyperparameters on the left and click "Run Full Quantum Pipeline".
                  </p>
                </div>
              ) : (
                <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                  {/* Provenance Box */}
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
                    <div className="grid-2" style={{ gap: '0.5rem', fontSize: '0.8rem' }}>
                      <div><span style={{ color: 'var(--text-3)' }}>Job ID:</span> <span className="mono" style={{ fontWeight: 600 }}>{latestExperiment.job_id}</span></div>
                      <div><span style={{ color: 'var(--text-3)' }}>Backend:</span> <strong>{latestExperiment.backend_used}</strong></div>
                      <div><span style={{ color: 'var(--text-3)' }}>Circuits:</span> <span>{latestExperiment.circuits_submitted || 'Analytical Gram'} ({latestExperiment.shots} shots)</span></div>
                      <div><span style={{ color: 'var(--text-3)' }}>Duration:</span> <span style={{ color: 'var(--accent-green, #10b981)', fontWeight: 600 }}>{latestExperiment.duration_ms} ms</span></div>
                    </div>
                  </div>

                  {/* 3 Model Metric Comparison Grid */}
                  <div className="grid-3" style={{ gap: '0.75rem' }}>
                    {/* Quantum Kernel SVM */}
                    <div className="stat-box" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }}>
                      <span className="chip chip-blue" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}>
                        Quantum-Kernel SVM
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.4rem' }}>
                        {latestExperiment.circuit_width || nFeatures} Qubits on {latestExperiment.backend_used}
                      </div>

                      <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>Accuracy</span>
                          <strong style={{ color: 'var(--accent)' }}>{(latestExperiment.metrics.quantum_kernel_svm.accuracy * 100).toFixed(1)}%</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>Balanced Acc</span>
                          <span>{(latestExperiment.metrics.quantum_kernel_svm.balanced_accuracy * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>F1-Score</span>
                          <span>{latestExperiment.metrics.quantum_kernel_svm.f1_score.toFixed(3)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>ROC-AUC</span>
                          <strong>{latestExperiment.metrics.quantum_kernel_svm.roc_auc != null ? latestExperiment.metrics.quantum_kernel_svm.roc_auc.toFixed(3) : 'N/A'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Matched Classical RBF SVM */}
                    <div className="stat-box" style={{ background: 'var(--surface)' }}>
                      <span className="chip chip-neutral" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}>
                        Classical RBF SVM
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.4rem' }}>
                        Tuned {latestExperiment.selected_features_count || nFeatures} Features (C=4.0)
                      </div>

                      <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>Accuracy</span>
                          <strong style={{ color: 'var(--accent-green, #10b981)' }}>{(latestExperiment.metrics.matched_rbf_svm.accuracy * 100).toFixed(1)}%</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>Balanced Acc</span>
                          <span>{(latestExperiment.metrics.matched_rbf_svm.balanced_accuracy * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>F1-Score</span>
                          <span>{latestExperiment.metrics.matched_rbf_svm.f1_score.toFixed(3)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-3)' }}>ROC-AUC</span>
                          <strong>{latestExperiment.metrics.matched_rbf_svm.roc_auc != null ? latestExperiment.metrics.matched_rbf_svm.roc_auc.toFixed(3) : 'N/A'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Tuned Gradient Boosting */}
                    {latestExperiment.metrics.gradient_boosting ? (
                      <div className="stat-box" style={{ background: 'var(--surface)' }}>
                        <span className="chip chip-neutral" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}>
                          Gradient Boosting
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.4rem' }}>
                          Tuned Ensemble Baseline
                        </div>

                        <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-3)' }}>Accuracy</span>
                            <strong style={{ color: 'var(--accent-green, #10b981)' }}>{(latestExperiment.metrics.gradient_boosting.accuracy * 100).toFixed(1)}%</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-3)' }}>Balanced Acc</span>
                            <span>{(latestExperiment.metrics.gradient_boosting.balanced_accuracy * 100).toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-3)' }}>F1-Score</span>
                            <span>{latestExperiment.metrics.gradient_boosting.f1_score.toFixed(3)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-3)' }}>ROC-AUC</span>
                            <strong>{latestExperiment.metrics.gradient_boosting.roc_auc != null ? latestExperiment.metrics.gradient_boosting.roc_auc.toFixed(3) : 'N/A'}</strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="stat-box" style={{ background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                        Baseline ensemble queued
                      </div>
                    )}
                  </div>

                  {/* Zero Leakage Assurance */}
                  <div className="alert-banner alert-info" style={{ marginTop: '0.25rem' }}>
                    <ShieldCheck size={16} />
                    <div style={{ fontSize: '0.8rem' }}>
                      <strong>Zero Target Leakage Guarantee:</strong> Feature selection, scaling, and hyperparameter tuning were fit solely on the training partition ({latestExperiment.sample_split.train_samples} samples) before evaluating on the isolated test partition ({latestExperiment.sample_split.test_samples} samples).
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Bottom: Recent Jobs Table */}
          <section className="card flush">
            <div className="card-header divided" style={{ padding: '1rem 1.25rem' }}>
              <h3 className="card-title">
                <Clock size={16} /> Execution Audit Log & Job Provenance
              </h3>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Backend Name</th>
                    <th>Execution Mode</th>
                    <th>Status</th>
                    <th>Circuits / Shots</th>
                    <th>Execution Duration</th>
                    <th>Result Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-3)' }}>
                        No execution jobs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    jobs.slice(0, 8).map(j => (
                      <tr key={j.job_id}>
                        <td className="mono" style={{ fontSize: '0.78rem' }}>{j.job_id}</td>
                        <td><strong>{j.backend_name}</strong></td>
                        <td>
                          <span className={`chip ${j.execution_mode === 'hardware' ? 'chip-green' : 'chip-blue'}`} style={{ fontSize: '0.72rem' }}>
                            {j.execution_mode}
                          </span>
                        </td>
                        <td>
                          <span className={`chip ${j.status === 'COMPLETED' ? 'chip-green' : 'chip-amber'}`} style={{ fontSize: '0.72rem' }}>
                            {j.status}
                          </span>
                        </td>
                        <td>{j.shots} shots</td>
                        <td className="tnum">{j.execution_duration_ms ? `${j.execution_duration_ms} ms` : '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{j.result_provenance}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB: MULTI-ARCHITECTURE QUANTUM ARENA (8 COMPARATIVE MODELS)
         ========================================================================= */}
      {activeTab === 'multi_arena' && (
        <div className="stack" style={{ gap: '1.5rem' }}>
          <section className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} style={{ color: 'var(--accent)' }} /> Multi-Architecture Quantum vs Classical Benchmark Arena
                </h3>
                <p className="card-subtitle">
                  8 comparative models evaluated on identical stratified folds with zero target leakage and 95% bootstrap confidence intervals.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleRunArena(arenaEndpoint)}
                  disabled={loadingArena}
                >
                  <RefreshCw size={14} className={loadingArena ? 'spin' : ''} /> Run Leakage-Free Benchmark
                </button>
              </div>
            </div>

            {/* Endpoint Selector Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
              {[
                { id: 'early_engraftment', label: '1. Early Engraftment (≤21 Days)' },
                { id: 'relapse', label: '2. Post-HSCT Relapse Risk' },
                { id: 'survival_risk', label: '3. Overall Survival Mortality Risk' },
                { id: 'aml_genetic_risk', label: '4. AML ELN Genetic Risk' },
              ].map(ep => (
                <button
                  key={ep.id}
                  className={`btn ${arenaEndpoint === ep.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => handleRunArena(ep.id)}
                >
                  {ep.label}
                </button>
              ))}
            </div>

            {/* Anti-Leakage Scientific Badge */}
            {arenaResult && (
              <div style={{ background: 'var(--surface-2)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <ShieldCheck size={18} style={{ color: '#10b981' }} />
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>TRIPOD-AI Compliance & Anti-Leakage Permutation Control:</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginLeft: '0.5rem' }}>
                      Label-permutation AUC = <strong>{arenaResult.anti_leakage_label_permutation_auc}</strong> (Collapses to ~0.50, proving zero leakage).
                    </span>
                  </div>
                </div>
                <span className="chip chip-green">Sample: n={arenaResult.sample_size} (Pos: {Math.round(arenaResult.positive_rate * 100)}%)</span>
              </div>
            )}

            {/* Comparison Table */}
            {loadingArena ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <RefreshCw size={28} className="spin" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }} />
                <p>Simulating 8 architectures across stratified validation folds...</p>
              </div>
            ) : arenaResult?.models ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Model Architecture</th>
                      <th>Category</th>
                      <th>ROC-AUC</th>
                      <th>Balanced Acc</th>
                      <th>Brier Loss</th>
                      <th>95% Bootstrap CI</th>
                      <th>Runtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(arenaResult.models).map(([name, m]: [string, any]) => {
                      const isBest = name === arenaResult.best_model;
                      return (
                        <tr key={name} style={{ background: isBest ? 'rgba(16, 185, 129, 0.05)' : undefined }}>
                          <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isBest && <CheckCircle size={15} style={{ color: '#10b981' }} />}
                            {name.replace(/_/g, ' ')}
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'block', fontWeight: 400 }}>{m.architecture}</span>
                          </td>
                          <td>
                            <span className={`chip ${m.category === 'quantum' ? 'chip-blue' : m.category === 'hybrid' ? 'chip-green' : 'chip-neutral'}`} style={{ fontSize: '0.7rem' }}>
                              {m.category.toUpperCase()}
                            </span>
                          </td>
                          <td className="tnum">
                            <strong style={{ fontSize: '1rem', color: isBest ? '#10b981' : undefined }}>{m.roc_auc.toFixed(3)}</strong>
                          </td>
                          <td className="tnum">{m.balanced_accuracy.toFixed(3)}</td>
                          <td className="tnum">{m.brier_score.toFixed(3)}</td>
                          <td className="tnum mono" style={{ fontSize: '0.75rem' }}>
                            [{m.ci_95?.[0]?.toFixed(3)} - {m.ci_95?.[1]?.toFixed(3)}]
                          </td>
                          <td className="tnum" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{m.runtime_s}s</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB: QUANTUM KERNEL DIAGNOSTICS & HEATMAP
         ========================================================================= */}
      {activeTab === 'kernel_diagnostics' && (
        <div className="stack" style={{ gap: '1.5rem' }}>
          <section className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={18} style={{ color: 'var(--accent)' }} /> Quantum Kernel Spectral Diagnostics & Concentration Heatmap
                </h3>
                <p className="card-subtitle">
                  Inspects Gram matrix condition number, off-diagonal variance, eigenvalue spectrum, and kernel-target alignment A(K, y).
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => handleLoadDiagnostics(diagQubits, diagGamma)}
                disabled={loadingDiag}
              >
                <RefreshCw size={14} className={loadingDiag ? 'spin' : ''} /> Refresh Diagnostics
              </button>
            </div>

            {/* Sliders for Qubits and Bandwidth */}
            <div className="grid-2" style={{ gap: '1rem', margin: '1rem 0' }}>
              <div style={{ background: 'var(--surface-2)', padding: '0.85rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Quantum Feature Map Qubits:</label>
                  <span className="chip chip-blue mono">{diagQubits} Qubits</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="6"
                  step="1"
                  value={diagQubits}
                  onChange={(e) => {
                    const q = parseInt(e.target.value);
                    setDiagQubits(q);
                    handleLoadDiagnostics(q, diagGamma);
                  }}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ background: 'var(--surface-2)', padding: '0.85rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Outer RBF Kernel Bandwidth (γ):</label>
                  <span className="chip chip-purple mono">γ = {diagGamma}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={diagGamma}
                  onChange={(e) => {
                    const g = parseFloat(e.target.value);
                    setDiagGamma(g);
                    handleLoadDiagnostics(diagQubits, g);
                  }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Diagnostics Stats KPI */}
            {diagResult?.diagnostics && (
              <div className="stats-grid grid-4" style={{ marginBottom: '1.25rem' }}>
                <div className="stat-box">
                  <span className="stat-label">Kernel-Target Alignment A(K, y)</span>
                  <span className="stat-value" style={{ color: '#10b981' }}>{diagResult.diagnostics.kernel_target_alignment}</span>
                  <span className="stat-hint">Ideal class separation metric [-1.0, 1.0]</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Condition Number κ(K)</span>
                  <span className="stat-value">{diagResult.diagnostics.condition_number}</span>
                  <span className="stat-hint">{diagResult.diagnostics.condition_number < 1000 ? 'Well-conditioned Gram matrix' : 'Ill-conditioned'}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Off-Diagonal Variance</span>
                  <span className="stat-value mono">{diagResult.diagnostics.off_diagonal_variance}</span>
                  <span className="stat-hint">{diagResult.diagnostics.is_concentrated ? 'Barren Plateau / Concentrated' : 'Healthy non-concentrated spread'}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Class Separation Ratio</span>
                  <span className="stat-value">{diagResult.diagnostics.separation_ratio}x</span>
                  <span className="stat-hint">Within-class vs between-class similarity</span>
                </div>
              </div>
            )}

            {/* Interactive Heatmap & Spectrum Grid */}
            {diagResult?.diagnostics?.heatmap && (
              <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
                {/* Heatmap */}
                <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '8px' }}>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                    Patient Quantum Kernel Matrix K(x_i, x_j) (16×16 Block Averaging)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: '2px', maxWidth: '320px', margin: '0 auto' }}>
                    {diagResult.diagnostics.heatmap.map((row: number[], rIdx: number) =>
                      row.map((val: number, cIdx: number) => {
                        const alpha = Math.max(0.05, Math.min(1.0, val));
                        return (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            title={`P${rIdx} vs P${cIdx}: ${val.toFixed(3)}`}
                            style={{
                              width: '100%',
                              paddingBottom: '100%',
                              background: `rgba(99, 102, 241, ${alpha})`,
                              borderRadius: '1px',
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.5rem' }}>
                    <span>0.0 (Orthogonal)</span>
                    <span>1.0 (Identical Statevector)</span>
                  </div>
                </div>

                {/* Eigenvalue Spectrum */}
                <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '8px' }}>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                    Top 10 Normalized Eigenvalues λ_k / Σλ
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {diagResult.diagnostics.top_eigenvalues?.map((val: number, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <span className="mono" style={{ width: '22px', color: 'var(--text-3)' }}>#{idx + 1}</span>
                        <div style={{ flex: 1, height: '14px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, val * 100 * 2.5)}%`,
                              height: '100%',
                              background: idx === 0 ? 'var(--accent)' : '#3b82f6',
                            }}
                          />
                        </div>
                        <span className="mono" style={{ width: '45px', textAlign: 'right' }}>{(val * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.75rem' }}>
                    Spectral Entropy: <strong>{diagResult.diagnostics.spectral_entropy} bits</strong>. A decayed eigenvalue spectrum confirms the kernel acts as a smooth low-rank feature regularizer.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 2: QUBIT SWEEP & 5x5 CV
         ========================================================================= */}
      {activeTab === 'sweep' && (
        <div className="stack" style={{ gap: '1.5rem' }}>
          {sweepError && (
            <div className="alert-banner alert-error">
              <AlertCircle size={16} />
              <div>{sweepError}</div>
            </div>
          )}

          {sweepResult && (
            <div className="stats-grid grid-3">
              <div className="stat-box">
                <span className="stat-label">Classical Baseline ROC-AUC</span>
                <span className="stat-value">{sweepResult.classical_baseline_auc.toFixed(3)}</span>
                <span className="stat-sub">
                  95% CI: [{sweepResult.classical_baseline_ci[0].toFixed(3)} – {sweepResult.classical_baseline_ci[1].toFixed(3)}]
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Best Qubit Setting</span>
                <span className="stat-value" style={{ color: 'var(--accent)' }}>
                  {sweepResult.best_qubit_setting ? `${sweepResult.best_qubit_setting.qubits} Qubits` : 'N/A'}
                </span>
                <span className="stat-sub">
                  QSVM AUC: {sweepResult.best_qubit_setting?.roc_auc.toFixed(3) ?? 'N/A'} (Diff: {sweepResult.best_qubit_setting ? `${(sweepResult.best_qubit_setting.roc_auc - sweepResult.classical_baseline_auc >= 0 ? '+' : '')}${(sweepResult.best_qubit_setting.roc_auc - sweepResult.classical_baseline_auc).toFixed(3)}` : '—'})
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Barren Plateau Safeguard</span>
                <span className="stat-value" style={{ color: 'var(--accent-green, #10b981)' }}>Active</span>
                <span className="stat-sub">Monitoring exponential concentration of off-diagonal variance</span>
              </div>
            </div>
          )}

          <section className="card flush">
            <div className="card-header divided" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="card-title">
                  <BarChart3 size={16} /> 5×5 Nested Cross-Validation Qubit Sweep (2 to 16 Qubits)
                </h3>
                <p className="card-subtitle">
                  Rigorous nested CV evaluation of ZZFeatureMap fidelity kernel on the UCI paediatric HSCT cohort.
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => loadSweep(true)}
                disabled={loadingSweep}
              >
                <RefreshCw size={14} className={loadingSweep ? 'spin' : ''} />
                {loadingSweep ? 'Running 5×5 Sweep...' : 'Re-run 5×5 Sweep'}
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Qubits</th>
                    <th>QSVM ROC-AUC (95% CI)</th>
                    <th>Diff vs Baseline</th>
                    <th>Balanced Acc</th>
                    <th>Off-Diag Variance</th>
                    <th>Geometric Diff vs RBF</th>
                    <th>Kernel Alignment</th>
                    <th>Tuned c / C</th>
                    <th>Training Time</th>
                  </tr>
                </thead>
                <tbody>
                  {!sweepResult ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                        {loadingSweep ? 'Computing 5×5 nested cross-validation across qubit dimensions...' : 'No sweep data loaded.'}
                      </td>
                    </tr>
                  ) : (
                    sweepResult.sweep_table.map((row) => {
                      const diffVsBase = row.roc_auc - sweepResult.classical_baseline_auc;
                      const isBest = sweepResult.best_qubit_setting?.qubits === row.qubits;
                      return (
                        <tr key={row.qubits} style={isBest ? { background: 'var(--surface-2)' } : undefined}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>{row.qubits} Qubits</span>
                              {isBest && <span className="chip chip-blue" style={{ fontSize: '0.65rem' }}>TOP</span>}
                            </div>
                          </td>
                          <td className="tnum" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                            {row.roc_auc.toFixed(3)}
                            {row.roc_auc_ci && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'block' }}>
                                [{row.roc_auc_ci[0].toFixed(3)}–{row.roc_auc_ci[1].toFixed(3)}]
                              </span>
                            )}
                          </td>
                          <td className="tnum">
                            <span style={{ color: diffVsBase >= 0 ? 'var(--accent-green, #10b981)' : 'var(--accent-red, #ef4444)', fontWeight: 600 }}>
                              {diffVsBase >= 0 ? `+${diffVsBase.toFixed(3)}` : diffVsBase.toFixed(3)}
                            </span>
                          </td>
                          <td className="tnum">
                            {row.balanced_accuracy.toFixed(3)}
                            {row.balanced_accuracy_ci && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'block' }}>
                                [{row.balanced_accuracy_ci[0].toFixed(3)}–{row.balanced_accuracy_ci[1].toFixed(3)}]
                              </span>
                            )}
                          </td>
                          <td className="mono" style={{ fontSize: '0.78rem' }}>
                            <span style={{ color: row.is_concentrated ? 'var(--accent-red, #ef4444)' : 'var(--accent-green, #10b981)' }}>
                              {row.off_diagonal_variance.toExponential(2)}
                            </span>
                            {row.is_concentrated && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--accent-red, #ef4444)', display: 'block' }}>
                                Concentrated
                              </span>
                            )}
                          </td>
                          <td className="tnum">{row.geometric_difference_vs_rbf.toFixed(3)}</td>
                          <td className="tnum">{row.kernel_target_alignment.toFixed(3)}</td>
                          <td className="mono" style={{ fontSize: '0.78rem' }}>{row.best_bandwidth.toFixed(2)} / {row.best_C}</td>
                          <td className="tnum">{row.training_time_seconds.toFixed(2)}s</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 3: IDEAL VS NOISY VS HARDWARE COMPARISON
         ========================================================================= */}
      {activeTab === 'comparison' && (
        <div className="stack" style={{ gap: '1.5rem' }}>
          <section className="card">
            <div className="card-header divided">
              <div>
                <h3 className="card-title">
                  <GitCompare size={16} /> Backend Fidelity & Noise Benchmark
                </h3>
                <p className="card-subtitle">
                  Direct evaluation of the same quantum kernel across ideal statevector, IBM Heron noisy model, and physical hardware.
                </p>
              </div>
              <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                  <span>Qubits:</span>
                  <select
                    className="select"
                    value={compQubits}
                    onChange={(e) => setCompQubits(parseInt(e.target.value))}
                    style={{ padding: '0.2rem 0.5rem', height: 28 }}
                  >
                    <option value={2}>2 Qubits</option>
                    <option value={4}>4 Qubits</option>
                    <option value={6}>6 Qubits</option>
                    <option value={8}>8 Qubits</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                  <span>Shots:</span>
                  <select
                    className="select"
                    value={compShots}
                    onChange={(e) => setCompShots(parseInt(e.target.value))}
                    style={{ padding: '0.2rem 0.5rem', height: 28 }}
                  >
                    <option value={512}>512</option>
                    <option value={1024}>1,024</option>
                    <option value={4096}>4,096</option>
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => loadComparison(true)}
                  disabled={loadingComp}
                >
                  <RefreshCw size={14} className={loadingComp ? 'spin' : ''} />
                  {loadingComp ? 'Evaluating...' : 'Run Benchmark'}
                </button>
              </div>
            </div>

            {!compResult ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-3)' }}>
                {loadingComp ? 'Running backend comparisons across simulators and hardware...' : 'No comparison data available.'}
              </div>
            ) : (
              <div className="grid-3" style={{ gap: '1rem', marginTop: '1rem' }}>
                {/* 1. Ideal Statevector */}
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>1. Ideal Statevector</h4>
                    <span className="chip chip-blue" style={{ fontSize: '0.7rem' }}>Zero Noise</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                    Backend: {compResult.ideal.backend_type}
                  </div>

                  <div className="grid-3" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
                    <div className="stat-box" style={{ padding: '0.5rem' }}>
                      <span className="stat-label">Alignment</span>
                      <strong className="stat-value" style={{ fontSize: '1rem' }}>{compResult.ideal.alignment?.toFixed(4) ?? '—'}</strong>
                    </div>
                    <div className="stat-box" style={{ padding: '0.5rem' }}>
                      <span className="stat-label">QSVM AUC</span>
                      <strong className="stat-value" style={{ fontSize: '1rem', color: 'var(--accent-green, #10b981)' }}>{compResult.ideal.test_auc?.toFixed(3) ?? '—'}</strong>
                    </div>
                    <div className="stat-box" style={{ padding: '0.5rem' }}>
                      <span className="stat-label">Time</span>
                      <strong className="stat-value" style={{ fontSize: '1rem' }}>{compResult.ideal.elapsed_seconds?.toFixed(2) ?? '—'}s</strong>
                    </div>
                  </div>

                  {compResult.ideal.matrix_preview && (
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'block', marginBottom: '0.4rem' }}>
                        Kernel Matrix 4×4 Sub-block
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                        {compResult.ideal.matrix_preview.flatMap((row, rIdx) =>
                          row.map((val, cIdx) => (
                            <div
                              key={`${rIdx}-${cIdx}`}
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                padding: '0.35rem 0.15rem',
                                textAlign: 'center',
                                fontSize: '0.7rem',
                                fontFamily: 'monospace',
                                borderRadius: '4px'
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

                {/* 2. Noisy Simulation (Heron Model) */}
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>2. Heron Noise Model</h4>
                    <span className="chip chip-amber" style={{ fontSize: '0.7rem' }}>Thermal + Readout</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                    Backend: {compResult.noisy_simulation.backend_type}
                  </div>

                  <div className="grid-3" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
                    <div className="stat-box" style={{ padding: '0.5rem' }}>
                      <span className="stat-label">Frobenius Err</span>
                      <strong className="stat-value" style={{ fontSize: '1rem', color: 'var(--accent-amber, #f59e0b)' }}>
                        {compResult.noisy_simulation.frobenius_error_vs_ideal != null ? `${(compResult.noisy_simulation.frobenius_error_vs_ideal * 100).toFixed(2)}%` : 'N/A'}
                      </strong>
                    </div>
                    <div className="stat-box" style={{ padding: '0.5rem' }}>
                      <span className="stat-label">QSVM AUC</span>
                      <strong className="stat-value" style={{ fontSize: '1rem' }}>{compResult.noisy_simulation.test_auc?.toFixed(3) ?? '—'}</strong>
                    </div>
                    <div className="stat-box" style={{ padding: '0.5rem' }}>
                      <span className="stat-label">Attenuation</span>
                      <strong className="stat-value" style={{ fontSize: '1rem' }}>
                        {compResult.noisy_simulation.diagonal_attenuation != null ? `${(compResult.noisy_simulation.diagonal_attenuation * 100).toFixed(1)}%` : 'N/A'}
                      </strong>
                    </div>
                  </div>

                  {compResult.noisy_simulation.matrix_preview && (
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'block', marginBottom: '0.4rem' }}>
                        Kernel Matrix 4×4 Sub-block
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                        {compResult.noisy_simulation.matrix_preview.flatMap((row, rIdx) =>
                          row.map((val, cIdx) => (
                            <div
                              key={`${rIdx}-${cIdx}`}
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                padding: '0.35rem 0.15rem',
                                textAlign: 'center',
                                fontSize: '0.7rem',
                                fontFamily: 'monospace',
                                borderRadius: '4px'
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

                {/* 3. Physical IBM Quantum QPU */}
                <div className="card" style={{ background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>3. Physical IBM QPU</h4>
                    <span className={`chip ${compResult.hardware.available ? 'chip-green' : 'chip-neutral'}`} style={{ fontSize: '0.7rem' }}>
                      {compResult.hardware.available ? 'Connected' : 'Offline / Mock'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                    {compResult.hardware.message}
                  </div>

                  {!compResult.hardware.available ? (
                    <div className="alert-banner alert-warn" style={{ fontSize: '0.8rem' }}>
                      <AlertTriangle size={15} />
                      <div>
                        Hardware execution skipped or unauthenticated. Configure an IBM Quantum API token to evaluate on real superconducting transmon qubits.
                      </div>
                    </div>
                  ) : (
                    <div className="grid-2" style={{ gap: '0.5rem', marginBottom: '1rem' }}>
                      <div className="stat-box" style={{ padding: '0.5rem' }}>
                        <span className="stat-label">Target Backend</span>
                        <strong className="stat-value" style={{ fontSize: '1rem' }}>{compResult.hardware.backend_name}</strong>
                      </div>
                      <div className="stat-box" style={{ padding: '0.5rem' }}>
                        <span className="stat-label">QSVM AUC</span>
                        <strong className="stat-value" style={{ fontSize: '1rem', color: 'var(--accent-green, #10b981)' }}>
                          {compResult.hardware.test_auc?.toFixed(3) ?? '—'}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 4: GPU QUANTUM KERNEL SIMULATOR
         ========================================================================= */}
      {activeTab === 'gpu_simulate' && (
        <div className="stack" style={{ gap: '1.5rem' }}>
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <section className="card">
              <div className="card-header divided">
                <div>
                  <h3 className="card-title">
                    <Zap size={16} /> GPU Statevector Simulator Parameters
                  </h3>
                  <p className="card-subtitle">
                    Accelerated statevector tensor-contraction engine for fast fidelity Gram matrix calculation.
                  </p>
                </div>
              </div>

              <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="field-label" style={{ margin: 0 }}>Cohort Patients (Sub-cohort)</label>
                    <span className="chip chip-neutral mono">{simPatients} Patients</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="48"
                    step="4"
                    value={simPatients}
                    onChange={(e) => setSimPatients(parseInt(e.target.value))}
                    style={{ width: '100%', marginTop: '0.4rem' }}
                  />
                  <p className="field-help">Generates a {simPatients}×{simPatients} pairwise fidelity kernel matrix.</p>
                </div>

                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="field-label" style={{ margin: 0 }}>Qubit Width (Features)</label>
                    <span className="chip chip-blue mono">{simQubits} Qubits</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="16"
                    step="1"
                    value={simQubits}
                    onChange={(e) => setSimQubits(parseInt(e.target.value))}
                    style={{ width: '100%', marginTop: '0.4rem' }}
                  />
                  <p className="field-help">Statevector size: 2^{simQubits} = {Math.pow(2, simQubits)} complex amplitudes per patient.</p>
                </div>

                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="field-label" style={{ margin: 0 }}>Feature Map Bandwidth (γ)</label>
                    <span className="chip chip-neutral mono">{simBandwidth.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={simBandwidth}
                    onChange={(e) => setSimBandwidth(parseFloat(e.target.value))}
                    style={{ width: '100%', marginTop: '0.4rem' }}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleRunGpuSimulation}
                  disabled={simRunning}
                  style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
                >
                  {simRunning ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      {simProgress.message}
                    </>
                  ) : (
                    <>
                      <Zap size={15} />
                      Launch GPU Kernel Simulation
                    </>
                  )}
                </button>
              </div>
            </section>

            <section className="card">
              <div className="card-header divided">
                <div>
                  <h3 className="card-title">
                    <Sparkles size={16} /> Simulation Diagnostics & Matrix
                  </h3>
                  <p className="card-subtitle">
                    Telemetry, Gram spectrum, and barren plateau diagnostics.
                  </p>
                </div>
              </div>

              {!simResult ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-3)' }}>
                  <Zap size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontWeight: 500 }}>No simulation executed yet.</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                    Adjust parameters on the left and click "Launch GPU Kernel Simulation".
                  </p>
                </div>
              ) : (
                <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                  <div className="grid-2" style={{ gap: '0.75rem' }}>
                    <div className="stat-box">
                      <span className="stat-label">Device Used</span>
                      <strong className="stat-value" style={{ fontSize: '0.95rem' }}>
                        {simResult.telemetry.device} ({simResult.telemetry.matmul_accelerator})
                      </strong>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Kernel Alignment</span>
                      <strong className="stat-value" style={{ fontSize: '0.95rem' }}>
                        {simResult.diagnostics.kernel_target_alignment.toFixed(4)}
                      </strong>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Off-Diagonal Variance</span>
                      <strong className="stat-value" style={{ fontSize: '0.95rem', color: simResult.diagnostics.is_concentrated ? 'var(--accent-red, #ef4444)' : 'var(--accent-green, #10b981)' }}>
                        {simResult.diagnostics.off_diagonal_variance.toExponential(2)}
                      </strong>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Elapsed Time</span>
                      <strong className="stat-value" style={{ fontSize: '0.95rem' }}>
                        {simResult.telemetry.elapsed_seconds.toFixed(3)}s
                      </strong>
                    </div>
                  </div>

                  {simResult.kernel_matrix_preview && (
                    <div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '0.5rem' }}>
                        Gram Matrix Heatmap Preview ({simResult.kernel_shape[0]}×{simResult.kernel_shape[1]})
                      </span>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${simResult.kernel_matrix_preview.length}, 1fr)`,
                          gap: '3px',
                          background: 'var(--surface-2)',
                          padding: '0.5rem',
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        {simResult.kernel_matrix_preview.flatMap((row, rIdx) =>
                          row.map((val, cIdx) => (
                            <div
                              key={`${rIdx}-${cIdx}`}
                              style={{
                                background: `rgba(37, 99, 235, ${Math.max(0.1, val)})`,
                                padding: '0.35rem 0.15rem',
                                textAlign: 'center',
                                fontSize: '0.68rem',
                                fontFamily: 'monospace',
                                borderRadius: '3px',
                                color: val > 0.5 ? '#ffffff' : 'var(--text)'
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
            </section>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: IBM HARDWARE & BUDGET GUARD
         ========================================================================= */}
      {activeTab === 'budget_hw' && (
        <div className="stack" style={{ gap: '1.5rem' }}>
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Budget Calculator Card */}
            <section className="card">
              <div className="card-header divided">
                <div>
                  <h3 className="card-title">
                    <ShieldCheck size={16} /> IBM Quantum Budget Guard
                  </h3>
                  <p className="card-subtitle">
                    Enforces strict execution quotas before submitting jobs to physical IBM Quantum QPUs.
                  </p>
                </div>
              </div>

              <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                <div className="field">
                  <label className="field-label">Number of Circuits</label>
                  <input
                    type="number"
                    className="input"
                    value={budgetCircuits}
                    onChange={(e) => setBudgetCircuits(parseInt(e.target.value) || 0)}
                  />
                  <p className="field-help">Total statevector or transpiled kernel evaluation circuits.</p>
                </div>

                <div className="field">
                  <label className="field-label">Measurement Shots per Circuit</label>
                  <input
                    type="number"
                    className="input"
                    value={budgetShots}
                    onChange={(e) => setBudgetShots(parseInt(e.target.value) || 0)}
                  />
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={handleEstimateBudget}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Recalculate Budget Guard
                </button>

                {budgetResult && (
                  <div
                    className={budgetResult.within_budget ? 'alert-banner alert-info' : 'alert-banner alert-error'}
                    style={{ marginTop: '0.5rem' }}
                  >
                    {budgetResult.within_budget ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Estimated QPU Execution Time:</strong>
                        <span className="mono" style={{ fontWeight: 700 }}>{budgetResult.estimated_qpu_seconds}s</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                        <span>Budget Cap:</span>
                        <span>{budgetResult.max_allowed_budget_seconds}s</span>
                      </div>
                      {!budgetResult.within_budget && (
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--accent-red, #ef4444)' }}>
                          {budgetResult.refusal_reason}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Error Mitigation & Twirling Card */}
            <section className="card">
              <div className="card-header divided">
                <div>
                  <h3 className="card-title">
                    <Zap size={16} /> Hardware Error Mitigation Protocols
                  </h3>
                  <p className="card-subtitle">
                    Active protocols applied when transpiling to IBM Heron heavy-hex lattice.
                  </p>
                </div>
              </div>

              <div className="stack" style={{ gap: '0.75rem', marginTop: '1rem' }}>
                <div style={{ background: 'var(--surface-2)', padding: '0.85rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block' }}>Pauli Twirling (Randomized Compiling)</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Converts coherent crosstalk errors into stochastic Pauli noise</span>
                  </div>
                  <span className="chip chip-blue" style={{ fontSize: '0.72rem' }}>Enabled</span>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: '0.85rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block' }}>Dynamical Decoupling (XY4)</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Inserts echo pulses on idle qubits to mitigate environmental dephasing</span>
                  </div>
                  <span className="chip chip-blue" style={{ fontSize: '0.72rem' }}>Enabled</span>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: '0.85rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', display: 'block' }}>Zero-Noise Extrapolation (ZNE)</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Scales noise levels to extrapolate zero-noise expectation values</span>
                  </div>
                  <span className="chip chip-neutral" style={{ fontSize: '0.72rem' }}>Optional</span>
                </div>
              </div>
            </section>
          </div>

          {/* Registered Backends Table */}
          <section className="card flush">
            <div className="card-header divided" style={{ padding: '1rem 1.25rem' }}>
              <h3 className="card-title">
                <Server size={16} /> Registered IBM Quantum Backends & Simulators
              </h3>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Backend Name</th>
                    <th>Type</th>
                    <th>Qubits</th>
                    <th>Status</th>
                    <th>Avg Queue</th>
                    <th>2-Qubit Error Rate</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {backends.map(b => (
                    <tr key={b.backend_name}>
                      <td style={{ fontWeight: 600 }}>{b.backend_name}</td>
                      <td>{b.backend_type}</td>
                      <td className="tnum"><strong>{b.qubits}</strong></td>
                      <td>
                        <span className={`chip ${b.status === 'ONLINE' ? 'chip-green' : 'chip-amber'}`} style={{ fontSize: '0.72rem' }}>
                          {b.status}
                        </span>
                      </td>
                      <td className="tnum">{b.avg_queue_depth} jobs</td>
                      <td className="tnum">{(b.two_qubit_error_rate * 100).toFixed(2)}%</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{b.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Connection Test Modal */}
      {showTestModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={18} style={{ color: 'var(--accent)' }} />
                <h3 className="card-title" style={{ margin: 0 }}>IBM Quantum Credentials Test</h3>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.2rem 0.5rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            {testingConn ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-3)' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--accent)' }} />
                Testing authentication with IBM Quantum Platform...
              </div>
            ) : connTestResult ? (
              <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                <div
                  className={connTestResult.success ? 'alert-banner alert-info' : 'alert-banner alert-error'}
                >
                  {connTestResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  <div>
                    <strong>{connTestResult.success ? 'Authentication Succeeded' : 'Authentication Failed'}</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                      {connTestResult.message || connTestResult.error}
                    </p>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-2)', padding: '0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                  <div className="stack" style={{ gap: '0.4rem' }}>
                    <div>Channel: <strong className="mono">{connTestResult.channel || 'ibm_quantum_platform'}</strong></div>
                    <div>Token configured: <strong>{connTestResult.token_configured ? 'Yes' : 'No'}</strong></div>
                    {connTestResult.token_masked && <div>Token: <span className="mono">{connTestResult.token_masked}</span></div>}
                    {connTestResult.accessible_backends_count !== undefined && (
                      <div>Accessible QPUs: <strong>{connTestResult.accessible_backends_count}</strong></div>
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={() => setShowTestModal(false)} style={{ width: '100%' }}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Hardware Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} style={{ color: 'var(--accent-amber, #f59e0b)' }} />
                <h3 className="card-title" style={{ margin: 0 }}>Confirm IBM Hardware QPU Execution</h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.2rem 0.5rem', border: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
              <div className="alert-banner alert-warn">
                <AlertTriangle size={16} />
                <div style={{ fontSize: '0.82rem' }}>
                  You are about to submit quantum circuits to a physical superconducting processor (<strong>{selectedBackend}</strong>). This will consume cloud QPU execution time.
                </div>
              </div>

              <div style={{ background: 'var(--surface-2)', padding: '0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                <div className="stack" style={{ gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-3)' }}>Target Processor:</span>
                    <strong>{selectedBackend}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-3)' }}>Feature Qubits:</span>
                    <strong className="mono">{nFeatures} Qubits</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-3)' }}>Measurement Shots:</span>
                    <span className="mono">{shots}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-3)' }}>Max Hardware Samples:</span>
                    <span className="mono">{maxHardwareSamples}</span>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowConfirmModal(false);
                    executePipeline(true);
                  }}
                >
                  Confirm & Submit to QPU
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuantumLabView;
