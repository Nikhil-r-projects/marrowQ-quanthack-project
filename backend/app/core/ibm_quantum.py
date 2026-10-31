import os
import time
import uuid
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Callable
from datetime import datetime, timezone
import numpy as np

from qiskit import QuantumCircuit
from qiskit.circuit.library import z_feature_map, zz_feature_map
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit_machine_learning.kernels import FidelityQuantumKernel

from app.core.database import save_quantum_job, list_quantum_jobs

logger = logging.getLogger("marrowq.ibm_quantum")


class BudgetExceededError(RuntimeError):
    """Raised when an IBM Quantum hardware execution estimate exceeds IBM_MAX_SECONDS_PER_RUN."""
    pass


# Auto-load .env if not loaded
def _ensure_env_loaded():
    repo_root = Path(__file__).resolve().parent.parent.parent.parent
    env_paths = [repo_root / ".env", Path(__file__).resolve().parent.parent / ".env"]
    for ep in env_paths:
        if ep.exists():
            for line in ep.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k not in os.environ or not os.environ[k]:
                        os.environ[k] = v

_ensure_env_loaded()

# Check for Qiskit IBM Runtime
try:
    from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2
    HAS_IBM_RUNTIME = True
except ImportError:
    HAS_IBM_RUNTIME = False
    QiskitRuntimeService = None
    SamplerV2 = None

DEFAULT_SIMULATORS = [
    {
        "backend_name": "aer_simulator_statevector",
        "backend_type": "Local Statevector Simulator",
        "qubits": 32,
        "status": "ONLINE",
        "is_hardware": False,
        "avg_queue_depth": 0,
        "description": "Exact Statevector Simulation (Zero statistical noise, instantaneous evaluation)",
        "basis_gates": ["cx", "id", "rz", "sx", "x"],
        "two_qubit_error_rate": 0.0
    },
    {
        "backend_name": "aer_simulator_shot_noise",
        "backend_type": "Local Shot-Based Simulator",
        "qubits": 32,
        "status": "ONLINE",
        "is_hardware": False,
        "avg_queue_depth": 0,
        "description": "Measurement Shot Simulator (Evaluated with Poisson statistical noise)",
        "basis_gates": ["cx", "id", "rz", "sx", "x"],
        "two_qubit_error_rate": None  # read from live calibration only; never guessed
    }
]


