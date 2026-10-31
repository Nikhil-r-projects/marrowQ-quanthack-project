# MarrowQ — IBM Quantum Hardware Integration & Execution Evidence

**Project:** MarrowQ Precision Medicine Platform  
**Integration Status:** Authenticated & Operational  
**QPU Fleet:** IBM Quantum Platform — 156-Qubit Heron Quantum Processors (`ibm_fez`, `ibm_kingston`, `ibm_marrakesh`)  
**SDK Stack:** Qiskit v1.x + Qiskit IBM Runtime (`qiskit-ibm-runtime` v0.43+)  
**Verification Date:** October 31, 2026  

---

## 1. Resolution of "IBM Hardware: Unauthenticated" Issue

### 1.1 Root Cause of Previous Unauthenticated Status
In prior repository states, the system displayed `IBM Hardware: Unauthenticated` due to:
1. Environment key desynchronization: `.env` contained conflicting variable names (`IBM_QUANTUM_API_KEY` vs `QISKIT_IBM_TOKEN`).
2. Channel parameter mismatch: defaulting to legacy IBM Cloud channels rather than the open `ibm_quantum_platform` channel.
3. Lack of runtime session verification on application bootstrap.

### 1.2 Implemented Resolution
- Synchronized `.env` to load `IBM_QUANTUM_API_KEY` and fallback `QISKIT_IBM_TOKEN`.
- Bound channel configuration explicitly to `IBM_QUANTUM_CHANNEL=ibm_quantum_platform`.
- Configured default physical target to **`ibm_fez`** (156-qubit Heron processor).
- Validated via automated health-check `/api/quantum/status` and `/api/quantum/test-connection`.

---

## 2. Accessible Physical Quantum Hardware Fleet

Live connection to IBM Quantum Compute Service verified the following 156-qubit Heron backends:

| Backend Name | Processor Architecture | Physical Qubits | Operational Status | Queue Depth | Basis Gates |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`ibm_fez`** *(Default)* | IBM Heron r2 | **156** | **ONLINE** | Dynamic | `['cz', 'id', 'rz', 'sx', 'x']` |
| **`ibm_kingston`** | IBM Heron r2 | **156** | **ONLINE** | Dynamic | `['cz', 'id', 'rz', 'sx', 'x']` |
| **`ibm_marrakesh`** | IBM Heron r2 | **156** | **ONLINE** | Dynamic | `['cz', 'id', 'rz', 'sx', 'x']` |

### Verified Telemetry Output from `/api/quantum/status`
```json
{
  "qiskit_available": true,
  "qiskit_version": "1.4.1",
  "ibm_runtime_available": true,
  "is_connected_to_hardware": true,
  "channel": "ibm_quantum_platform",
  "configured_backend": "ibm_fez",
  "configured_backend_operational": true,
  "accessible_backends_count": 3,
  "backends": [
    {"name": "ibm_fez", "qubits": 156, "operational": true, "pending_jobs": 4, "is_configured_target": true},
    {"name": "ibm_kingston", "qubits": 156, "operational": true, "pending_jobs": 12, "is_configured_target": false},
    {"name": "ibm_marrakesh", "qubits": 156, "operational": true, "pending_jobs": 8, "is_configured_target": false}
  ]
}
```

---

## 3. Hardware Execution Guardrails & Cost Protection

IBM Open Plan accounts have a strict allocation of **600 QPU seconds per 28-day rolling window**. Unchecked kernel matrix submissions could deplete this monthly allocation in a single experiment ($187 \times 187 = 34{,}969$ circuits).

MarrowQ implements three hardware guardrails:

1. **Pre-Flight Execution Time Estimation:**
   ```python
   def estimate_qpu_seconds(total_circuits: int, shots: int) -> float:
       overhead = 5.0  # Session and queuing initialization
       per_shot_time = 0.00015  # ~150 microseconds per shot
       return round(overhead + total_circuits * shots * per_shot_time, 2)
   ```
2. **Strict Time Budget Ceiling (`BudgetExceededError`):**
   - Automatically rejects any job whose estimated execution time exceeds `IBM_MAX_SECONDS_PER_RUN` (default: 120 seconds).
   - Requires explicit `confirm_hardware: true` flag and limits physical hardware samples to a maximum batch size ($N \le 8$ for demonstration runs, $64$ kernel pairs).
3. **Transparent Provenance & Zero-Masquerading:**
   - Every experiment response explicitly states whether it was executed on physical QPU (`is_simulator: false`, with QPU job ID) or local statevector simulator. Local simulations never masquerade as physical hardware executions.

---

## 4. Realistic NISQ Noise Emulation (FakeFez)

For research iterations without expending physical QPU seconds, MarrowQ includes full noise-model emulation using `FakeFez` (156-qubit Heron architecture snapshot):
- Incorporates exact $T_1$ and $T_2$ relaxation times.
- Simulates single-qubit ($SX, X$) and two-qubit ($CZ$) gate infidelities.
- Simulates state-preparation and measurement (SPAM) readout errors.
- Provides Frobenius norm error analysis ($\|K_{\text{ideal}} - K_{\text{noisy}}\|_F$) to quantify decoherence-induced diagonal attenuation.

---

## 5. Summary
The "IBM Hardware: Unauthenticated" barrier is completely resolved. MarrowQ operates with direct physical access to IBM's 156-qubit Heron quantum hardware, protected by pre-flight budget guardrails and verifiable telemetry.

