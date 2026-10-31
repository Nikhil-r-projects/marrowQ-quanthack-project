import sqlite3
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

from app.core.settings import get_settings

DB_PATH = str(get_settings().db_path)


def _connect(db_path: str) -> sqlite3.Connection:
    # The API and the worker are separate processes: WAL lets reads proceed during writes,
    # and the timeout waits out a concurrent writer instead of failing with "database is locked".
    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


def init_db(db_path: str = DB_PATH):
    conn = _connect(db_path)
    cursor = conn.cursor()
    
    # Datasets table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS datasets (
        dataset_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        data_mode TEXT NOT NULL,
        filepath TEXT,
        row_count INTEGER,
        column_count INTEGER,
        created_at TEXT NOT NULL,
        profile_json TEXT NOT NULL
    )
    """)
    
    # Experiments table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS experiments (
        experiment_id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        dataset_name TEXT NOT NULL,
        data_mode TEXT NOT NULL,
        target_column TEXT NOT NULL,
        positive_class TEXT NOT NULL,
        selected_features_json TEXT NOT NULL,
        test_size REAL NOT NULL,
        random_state INTEGER NOT NULL,
        status TEXT NOT NULL,
        current_stage TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        total_runtime_seconds REAL,
        error_message TEXT,
        train_sample_count INTEGER,
        test_sample_count INTEGER,
        class_dist_train_json TEXT,
        class_dist_test_json TEXT,
        metrics_json TEXT NOT NULL,
        config_json TEXT NOT NULL,
        artifacts_path TEXT
    )
    """)

    # Patients table (Phase 9.1)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patients (
        patient_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        disease TEXT NOT NULL,
        transplant_type TEXT NOT NULL,
        donor_type TEXT NOT NULL,
        transplant_date TEXT NOT NULL,
        conditioning TEXT NOT NULL,
        cell_dose_cd34 REAL,
        chimerism_donor_pct REAL,
        cmv_status TEXT,
        hla_match TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # Clinical Observations table (Phase 9.2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clinical_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT NOT NULL,
        day_post_tx INTEGER NOT NULL,
        recorded_date TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        source TEXT NOT NULL,
        recorded_by TEXT,
        status TEXT DEFAULT 'verified',
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    )
    """)

    # Feature Snapshots (Phase 9.3)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feature_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        features_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    )
    """)

    # Model Registry (Phase 9.4)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS model_registry (
        model_id TEXT PRIMARY KEY,
        model_type TEXT NOT NULL,
        model_version TEXT NOT NULL,
        target_task TEXT NOT NULL,
        feature_schema_version TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        backend_provenance TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # Prediction Runs (Phase 9.5)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prediction_runs (
        prediction_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        models_executed_json TEXT NOT NULL,
        predictions_json TEXT NOT NULL,
        disagreement_json TEXT NOT NULL,
        validation_status TEXT NOT NULL,
        warnings_json TEXT NOT NULL,
        clinician_review_status TEXT NOT NULL,
        reviewed_by TEXT,
        review_notes TEXT,
        backend_provenance TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    )
    """)

    # Quantum Execution Jobs (Phase 9.6)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quantum_jobs (
        job_id TEXT PRIMARY KEY,
        backend_name TEXT NOT NULL,
        backend_type TEXT NOT NULL,
        execution_mode TEXT NOT NULL,
        status TEXT NOT NULL,
        shots INTEGER NOT NULL,
        circuit_depth INTEGER,
        circuit_width INTEGER,
        submitted_at TEXT NOT NULL,
        completed_at TEXT,
        execution_duration_ms REAL,
        kernel_evaluation_duration_ms REAL,
        error_message TEXT,
        result_provenance TEXT NOT NULL
    )
    """)

    # Recovery Assessments & Milestones (Phase 9.7)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recovery_assessments (
        assessment_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        assessed_date TEXT NOT NULL,
        engraftment_status TEXT NOT NULL,
        forecast_anc_day INTEGER,
        forecast_plt_day INTEGER,
        gvhd_risk TEXT,
        milestones_json TEXT NOT NULL,
        clinician_notes TEXT,
        reviewed_by TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    )
    """)

    # Audit Events (Phase 9.8)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        patient_id TEXT,
        user_role TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # Long-running work (GPU simulation, quantum jobs) is queued here and executed by app/worker.py.
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS jobs (
        job_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        result_json TEXT,
        error TEXT,
        progress REAL NOT NULL DEFAULT 0,
        progress_message TEXT,
        worker_id TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at)")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS worker_heartbeats (
        worker_id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        started_at TEXT NOT NULL,
        heartbeat_at TEXT NOT NULL,
        capabilities_json TEXT NOT NULL
    )
    """)

    # Users Table (RBAC / Auth - Issue K)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL,
        full_name TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

    # User Sessions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
    """)

    # Columns added after the first release; ALTER keeps existing databases usable.
    patient_cols = {row[1] for row in cursor.execute("PRAGMA table_info(patients)")}
    for column, ddl in (
        ("source", "TEXT NOT NULL DEFAULT 'clinical'"),
        ("source_record", "TEXT"),
        ("pretransplant_json", "TEXT"),
    ):
        if column not in patient_cols:
            cursor.execute(f"ALTER TABLE patients ADD COLUMN {column} {ddl}")

    conn.commit()
    conn.close()
    purge_legacy_seed_data(db_path)

_initialized: set = set()

def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    if db_path not in _initialized:
        init_db(db_path)
        _initialized.add(db_path)
    return _connect(db_path)

# --- Dataset & Experiment Functions (Preserved) ---

def save_dataset_meta(dataset_id: str, name: str, source: str, data_mode: str, filepath: str, row_count: int, col_count: int, profile_dict: Dict[str, Any], db_path: str = DB_PATH):
    conn = get_connection(db_path)
    cursor = conn.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        INSERT OR REPLACE INTO datasets (dataset_id, name, source, data_mode, filepath, row_count, column_count, created_at, profile_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (dataset_id, name, source, data_mode, filepath, row_count, col_count, now_str, json.dumps(profile_dict)))
    conn.commit()
    conn.close()

def get_dataset_meta(dataset_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT dataset_id, name, source, data_mode, filepath, row_count, column_count, created_at, profile_json FROM datasets WHERE dataset_id = ?", (dataset_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "dataset_id": row[0], "name": row[1], "source": row[2], "data_mode": row[3],
        "filepath": row[4], "row_count": row[5], "column_count": row[6], "created_at": row[7],
        "profile": json.loads(row[8])
    }

def list_datasets(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT dataset_id, name, source, data_mode, row_count, column_count, created_at FROM datasets ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [{
        "dataset_id": r[0], "name": r[1], "source": r[2], "data_mode": r[3],
        "row_count": r[4], "column_count": r[5], "created_at": r[6]
    } for r in rows]

def save_experiment_record(record: Dict[str, Any], db_path: str = DB_PATH):
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO experiments (
            experiment_id, dataset_id, dataset_name, data_mode, target_column, positive_class,
            selected_features_json, test_size, random_state, status, current_stage, created_at,
            completed_at, total_runtime_seconds, error_message, train_sample_count, test_sample_count,
            class_dist_train_json, class_dist_test_json, metrics_json, config_json, artifacts_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        record["experiment_id"], record["dataset_id"], record["dataset_name"], record["data_mode"],
        record["target_column"], str(record.get("positive_class", 1)),
        json.dumps(record.get("selected_features", [])), float(record.get("test_size", 0.25)),
        int(record.get("random_state", 42)), record.get("status", "created"),
        record.get("current_stage", "created"), record.get("created_at", datetime.now(timezone.utc).isoformat()),
        record.get("completed_at"), record.get("total_runtime_seconds"), record.get("error_message"),
        record.get("train_sample_count"), record.get("test_sample_count"),
        json.dumps(record.get("class_distribution_train") or {}), json.dumps(record.get("class_distribution_test") or {}),
        json.dumps(record.get("metrics") or {}), json.dumps(record.get("config") or {}), record.get("artifacts_path")
    ))
    conn.commit()
    conn.close()

def get_experiment_record(experiment_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT experiment_id, dataset_id, dataset_name, data_mode, target_column, positive_class,
               selected_features_json, test_size, random_state, status, current_stage, created_at,
               completed_at, total_runtime_seconds, error_message, train_sample_count, test_sample_count,
               class_dist_train_json, class_dist_test_json, metrics_json, config_json, artifacts_path
        FROM experiments WHERE experiment_id = ?
    """, (experiment_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "experiment_id": row[0], "dataset_id": row[1], "dataset_name": row[2], "data_mode": row[3],
        "target_column": row[4], "positive_class": row[5], "selected_features": json.loads(row[6]),
        "test_size": row[7], "random_state": row[8], "status": row[9], "current_stage": row[10],
        "created_at": row[11], "completed_at": row[12], "total_runtime_seconds": row[13],
        "error_message": row[14], "train_sample_count": row[15], "test_sample_count": row[16],
        "class_distribution_train": json.loads(row[17]), "class_distribution_test": json.loads(row[18]),
        "metrics": json.loads(row[19]), "config": json.loads(row[20]), "artifacts_path": row[21]
    }

