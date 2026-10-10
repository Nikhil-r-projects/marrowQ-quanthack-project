import sqlite3
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

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
    
    conn.commit()
    conn.close()

# Auto-initialize DB on import
init_db()

def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    init_db(db_path)
    return sqlite3.connect(db_path)

def save_dataset_meta(dataset_id: str, name: str, source: str, data_mode: str, filepath: str, row_count: int, col_count: int, profile_dict: Dict[str, Any], db_path: str = DB_PATH):
    conn = get_connection(db_path)
    cursor = conn.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        INSERT OR REPLACE INTO datasets (dataset_id, name, source, data_mode, filepath, row_count, column_count, created_at, profile_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        dataset_id, name, source, data_mode, filepath, row_count, col_count, now_str, json.dumps(profile_dict)
    ))
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
        "dataset_id": row[0],
        "name": row[1],
        "source": row[2],
        "data_mode": row[3],
        "filepath": row[4],
        "row_count": row[5],
        "column_count": row[6],
        "created_at": row[7],
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
        record["experiment_id"],
        record["dataset_id"],
        record["dataset_name"],
        record["data_mode"],
        record["target_column"],
        str(record.get("positive_class", 1)),
        json.dumps(record.get("selected_features", [])),
        float(record.get("test_size", 0.25)),
        int(record.get("random_state", 42)),
        record.get("status", "created"),
        record.get("current_stage", "created"),
        record.get("created_at", datetime.now(timezone.utc).isoformat()),
        record.get("completed_at"),
        record.get("total_runtime_seconds"),
        record.get("error_message"),
        record.get("train_sample_count"),
        record.get("test_sample_count"),
        json.dumps(record.get("class_distribution_train") or {}),
        json.dumps(record.get("class_distribution_test") or {}),
        json.dumps(record.get("metrics") or {}),
        json.dumps(record.get("config") or {}),
        record.get("artifacts_path")
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
        "experiment_id": row[0],
        "dataset_id": row[1],
        "dataset_name": row[2],
        "data_mode": row[3],
        "target_column": row[4],
        "positive_class": row[5],
        "selected_features": json.loads(row[6]),
        "test_size": row[7],
        "random_state": row[8],
        "status": row[9],
        "current_stage": row[10],
        "created_at": row[11],
        "completed_at": row[12],
        "total_runtime_seconds": row[13],
        "error_message": row[14],
        "train_sample_count": row[15],
        "test_sample_count": row[16],
        "class_distribution_train": json.loads(row[17]),
        "class_distribution_test": json.loads(row[18]),
        "metrics": json.loads(row[19]),
        "config": json.loads(row[20]),
        "artifacts_path": row[21]
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
            "experiment_id": r[0],
            "dataset_id": r[1],
            "dataset_name": r[2],
            "data_mode": r[3],
            "target_column": r[4],
            "status": r[5],
            "created_at": r[6],
            "completed_at": r[7],
            "total_runtime_seconds": r[8],
            "metrics": json.loads(r[9]) if r[9] else {}
        })
    return results
