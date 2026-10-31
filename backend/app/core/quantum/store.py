"""Persisted quantum results (sweep, backend comparison, IBM hardware runs) under results/ at the repo root.

Heavy quantum computations run in the worker; the API only serves the last saved result, so a page load never
starts a long computation.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from app.core import jobs

RESULTS_DIR = Path(os.environ.get("MARROWQ_RESULTS_DIR") or Path(__file__).resolve().parents[4] / "results")


def save(name: str, data: Dict[str, Any]) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (RESULTS_DIR / f"{name}.json").write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def load(name: str) -> Optional[Dict[str, Any]]:
    path = RESULTS_DIR / f"{name}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def active_job(kind: str) -> Optional[Dict[str, Any]]:
    return next((j for j in jobs.list_jobs(kind=kind, limit=20) if j["status"] in ("queued", "running")), None)


def cached_or_enqueue(name: str, kind: str, payload: Dict[str, Any], refresh: bool) -> Dict[str, Any]:
    """Returns {result, job}: the saved result (None if never computed) and the worker job computing a new one."""
    result = load(name)
    job = active_job(kind)
    if job is None and (refresh or result is None):
        job = jobs.enqueue_job(kind, payload)
    return {"result": result, "job": job}
