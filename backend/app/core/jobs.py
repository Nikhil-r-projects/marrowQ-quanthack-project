"""SQLite-backed job queue shared by the API (enqueue, read) and app/worker.py (claim, report)."""
import json
import socket
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.database import DB_PATH, get_connection

# A worker that has not checked in for this long is reported as offline.
WORKER_STALE_AFTER = timedelta(seconds=15)

_COLUMNS = "job_id, kind, status, payload_json, result_json, error, progress, progress_message, worker_id, created_at, started_at, finished_at"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_job(row) -> Dict[str, Any]:
    return {
        "job_id": row[0], "kind": row[1], "status": row[2],
        "payload": json.loads(row[3]), "result": json.loads(row[4]) if row[4] else None,
        "error": row[5], "progress": row[6], "progress_message": row[7], "worker_id": row[8],
        "created_at": row[9], "started_at": row[10], "finished_at": row[11],
    }


def enqueue_job(kind: str, payload: Dict[str, Any], db_path: str = DB_PATH) -> Dict[str, Any]:
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    with get_connection(db_path) as conn:
        conn.execute(
            "INSERT INTO jobs (job_id, kind, status, payload_json, created_at) VALUES (?, ?, 'queued', ?, ?)",
            (job_id, kind, json.dumps(payload), _now()),
        )
    return get_job(job_id, db_path)


def get_job(job_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    with get_connection(db_path) as conn:
        row = conn.execute(f"SELECT {_COLUMNS} FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    return _row_to_job(row) if row else None


def list_jobs(kind: Optional[str] = None, limit: int = 50, db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    query = f"SELECT {_COLUMNS} FROM jobs"
    args: list = []
    if kind:
        query += " WHERE kind = ?"
        args.append(kind)
    query += " ORDER BY created_at DESC LIMIT ?"
    args.append(limit)
    with get_connection(db_path) as conn:
        return [_row_to_job(r) for r in conn.execute(query, args).fetchall()]


def claim_next_job(worker_id: str, kinds: List[str], db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    """Atomically move the oldest queued job of a supported kind to 'running'."""
    placeholders = ",".join("?" for _ in kinds)
    conn = get_connection(db_path)
    try:
        # BEGIN IMMEDIATE takes the write lock up front, so two workers can never claim the same row.
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            f"SELECT job_id FROM jobs WHERE status = 'queued' AND kind IN ({placeholders}) ORDER BY created_at LIMIT 1",
            kinds,
        ).fetchone()
        if not row:
            conn.execute("COMMIT")
            return None
        conn.execute(
            "UPDATE jobs SET status = 'running', worker_id = ?, started_at = ? WHERE job_id = ?",
            (worker_id, _now(), row[0]),
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()
    return get_job(row[0], db_path)


def report_progress(job_id: str, progress: float, message: str, db_path: str = DB_PATH) -> None:
    with get_connection(db_path) as conn:
        conn.execute(
            "UPDATE jobs SET progress = ?, progress_message = ? WHERE job_id = ? AND status = 'running'",
            (max(0.0, min(1.0, progress)), message, job_id),
        )


def complete_job(job_id: str, result: Dict[str, Any], db_path: str = DB_PATH) -> None:
    with get_connection(db_path) as conn:
        conn.execute(
            "UPDATE jobs SET status = 'succeeded', result_json = ?, progress = 1, finished_at = ? WHERE job_id = ?",
            (json.dumps(result), _now(), job_id),
        )


def fail_job(job_id: str, error: str, db_path: str = DB_PATH) -> None:
    with get_connection(db_path) as conn:
        conn.execute(
            "UPDATE jobs SET status = 'failed', error = ?, finished_at = ? WHERE job_id = ?",
            (error, _now(), job_id),
        )


def requeue_orphaned_jobs(worker_id: str, db_path: str = DB_PATH) -> int:
    """On worker start, return jobs this worker held when it last stopped to the queue."""
    with get_connection(db_path) as conn:
        cur = conn.execute(
            "UPDATE jobs SET status = 'queued', worker_id = NULL, started_at = NULL, progress = 0, progress_message = NULL "
            "WHERE status = 'running' AND worker_id = ?",
            (worker_id,),
        )
        return cur.rowcount


def record_heartbeat(worker_id: str, started_at: str, capabilities: Dict[str, Any], db_path: str = DB_PATH) -> None:
    with get_connection(db_path) as conn:
        conn.execute(
            "INSERT INTO worker_heartbeats (worker_id, hostname, started_at, heartbeat_at, capabilities_json) VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(worker_id) DO UPDATE SET heartbeat_at = excluded.heartbeat_at, capabilities_json = excluded.capabilities_json",
            (worker_id, socket.gethostname(), started_at, _now(), json.dumps(capabilities)),
        )


def list_workers(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - WORKER_STALE_AFTER
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT worker_id, hostname, started_at, heartbeat_at, capabilities_json FROM worker_heartbeats ORDER BY heartbeat_at DESC"
        ).fetchall()
    return [
        {
            "worker_id": r[0], "hostname": r[1], "started_at": r[2], "heartbeat_at": r[3],
            "capabilities": json.loads(r[4]),
            "online": datetime.fromisoformat(r[3]) >= cutoff,
        }
        for r in rows
    ]
