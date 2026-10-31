import threading

from fastapi.testclient import TestClient

from app.core import jobs
from app.main import app
from app.worker import Worker

client = TestClient(app)


def test_enqueue_claim_complete_roundtrip():
    job = jobs.enqueue_job("gpu_benchmark", {"n_qubits": 4})
    assert job["status"] == "queued"
    claimed = jobs.claim_next_job("w-test", ["gpu_benchmark"])
    assert claimed["job_id"] == job["job_id"] and claimed["status"] == "running"
    jobs.report_progress(job["job_id"], 0.5, "halfway")
    assert jobs.get_job(job["job_id"])["progress"] == 0.5
    jobs.complete_job(job["job_id"], {"ok": True})
    done = jobs.get_job(job["job_id"])
    assert done["status"] == "succeeded" and done["result"] == {"ok": True} and done["progress"] == 1


def test_concurrent_claims_never_share_a_job():
    created = {jobs.enqueue_job("gpu_benchmark", {})["job_id"] for _ in range(20)}
    claimed: list = []
    lock = threading.Lock()

    def claim_all(worker_id):
        while (job := jobs.claim_next_job(worker_id, ["gpu_benchmark"])) is not None:
            with lock:
                claimed.append(job["job_id"])

    threads = [threading.Thread(target=claim_all, args=(f"w{i}",)) for i in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(claimed) == len(set(claimed))
    assert created <= set(claimed)


def test_orphaned_running_jobs_are_requeued_on_restart():
    job = jobs.enqueue_job("gpu_benchmark", {})
    while (claimed := jobs.claim_next_job("w-crash", ["gpu_benchmark"])) and claimed["job_id"] != job["job_id"]:
        jobs.complete_job(claimed["job_id"], {})
    assert jobs.requeue_orphaned_jobs("w-crash") >= 1
    assert jobs.get_job(job["job_id"])["status"] == "queued"


def test_worker_runs_cpu_benchmark_and_reports_failure_cleanly():
    while (stale := jobs.claim_next_job("w-drain", ["gpu_benchmark"])) is not None:
        jobs.complete_job(stale["job_id"], {})
    worker = Worker("w-exec")
    ok = jobs.enqueue_job("gpu_benchmark", {"n_qubits": 4})
    bad = jobs.enqueue_job("gpu_benchmark", {"n_qubits": 99})
    for _ in range(2):
        worker._execute(jobs.claim_next_job("w-exec", ["gpu_benchmark"]))
    result = jobs.get_job(ok["job_id"])
    assert result["status"] == "succeeded"
    bench = result["result"]["benchmark"]
    assert bench["n_qubits"] == 4 and "CPU" in bench["seconds"]
    if bench["max_amplitude_difference_gpu_cpu"] is not None:
        assert bench["max_amplitude_difference_gpu_cpu"] < 1e-9
    failed = jobs.get_job(bad["job_id"])
    assert failed["status"] == "failed" and "n_qubits must be between" in failed["error"]


def test_compute_api():
    assert client.post("/api/compute/jobs", json={"kind": "rm -rf", "payload": {}}).status_code == 400
    created = client.post("/api/compute/jobs", json={"kind": "gpu_benchmark", "payload": {"n_qubits": 3}})
    assert created.status_code == 202
    job_id = created.json()["job_id"]
    assert client.get(f"/api/compute/jobs/{job_id}").json()["status"] in {"queued", "running", "succeeded"}
    assert client.get("/api/compute/jobs/job_missing").status_code == 404
    jobs.record_heartbeat("w-api", "2026-10-31T00:00:00+00:00", {"gpu_name": "test"})
    workers = client.get("/api/compute/workers").json()
    assert workers["online"] is True
    assert any(w["worker_id"] == "w-api" for w in workers["workers"])


def test_experiment_run_is_queued_for_the_worker():
    client.get("/api/datasets/demo")
    exp = client.post("/api/experiments", json={"dataset_id": "uci_bmt_children", "target_column": "early_engraftment",
                                                "selected_features": ["cd34_dose", "recipient_age"]}).json()
    res = client.post(f"/api/experiments/{exp['experiment_id']}/run").json()
    assert res["status"] == "queued"
    job = jobs.get_job(res["job_id"])
    assert job["kind"] == "benchmark" and job["payload"]["experiment_id"] == exp["experiment_id"]
    assert client.get(f"/api/experiments/{exp['experiment_id']}").json()["status"] == "queued"
