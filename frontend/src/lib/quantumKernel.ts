/**
 * Exact statevector simulation of Qiskit's ZZFeatureMap (reps = 1, linear entanglement)
 * and the fidelity kernel K(x, y) = |<ψ(x)|ψ(y)>|².
 *
 * After the initial Hadamard layer every gate in the circuit is diagonal
 * (P(2·xᵢ) on each qubit, and CX·P(2·φ)·CX on neighbours, which is a phase on
 * states where the two bits differ), so each amplitude has the closed form
 *   a_b = 2^(-n/2) · exp(i · [Σ 2·xᵢ·bᵢ + Σ 2·(π-xᵢ)(π-xᵢ₊₁)·(bᵢ ⊕ bᵢ₊₁)])
 * This matches qiskit.circuit.library.ZZFeatureMap up to a global phase, which
 * the fidelity kernel ignores. Practical up to ~16 qubits in the browser.
 */

function phases(x: number[]): Float64Array {
  const n = x.length;
  const dim = 1 << n;
  const out = new Float64Array(dim);
  for (let b = 0; b < dim; b++) {
    let theta = 0;
    for (let i = 0; i < n; i++) {
      if ((b >> i) & 1) theta += 2 * x[i];
    }
    for (let i = 0; i < n - 1; i++) {
      if (((b >> i) ^ (b >> (i + 1))) & 1) theta += 2 * (Math.PI - x[i]) * (Math.PI - x[i + 1]);
    }
    out[b] = theta;
  }
  return out;
}

export function zzFidelity(x: number[], y: number[]): number {
  if (x.length !== y.length) throw new Error('Feature vectors must have the same dimension');
  const px = phases(x);
  const py = phases(y);
  let re = 0;
  let im = 0;
  for (let b = 0; b < px.length; b++) {
    const d = py[b] - px[b];
    re += Math.cos(d);
    im += Math.sin(d);
  }
  const norm = px.length;
  return (re * re + im * im) / (norm * norm);
}

/** Gram matrix K[i][j] = fidelity(rows[i], cols[j]). */
export function zzKernelMatrix(rows: number[][], cols: number[][]): number[][] {
  return rows.map(r => cols.map(c => zzFidelity(r, c)));
}

/** Circuit depth of ZZFeatureMap(reps=1, linear) after decomposition into H, P, CX. */
export function zzCircuitDepth(nQubits: number): number {
  if (nQubits <= 1) return 2;
  return 2 + 3 * (nQubits - 1);
}
