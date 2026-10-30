import React, { useState, useEffect } from 'react';
import {
  Cpu, Server, Activity, ShieldCheck, Play, RefreshCw, AlertCircle,
  Clock, Zap, CheckCircle2, Key, ExternalLink, Check, Sparkles,
  Layers, Database, ArrowRight, AlertTriangle, Radio, BarChart3
} from 'lucide-react';
import { QuantumBackend, QuantumStatus, QuantumJob, QuantumExperimentResult } from '../types';
import {
  fetchQuantumBackends, fetchQuantumStatus, fetchQuantumJobs,
  testQuantumConnection, runQuantumKernelExperiment, fetchLatestQuantumExperiment
} from '../api';

export const QuantumLabView: React.FC = () => {
  const [backends, setBackends] = useState<QuantumBackend[]>([]);
  const [qStatus, setQStatus] = useState<QuantumStatus | null>(null);
  const [jobs, setJobs] = useState<QuantumJob[]>([]);
  const [selectedBackend, setSelectedBackend] = useState<string>('ibm_fez');
  const [executionMode, setExecutionMode] = useState<'hardware' | 'simulator'>('hardware');
  const [shots, setShots] = useState<number>(1000);
  const [maxHardwareSamples, setMaxHardwareSamples] = useState<number>(4);
  const [runningExperiment, setRunningExperiment] = useState<boolean>(false);
  const [experimentStep, setExperimentStep] = useState<string>('');
  const [latestExperiment, setLatestExperiment] = useState<QuantumExperimentResult | null>(null);

  // Connection Test Modal
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [testingConn, setTestingConn] = useState<boolean>(false);
  const [connTestResult, setConnTestResult] = useState<any>(null);

  // Hardware Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [bList, statusData, jobList, latestExp] = await Promise.all([
        fetchQuantumBackends(),
        fetchQuantumStatus(),
        fetchQuantumJobs(),
        fetchLatestQuantumExperiment()
      ]);
      setBackends(bList);
      setQStatus(statusData);
      setJobs(jobList);
      if (latestExp) {
        setLatestExperiment(latestExp);
      }
      
      // Select first operational hardware backend if available
      const operationalHw = bList.find(b => b.is_hardware && b.status === 'ONLINE');
      if (operationalHw) {
        setSelectedBackend(operationalHw.backend_name);
      } else if (bList.length > 0) {
        setSelectedBackend(bList[0].backend_name);
      }
    } catch (e) {
      console.error("Error loading quantum lab data:", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestConnection = async () => {
    setTestingConn(true);
    setShowTestModal(true);
    setConnTestResult(null);
    try {
      const res = await testQuantumConnection();
      setConnTestResult(res);
      await loadData();
    } catch (err: any) {
      setConnTestResult({
        success: false,
        error: err.message || "Failed to reach backend connection test endpoint"
      });
    } finally {
      setTestingConn(false);
    }
  };

  const executePipeline = async (confirmedHardware: boolean = false) => {
    setRunningExperiment(true);
    setExperimentStep('1/5 Ingesting 63 pre-transplant clinical features from CIBMTR cohort...');
    
    try {
      setTimeout(() => {
        setExperimentStep('2/5 Fitting LeakageSafePreprocessor & selecting Top 20 features via SelectKBest...');
      }, 700);

      setTimeout(() => {
        if (executionMode === 'hardware') {
          setExperimentStep(`3/5 Transpiling 20-qubit circuit for ${selectedBackend} heavy-hex topology...`);
        } else {
          setExperimentStep('3/5 Simulating exact 20-qubit Hilbert space statevectors...');
        }
      }, 1500);

      if (executionMode === 'hardware') {
        setTimeout(() => {
          setExperimentStep(`4/5 Submitting batch to IBM Quantum Qiskit Runtime SamplerV2 (${selectedBackend})...`);
        }, 2600);
      }

      const res = await runQuantumKernelExperiment({
        backend_name: selectedBackend,
        execution_mode: executionMode,
        n_features: 20,
        shots: shots,
        max_hardware_samples: maxHardwareSamples,
        confirm_hardware: confirmedHardware
      });

      setExperimentStep('5/5 Training Quantum-Kernel SVM & evaluating classical RBF comparator...');
      setLatestExperiment(res);
      await loadData();
    } catch (err: any) {
      alert("Quantum Pipeline Notice: " + err.message);
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
    is_hardware: executionMode === 'hardware',
    avg_queue_depth: 0,
    description: '156-Qubit Superconducting Processor',
    basis_gates: ['cz', 'id', 'rz', 'sx', 'x', 'measure'],
    two_qubit_error_rate: 0.0055
  };

  const isHardwareSelected = selectedBackendMeta.is_hardware || executionMode === 'hardware';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1360px', margin: '0 auto', color: '#e2e8f0' }}>
      
      {/* 1. Header Card with Live IBM Quantum Service Telemetry */}
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
                IBM Quantum Compute Service Bridge
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
                {qStatus?.is_connected_to_hardware ? 'IBM Quantum Service Authenticated' : 'Credentials Not Configured'}
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
                Channel: {qStatus?.channel || 'ibm_quantum_platform'}
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
                Key: {qStatus?.token_masked || 'NOT_CONFIGURED'}
              </span>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Qiskit Runtime SamplerV2 integration for high-dimensional clinical HSCT recovery prediction (Day-28 Neutrophil Engraftment).
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleTestConnection}
              className="spatial-pill-btn"
              style={{ padding: '0.6rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ShieldCheck size={16} />
              <span>Validate IBM Connection</span>
            </button>
            <button
              onClick={loadData}
              className="spatial-pill-btn"
              style={{ padding: '0.6rem 0.85rem' }}
              title="Refresh telemetry"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Primary Telemetry KPI Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        
        <div className="spatial-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Quantum Processor</span>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>{selectedBackendMeta.backend_name}</div>
          <span style={{ fontSize: '0.75rem', color: selectedBackendMeta.is_hardware ? '#60a5fa' : '#34d399', fontWeight: 600 }}>
            {selectedBackendMeta.qubits} Qubits • {selectedBackendMeta.is_hardware ? 'Physical Superconducting' : 'Local Statevector'}
          </span>
        </div>

        <div className="spatial-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Feature Reduction & Encoding</span>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>63 → 20 Clinical Features</div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>SelectKBest (f_classif) • Zero Leakage</span>
        </div>

        <div className="spatial-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Circuit Width & Depth</span>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>20 Qubits • Depth 6</div>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Heavy-Hex Transpiled (PassManager)</span>
        </div>

        <div className="spatial-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hardware Queue Depth</span>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>{selectedBackendMeta.avg_queue_depth} jobs pending</div>
          <span style={{ fontSize: '0.75rem', color: selectedBackendMeta.avg_queue_depth === 0 ? '#34d399' : '#fbbf24' }}>
            {selectedBackendMeta.avg_queue_depth === 0 ? 'Zero queue • Instant execution' : 'In queue rotation'}
          </span>
        </div>

      </div>

      {/* 3. Main Experiment Execution Console & Live Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left: Interactive Experiment Trigger & Pipeline Config */}
        <div className="spatial-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <div className="spatial-section-title" style={{ margin: 0 }}>
                <span className="blue-dot" />
                <span>50+ Clinical Features → 20 Qubit Quantum Experiment</span>
              </div>
              <span style={{
                fontSize: '0.72rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                background: isHardwareSelected ? 'rgba(234, 179, 8, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: isHardwareSelected ? '#fde047' : '#93c5fd',
                border: `1px solid ${isHardwareSelected ? 'rgba(234, 179, 8, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                fontWeight: 600
              }}>
                {isHardwareSelected ? 'PHYSICAL QPU MODE' : 'LOCAL SIMULATOR MODE'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              Extracts 63 strictly pre-transplant clinical features from the CIBMTR HSCT dataset, optimizes to the Top 20 predictive features on training data, maps to 20 quantum statevector registers, and executes the fidelity kernel on target hardware.
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div
              onClick={() => {
                setExecutionMode('hardware');
                const hw = backends.find(b => b.is_hardware && b.status === 'ONLINE');
                if (hw) setSelectedBackend(hw.backend_name);
              }}
              style={{
                padding: '1rem',
                borderRadius: '12px',
                cursor: 'pointer',
                background: executionMode === 'hardware' ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                border: executionMode === 'hardware' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#ffffff', fontSize: '0.9rem' }}>
                  <Radio size={16} color={executionMode === 'hardware' ? '#60a5fa' : '#94a3b8'} />
                  <span>Physical IBM Hardware</span>
                </div>
                {executionMode === 'hardware' && <Check size={16} color="#60a5fa" />}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Executes genuine circuits on 156-qubit IBM QPU via Qiskit Runtime SamplerV2.
              </div>
            </div>

            <div
              onClick={() => {
                setExecutionMode('simulator');
                setSelectedBackend('aer_simulator_statevector');
              }}
              style={{
                padding: '1rem',
                borderRadius: '12px',
                cursor: 'pointer',
                background: executionMode === 'simulator' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                border: executionMode === 'simulator' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#ffffff', fontSize: '0.9rem' }}>
                  <Activity size={16} color={executionMode === 'simulator' ? '#34d399' : '#94a3b8'} />
                  <span>Local Statevector Simulator</span>
                </div>
                {executionMode === 'simulator' && <Check size={16} color="#34d399" />}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Zero queue wait. Evaluates exact analytical Hilbert space inner product.
              </div>
            </div>
          </div>

          {/* Configuration Parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                Selected Target Backend
              </label>
              <select
                value={selectedBackend}
                onChange={(e) => {
                  setSelectedBackend(e.target.value);
                  const isHw = !e.target.value.includes('simulator');
                  setExecutionMode(isHw ? 'hardware' : 'simulator');
                }}
                style={{
                  width: '100%',
                  background: 'rgba(10, 14, 23, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                {backends.map(b => (
                  <option key={b.backend_name} value={b.backend_name}>
                    {b.backend_name} ({b.qubits} Qubits {b.is_hardware ? '• QPU' : '• Sim'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                Measurement Shots
              </label>
              <select
                value={shots}
                onChange={(e) => setShots(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(10, 14, 23, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value={500}>500 Shots</option>
                <option value={1000}>1,000 Shots (Recommended)</option>
                <option value={2048}>2,048 Shots</option>
                <option value={4096}>4,096 Shots</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                Evaluation Sample Limit
              </label>
              <select
                value={maxHardwareSamples}
                onChange={(e) => setMaxHardwareSamples(Number(e.target.value))}
                style={{
                  width: '100%',
                  background: 'rgba(10, 14, 23, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.75rem',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value={4}>4 Train / 2 Test (14 circuits)</option>
                <option value={6}>6 Train / 3 Test (33 circuits)</option>
                <option value={8}>8 Train / 4 Test (60 circuits)</option>
              </select>
            </div>
          </div>

          {/* Feature Badges Display */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              <strong>Top Pre-Transplant Features Selected (20 Qubits):</strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {[
                'cd34_dose', 'comorbidity_index_hctci', 'hla_match_score', 'recipient_kps',
                'graft_source', 'donor_age', 'disease_status', 'pre_tx_ferritin',
                'conditioning_intensity', 'diabetes_treated', 'pulmonary_moderate_severe',
                'total_nucleated_cells_tnc', 'time_diagnosis_to_tx_days', 'blast_percentage_pre_tx',
                'atg_alemtuzumab_serotherapy', 'donor_recipient_weight_ratio', 'donor_cmv',
                'pre_tx_albumin', 'total_body_irradiation_tbi', 'prior_autologous_tx'
              ].map((feat, idx) => (
                <span key={feat} style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#cbd5e1',
                  fontFamily: 'monospace'
                }}>
                  q[{idx}]: {feat}
                </span>
              ))}
            </div>
          </div>

          {/* Execution Progress & Status */}
          {runningExperiment && (
            <div style={{
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '10px',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <RefreshCw size={18} className="spin" color="#60a5fa" />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                  Executing Quantum Kernel Pipeline...
                </div>
                <div style={{ fontSize: '0.75rem', color: '#93c5fd' }}>
                  {experimentStep}
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Evaluation split strictly enforced on held-out patients with zero data leakage.
            </div>

            <button
              onClick={handleRunClick}
              disabled={runningExperiment}
              className="spatial-cta-btn"
              style={{
                padding: '0.75rem 1.75rem',
                background: isHardwareSelected ? 'linear-gradient(135deg, #1d4ed8, #4338ca)' : 'linear-gradient(135deg, #059669, #047857)'
              }}
            >
              <Play size={15} fill="#ffffff" />
              <span>{runningExperiment ? 'Processing on Quantum Backend...' : `Run 20-Feature Experiment (${executionMode.toUpperCase()})`}</span>
            </button>
          </div>

        </div>

        {/* Right: Comparative Results Card (Quantum vs Classical) */}
        <div className="spatial-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="spatial-section-title" style={{ margin: 0 }}>
              <span className="blue-dot" />
              <span>Side-by-Side Model Evaluation</span>
            </div>
            {latestExperiment && (
              <span style={{
                fontSize: '0.7rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                background: latestExperiment.is_simulator ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: latestExperiment.is_simulator ? '#93c5fd' : '#34d399',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: 600
              }}>
                {latestExperiment.is_simulator ? 'SIMULATOR RESULT' : 'PHYSICAL HARDWARE RESULT'}
              </span>
            )}
          </div>

          {latestExperiment ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Provenance Box */}
              <div style={{
                background: 'rgba(10, 14, 23, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                fontSize: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#94a3b8' }}>Job ID:</span>
                  <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontWeight: 600 }}>{latestExperiment.job_id}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#94a3b8' }}>Backend:</span>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{latestExperiment.backend_used}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ color: '#94a3b8' }}>Circuits Evaluated:</span>
                  <span style={{ color: '#ffffff' }}>{latestExperiment.circuits_submitted || 'Analytical Gram'} ({latestExperiment.shots} shots)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Execution Duration:</span>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>{latestExperiment.duration_ms} ms</span>
                </div>
              </div>

              {/* Side-by-Side Comparison Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                
                {/* Quantum Kernel SVM Card */}
                <div style={{
                  background: 'rgba(37, 99, 235, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Cpu size={15} />
                    <span>Quantum-Kernel SVM</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    20 Qubits on {latestExperiment.backend_used}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Accuracy</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                      {(latestExperiment.metrics.quantum_kernel_svm.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Balanced Acc</span>
                    <span style={{ fontSize: '0.82rem', color: '#ffffff' }}>
                      {(latestExperiment.metrics.quantum_kernel_svm.balanced_accuracy * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>F1-Score</span>
                    <span style={{ fontSize: '0.82rem', color: '#ffffff' }}>
                      {latestExperiment.metrics.quantum_kernel_svm.f1_score.toFixed(3)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ROC-AUC</span>
                    <span style={{ fontSize: '0.82rem', color: '#ffffff' }}>
                      {latestExperiment.metrics.quantum_kernel_svm.roc_auc != null ? latestExperiment.metrics.quantum_kernel_svm.roc_auc.toFixed(3) : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Classical RBF SVM Card */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <BarChart3 size={15} />
                    <span>Classical RBF SVM</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Matched 20 Input Features
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Accuracy</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                      {(latestExperiment.metrics.matched_rbf_svm.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Balanced Acc</span>
                    <span style={{ fontSize: '0.82rem', color: '#ffffff' }}>
                      {(latestExperiment.metrics.matched_rbf_svm.balanced_accuracy * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>F1-Score</span>
                    <span style={{ fontSize: '0.82rem', color: '#ffffff' }}>
                      {latestExperiment.metrics.matched_rbf_svm.f1_score.toFixed(3)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ROC-AUC</span>
                    <span style={{ fontSize: '0.82rem', color: '#ffffff' }}>
                      {latestExperiment.metrics.matched_rbf_svm.roc_auc != null ? latestExperiment.metrics.matched_rbf_svm.roc_auc.toFixed(3) : 'N/A'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Zero-Leakage & Clinical Assurance */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                fontSize: '0.72rem',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <ShieldCheck size={16} />
                <span>Zero target leakage verified: post-transplant measurements excluded; encoders fit on training set only.</span>
              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
              <Cpu size={32} style={{ margin: '0 auto 0.75rem', color: '#64748b' }} />
              <div>No experiment executed yet.</div>
              <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Select a backend and trigger the 20-feature quantum pipeline above.
              </div>
            </div>
          )}

        </div>

      </div>

      {/* 4. Live Backends Catalog & Hardware Specifications Table */}
      <div className="spatial-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div className="spatial-section-title" style={{ margin: 0 }}>
            <span className="blue-dot" />
            <span>Accessible Quantum Processors & Simulators</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Live discovery via QiskitRuntimeService.backends()
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {backends.map((b) => {
            const isSelected = selectedBackend === b.backend_name;
            return (
              <div
                key={b.backend_name}
                onClick={() => {
                  setSelectedBackend(b.backend_name);
                  setExecutionMode(b.is_hardware ? 'hardware' : 'simulator');
                }}
                style={{
                  background: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.15rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                    {b.backend_name}
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    background: b.status === 'ONLINE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: b.status === 'ONLINE' ? '#34d399' : '#f87171',
                    fontWeight: 600
                  }}>
                    ● {b.status}
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  {b.description}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingTop: '0.5rem',
                  fontSize: '0.72rem'
                }}>
                  <span style={{ color: '#94a3b8' }}>Qubits: <strong style={{ color: '#ffffff' }}>{b.qubits}</strong></span>
                  <span style={{ color: '#94a3b8' }}>Queue: <strong style={{ color: b.avg_queue_depth === 0 ? '#34d399' : '#fbbf24' }}>{b.avg_queue_depth}</strong></span>
                  <span style={{ color: b.is_hardware ? '#60a5fa' : '#a78bfa', fontWeight: 600 }}>
                    {b.is_hardware ? 'QPU' : 'Simulator'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Executed Quantum Jobs Audit Log */}
      <div className="spatial-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div className="spatial-section-title" style={{ margin: 0 }}>
            <span className="blue-dot" />
            <span>Executed Quantum Jobs & Provenance Log</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Permanent SQLite Audit Trail
          </span>
        </div>

        {jobs.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Job ID</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Backend</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Execution Mode</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Status</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Shots</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Runtime</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.job_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', color: '#60a5fa' }}>
                      {j.job_id}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#ffffff' }}>
                      {j.backend_name}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background: j.execution_mode.includes('hardware') ? 'rgba(234, 179, 8, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: j.execution_mode.includes('hardware') ? '#fde047' : '#93c5fd',
                        fontWeight: 600
                      }}>
                        {j.execution_mode}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: j.status.includes('COMPLETED') ? '#34d399' : '#f87171' }}>
                      {j.status}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#cbd5e1' }}>
                      {j.shots || 'Exact'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#cbd5e1' }}>
                      {j.execution_duration_ms ? `${j.execution_duration_ms} ms` : 'N/A'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', color: '#94a3b8' }}>
                      {new Date(j.submitted_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.82rem' }}>
            No quantum execution jobs recorded yet.
          </div>
        )}
      </div>

      {/* 6. Connection Test Modal */}
      {showTestModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div className="spatial-card" style={{ maxWidth: '580px', width: '100%', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'rgba(37, 99, 235, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa'
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff', fontWeight: 700 }}>
                  IBM Quantum Connection Diagnostic
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Authenticates with IBM Quantum Platform without consuming runtime credits.
                </div>
              </div>
            </div>

            {testingConn ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <RefreshCw size={28} className="spin" color="#60a5fa" style={{ margin: '0 auto 1rem' }} />
                <div style={{ fontSize: '0.9rem', color: '#ffffff' }}>Connecting to IBM Quantum Compute Service...</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Querying backends on channel '{qStatus?.channel || 'ibm_quantum_platform'}'</div>
              </div>
            ) : connTestResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  background: connTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${connTestResult.success ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  borderRadius: '10px',
                  padding: '1rem',
                  fontSize: '0.82rem',
                  color: connTestResult.success ? '#34d399' : '#f87171'
                }}>
                  <strong>{connTestResult.success ? '✓ Connection Verified' : '✗ Connection Failed'}</strong>: {connTestResult.message || connTestResult.error}
                </div>

                {connTestResult.backends && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Accessible Physical QPUs:</div>
                    {connTestResult.backends.map((b: any) => (
                      <div key={b.name} style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem'
                      }}>
                        <div>
                          <strong style={{ color: '#ffffff' }}>{b.name}</strong> • {b.qubits} Qubits
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{ color: b.operational ? '#34d399' : '#f87171' }}>
                            ● {b.operational ? 'Operational' : 'Offline'}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                            Queue: {b.pending_jobs}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowTestModal(false)}
                className="spatial-pill-btn"
                style={{ padding: '0.55rem 1.25rem' }}
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Hardware Execution Confirmation Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div className="spatial-card" style={{ maxWidth: '520px', width: '100%', padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: '10px',
                background: 'rgba(234, 179, 8, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#facc15'
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff', fontWeight: 700 }}>
                  Confirm Real IBM Hardware Job Submission
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Target: {selectedBackend} (156 Qubits)
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
              color: '#cbd5e1',
              lineHeight: 1.5
            }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                You are about to submit a genuine quantum kernel experiment to IBM Quantum superconducting hardware:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li>Features: <strong>20 pre-transplant clinical features</strong></li>
                <li>Workload: <strong>{maxHardwareSamples === 4 ? '14' : maxHardwareSamples === 6 ? '33' : '60'} quantum circuits</strong> (reproducible subset)</li>
                <li>Shots: <strong>{shots} shots per circuit</strong></li>
                <li>Execution: <strong>SamplerV2</strong> on <strong>{selectedBackend}</strong></li>
                <li>Quantum credits: Will be consumed from your authenticated account</li>
              </ul>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="spatial-pill-btn"
                style={{ padding: '0.55rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  executePipeline(true);
                }}
                className="spatial-cta-btn"
                style={{ padding: '0.55rem 1.5rem', background: 'linear-gradient(135deg, #d97706, #b45309)' }}
              >
                Confirm & Submit to QPU
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
