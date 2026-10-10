import time
import numpy as np
from typing import Dict, Any, Optional, List
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, brier_score_loss, confusion_matrix
)
from app.schemas import ModelMetric

def evaluate_model_performance(
    model_name: str,
    display_name: str,
    y_test: np.ndarray,
    y_pred: np.ndarray,
    y_prob: Optional[np.ndarray],
    training_time_seconds: float,
    inference_time_seconds: float,
    extra_info: Optional[Dict[str, Any]] = None
) -> ModelMetric:
    test_sample_count = len(y_test)
    
    acc = float(accuracy_score(y_test, y_pred))
    bal_acc = float(balanced_accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    
    # Compute ROC-AUC if probability or decision function exists and y_test has >1 class
    roc_auc = None
    if y_prob is not None:
        try:
            if len(np.unique(y_test)) > 1:
                roc_auc = float(roc_auc_score(y_test, y_prob))
        except Exception:
            roc_auc = None
            
    brier = None
    if y_prob is not None:
        try:
            brier = float(brier_score_loss(y_test, y_prob))
        except Exception:
            brier = None
            
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1]).tolist()
    
    return ModelMetric(
        model_name=model_name,
        display_name=display_name,
        accuracy=round(acc, 4),
        balanced_accuracy=round(bal_acc, 4),
        precision=round(prec, 4),
        recall=round(rec, 4),
        f1_score=round(f1, 4),
        roc_auc=round(roc_auc, 4) if roc_auc is not None else None,
        brier_score=round(brier, 4) if brier is not None else None,
        confusion_matrix=cm,
        training_time_seconds=round(training_time_seconds, 4),
        inference_time_seconds=round(inference_time_seconds, 4),
        test_sample_count=test_sample_count,
        status="completed",
        extra_info=extra_info
    )
