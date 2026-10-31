"""Background worker: claims queued jobs from SQLite and runs them (GPU simulation, quantum kernels, IBM jobs).

Run from the repo root inside WSL:  python -m app.worker  (with backend/ as the working directory)
"""
import argparse
import logging
import signal
import socket
import threading
import traceback
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from app.core import jobs
from app.core.compute import detect_capabilities, statevector_benchmark
from app.core.settings import get_settings

log = logging.getLogger("marrowq.worker")

Progress = Callable[[float, str], None]
Handler = Callable[[Dict[str, Any], Progress], Dict[str, Any]]


def _gpu_benchmark(payload: Dict[str, Any], progress: Progress) -> Dict[str, Any]:
    n_qubits = int(payload.get("n_qubits", 20))
    if not 2 <= n_qubits <= 28:
        raise ValueError("n_qubits must be between 2 and 28")
    caps = detect_capabilities()
    devices = [d for d in ("GPU", "CPU") if d in caps["aer_devices"]]
    return {"capabilities": caps, "benchmark": statevector_benchmark(n_qubits, devices, progress)}


def _calibrate_biology(payload: Dict[str, Any], progress: Progress) -> Dict[str, Any]:
    from app.core.biology import calibrate
    from app.core.biology import forecast

    result = calibrate.run(progress)
    forecast._calibration.cache_clear()
    return result


def _benchmark(payload: Dict[str, Any], progress: Progress) -> Dict[str, Any]:
    from app.api.routes import execute_experiment_pipeline
    from app.core.database import get_experiment_record

    record = get_experiment_record(payload["experiment_id"])
    if record is None:
        raise ValueError(f"Experiment {payload['experiment_id']} not found")
    execute_experiment_pipeline(record["experiment_id"], record.get("config") or {}, progress)
    final = get_experiment_record(record["experiment_id"])
    if final["status"] == "failed":
        raise RuntimeError(final.get("error_message") or "Benchmark failed")
    return {"experiment_id": final["experiment_id"], "status": final["status"]}


def _gpu_simulate(payload: Dict[str, Any], progress: Progress) -> Dict[str, Any]:
    """Computes genuine quantum kernel matrices on real UCI cohort patients."""
    import numpy as np
    from app.core.datasets.uci_bmt import load_cohort, CORE_FEATURES
    from app.core.benchmark import build_preprocessor, split_feature_types, binary_target
    from app.core.quantum.kernel_engine import GPUQuantumKernelEngine
    from app.core.quantum.diagnostics import compute_kernel_diagnostics
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import MinMaxScaler

    n_patients = int(payload.get("n_patients", 24))
    n_qubits = int(payload.get("n_qubits", 4))
    bandwidth = float(payload.get("bandwidth", 1.0))
    reps = int(payload.get("reps", 1))

    progress(0.1, f"Loading UCI cohort (N={n_patients})...")
    df = load_cohort()
    df_sub = df.iloc[:n_patients].copy() if n_patients < len(df) else df.copy()

    y = binary_target(df_sub["early_engraftment"])
    X_raw = df_sub[CORE_FEATURES]

    progress(0.3, "Fitting preprocessor & PCA projection...")
    num, cat = split_feature_types(df_sub, CORE_FEATURES)
    prep = build_preprocessor(num, cat)
    X_trans = prep.fit_transform(X_raw)

    n_components = min(n_qubits, X_trans.shape[1])
    pca = PCA(n_components=n_components, random_state=42)
    scaler = MinMaxScaler(feature_range=(0, np.pi))
    X_pca = scaler.fit_transform(pca.fit_transform(X_trans))

    progress(0.6, f"Simulating quantum statevectors on {n_components} qubits...")
    engine = GPUQuantumKernelEngine(prefer_gpu=True)
    K, meta = engine.evaluate(X_pca, n_qubits=n_components, reps=reps, bandwidth=bandwidth)

    progress(0.9, "Calculating kernel concentration, geometric difference & alignment...")
    diag = compute_kernel_diagnostics(K, y, X_original=X_pca)

    progress(1.0, f"Completed quantum simulation on {meta['device']}")
    return {
        "dataset": "UCI Bone Marrow Transplant: Children",
        "n_patients": len(df_sub),
        "patient_ids": df_sub["patient_id"].tolist(),
        "n_qubits": n_components,
        "bandwidth": bandwidth,
        "reps": reps,
        "telemetry": meta,
        "diagnostics": diag,
        "kernel_matrix_preview": K[:8, :8].round(4).tolist() if len(K) >= 8 else K.round(4).tolist(),
        "kernel_shape": list(K.shape),
    }