class IBMQuantumManager:
    """
    Manages IBM Quantum Compute Service authentication, backend discovery,
    circuit validation, QPU-seconds budget guarding, and genuine quantum execution
    without silent simulator masquerading.
    """
    def __init__(self):
        self._reload_credentials()

    def _reload_credentials(self):
        _ensure_env_loaded()
        self.api_key = (
            os.environ.get("IBM_QUANTUM_API_KEY") or
            os.environ.get("IBM_QUANTUM_TOKEN") or
            os.environ.get("QISKIT_IBM_TOKEN")
        )
        self.channel = os.environ.get("IBM_QUANTUM_CHANNEL", "ibm_quantum_platform")
        self.backend_default = os.environ.get("IBM_QUANTUM_BACKEND", "ibm_fez")
        raw_instance = os.environ.get("IBM_QUANTUM_INSTANCE", "").strip()
        self.instance = raw_instance if raw_instance and raw_instance.lower() != "none" else None
        
        self.service: Optional[Any] = None
        self.last_connection_error: Optional[str] = None
        self._initialize_service()

    def _mask_token(self, token: Optional[str]) -> str:
        if not token or len(token.strip()) < 8:
            return "NOT_CONFIGURED"
        t = token.strip()
        return f"{t[:4]}...{t[-4:]}"

    def _initialize_service(self):
        """Initializes QiskitRuntimeService if credentials are present"""
        if not HAS_IBM_RUNTIME:
            self.last_connection_error = "qiskit-ibm-runtime package is not installed."
            return

        if not self.api_key:
            self.last_connection_error = "IBM_QUANTUM_API_KEY not found in environment."
            return

        try:
            kwargs = {
                "channel": self.channel,
                "token": self.api_key
            }
            if self.instance:
                kwargs["instance"] = self.instance
            
            self.service = QiskitRuntimeService(**kwargs)
            self.last_connection_error = None
        except Exception as e:
            # Mask any token substring that might appear in exception string
            err_str = str(e)
            if self.api_key and self.api_key in err_str:
                err_str = err_str.replace(self.api_key, self._mask_token(self.api_key))
            self.last_connection_error = err_str
            self.service = None

    @staticmethod
    def estimate_qpu_seconds(total_circuits: int, shots: int) -> float:
        """Estimates QPU execution seconds based on circuit count and shots.
        Open Plan limit is 600 s / 28 days.
        """
        overhead = 5.0  # Session and queuing initialization
        per_shot_time = 0.00015  # ~150 us per shot for circuit execution + readout
        return round(overhead + total_circuits * shots * per_shot_time, 2)

    def test_connection(self) -> Dict[str, Any]:
        """
        Validates IBM Quantum Compute Service authentication and reports
        accessible QPUs and queue status WITHOUT submitting circuits or consuming quantum time.
        """
        self._reload_credentials()
        
        if not HAS_IBM_RUNTIME:
            return {
                "success": False,
                "error": "qiskit-ibm-runtime is not installed in the environment.",
                "token_configured": bool(self.api_key),
                "channel": self.channel
            }
            
        if not self.api_key:
            return {
                "success": False,
                "error": "IBM_QUANTUM_API_KEY environment variable is not set.",
                "token_configured": False,
                "channel": self.channel
            }

        if not self.service:
            return {
                "success": False,
                "error": self.last_connection_error or "Failed to connect to IBM Quantum Platform.",
                "token_configured": True,
                "token_masked": self._mask_token(self.api_key),
                "channel": self.channel
            }

        try:
            backends = self.service.backends()
            qpu_list = []
            default_backend_operational = False
            
            for b in backends:
                cfg = b.configuration()
                status = b.status()
                is_target = b.name == self.backend_default
                if is_target and status.operational:
                    default_backend_operational = True
                
                qpu_list.append({
                    "name": b.name,
                    "qubits": cfg.n_qubits,
                    "operational": status.operational,
                    "pending_jobs": status.pending_jobs,
                    "is_configured_target": is_target
                })

            return {
                "success": True,
                "channel": self.channel,
                "instance": self.instance or "auto",
                "token_configured": True,
                "token_masked": self._mask_token(self.api_key),
                "accessible_backends_count": len(qpu_list),
                "backends": qpu_list,
                "configured_backend": self.backend_default,
                "configured_backend_operational": default_backend_operational,
                "message": f"Successfully authenticated with IBM Quantum Compute Service. Found {len(qpu_list)} accessible QPUs."
            }
        except Exception as e:
            err_str = str(e)
            if self.api_key and self.api_key in err_str:
                err_str = err_str.replace(self.api_key, self._mask_token(self.api_key))
            return {
                "success": False,
                "error": err_str,
                "token_configured": True,
                "token_masked": self._mask_token(self.api_key),
                "channel": self.channel
            }

    def get_status(self) -> Dict[str, Any]:
        """Returns non-sensitive configuration and connectivity status"""
        self._reload_credentials()
        has_token = bool(self.api_key and len(self.api_key.strip()) > 10)
        is_live = self.service is not None
        default_backend = self.backend_default if is_live else "aer_simulator_statevector"
        
        return {
            "has_ibm_runtime_installed": HAS_IBM_RUNTIME,
            "has_token_configured": has_token,
            "token_masked": self._mask_token(self.api_key),
            "channel": self.channel,
            "configured_instance": self.instance or "auto",
            "is_connected_to_hardware": is_live,
            "default_backend": default_backend,
            "connection_error": self.last_connection_error if not is_live else None,
            "supported_execution_modes": [
                {
                    "mode": "simulator",
                    "label": "Local Statevector Simulator (Exact)",
                    "hardware": False,
                    "description": "Zero queue time, exact Hilbert space simulation via Qiskit."
                },
                {
                    "mode": "hardware",
                    "label": "Physical IBM Quantum QPU (Qiskit Runtime)",
                    "hardware": True,
                    "description": f"Executes on physical superconducting QPU ({self.backend_default}) via IBM Quantum Platform."
                }
            ]
        }

    def list_backends(self) -> List[Dict[str, Any]]:
        """Lists live IBM QPUs and local simulators with genuine operational telemetry"""
        self._reload_credentials()
        backends_out = []
        
        # 1. Fetch live IBM Quantum QPUs only if an authenticated session exists
        if self.service:
            try:
                live_qpus = self.service.backends()
                for b in live_qpus:
                    cfg = b.configuration()
                    status = b.status()
                    
                    family = "Superconducting Eagle/Heron"
                    if hasattr(cfg, "processor_type") and isinstance(cfg.processor_type, dict):
                        family = cfg.processor_type.get("family", "Eagle/Heron")
                    
                    backends_out.append({
                        "backend_name": b.name,
                        "backend_type": "IBM Quantum Superconducting QPU",
                        "qubits": cfg.n_qubits,
                        "status": "ONLINE" if status.operational else "OFFLINE",
                        "is_hardware": True,
                        "avg_queue_depth": status.pending_jobs,
                        "description": f"{cfg.n_qubits}-Qubit Physical QPU ({family}) with heavy-hex lattice",
                        "basis_gates": list(cfg.basis_gates) if hasattr(cfg, "basis_gates") else ["cz", "rz", "sx", "x"],
                        "two_qubit_error_rate": None  # read from live calibration only; never guessed
                    })
            except Exception as exc:
                logger.warning(f"Error fetching live IBM backends: {exc}")

        # 2. Add Local Simulators
        backends_out.extend(DEFAULT_SIMULATORS)
        return backends_out

    def check_circuit_compatibility(self, backend_name: str, num_qubits: int) -> Dict[str, Any]:
        """Checks if circuit fits within target backend's qubit capacity and operational bounds"""
        backends = self.list_backends()
        target = next((b for b in backends if b["backend_name"] == backend_name), None)
        
        if not target:
            return {
                "compatible": False,
                "reason": f"Target backend '{backend_name}' is not recognized or unavailable.",
                "qubits_supported": 0,
                "qubits_requested": num_qubits,
                "queue_depth": 0
            }
            
        supported = target["qubits"]
        if num_qubits > supported:
            return {
                "compatible": False,
                "reason": f"Circuit requires {num_qubits} qubits, but '{backend_name}' provides only {supported}.",
                "qubits_supported": supported,
                "qubits_requested": num_qubits,
                "queue_depth": target["avg_queue_depth"]
            }
            
        return {
            "compatible": True,
            "reason": f"Compatible with '{backend_name}' ({supported} qubits available).",
            "qubits_supported": supported,
            "qubits_requested": num_qubits,
            "queue_depth": target["avg_queue_depth"]
        }

    def execute_kernel_matrices(
        self,
        X_train: np.ndarray,
        X_test: np.ndarray,
        backend_name: str = "ibm_fez",
        execution_mode: str = "simulator", # "hardware" or "simulator"
        shots: int = 1024,
        max_hardware_samples: int = 10,
        feature_map_type: str = "z_feature_map",
        enable_twirling: bool = False,
        enable_dd: bool = False,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Executes quantum kernel Gram matrices K_train and K_test.
        
        DISTINCTION GUARANTEE:
        - Never silently switches from physical hardware to a simulator.
        - Enforces QPU-seconds budget refusal if estimate > IBM_MAX_SECONDS_PER_RUN (600s Open Plan).
        - Physical hardware execution is submitted via SamplerV2 to IBM Quantum and monitored.
        - Local simulation runs via FidelityQuantumKernel/StatevectorSampler with exact statevectors.
        """
        start_time = time.time()
        job_id = f"qjob-{uuid.uuid4().hex[:10]}"
        submitted_at = datetime.now(timezone.utc).isoformat()
        
        n_features = X_train.shape[1]
        n_qubits = n_features
        
        # Build base feature map
        if feature_map_type == "zz_feature_map" or n_features <= 6:
            fmap = zz_feature_map(feature_dimension=n_features, reps=1, entanglement="linear")
        else:
            fmap = z_feature_map(feature_dimension=n_features, reps=1)
            
        circuit_depth_raw = fmap.depth()
        
        # --- PATH A: PHYSICAL IBM QUANTUM HARDWARE EXECUTION ---
        if execution_mode == "hardware":
            # 1. Budget check upfront: calculate total circuits and refuse before consuming any network/quantum resources
            N_tr = min(len(X_train), max_hardware_samples)
            N_te = min(len(X_test), max(2, int(max_hardware_samples * 0.4)))
            circuits_count = (N_tr * (N_tr - 1)) // 2 + (N_te * N_tr)
            
            max_budget = float(os.environ.get("IBM_MAX_SECONDS_PER_RUN", "600.0"))
            est_seconds = self.estimate_qpu_seconds(circuits_count, shots)
            if est_seconds > max_budget:
                error_msg = (
                    f"BudgetRefusal: Estimated runtime ({est_seconds:.1f}s) exceeds maximum allowed budget "
                    f"IBM_MAX_SECONDS_PER_RUN ({max_budget:.1f}s). Refusing hardware execution to protect quantum allocation."
                )
                save_quantum_job({
                    "job_id": job_id,
                    "backend_name": backend_name,
                    "backend_type": "IBM Quantum Superconducting QPU",
                    "execution_mode": "ibm_quantum_hardware",
                    "status": "REFUSED_BUDGET_EXCEEDED",
                    "shots": shots,
                    "circuit_depth": circuit_depth_raw,
                    "circuit_width": n_qubits,
                    "submitted_at": submitted_at,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "execution_duration_ms": 0,
                    "kernel_evaluation_duration_ms": 0,
                    "error_message": error_msg,
                    "result_provenance": "budget_guard_refusal"
                })
                raise BudgetExceededError(error_msg)

            self._reload_credentials()
            
            if not self.service:
                error_msg = f"Cannot execute on hardware backend '{backend_name}': {self.last_connection_error or 'Not authenticated with IBM Quantum Compute Service.'}"
                save_quantum_job({
                    "job_id": job_id,
                    "backend_name": backend_name,
                    "backend_type": "IBM Quantum Superconducting QPU",
                    "execution_mode": "ibm_quantum_hardware",
                    "status": "FAILED_AUTHENTICATION",
                    "shots": shots,
                    "circuit_depth": circuit_depth_raw,
                    "circuit_width": n_qubits,
                    "submitted_at": submitted_at,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "execution_duration_ms": 0,
                    "kernel_evaluation_duration_ms": 0,
                    "error_message": error_msg,
                    "result_provenance": "unauthenticated"
                })
                raise RuntimeError(error_msg)
                
            try:
                backend = self.service.backend(backend_name)
            except Exception as e:
                error_msg = f"Target backend '{backend_name}' could not be loaded: {e}"
                save_quantum_job({
                    "job_id": job_id,
                    "backend_name": backend_name,
                    "backend_type": "IBM Quantum Superconducting QPU",
                    "execution_mode": "ibm_quantum_hardware",
                    "status": "FAILED_BACKEND_UNAVAILABLE",
                    "shots": shots,
                    "circuit_depth": circuit_depth_raw,
                    "circuit_width": n_qubits,
                    "submitted_at": submitted_at,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "execution_duration_ms": 0,
                    "kernel_evaluation_duration_ms": 0,
                    "error_message": error_msg,
                    "result_provenance": "backend_not_found"
                })
                raise RuntimeError(error_msg)

            # Enforce hardware sample limits to guard against runaway quantum runtime credits
            N_tr = min(len(X_train), max_hardware_samples)
            N_te = min(len(X_test), max(2, int(max_hardware_samples * 0.4)))
            
            X_tr_sub = X_train[:N_tr]
            X_te_sub = X_test[:N_te]
            
            # Construct upper-triangular training pair circuits
            circuits_to_run = []
            train_pair_indices = []
            for i in range(N_tr):
                for j in range(i + 1, N_tr):
                    qc = QuantumCircuit(n_qubits, n_qubits)
                    c_i = fmap.assign_parameters(X_tr_sub[i])
                    c_j = fmap.assign_parameters(X_tr_sub[j])
                    qc.compose(c_i, inplace=True)
                    qc.compose(c_j.inverse(), inplace=True)
                    qc.measure(range(n_qubits), range(n_qubits))
                    circuits_to_run.append(qc)
                    train_pair_indices.append((i, j))
                    
            # Construct test-vs-train pair circuits
            test_pair_indices = []
            for t in range(N_te):
                for tr in range(N_tr):
                    qc = QuantumCircuit(n_qubits, n_qubits)
                    c_t = fmap.assign_parameters(X_te_sub[t])
                    c_tr = fmap.assign_parameters(X_tr_sub[tr])
                    qc.compose(c_t, inplace=True)
                    qc.compose(c_tr.inverse(), inplace=True)
                    qc.measure(range(n_qubits), range(n_qubits))
                    circuits_to_run.append(qc)
                    test_pair_indices.append((t, tr))
                    
            total_circuits = len(circuits_to_run)
            
            # Budget check: refuse if estimated runtime exceeds IBM_MAX_SECONDS_PER_RUN (default 600s Open Plan)
            max_budget = float(os.environ.get("IBM_MAX_SECONDS_PER_RUN", "600.0"))
            est_seconds = self.estimate_qpu_seconds(total_circuits, shots)
            if est_seconds > max_budget:
                error_msg = (
                    f"BudgetRefusal: Estimated runtime ({est_seconds:.1f}s) exceeds maximum allowed budget "
                    f"IBM_MAX_SECONDS_PER_RUN ({max_budget:.1f}s). Refusing hardware execution to protect quantum allocation."
                )
                save_quantum_job({
                    "job_id": job_id,
                    "backend_name": backend_name,
                    "backend_type": "IBM Quantum Superconducting QPU",
                    "execution_mode": "ibm_quantum_hardware",
                    "status": "REFUSED_BUDGET_EXCEEDED",
                    "shots": shots,
                    "circuit_depth": circuit_depth_raw,
                    "circuit_width": n_qubits,
                    "submitted_at": submitted_at,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "execution_duration_ms": 0,
                    "kernel_evaluation_duration_ms": 0,
                    "error_message": error_msg,
                    "result_provenance": "budget_guard_refusal"
                })
                raise BudgetExceededError(error_msg)

            if progress_callback:
                progress_callback(0.3, f"Transpiling {total_circuits} circuits for target QPU {backend_name}...")
            logger.info(f"Submitting {total_circuits} circuits to IBM Quantum hardware '{backend_name}' (est. {est_seconds:.1f}s)...")

            # Transpile for target QPU
            pm = generate_preset_pass_manager(backend=backend, optimization_level=1)
            transpiled_circuits = pm.run(circuits_to_run)
            transpiled_depth = int(transpiled_circuits[0].depth()) if transpiled_circuits else circuit_depth_raw
            
            # Configure SamplerV2 with optional twirling and dynamical decoupling
            sampler = SamplerV2(mode=backend)
            if enable_twirling:
                try:
                    sampler.options.twirling.enable_gates = True
                    sampler.options.twirling.enable_measure = True
                except Exception as exc:
                    logger.warning("Could not set twirling options on SamplerV2: %s", exc)
            if enable_dd:
                try:
                    sampler.options.dynamical_decoupling.enable = True
                    sampler.options.dynamical_decoupling.sequence_type = "XY4"
                except Exception as exc:
                    logger.warning("Could not set dynamical decoupling on SamplerV2: %s", exc)

            if progress_callback:
                progress_callback(0.5, f"Submitting job to IBM Quantum Platform ({backend_name})...")

            hardware_job = sampler.run(transpiled_circuits, shots=shots)
            real_job_id = hardware_job.job_id()
            logger.info(f"IBM Quantum hardware job submitted: ID={real_job_id}. Awaiting results...")

            # Poll status with progress updates
            status_poll_count = 0
            while not hardware_job.done():
                status_poll_count += 1
                try:
                    job_status = str(hardware_job.status())
                except Exception:
                    job_status = "RUNNING"
                if progress_callback:
                    progress_callback(min(0.9, 0.5 + status_poll_count * 0.05), f"IBM Job {real_job_id}: status={job_status}")
                time.sleep(2)
            
            # Retrieve genuine hardware results
            job_result = hardware_job.result()
            duration_ms = round((time.time() - start_time) * 1000, 2)
            
            # Parse bitstring zero frequencies
            all_zeros_bitstring = "0" * n_qubits
            
            K_train = np.eye(N_tr)
            for idx, (i, j) in enumerate(train_pair_indices):
                pub_data = job_result[idx].data
                reg_name = list(pub_data.keys())[0]
                counts = getattr(pub_data, reg_name).get_counts()
                fidelity = counts.get(all_zeros_bitstring, 0) / float(shots)
                K_train[i, j] = fidelity
                K_train[j, i] = fidelity
                
            K_test = np.zeros((N_te, N_tr))
            offset = len(train_pair_indices)
            for idx, (t, tr) in enumerate(test_pair_indices):
                pub_data = job_result[offset + idx].data
                reg_name = list(pub_data.keys())[0]
                counts = getattr(pub_data, reg_name).get_counts()
                fidelity = counts.get(all_zeros_bitstring, 0) / float(shots)
                K_test[t, tr] = fidelity
                
            provenance = f"ibm_quantum_hardware:backend={backend_name}:job_id={real_job_id}:shots={shots}"
            
            save_quantum_job({
                "job_id": real_job_id,
                "backend_name": backend_name,
                "backend_type": "IBM Quantum Superconducting QPU",
                "execution_mode": "ibm_quantum_hardware",
                "status": "COMPLETED_HARDWARE",
                "shots": shots,
                "circuit_depth": transpiled_depth,
                "circuit_width": n_qubits,
                "submitted_at": submitted_at,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "execution_duration_ms": duration_ms,
                "kernel_evaluation_duration_ms": duration_ms,
                "error_message": None,
                "result_provenance": provenance
            })
            
            return {
                "job_id": real_job_id,
                "backend_used": backend_name,
                "execution_mode": "ibm_quantum_hardware",
                "is_simulator": False,
                "status": "COMPLETED",
                "K_train": K_train,
                "K_test": K_test,
                "train_sample_count": N_tr,
                "test_sample_count": N_te,
                "circuit_depth": transpiled_depth,
                "circuit_width": n_qubits,
                "circuits_submitted": total_circuits,
                "shots": shots,
                "duration_ms": duration_ms,
                "provenance": provenance
            }

        # --- PATH B: LOCAL STATEVECTOR SIMULATION ---
        else:
            if n_qubits > 6 and feature_map_type == "z_feature_map":
                diff_train = X_train[:, np.newaxis, :] - X_train[np.newaxis, :, :]
                K_train = np.prod(np.cos(diff_train) ** 2, axis=-1)
                
                diff_test = X_test[:, np.newaxis, :] - X_train[np.newaxis, :, :]
                K_test = np.prod(np.cos(diff_test) ** 2, axis=-1)
                provenance = f"aer_statevector:exact_{n_qubits}_qubit_hilbert_fidelity"
            else:
                qkernel = FidelityQuantumKernel(feature_map=fmap)
                K_train = qkernel.evaluate(x_vec=X_train, y_vec=X_train)
                K_test = qkernel.evaluate(x_vec=X_test, y_vec=X_train)
                provenance = "aer_statevector:exact_hilbert_fidelity"
                
            duration_ms = round((time.time() - start_time) * 1000, 2)
            
            save_quantum_job({
                "job_id": job_id,
                "backend_name": "aer_simulator_statevector",
                "backend_type": "Local Statevector Simulator",
                "execution_mode": "local_simulator",
                "status": "COMPLETED",
                "shots": 0,
                "circuit_depth": circuit_depth_raw,
                "circuit_width": n_qubits,
                "submitted_at": submitted_at,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "execution_duration_ms": duration_ms,
                "kernel_evaluation_duration_ms": duration_ms,
                "error_message": None,
                "result_provenance": provenance
            })
            
            return {
                "job_id": job_id,
                "backend_used": "aer_simulator_statevector",
                "execution_mode": "local_simulator",
                "is_simulator": True,
                "status": "COMPLETED",
                "K_train": K_train,
                "K_test": K_test,
                "train_sample_count": len(X_train),
                "test_sample_count": len(X_test),
                "circuit_depth": circuit_depth_raw,
                "circuit_width": n_qubits,
                "circuits_submitted": 0,
                "shots": 0,
                "duration_ms": duration_ms,
                "provenance": provenance
            }

    def execute_hardware_kernel_job(
        self,
        payload: Dict[str, Any],
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> Dict[str, Any]:
        """Runs an IBM hardware kernel job dispatched from the worker."""
        backend_name = payload.get("backend_name", self.backend_default)
        shots = int(payload.get("shots", 1024))
        max_samples = int(payload.get("max_samples", 8))
        enable_twirling = bool(payload.get("enable_twirling", False))
        enable_dd = bool(payload.get("enable_dd", False))
        n_qubits = int(payload.get("n_qubits", 4))

        from app.core.datasets.uci_bmt import load_cohort, CORE_FEATURES
        from app.core.benchmark import build_preprocessor, split_feature_types
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import MinMaxScaler

        if progress_callback:
            progress_callback(0.1, "Extracting UCI cohort subset for hardware execution...")

        df = load_cohort()
        df_sub = df.iloc[:max_samples].copy()
        num, cat = split_feature_types(df_sub, CORE_FEATURES)
        prep = build_preprocessor(num, cat)
        X_trans = prep.fit_transform(df_sub[CORE_FEATURES])

        q_dim = min(n_qubits, X_trans.shape[1])
        pca = PCA(n_components=q_dim, random_state=42)
        scaler = MinMaxScaler(feature_range=(0, np.pi))
        X_pca = scaler.fit_transform(pca.fit_transform(X_trans))

        res = self.execute_kernel_matrices(
            X_train=X_pca,
            X_test=X_pca[:max(2, int(max_samples * 0.4))],
            backend_name=backend_name,
            execution_mode="hardware",
            shots=shots,
            max_hardware_samples=max_samples,
            enable_twirling=enable_twirling,
            enable_dd=enable_dd,
            progress_callback=progress_callback
        )
        return {
            "job_id": res["job_id"],
            "backend_used": res["backend_used"],
            "execution_mode": res["execution_mode"],
            "shots": res["shots"],
            "duration_ms": res["duration_ms"],
            "K_train_preview": res["K_train"].round(4).tolist() if isinstance(res["K_train"], np.ndarray) else res["K_train"],
        }

    def run_backends_comparison(
        self,
        shots: int = 1024,
        n_qubits: int = 4,
        progress_callback: Optional[Callable[[float, str], None]] = None
    ) -> Dict[str, Any]:
        """Compares Ideal (GPU Statevector) vs Noisy (FakeFez) vs Physical Hardware on a 16 train / 8 test UCI subset."""
        from app.core.datasets.uci_bmt import load_cohort, CORE_FEATURES
        from app.core.benchmark import build_preprocessor, split_feature_types, binary_target
        from app.core.quantum.kernel_engine import GPUQuantumKernelEngine
        from app.core.quantum.noisy_simulation import HeronNoisySimulator
        from app.core.quantum.diagnostics import compute_kernel_diagnostics
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import MinMaxScaler
        from sklearn.svm import SVC
        from sklearn.metrics import roc_auc_score

        if progress_callback:
            progress_callback(0.05, "Extracting 16 train / 8 test UCI patient cohort subset...")

        df = load_cohort()
        train_df = df.iloc[:16].copy()
        test_df = df.iloc[16:24].copy()

        y_train = binary_target(train_df["early_engraftment"])
        y_test = binary_target(test_df["early_engraftment"])

        num, cat = split_feature_types(train_df, CORE_FEATURES)
        prep = build_preprocessor(num, cat)
        X_tr_trans = prep.fit_transform(train_df[CORE_FEATURES])
        X_te_trans = prep.transform(test_df[CORE_FEATURES])

        pca = PCA(n_components=n_qubits, random_state=42)
        scaler = MinMaxScaler(feature_range=(0, np.pi))
        X_tr_pca = scaler.fit_transform(pca.fit_transform(X_tr_trans))
        X_te_pca = scaler.transform(pca.transform(X_te_trans))

        # 1. Ideal Statevector Kernel
        if progress_callback:
            progress_callback(0.2, "Computing Ideal GPU Statevector Kernel...")
        engine = GPUQuantumKernelEngine(prefer_gpu=True)
        K_tr_ideal, meta_ideal = engine.evaluate(X_tr_pca, n_qubits=n_qubits)
        K_te_ideal, _ = engine.evaluate(X_te_pca, X_tr_pca, n_qubits=n_qubits)
        diag_ideal = compute_kernel_diagnostics(K_tr_ideal, y_train, X_original=X_tr_pca)

        svc_ideal = SVC(kernel="precomputed", class_weight="balanced")
        svc_ideal.fit(K_tr_ideal, y_train)
        score_ideal = float(roc_auc_score(y_test, svc_ideal.decision_function(K_te_ideal)))

        # 2. Noisy Heron FakeFez Simulation
        if progress_callback:
            progress_callback(0.5, "Evaluating Noisy Simulation with Heron FakeFez...")
        noisy_sim = HeronNoisySimulator(prefer_gpu=True, default_shots=shots)
        K_tr_noisy, meta_noisy = noisy_sim.evaluate_noisy_kernel_matrix(X_tr_pca, n_qubits=n_qubits, shots=shots)
        K_te_noisy, _ = noisy_sim.evaluate_noisy_kernel_matrix(X_te_pca, X_tr_pca, n_qubits=n_qubits, shots=shots)
        diag_noisy = compute_kernel_diagnostics(K_tr_noisy, y_train, X_original=X_tr_pca)

        frob_ideal = float(np.linalg.norm(K_tr_ideal, "fro"))
        diff_noisy_frob = float(np.linalg.norm(K_tr_noisy - K_tr_ideal, "fro"))
        frob_error_noisy = diff_noisy_frob / frob_ideal if frob_ideal > 0 else 0.0

        svc_noisy = SVC(kernel="precomputed", class_weight="balanced")
        svc_noisy.fit(K_tr_noisy, y_train)
        score_noisy = float(roc_auc_score(y_test, svc_noisy.decision_function(K_te_noisy)))

        # 3. Hardware status
        if progress_callback:
            progress_callback(0.8, "Checking live IBM Hardware connection...")
        hardware_available = bool(self.service is not None)
        hw_info: Dict[str, Any] = {
            "available": hardware_available,
            "status": "ONLINE" if hardware_available else "UNAUTHENTICATED",
            "message": "Physical hardware execution requires IBM_QUANTUM_API_KEY" if not hardware_available else "Ready on IBM Quantum Platform",
            "backend_name": self.backend_default if hardware_available else None,
            "frobenius_error_vs_ideal": None,
            "alignment": None,
            "test_auc": None,
            "device_provenance": "ibm_quantum_hardware" if hardware_available else "unavailable (never simulated as hardware)"
        }

        if progress_callback:
            progress_callback(1.0, "Comparison complete.")

        return {
            "subset": "UCI Bone Marrow Transplant (16 train / 8 test)",
            "n_qubits": n_qubits,
            "shots": shots,
            "ideal": {
                "backend_type": f"Local AerSimulator ({meta_ideal['device']})",
                "is_simulator": True,
                "frobenius_error_vs_ideal": 0.0,
                "alignment": diag_ideal["kernel_target_alignment"],
                "test_auc": round(score_ideal, 4),
                "elapsed_seconds": meta_ideal["elapsed_seconds"],
                "matrix_preview": K_tr_ideal[:4, :4].round(4).tolist(),
            },
            "noisy_simulation": {
                "backend_type": "FakeFez (156-qubit Heron NISQ noise model)",
                "is_simulator": True,
                "frobenius_error_vs_ideal": round(frob_error_noisy, 5),
                "alignment": diag_noisy["kernel_target_alignment"],
                "test_auc": round(score_noisy, 4),
                "elapsed_seconds": meta_noisy["elapsed_seconds"],
                "diagonal_attenuation": round(float(1.0 - np.mean(np.diag(K_tr_noisy))), 4),
                "matrix_preview": K_tr_noisy[:4, :4].round(4).tolist(),
            },
            "hardware": hw_info,
        }

    def execute_kernel_circuit(
        self,
        X_train: np.ndarray,
        X_test: Optional[np.ndarray] = None,
        backend_name: str = "aer_simulator_statevector",
        execution_mode: str = "auto_fallback",
        shots: int = 1000
    ) -> Dict[str, Any]:
        """Backwards-compatible wrapper for multi-agent clinical orchestration"""
        mode = "hardware" if "ibm_" in backend_name.lower() and execution_mode in ["hardware", "hardware_only"] else "simulator"
        if X_test is None:
            X_test = X_train
            
        res = self.execute_kernel_matrices(
            X_train=X_train,
            X_test=X_test,
            backend_name=backend_name,
            execution_mode=mode,
            shots=shots,
            max_hardware_samples=len(X_train)
        )
        res["kernel_matrix"] = res["K_test"].tolist()
        res["transparency_notice"] = f"Executed on physical hardware '{backend_name}'" if not res["is_simulator"] else "Evaluated on local Qiskit simulator."
        return res

# Singleton instance
quantum_manager = IBMQuantumManager()
