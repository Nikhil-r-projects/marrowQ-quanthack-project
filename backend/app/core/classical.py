import time
import numpy as np
from typing import Dict, Any, Tuple
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from app.core.evaluator import evaluate_model_performance
from app.schemas import ModelMetric

def train_dummy_model(
    X_train: np.ndarray, y_train: np.ndarray,
    X_test: np.ndarray, y_test: np.ndarray,
    random_state: int = 42
) -> Tuple[DummyClassifier, ModelMetric]:
    clf = DummyClassifier(strategy="most_frequent")
    
    t0 = time.perf_counter()
    clf.fit(X_train, y_train)
    t_train = time.perf_counter() - t0
    
    t0 = time.perf_counter()
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1] if hasattr(clf, "predict_proba") else None
    t_infer = time.perf_counter() - t0
    
    metric = evaluate_model_performance(
        model_name="dummy",
        display_name="Dummy Baseline (Most Frequent)",
        y_test=y_test,
        y_pred=y_pred,
        y_prob=y_prob,
        training_time_seconds=t_train,
        inference_time_seconds=t_infer,
        extra_info={"strategy": "most_frequent"}
    )
    return clf, metric

def train_logistic_regression(
    X_train: np.ndarray, y_train: np.ndarray,
    X_test: np.ndarray, y_test: np.ndarray,
    random_state: int = 42
) -> Tuple[LogisticRegression, ModelMetric]:
    clf = LogisticRegression(max_iter=1000, random_state=random_state)
    
    t0 = time.perf_counter()
    clf.fit(X_train, y_train)
    t_train = time.perf_counter() - t0
    
    t0 = time.perf_counter()
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]
    t_infer = time.perf_counter() - t0
    
    metric = evaluate_model_performance(
        model_name="logistic_regression",
        display_name="Logistic Regression (L2)",
        y_test=y_test,
        y_pred=y_pred,
        y_prob=y_prob,
        training_time_seconds=t_train,
        inference_time_seconds=t_infer,
        extra_info={"solver": "lbfgs", "penalty": "l2"}
    )
    return clf, metric

def train_random_forest(
    X_train: np.ndarray, y_train: np.ndarray,
    X_test: np.ndarray, y_test: np.ndarray,
    random_state: int = 42
) -> Tuple[RandomForestClassifier, ModelMetric]:
    clf = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=random_state)
    
    t0 = time.perf_counter()
    clf.fit(X_train, y_train)
    t_train = time.perf_counter() - t0
    
    t0 = time.perf_counter()
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]
    t_infer = time.perf_counter() - t0
    
    metric = evaluate_model_performance(
        model_name="random_forest",
        display_name="Random Forest Classifier",
        y_test=y_test,
        y_pred=y_pred,
        y_prob=y_prob,
        training_time_seconds=t_train,
        inference_time_seconds=t_infer,
        extra_info={"n_estimators": 100, "max_depth": 6}
    )
    return clf, metric

def train_rbf_svm(
    X_train: np.ndarray, y_train: np.ndarray,
    X_test: np.ndarray, y_test: np.ndarray,
    random_state: int = 42
) -> Tuple[SVC, ModelMetric]:
    clf = SVC(kernel="rbf", probability=True, random_state=random_state)
    
    t0 = time.perf_counter()
    clf.fit(X_train, y_train)
    t_train = time.perf_counter() - t0
    
    t0 = time.perf_counter()
    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]
    t_infer = time.perf_counter() - t0
    
    metric = evaluate_model_performance(
        model_name="rbf_svm",
        display_name="Classical RBF SVM",
        y_test=y_test,
        y_pred=y_pred,
        y_prob=y_prob,
        training_time_seconds=t_train,
        inference_time_seconds=t_infer,
        extra_info={"kernel": "rbf", "probability": True}
    )
    return clf, metric
