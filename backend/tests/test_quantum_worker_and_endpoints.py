"""Tests for worker jobs and quantum API endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core import jobs
from app.worker import Worker, HANDLERS

client = TestClient(app)


def test_compute_gpu_simulate_endpoint_and_worker():
    # Enqueue real UCI gpu-simulate job
    res = client.post("/api/compute/gpu-simulate", json={
        "n_patients": 8,
        "n_qubits": 2,
        "bandwidth": 1.0,
        "reps": 1
    })
    assert res.status_code == 202
    job_info = res.json()
    job_id = job_info["job_id"]
    assert job_info["kind"] == "gpu_simulate"

    # Execute with worker
    worker = Worker("test-worker")
    claimed = jobs.claim_next_job("test-worker", ["gpu_simulate"])
    assert claimed is not None
    assert claimed["job_id"] == job_id
    worker._execute(claimed)

    # Check finished job
    completed = jobs.get_job(job_id)
    assert completed["status"] == "succeeded"
    result = completed["result"]
    assert result["dataset"] == "UCI Bone Marrow Transplant: Children"
    assert result["n_patients"] == 8
    assert result["n_qubits"] == 2
    assert "diagnostics" in result
    assert "kernel_matrix_preview" in result
    assert result["telemetry"]["device"] in ("GPU", "CPU")


def test_quantum_estimate_budget_endpoint():
    res = client.post("/api/quantum/estimate-budget", params={"total_circuits": 50, "shots": 1000})
    assert res.status_code == 200
    data = res.json()
    assert data["total_circuits"] == 50
    assert data["shots"] == 1000
    assert data["estimated_qpu_seconds"] > 0
    assert data["within_budget"] is True


def _run_queued(kind, **payload_overrides):
    job = jobs.claim_next_job("test-worker", [kind])
    assert job is not None
    job["payload"].update(payload_overrides)
    Worker("test-worker")._execute(job)
    done = jobs.get_job(job["job_id"])
    assert done["status"] == "succeeded", done["error"]


def test_quantum_compare_backends_endpoint():
    # First request queues the computation on the worker instead of running it in the request.
    first = client.get("/api/quantum/compare-backends?shots=256&n_qubits=2").json()
    assert first["result"] is None and first["job"]["kind"] == "compare_backends"
    _run_queued("compare_backends")
    data = client.get("/api/quantum/compare-backends?shots=256&n_qubits=2").json()["result"]
    assert data["ideal"]["is_simulator"] is True
    assert data["noisy_simulation"]["is_simulator"] is True
    assert len(data["train_patients"]) == 16 and len(data["test_patients"]) == 8
    # Never labels a simulation as hardware: hardware results only come from a real IBM job.
    assert data["hardware_run"] is None


def test_hardware_run_refused_without_ibm_connection():
    res = client.post("/api/quantum/hardware-run", json={"shots": 512, "n_qubits": 4})
    assert res.status_code == 409


def test_quantum_sweep_endpoint():
    first = client.get("/api/quantum/sweep?splits=2&repeats=1").json()
    assert first["job"]["kind"] == "quantum_cv_sweep"
    _run_queued("quantum_cv_sweep", qubits_list=[2])
    data = client.get("/api/quantum/sweep?splits=2&repeats=1").json()["result"]
    assert data["dataset"] == "UCI Bone Marrow Transplant: Children (n=187)"
    # The classical baseline is computed on the same folds, not a constant.
    assert 0.5 < data["classical_baseline_auc"] < 1.0
    assert len(data["sweep_table"]) == 1
    row0 = data["sweep_table"][0]
    for key in ("roc_auc", "roc_auc_ci", "off_diagonal_variance", "kernel_target_alignment"):
        assert key in row0
