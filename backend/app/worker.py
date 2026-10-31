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
from typing import Any, Callable, Dict

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


# Job kinds this worker executes; later chunks register simulation and quantum handlers here.
HANDLERS: Dict[str, Handler] = {
    "gpu_benchmark": _gpu_benchmark,
    "calibrate_biology": _calibrate_biology,
}


class Worker:
    def __init__(self, worker_id: str):
        self.worker_id = worker_id
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
        log.info("worker %s ready · GPU: %s · kinds: %s", self.worker_id, self.capabilities.get("gpu_name", "none"), ", ".join(HANDLERS))

        poll = get_settings().worker_poll_seconds
        while not self.stop.is_set():
            job = jobs.claim_next_job(self.worker_id, list(HANDLERS))
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
    args = parser.parse_args()
    # Libraries such as the Qiskit transpiler log every pass at INFO; keep only our own progress lines.
    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(message)s")
    log.setLevel(logging.INFO)

    worker = Worker(args.id)
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: worker.stop.set())
    worker.run()


if __name__ == "__main__":
    main()
