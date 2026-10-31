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


def test_quantum_compare_backends_endpoint():
    # Small test on 4 qubits, 256 shots
    res = client.get("/api/quantum/compare-backends?shots=256&n_qubits=2")
    assert res.status_code == 200
    data = res.json()
    assert "ideal" in data
    assert "noisy_simulation" in data
    assert "hardware" in data
    assert data["ideal"]["is_simulator"] is True
    assert data["noisy_simulation"]["is_simulator"] is True
    # Rule 5 check: never label a simulator run as hardware
    assert data["hardware"]["available"] in (True, False)
    if not data["hardware"]["available"]:
        assert data["hardware"]["status"] == "UNAUTHENTICATED"


def test_quantum_sweep_endpoint():
    # Test sweep with 2 splits and 1 repeat on 2 qubits
    res = client.get("/api/quantum/sweep?splits=2&repeats=1")
    assert res.status_code == 200
    data = res.json()
    assert data["dataset"] == "UCI Bone Marrow Transplant: Children (n=187)"
    assert data["classical_baseline_auc"] == 0.755
    assert "sweep_table" in data
    assert len(data["sweep_table"]) > 0
    row0 = data["sweep_table"][0]
    assert "roc_auc" in row0
    assert "roc_auc_ci" in row0
    assert "off_diagonal_variance" in row0
    assert "kernel_target_alignment" in row0

