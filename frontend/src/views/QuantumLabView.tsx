import React, { useEffect, useMemo, useState } from 'react';
import { Atom, CircleCheck, Cpu, ExternalLink, History, KeyRound, Play, Server, TriangleAlert } from 'lucide-react';
import { QuantumBackend, QuantumJob, QuantumStatus } from '../types';
import { QuantumJobResult, fetchQuantumBackends, fetchQuantumJobs, fetchQuantumStatus, submitQuantumJob } from '../api';
import { zzCircuitDepth } from '../lib/quantumKernel';

const TWO_PI = 2 * Math.PI;

/** Reference benchmark (held-out N=125, matched 2-D PCA subspace for the two kernel models). */
const BENCHMARK = [
  { model: 'Logistic regression (full features)', auc: 0.769, time: 0.006 },
  { model: 'Classical RBF SVM (matched 2-D)', auc: 0.593, time: 0.003 },
  { model: 'Quantum-kernel SVM (2 qubits)', auc: 0.481, time: 8.08, quantum: true }
];

/** Gate-level drawing of ZZFeatureMap(reps=1) on two qubits. */
const CircuitDiagram: React.FC<{ x0: number; x1: number }> = ({ x0, x1 }) => {
  const phi = 2 * (Math.PI - x0) * (Math.PI - x1);
  const W = 640, rowY = [44, 116];
  const gate = (cx: number, y: number, label: string, sub?: string, tone: 'h' | 'p' = 'p') => (
    <g key={`${cx}-${y}-${label}`}>
      <rect x={cx - 34} y={y - 18} width={68} height={36} rx={8} className={`qc-gate ${tone}`} />
      <text x={cx} y={sub ? y - 2 : y + 4} textAnchor="middle" className="qc-gate-label">{label}</text>
      {sub && <text x={cx} y={y + 11} textAnchor="middle" className="qc-gate-sub">{sub}</text>}
    </g>
  );
  const cx = (x: number) => (
    <g key={`cx-${x}`}>
      <line x1={x} x2={x} y1={rowY[0]} y2={rowY[1] - 12} className="qc-wire-v" />
      <circle cx={x} cy={rowY[0]} r={5} className="qc-ctrl" />
      <circle cx={x} cy={rowY[1]} r={12} className="qc-target" />
      <line x1={x - 12} x2={x + 12} y1={rowY[1]} y2={rowY[1]} className="qc-target-x" />
      <line x1={x} x2={x} y1={rowY[1] - 12} y2={rowY[1] + 12} className="qc-target-x" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} 160`} width="100%" role="img" aria-label="ZZ feature map circuit on two qubits: Hadamard, phase rotations, then a controlled-NOT, phase, controlled-NOT entangler" className="qc-svg">
      {rowY.map((y, i) => (
        <g key={i}>
          <text x={8} y={y + 4} className="qc-qubit">q{i}</text>
          <line x1={36} x2={W - 10} y1={y} y2={y} className="qc-wire" />
        </g>
      ))}
      {gate(90, rowY[0], 'H', undefined, 'h')}
      {gate(90, rowY[1], 'H', undefined, 'h')}
      {gate(190, rowY[0], 'P', `2·x₀=${(2 * x0).toFixed(2)}`)}
      {gate(190, rowY[1], 'P', `2·x₁=${(2 * x1).toFixed(2)}`)}
      {cx(300)}
      {gate(400, rowY[1], 'P', `φ=${(((phi % TWO_PI) + TWO_PI) % TWO_PI).toFixed(2)}`)}
      {cx(500)}
      <text x={W - 10} y={150} textAnchor="end" className="qc-gate-sub">φ = 2(π−x₀)(π−x₁) mod 2π</text>
    </svg>
  );
};

export const QuantumLabView: React.FC = () => {
  const [backends, setBackends] = useState<QuantumBackend[]>([]);
  const [status, setStatus] = useState<(QuantumStatus & { backend_online: boolean }) | null>(null);
  const [jobs, setJobs] = useState<QuantumJob[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [shots, setShots] = useState(8192);
  const [x0, setX0] = useState(3.14);
  const [x1, setX1] = useState(1.57);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QuantumJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [b, s, j] = await Promise.all([fetchQuantumBackends(), fetchQuantumStatus(), fetchQuantumJobs()]);
    setBackends(b);
    setStatus(s);
    setJobs(j);
    setSelected(prev => prev || b.find(x => !x.is_hardware)?.backend_name || b[0]?.backend_name || '');
  };

  useEffect(() => { load(); }, []);

  const backend = useMemo(() => backends.find(b => b.backend_name === selected), [backends, selected]);
  const usesShots = !!backend && (backend.is_hardware || backend.backend_name.includes('shot'));

  const run = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await submitQuantumJob({ backend_name: selected, execution_mode: 'auto_fallback', shots, sample_values: [x0, x1] });
      if (res.status === 'FAILED') setError(res.error ?? 'The quantum job failed.');
      else setResult(res);
      setJobs(await fetchQuantumJobs());
    } catch (e: any) {
      setError(e?.message ?? 'The quantum job failed.');
    } finally {
      setRunning(false);
    }
  };

  const kRow = result?.kernel_matrix?.[0];
  const statusChip = !status ? null
    : status.is_connected_to_hardware ? <span className="chip chip-green"><span className="chip-dot" />IBM hardware connected</span>
    : status.backend_online ? <span className="chip chip-blue"><span className="chip-dot" />Simulators online · hardware not configured</span>
    : <span className="chip chip-neutral"><span className="chip-dot" />Backend offline · browser simulation</span>;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Atom size={13} /> Quantum lab</div>
          <h2>Quantum kernel lab</h2>
          <p>
            Encode two patient features into a ZZ feature map, measure how similar the resulting quantum state is to engrafted and delayed reference patients,
            and compare simulators with IBM hardware. Every result states where it was computed.
          </p>
        </div>
        <div className="actions">{statusChip}</div>
      </div>

      <div className="grid-4">
        <div className="card kpi">
          <span className="kpi-label">Execution target</span>
          <span className="kpi-value" style={{ fontSize: '1.1rem', lineHeight: 1.35 }}>{backend?.backend_name ?? '—'}</span>
          <span className="kpi-foot">{backend ? `${backend.backend_type} · ${backend.qubits} qubits` : 'Loading backends…'}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Feature map</span>
          <span className="kpi-value" style={{ fontSize: '1.1rem', lineHeight: 1.35 }}>ZZFeatureMap</span>
          <span className="kpi-foot">2 qubits · reps 1 · linear · depth {zzCircuitDepth(2)}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">IBM Quantum access</span>
          <span className="kpi-value" style={{ fontSize: '1.1rem', lineHeight: 1.35 }}>{status?.has_token_configured ? 'Token configured' : 'Not configured'}</span>
          <span className="kpi-foot">{status?.has_ibm_runtime_installed ? 'qiskit-ibm-runtime installed' : 'Runtime unavailable here'}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">Jobs this session</span>
          <span className="kpi-value">{jobs.length}</span>
          <span className="kpi-foot">{jobs.filter(j => j.status.includes('FALLBACK')).length} ran on a fallback simulator</span>
        </div>
      </div>

      <div className="quantum-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title"><Cpu size={16} /> Circuit</div>
              <div className="card-subtitle">Fidelity kernel K(x, x′) = |⟨ψ(x)|ψ(x′)⟩|²</div>
            </div>
          </div>
          <div className="inset" style={{ padding: '0.75rem 0.5rem' }}>
            <CircuitDiagram x0={x0} x1={x1} />
          </div>

          <div className="grid-2" style={{ marginTop: '1rem', gap: '1rem' }}>
            {[{ label: 'x₀ · neutrophil and CD34+ signal', v: x0, set: setX0 }, { label: 'x₁ · chimerism and age signal', v: x1, set: setX1 }].map((f, i) => (
              <div key={i}>
                <div className="row between small" style={{ marginBottom: '0.3rem' }}>
                  <label htmlFor={`qx${i}`} className="muted">{f.label}</label>
                  <span className="tnum">{f.v.toFixed(2)} rad</span>
                </div>
                <input id={`qx${i}`} type="range" className="form-slider" min={0} max={TWO_PI} step={0.01} value={f.v} onChange={e => f.set(Number(e.target.value))} />
              </div>
            ))}
          </div>

          <div className="row between wrap" style={{ marginTop: '1.1rem', gap: '0.75rem' }}>
            <div className="row" style={{ gap: '0.5rem' }}>
              <label className="form-label" htmlFor="q-shots" style={{ margin: 0 }}>Shots</label>
              <select id="q-shots" className="form-select" style={{ width: 120 }} value={shots} onChange={e => setShots(Number(e.target.value))} disabled={!usesShots} title={usesShots ? '' : 'Exact statevector simulation does not sample'}>
                {[1024, 4096, 8192].map(s => <option key={s} value={s}>{s.toLocaleString()}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={run} disabled={running || !selected}>
              <Play size={14} /> {running ? 'Evaluating kernel…' : 'Run kernel job'}
            </button>
          </div>

          {error && <div className="alert-banner alert-error" style={{ marginTop: '1rem' }}><TriangleAlert size={15} /><div>{error}</div></div>}

          {result && kRow && (
            <div className="inset" style={{ marginTop: '1rem' }}>
              <div className="row between wrap" style={{ marginBottom: '0.75rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>Kernel similarity</strong>
                <span className={`chip ${result.status.includes('FALLBACK') ? 'chip-amber' : 'chip-green'}`}>{result.status.replace(/_/g, ' ').toLowerCase()}</span>
              </div>
              {[{ label: 'Engrafted reference patient', v: kRow[0] }, { label: 'Delayed-engraftment reference patient', v: kRow[1] }].map(r => (
                <div key={r.label} style={{ marginBottom: '0.7rem' }}>
                  <div className="row between small" style={{ marginBottom: '0.3rem' }}><span className="muted">{r.label}</span><strong className="tnum">{r.v.toFixed(4)}</strong></div>
                  <div className="prob-track"><div className="prob-fill quantum" style={{ width: `${r.v * 100}%` }} /></div>
                </div>
              ))}
              <div className="small" style={{ marginTop: '0.4rem' }}>
                This state is closer to the <strong>{kRow[0] >= kRow[1] ? 'engrafted' : 'delayed-engraftment'}</strong> reference.
              </div>
              <dl className="kv tiny" style={{ marginTop: '0.8rem' }}>
                <dt>Ran on</dt><dd>{result.backend_used}</dd>
                <dt>Provenance</dt><dd className="mono">{result.provenance}</dd>
                <dt>Circuit</dt><dd>{result.circuit_width} qubits · depth {result.circuit_depth}{result.shots ? ` · ${result.shots.toLocaleString()} shots` : ' · exact'}</dd>
                <dt>Duration</dt><dd>{result.duration_ms} ms</dd>
              </dl>
              {result.transparency_notice && <p className="tiny faint" style={{ marginTop: '0.6rem' }}>{result.transparency_notice}</p>}
            </div>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-header"><div className="card-title"><Server size={16} /> Backends</div></div>
            <div className="stack" style={{ gap: '0.5rem' }} role="radiogroup" aria-label="Quantum backend">
              {backends.map(b => (
                <button
                  key={b.backend_name}
                  role="radio"
                  aria-checked={selected === b.backend_name}
                  className={`menu-item ${selected === b.backend_name ? 'selected' : ''}`}
                  style={{ border: '1px solid var(--border)' }}
                  onClick={() => setSelected(b.backend_name)}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="row between">
                      <span className="mi-title mono">{b.backend_name}</span>
                      <span className={`chip ${b.is_hardware ? 'chip-violet' : 'chip-blue'}`}>{b.is_hardware ? 'QPU' : 'Simulator'}</span>
                    </span>
                    <span className="mi-sub" style={{ display: 'block' }}>
                      {b.qubits} qubits{b.is_hardware ? ` · queue ${b.avg_queue_depth} · 2q error ${(b.two_qubit_error_rate * 100).toFixed(2)}%` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {backend?.is_hardware && !status?.has_token_configured && (
              <p className="tiny" style={{ color: 'var(--amber-text)', marginTop: '0.75rem' }}>
                No IBM token is configured, so this job will run on a local simulator and be labelled as a fallback.
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-header"><div className="card-title"><KeyRound size={16} /> Connect IBM Quantum hardware</div></div>
            <ol className="small muted" style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li>Create a free account at <a href="https://quantum.cloud.ibm.com/" target="_blank" rel="noreferrer">IBM Quantum Platform <ExternalLink size={11} style={{ display: 'inline' }} /></a> and copy your API key.</li>
              <li>Add <code>QISKIT_IBM_TOKEN=…</code> to the backend’s <code>.env</code> file (see <code>.env.example</code>).</li>
              <li>Restart the API. This panel will show “IBM hardware connected”.</li>
            </ol>
            <p className="tiny faint" style={{ marginTop: '0.75rem' }}>
              The token stays on the server. It is never entered in, or sent from, the browser.
            </p>
            {status && (
              <div className="row tiny" style={{ marginTop: '0.6rem', gap: '0.4rem' }}>
                {status.has_token_configured ? <CircleCheck size={13} color="var(--green)" /> : <TriangleAlert size={13} color="var(--amber)" />}
                <span className="muted">Token: <span className="mono">{status.token_masked}</span></span>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Benchmark so far</div>
              <div className="card-subtitle">Held-out test set, N = 125 synthetic patients</div>
            </div>
          </div>
          <table className="data-table">
            <thead><tr><th>Model</th><th className="num">ROC-AUC</th><th className="num">Train time</th></tr></thead>
            <tbody>
              {BENCHMARK.map(b => (
                <tr key={b.model}>
                  <td>{b.model} {b.quantum && <span className="chip chip-violet" style={{ marginLeft: 6 }}>Quantum</span>}</td>
                  <td className="num">{b.auc.toFixed(3)}</td>
                  <td className="num">{b.time < 1 ? `${(b.time * 1000).toFixed(0)} ms` : `${b.time.toFixed(2)} s`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: '0.9rem' }}>
            At two qubits the quantum kernel does not beat a classical kernel on the same features and costs far more to compute.
            Next we test larger feature maps, check whether quantum kernels can separate this data at all (geometric difference), and measure how hardware noise changes predictions.
          </p>
        </section>

        <section className="card">
          <div className="card-header"><div className="card-title"><History size={16} /> Job history</div></div>
          {jobs.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <History size={28} />
              <p>No kernel jobs yet. Run one above.</p>
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: 300 }}>
              <table className="data-table">
                <thead><tr><th>Job</th><th>Backend</th><th>Status</th><th className="num">Time</th></tr></thead>
                <tbody>
                  {jobs.slice(0, 20).map(j => (
                    <tr key={j.job_id}>
                      <td className="mono tiny">{j.job_id}</td>
                      <td className="small">{j.backend_name}</td>
                      <td><span className={`chip ${j.status.startsWith('COMPLETED') ? (j.status.includes('FALLBACK') ? 'chip-amber' : 'chip-green') : 'chip-red'}`}>{j.status.replace(/_/g, ' ').toLowerCase()}</span></td>
                      <td className="num small">{j.execution_duration_ms != null ? `${j.execution_duration_ms} ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
