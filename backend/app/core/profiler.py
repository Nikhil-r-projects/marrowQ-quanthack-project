import re
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from app.schemas import DatasetProfileResponse

LEAKAGE_KEYWORDS = [
    "anc_day", "engraft_day", "recovery_day", "day_to", "time_to",
    "post_tx", "post_transplant", "chimerism", "gvhd_day", "gvhd_grade",
    "relapse_day", "death_day", "cause_of_death", "survival_time",
    "discharge_date", "day30", "day100"
]

ID_KEYWORDS = ["id", "patient_id", "mrn", "subject_id", "record_id"]

def profile_dataset(
    df: pd.DataFrame, 
    dataset_id: str, 
    name: str, 
    source: str = "Uploaded CSV", 
    data_mode: str = "research"
) -> DatasetProfileResponse:
    total_rows = len(df)
    total_columns = len(df.columns)
    columns = list(df.columns)
    
    column_types: Dict[str, str] = {}
    missing_counts: Dict[str, int] = {}
    missing_percentages: Dict[str, float] = {}
    numeric_summaries: Dict[str, Dict[str, float]] = {}
    categorical_summaries: Dict[str, Dict[str, int]] = {}
    leakage_warnings: List[str] = []
    leakage_columns: List[str] = []
    
    duplicates_count = int(df.duplicated().sum())
    
    for col in columns:
        col_lower = str(col).lower()
        # Check leakage
        for kw in LEAKAGE_KEYWORDS:
            if kw in col_lower:
                leakage_warnings.append(
                    f"Potential target leakage detected in column '{col}': resembles post-transplant event or time-to-event marker."
                )
                leakage_columns.append(col)
                break
        
        # Missing values
        missing_count = int(df[col].isna().sum())
        missing_counts[col] = missing_count
        missing_percentages[col] = round((missing_count / total_rows * 100) if total_rows > 0 else 0.0, 2)
        
        # Type inference
        if pd.api.types.is_numeric_dtype(df[col]):
            column_types[col] = "numeric"
            series_clean = df[col].dropna()
            if len(series_clean) > 0:
                numeric_summaries[col] = {
                    "mean": round(float(series_clean.mean()), 3),
                    "std": round(float(series_clean.std()), 3) if len(series_clean) > 1 else 0.0,
                    "min": round(float(series_clean.min()), 3),
                    "q25": round(float(series_clean.quantile(0.25)), 3),
                    "median": round(float(series_clean.median()), 3),
                    "q75": round(float(series_clean.quantile(0.75)), 3),
                    "max": round(float(series_clean.max()), 3),
                }
        else:
            column_types[col] = "categorical"
            top_counts = df[col].astype(str).value_counts().head(10).to_dict()
            categorical_summaries[col] = {str(k): int(v) for k, v in top_counts.items()}
            
    # Suggest target
    suggested_target = ""
    for col in columns:
        col_lower = col.lower()
        if any(term in col_lower for term in ["neutrophil_recovery", "engraft", "recovery", "target", "outcome", "label"]):
            suggested_target = col
            break
    if not suggested_target and columns:
        suggested_target = columns[-1]
        
    # Suggested features: exclude target, IDs, and leakage columns
    suggested_features = []
    for col in columns:
        col_lower = col.lower()
        if col == suggested_target:
            continue
        if any(id_kw == col_lower or col_lower.endswith("_id") for id_kw in ID_KEYWORDS):
            continue
        if any(lkw in col_lower for lkw in LEAKAGE_KEYWORDS):
            continue
        suggested_features.append(col)
        
    class_distribution = None
    if suggested_target in df.columns:
        counts = df[suggested_target].dropna().value_counts().to_dict()
        class_distribution = {str(k): int(v) for k, v in counts.items()}
        
    return DatasetProfileResponse(
        dataset_id=dataset_id,
        name=name,
        source=source,
        data_mode=data_mode,
        total_rows=total_rows,
        total_columns=total_columns,
        columns=columns,
        column_types=column_types,
        missing_counts=missing_counts,
        missing_percentages=missing_percentages,
        duplicates_count=duplicates_count,
        numeric_summaries=numeric_summaries,
        categorical_summaries=categorical_summaries,
        potential_leakage_warnings=leakage_warnings,
        leakage_columns=leakage_columns,
        suggested_target=suggested_target,
        suggested_features=suggested_features,
        class_distribution=class_distribution
    )
