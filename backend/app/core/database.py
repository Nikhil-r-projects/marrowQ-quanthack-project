import sqlite3
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "marrowq.db")

def init_db(db_path: str = DB_PATH):
    conn = sqlite3.connect(db_path)
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

    conn.commit()
    conn.close()

# Auto-initialize DB on import
init_db()

def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    init_db(db_path)
    return sqlite3.connect(db_path)

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

def list_patients(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT patient_id, name, age, gender, disease, transplant_type, donor_type,
               transplant_date, conditioning, cell_dose_cd34, chimerism_donor_pct,
               cmv_status, hla_match, status, created_at
        FROM patients ORDER BY transplant_date DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [{
        "patient_id": r[0], "name": r[1], "age": r[2], "gender": r[3],
        "disease": r[4], "transplant_type": r[5], "donor_type": r[6],
        "transplant_date": r[7], "conditioning": r[8], "cell_dose_cd34": r[9],
        "chimerism_donor_pct": r[10], "cmv_status": r[11], "hla_match": r[12],
        "status": r[13], "created_at": r[14]
    } for r in rows]

def get_patient(patient_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT patient_id, name, age, gender, disease, transplant_type, donor_type,
               transplant_date, conditioning, cell_dose_cd34, chimerism_donor_pct,
               cmv_status, hla_match, status, created_at
        FROM patients WHERE patient_id = ?
    """, (patient_id,))
    r = cursor.fetchone()
    conn.close()
    if not r:
        return None
    return {
        "patient_id": r[0], "name": r[1], "age": r[2], "gender": r[3],
        "disease": r[4], "transplant_type": r[5], "donor_type": r[6],
        "transplant_date": r[7], "conditioning": r[8], "cell_dose_cd34": r[9],
        "chimerism_donor_pct": r[10], "cmv_status": r[11], "hla_match": r[12],
        "status": r[13], "created_at": r[14]
    }

def save_patient(patient: Dict[str, Any], db_path: str = DB_PATH):
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO patients (
            patient_id, name, age, gender, disease, transplant_type, donor_type,
            transplant_date, conditioning, cell_dose_cd34, chimerism_donor_pct,
            cmv_status, hla_match, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        patient["patient_id"], patient["name"], patient["age"], patient["gender"],
        patient["disease"], patient["transplant_type"], patient["donor_type"],
        patient["transplant_date"], patient.get("conditioning", "Myeloablative"),
        patient.get("cell_dose_cd34", 5.0), patient.get("chimerism_donor_pct", 95.0),
        patient.get("cmv_status", "Negative"), patient.get("hla_match", "10/10"),
        patient.get("status", "Active"), patient.get("created_at", datetime.now(timezone.utc).isoformat())
    ))
    conn.commit()
    conn.close()

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

def seed_default_clinical_data(db_path: str = DB_PATH):
    """Seed authentic clinical records for marrowQ 2.0 demonstration"""
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM patients")
    count = cursor.fetchone()[0]
    if count > 0:
        conn.close()
        return

    # Seed Patient 1: PT-9042-BMT (Eleanora Vance, Day +14 Active Recovery)
    p1 = {
        "patient_id": "PT-9042-BMT",
        "name": "Eleanora Vance",
        "age": 42,
        "gender": "Female",
        "disease": "Acute Myeloid Leukemia (AML, adverse cytogenetics)",
        "transplant_type": "Allogeneic HSCT",
        "donor_type": "10/10 Matched Unrelated Donor (MUD)",
        "transplant_date": "2026-10-14",
        "conditioning": "Busulfan/Cyclophosphamide (Bu/Cy)",
        "cell_dose_cd34": 6.4,
        "chimerism_donor_pct": 98.4,
        "cmv_status": "D+/R- (High Risk)",
        "hla_match": "10/10",
        "status": "Active Surveillance - Engraftment Impending",
        "created_at": "2026-10-14T08:00:00Z"
    }
    
    # Seed Patient 2: PT-8104-BMT (Marcus Chen, Day +32 Engrafted)
    p2 = {
        "patient_id": "PT-8104-BMT",
        "name": "Marcus Chen",
        "age": 58,
        "gender": "Male",
        "disease": "Myelodysplastic Syndrome (MDS-EB2)",
        "transplant_type": "Allogeneic HSCT",
        "donor_type": "Haploidentical Related Donor",
        "transplant_date": "2026-09-26",
        "conditioning": "Fludarabine/Melphalan/TBI (Flu/Mel)",
        "cell_dose_cd34": 5.2,
        "chimerism_donor_pct": 99.8,
        "cmv_status": "D+/R+ (Reactivated, Treated)",
        "hla_match": "5/10 Haplo",
        "status": "Engrafted - Stable Outpatient",
        "created_at": "2026-09-26T08:00:00Z"
    }

    # Seed Patient 3: PT-4421-BMT (Sarah Jenkins, Day +5 Aplasia)
    p3 = {
        "patient_id": "PT-4421-BMT",
        "name": "Sarah Jenkins",
        "age": 29,
        "gender": "Female",
        "disease": "Acute Lymphoblastic Leukemia (B-ALL, Ph-like)",
        "transplant_type": "Allogeneic HSCT",
        "donor_type": "Matched Sibling Donor (MSD)",
        "transplant_date": "2026-10-23",
        "conditioning": "Total Body Irradiation + Cyclophosphamide (TBI/Cy)",
        "cell_dose_cd34": 7.1,
        "chimerism_donor_pct": 92.0,
        "cmv_status": "D-/R- (Low Risk)",
        "hla_match": "12/12",
        "status": "Aplastic Nadir - Intensive Isolation",
        "created_at": "2026-10-23T08:00:00Z"
    }

    conn.close()
    save_patient(p1, db_path)
    save_patient(p2, db_path)
    save_patient(p3, db_path)

    # Seed Longitudinal observations for PT-9042-BMT (Eleanora Vance)
    # Days -2, 0, 3, 7, 10, 12, 14
    labs_p1 = [
        # Day -2 (Conditioning)
        {"day": -2, "date": "2026-10-12", "anc": 2800, "plt": 145000, "hb": 11.8, "wbc": 3.9},
        # Day 0 (Transplant Infusion)
        {"day": 0, "date": "2026-10-14", "anc": 450, "plt": 85000, "hb": 10.4, "wbc": 1.2},
        # Day +3 (Early Aplasia)
        {"day": 3, "date": "2026-10-17", "anc": 30, "plt": 32000, "hb": 8.5, "wbc": 0.1},
        # Day +7 (Nadir)
        {"day": 7, "date": "2026-10-21", "anc": 80, "plt": 14000, "hb": 7.9, "wbc": 0.3},
        # Day +10 (Early Recovery)
        {"day": 10, "date": "2026-10-24", "anc": 190, "plt": 12500, "hb": 8.6, "wbc": 0.8},
        # Day +12 (Engraftment Surge)
        {"day": 12, "date": "2026-10-26", "anc": 280, "plt": 15000, "hb": 9.1, "wbc": 1.3},
        # Day +14 (Today: 420 cells/uL, impending 500 milestone)
        {"day": 14, "date": "2026-10-28", "anc": 420, "plt": 18500, "hb": 9.6, "wbc": 1.9},
    ]
    for row in labs_p1:
        save_clinical_observation({"patient_id": "PT-9042-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "Absolute Neutrophil Count (ANC)", "value": row["anc"], "unit": "cells/μL", "source": "Central Hematology Lab"}, db_path)
        save_clinical_observation({"patient_id": "PT-9042-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "Platelets", "value": row["plt"], "unit": "/μL", "source": "Central Hematology Lab"}, db_path)
        save_clinical_observation({"patient_id": "PT-9042-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "Hemoglobin", "value": row["hb"], "unit": "g/dL", "source": "Central Hematology Lab"}, db_path)
        save_clinical_observation({"patient_id": "PT-9042-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "White Blood Cells (WBC)", "value": row["wbc"], "unit": "x10^3/μL", "source": "Central Hematology Lab"}, db_path)

    # Seed observations for PT-8104-BMT (Engrafted)
    labs_p2 = [
        {"day": 0, "date": "2026-09-26", "anc": 300, "plt": 70000, "hb": 9.8, "wbc": 0.9},
        {"day": 7, "date": "2026-10-03", "anc": 40, "plt": 12000, "hb": 7.6, "wbc": 0.2},
        {"day": 14, "date": "2026-10-10", "anc": 320, "plt": 16000, "hb": 8.4, "wbc": 1.1},
        {"day": 18, "date": "2026-10-14", "anc": 680, "plt": 24000, "hb": 9.2, "wbc": 2.4}, # Engrafted ANC > 500
        {"day": 24, "date": "2026-10-20", "anc": 1420, "plt": 48000, "hb": 10.3, "wbc": 4.1},
        {"day": 32, "date": "2026-10-28", "anc": 1950, "plt": 65000, "hb": 11.2, "wbc": 5.4},
    ]
    for row in labs_p2:
        save_clinical_observation({"patient_id": "PT-8104-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "Absolute Neutrophil Count (ANC)", "value": row["anc"], "unit": "cells/μL", "source": "Central Hematology Lab"}, db_path)
        save_clinical_observation({"patient_id": "PT-8104-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "Platelets", "value": row["plt"], "unit": "/μL", "source": "Central Hematology Lab"}, db_path)
        save_clinical_observation({"patient_id": "PT-8104-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "Hemoglobin", "value": row["hb"], "unit": "g/dL", "source": "Central Hematology Lab"}, db_path)
        save_clinical_observation({"patient_id": "PT-8104-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "White Blood Cells (WBC)", "value": row["wbc"], "unit": "x10^3/μL", "source": "Central Hematology Lab"}, db_path)

    # Seed observations for PT-4421-BMT (Aplasia)
    labs_p3 = [
        {"day": 0, "date": "2026-10-23", "anc": 500, "plt": 92000, "hb": 10.9, "wbc": 1.4},
        {"day": 3, "date": "2026-10-26", "anc": 90, "plt": 28000, "hb": 8.7, "wbc": 0.3},
        {"day": 5, "date": "2026-10-28", "anc": 40, "plt": 11000, "hb": 8.0, "wbc": 0.1},
    ]
    for row in labs_p3:
        save_clinical_observation({"patient_id": "PT-4421-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "Absolute Neutrophil Count (ANC)", "value": row["anc"], "unit": "cells/μL", "source": "Central Hematology Lab"}, db_path)
        save_clinical_observation({"patient_id": "PT-4421-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "Platelets", "value": row["plt"], "unit": "/μL", "source": "Central Hematology Lab"}, db_path)
        save_clinical_observation({"patient_id": "PT-4421-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "Hemoglobin", "value": row["hb"], "unit": "g/dL", "source": "Central Hematology Lab"}, db_path)
        save_clinical_observation({"patient_id": "PT-4421-BMT", "day_post_tx": row["day"], "recorded_date": row["date"], "metric_type": "White Blood Cells (WBC)", "value": row["wbc"], "unit": "x10^3/μL", "source": "Central Hematology Lab"}, db_path)

    # Seed Sample Quantum Job (ibm_brisbane telemetry)
    save_quantum_job({
        "job_id": "qjob-bmt-9042-kernel-eval",
        "backend_name": "ibm_brisbane",
        "backend_type": "IBM Quantum Hardware (127-Qubit Eagle r3)",
        "execution_mode": "qiskit_ibm_runtime_estimator",
        "status": "COMPLETED",
        "shots": 8192,
        "circuit_depth": 48,
        "circuit_width": 2,
        "submitted_at": "2026-10-28T09:12:00Z",
        "completed_at": "2026-10-28T09:16:32Z",
        "execution_duration_ms": 272000,
        "kernel_evaluation_duration_ms": 320,
        "error_message": None,
        "result_provenance": "ibm_brisbane:runtime:zne_error_mitigated"
    }, db_path)

    # Seed Sample Multi-Model Prediction Run for PT-9042-BMT
    save_prediction_run({
        "prediction_id": "PR-9042-20261028",
        "patient_id": "PT-9042-BMT",
        "models_executed": ["Logistic Regression", "Random Forest", "Classical RBF SVM", "Quantum-Kernel SVM"],
        "predictions": {
            "Logistic Regression": {"probability": 0.78, "predicted_engraftment": True, "confidence": "Moderate"},
            "Random Forest": {"probability": 0.84, "predicted_engraftment": True, "confidence": "High"},
            "Classical RBF SVM": {"probability": 0.82, "predicted_engraftment": True, "confidence": "High"},
            "Quantum-Kernel SVM": {"probability": 0.94, "predicted_engraftment": True, "confidence": "High (Hilbert Kernel Fidelity 0.962)"}
        },
        "disagreement": {
            "consensus": "Unanimous Positive Engraftment (All 4 Models Agree)",
            "variance": 0.0048,
            "outlier_model": None,
            "disagreement_flag": False
        },
        "validation_status": "VALIDATED_CLINICALLY_SAFE",
        "warnings": ["CMV High Risk Donor/Recipient Mismatch: Serial CMV PCR Surveillance Advised"],
        "clinician_review_status": "APPROVED",
        "reviewed_by": "Dr. Vance S., MD PhD",
        "review_notes": "Concur with quantum kernel and RF predictions. ANC velocity confirms impending day +15 engraftment.",
        "backend_provenance": "qiskit_machine_learning:zz_feature_map:ibm_brisbane"
    }, db_path)

# Seed on import
seed_default_clinical_data()