def _quantum_cv_sweep(payload: Dict[str, Any], progress: Progress) -> Dict[str, Any]:
    from app.core.quantum.qsvm_cv import run_qubit_sweep
    qubits_list = payload.get("qubits_list", [2, 4, 8, 12, 16])
    n_splits = int(payload.get("n_splits", 5))
    n_repeats = int(payload.get("n_repeats", 5))
    from app.core.quantum import store
    result = run_qubit_sweep(qubits_list=qubits_list, n_splits=n_splits, n_repeats=n_repeats, progress_callback=progress)
    store.save("quantum_sweep", result)
    return result


def _compare_backends(payload: Dict[str, Any], progress: Progress) -> Dict[str, Any]:
    from app.core.ibm_quantum import quantum_manager
    shots = int(payload.get("shots", 1024))
    n_qubits = int(payload.get("n_qubits", 4))
    return quantum_manager.run_backends_comparison(shots=shots, n_qubits=n_qubits, progress_callback=progress)


def _ibm_hardware_kernel(payload: Dict[str, Any], progress: Progress) -> Dict[str, Any]:
    from app.core.ibm_quantum import quantum_manager
    return quantum_manager.execute_hardware_kernel_job(payload, progress)


# Job kinds this worker executes; later chunks register simulation and quantum handlers here.
HANDLERS: Dict[str, Handler] = {
    "gpu_benchmark": _gpu_benchmark,
    "calibrate_biology": _calibrate_biology,
    "benchmark": _benchmark,
    "gpu_simulate": _gpu_simulate,
    "quantum_cv_sweep": _quantum_cv_sweep,
    "compare_backends": _compare_backends,
    "ibm_hardware_kernel": _ibm_hardware_kernel,
}


class Worker:
    def __init__(self, worker_id: str, kinds: Optional[list] = None):
        self.worker_id = worker_id
        self.kinds = kinds or list(HANDLERS)
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.capabilities = detect_capabilities()
        self.stop = threading.Event()

    def _heartbeat_loop(self) -> None:
        # Runs beside job execution so a long GPU job does not make the worker look offline.
        while not self.stop.is_set():
            try:
                jobs.record_heartbeat(self.worker_id, self.started_at, self.capabilities)
            except Exception:
                log.exception("heartbeat failed")
            self.stop.wait(5)

    def run(self) -> None:
        requeued = jobs.requeue_orphaned_jobs(self.worker_id)
        if requeued:
            log.info("returned %d interrupted job(s) to the queue", requeued)
        threading.Thread(target=self._heartbeat_loop, daemon=True).start()
        log.info("worker %s ready · GPU: %s · kinds: %s", self.worker_id, self.capabilities.get("gpu_name", "none"), ", ".join(self.kinds))

        poll = get_settings().worker_poll_seconds
        while not self.stop.is_set():
            job = jobs.claim_next_job(self.worker_id, self.kinds)
            if job is None:
                self.stop.wait(poll)
                continue
            self._execute(job)

    def _execute(self, job: Dict[str, Any]) -> None:
        job_id = job["job_id"]
        log.info("running %s (%s)", job_id, job["kind"])
        progress: Progress = lambda fraction, message: jobs.report_progress(job_id, fraction, message)
        try:
            result = HANDLERS[job["kind"]](job["payload"], progress)
            jobs.complete_job(job_id, result)
            log.info("finished %s", job_id)
        except Exception as exc:
            log.error("job %s failed: %s", job_id, exc)
            jobs.fail_job(job_id, f"{type(exc).__name__}: {exc}\n{traceback.format_exc(limit=5)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="MarrowQ compute worker")
    parser.add_argument("--id", default=f"{socket.gethostname()}-worker", help="stable id, so interrupted jobs are requeued on restart")
    parser.add_argument("--kinds", default="", help="comma-separated job kinds to serve (default: all); e.g. a separate "
                                                     "lane for ibm_hardware_kernel so QPU runs never wait behind GPU sweeps")
    parser.add_argument("--exclude", default="", help="comma-separated job kinds this worker skips")
    args = parser.parse_args()
    kinds = [k for k in (args.kinds.split(",") if args.kinds else HANDLERS) if k in HANDLERS and k not in args.exclude.split(",")]
    # Libraries such as the Qiskit transpiler log every pass at INFO; keep only our own progress lines.
    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(message)s")
    log.setLevel(logging.INFO)

    worker = Worker(args.id, kinds)
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: worker.stop.set())
    worker.run()


if __name__ == "__main__":
    main()