def list_experiments(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT experiment_id, dataset_id, dataset_name, data_mode, target_column, status,
               created_at, completed_at, total_runtime_seconds, metrics_json
        FROM experiments ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    results = []
    for r in rows:
        results.append({
            "experiment_id": r[0], "dataset_id": r[1], "dataset_name": r[2], "data_mode": r[3],
            "target_column": r[4], "status": r[5], "created_at": r[6], "completed_at": r[7],
            "total_runtime_seconds": r[8], "metrics": json.loads(r[9]) if r[9] else {}
        })
    return results

# --- Clinical Patients & Observations Store (marrowQ 2.0) ---

_PATIENT_COLUMNS = (
    "patient_id, name, age, gender, disease, transplant_type, donor_type, transplant_date, conditioning, "
    "cell_dose_cd34, chimerism_donor_pct, cmv_status, hla_match, status, created_at, source, source_record, pretransplant_json"
)


def _row_to_patient(r) -> Dict[str, Any]:
    return {
        "patient_id": r[0], "name": r[1], "age": r[2], "gender": r[3],
        "disease": r[4], "transplant_type": r[5], "donor_type": r[6],
        "transplant_date": r[7], "conditioning": r[8], "cell_dose_cd34": r[9],
        "chimerism_donor_pct": r[10], "cmv_status": r[11], "hla_match": r[12],
        "status": r[13], "created_at": r[14], "source": r[15], "source_record": r[16],
        "pretransplant": json.loads(r[17]) if r[17] else None,
    }


def list_patients(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    with get_connection(db_path) as conn:
        rows = conn.execute(f"SELECT {_PATIENT_COLUMNS} FROM patients ORDER BY transplant_date DESC").fetchall()
    return [_row_to_patient(r) for r in rows]


def get_patient(patient_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    with get_connection(db_path) as conn:
        r = conn.execute(f"SELECT {_PATIENT_COLUMNS} FROM patients WHERE patient_id = ?", (patient_id,)).fetchone()
    return _row_to_patient(r) if r else None


def save_patient(patient: Dict[str, Any], db_path: str = DB_PATH):
    with get_connection(db_path) as conn:
        conn.execute(f"""
            INSERT OR REPLACE INTO patients ({_PATIENT_COLUMNS}) VALUES ({",".join("?" * 18)})
        """, (
            patient["patient_id"], patient["name"], patient["age"], patient["gender"],
            patient["disease"], patient["transplant_type"], patient["donor_type"],
            patient["transplant_date"], patient["conditioning"],
            patient.get("cell_dose_cd34"), patient.get("chimerism_donor_pct"),
            patient.get("cmv_status"), patient.get("hla_match"),
            patient["status"], patient.get("created_at", datetime.now(timezone.utc).isoformat()),
            patient.get("source", "clinical"), patient.get("source_record"),
            json.dumps(patient["pretransplant"]) if patient.get("pretransplant") is not None else None,
        ))


def delete_patient(patient_id: str, db_path: str = DB_PATH) -> bool:
    with get_connection(db_path) as conn:
        conn.execute("DELETE FROM clinical_observations WHERE patient_id = ?", (patient_id,))
        conn.execute("DELETE FROM prediction_runs WHERE patient_id = ?", (patient_id,))
        return conn.execute("DELETE FROM patients WHERE patient_id = ?", (patient_id,)).rowcount > 0

def get_patient_observations(patient_id: str, db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, patient_id, day_post_tx, recorded_date, metric_type, value, unit, source, recorded_by, status
        FROM clinical_observations WHERE patient_id = ? ORDER BY day_post_tx ASC
    """, (patient_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{
        "id": r[0], "patient_id": r[1], "day_post_tx": r[2], "recorded_date": r[3],
        "metric_type": r[4], "value": r[5], "unit": r[6], "source": r[7],
        "recorded_by": r[8], "status": r[9]
    } for r in rows]

def save_clinical_observation(obs: Dict[str, Any], db_path: str = DB_PATH) -> int:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO clinical_observations (
            patient_id, day_post_tx, recorded_date, metric_type, value, unit, source, recorded_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        obs["patient_id"], obs["day_post_tx"], obs["recorded_date"],
        obs["metric_type"], obs["value"], obs["unit"],
        obs.get("source", "Hospital EMR Lab"), obs.get("recorded_by", "Clinical Staff"),
        obs.get("status", "verified")
    ))
    obs_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return obs_id

def log_audit_event(event_type: str, patient_id: Optional[str], user_role: str, details: Dict[str, Any], db_path: str = DB_PATH):
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO audit_events (event_type, patient_id, user_role, details_json, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (event_type, patient_id, user_role, json.dumps(details), datetime.now(timezone.utc).isoformat()))
    conn.commit()
    conn.close()

def save_quantum_job(job: Dict[str, Any], db_path: str = DB_PATH):
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO quantum_jobs (
            job_id, backend_name, backend_type, execution_mode, status, shots,
            circuit_depth, circuit_width, submitted_at, completed_at,
            execution_duration_ms, kernel_evaluation_duration_ms, error_message, result_provenance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job["job_id"], job["backend_name"], job["backend_type"], job["execution_mode"],
        job["status"], job["shots"], job.get("circuit_depth"), job.get("circuit_width"),
        job["submitted_at"], job.get("completed_at"), job.get("execution_duration_ms"),
        job.get("kernel_evaluation_duration_ms"), job.get("error_message"), job.get("result_provenance", "ibm_quantum_runtime")
    ))
    conn.commit()
    conn.close()

def list_quantum_jobs(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT job_id, backend_name, backend_type, execution_mode, status, shots,
               circuit_depth, circuit_width, submitted_at, completed_at,
               execution_duration_ms, kernel_evaluation_duration_ms, error_message, result_provenance
        FROM quantum_jobs ORDER BY submitted_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [{
        "job_id": r[0], "backend_name": r[1], "backend_type": r[2], "execution_mode": r[3],
        "status": r[4], "shots": r[5], "circuit_depth": r[6], "circuit_width": r[7],
        "submitted_at": r[8], "completed_at": r[9], "execution_duration_ms": r[10],
        "kernel_evaluation_duration_ms": r[11], "error_message": r[12], "result_provenance": r[13]
    } for r in rows]

def save_prediction_run(run: Dict[str, Any], db_path: str = DB_PATH):
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO prediction_runs (
            prediction_id, patient_id, models_executed_json, predictions_json, disagreement_json,
            validation_status, warnings_json, clinician_review_status, reviewed_by, review_notes,
            backend_provenance, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        run["prediction_id"], run["patient_id"], json.dumps(run.get("models_executed", [])),
        json.dumps(run.get("predictions", {})), json.dumps(run.get("disagreement", {})),
        run.get("validation_status", "validated"), json.dumps(run.get("warnings", [])),
        run.get("clinician_review_status", "pending"), run.get("reviewed_by"),
        run.get("review_notes"), run.get("backend_provenance", "marrowq_hybrid_pipeline"),
        run.get("created_at", datetime.now(timezone.utc).isoformat())
    ))
    conn.commit()
    conn.close()

def list_prediction_runs(patient_id: Optional[str] = None, db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    if patient_id:
        cursor.execute("SELECT * FROM prediction_runs WHERE patient_id = ? ORDER BY created_at DESC", (patient_id,))
    else:
        cursor.execute("SELECT * FROM prediction_runs ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    results = []
    for r in rows:
        results.append({
            "prediction_id": r[0], "patient_id": r[1], "models_executed": json.loads(r[2]),
            "predictions": json.loads(r[3]), "disagreement": json.loads(r[4]),
            "validation_status": r[5], "warnings": json.loads(r[6]),
            "clinician_review_status": r[7], "reviewed_by": r[8], "review_notes": r[9],
            "backend_provenance": r[10], "created_at": r[11]
        })
    return results

# Rows that earlier versions seeded with invented patients, labs, an approved prediction and a
# hardware job that never ran. Removed on start-up so no fabricated record survives an upgrade.
_LEGACY_SEED_PATIENTS = ("PT-9042-BMT", "PT-8104-BMT", "PT-4421-BMT")
_LEGACY_SEED_JOBS = ("qjob-bmt-9042-kernel-eval",)
_LEGACY_SEED_PREDICTIONS = ("PR-9042-20261028",)


def purge_legacy_seed_data(db_path: str = DB_PATH) -> None:
    with _connect(db_path) as conn:
        marks = ",".join("?" for _ in _LEGACY_SEED_PATIENTS)
        conn.execute(f"DELETE FROM clinical_observations WHERE patient_id IN ({marks})", _LEGACY_SEED_PATIENTS)
        conn.execute(f"DELETE FROM prediction_runs WHERE patient_id IN ({marks})", _LEGACY_SEED_PATIENTS)
        conn.execute(f"DELETE FROM audit_events WHERE patient_id IN ({marks})", _LEGACY_SEED_PATIENTS)
        conn.execute(f"DELETE FROM patients WHERE patient_id IN ({marks})", _LEGACY_SEED_PATIENTS)
        conn.execute(f"DELETE FROM quantum_jobs WHERE job_id IN ({','.join('?' for _ in _LEGACY_SEED_JOBS)})", _LEGACY_SEED_JOBS)
        conn.execute(f"DELETE FROM prediction_runs WHERE prediction_id IN ({','.join('?' for _ in _LEGACY_SEED_PREDICTIONS)})", _LEGACY_SEED_PREDICTIONS)


# --- User & Auth Functions (RBAC - Issue K) ---

def save_user(user: Dict[str, Any], db_path: str = DB_PATH) -> None:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO users (user_id, email, password_hash, salt, role, full_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        user["user_id"], user["email"], user["password_hash"], user["salt"],
        user["role"], user["full_name"], user.get("created_at", datetime.now(timezone.utc).isoformat())
    ))
    conn.commit()
    conn.close()


def get_user_by_email(email: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, email, password_hash, salt, role, full_name, created_at FROM users WHERE email = ?", (email.lower().strip(),))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "user_id": row[0], "email": row[1], "password_hash": row[2], "salt": row[3],
        "role": row[4], "full_name": row[5], "created_at": row[6]
    }


def get_user_by_id(user_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, email, password_hash, salt, role, full_name, created_at FROM users WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "user_id": row[0], "email": row[1], "password_hash": row[2], "salt": row[3],
        "role": row[4], "full_name": row[5], "created_at": row[6]
    }


def list_users(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, email, role, full_name, created_at FROM users ORDER BY created_at ASC")
    rows = cursor.fetchall()
    conn.close()
    return [{"user_id": r[0], "email": r[1], "role": r[2], "full_name": r[3], "created_at": r[4]} for r in rows]


def save_session(session: Dict[str, Any], db_path: str = DB_PATH) -> None:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO user_sessions (session_id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (
        session["session_id"], session["user_id"], session["token_hash"],
        session["expires_at"], session.get("created_at", datetime.now(timezone.utc).isoformat())
    ))
    conn.commit()
    conn.close()


def get_session(session_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT session_id, user_id, token_hash, expires_at, created_at FROM user_sessions WHERE session_id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "session_id": row[0], "user_id": row[1], "token_hash": row[2],
        "expires_at": row[3], "created_at": row[4]
    }


def delete_session(session_id: str, db_path: str = DB_PATH) -> None:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_sessions WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()

