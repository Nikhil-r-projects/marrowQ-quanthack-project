"""Job queue and worker status endpoints. Jobs run in app/worker.py, not in the API process."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core import jobs
from app.worker import HANDLERS

router = APIRouter(prefix="/api/compute", tags=["compute"])


class JobSubmitRequest(BaseModel):
    kind: str
    payload: Dict[str, Any] = Field(default_factory=dict)


@router.post("/jobs", status_code=202)
def submit_job(req: JobSubmitRequest):
    if req.kind not in HANDLERS:
        raise HTTPException(status_code=400, detail=f"Unknown job kind '{req.kind}'. Supported: {', '.join(HANDLERS)}")
    return jobs.enqueue_job(req.kind, req.payload)


@router.get("/jobs")
def list_jobs(kind: Optional[str] = None, limit: int = 50):
    return jobs.list_jobs(kind=kind, limit=max(1, min(limit, 200)))


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return job


@router.get("/workers")
def list_workers():
    workers = jobs.list_workers()
    return {"online": any(w["online"] for w in workers), "workers": workers}
