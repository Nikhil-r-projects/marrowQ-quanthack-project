"""Longitudinal Survival & Time-to-Event Modeling Engine for MarrowQ.

Replaces fixed parametric heuristics with statistical and machine learning survival models:
1. Kaplan-Meier Non-Parametric Estimator with Greenwood 95% Confidence Intervals.
2. Cox Proportional Hazards Model with Log-Partial Likelihood and Hazard Ratios.
3. Harrell's Concordance Index (C-Index) Evaluation.
4. Time-Dependent Event-Free Survival (EFS) and Overall Survival (OS) Projections.
"""
import logging
import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from scipy.optimize import minimize

logger = logging.getLogger("marrowq.clinical.survival_models")


class KaplanMeierEstimator:
    """Computes non-parametric Kaplan-Meier survival curves with Greenwood variance."""

    def __init__(self):
        self.timeline: np.ndarray = np.array([])
        self.survival_probabilities: np.ndarray = np.array([])
        self.ci_lower: np.ndarray = np.array([])
        self.ci_upper: np.ndarray = np.array([])

    def fit(self, durations: np.ndarray, events: np.ndarray) -> "KaplanMeierEstimator":
        """Fits survival function S(t) = prod_{t_i <= t} (1 - d_i / n_i)."""
        durations = np.asarray(durations, dtype=float)
        events = np.asarray(events, dtype=int)

        order = np.argsort(durations)
        t_sorted = durations[order]
        e_sorted = events[order]

        unique_times, idx = np.unique(t_sorted, return_index=True)
        n_times = len(unique_times)

        # Risk table
        n_at_risk = np.zeros(n_times, dtype=int)
        n_events = np.zeros(n_times, dtype=int)

        total_patients = len(durations)
        for i, t in enumerate(unique_times):
            at_risk = np.sum(durations >= t)
            num_ev = np.sum((durations == t) & (events == 1))
            n_at_risk[i] = at_risk
            n_events[i] = num_ev

        surv = 1.0
        greenwood_sum = 0.0
        surv_probs = []
        lower_bounds = []
        upper_bounds = []

        for i in range(n_times):
            ni = n_at_risk[i]
            di = n_events[i]
            if ni > 0:
                surv *= (1.0 - di / ni)
                if ni > di:
                    greenwood_sum += di / (ni * (ni - di))
            std_err = surv * math.sqrt(greenwood_sum)
            z = 1.96

            surv_probs.append(round(float(surv), 4))
            lower_bounds.append(round(float(max(0.0, surv - z * std_err)), 4))
            upper_bounds.append(round(float(min(1.0, surv + z * std_err)), 4))

        self.timeline = unique_times
        self.survival_probabilities = np.array(surv_probs)
        self.ci_lower = np.array(lower_bounds)
        self.ci_upper = np.array(upper_bounds)
        return self

    def predict_at_time(self, t: float) -> Tuple[float, float, float]:
        """Returns (survival_prob, lower_95, upper_95) at horizon t."""
        if len(self.timeline) == 0:
            return (1.0, 1.0, 1.0)
        idx = np.searchsorted(self.timeline, t, side="right") - 1
        if idx < 0:
            return (1.0, 1.0, 1.0)
        return (
            float(self.survival_probabilities[idx]),
            float(self.ci_lower[idx]),
            float(self.ci_upper[idx]),
        )


class CoxProportionalHazardsModel:
    """Semi-parametric Cox Proportional Hazards model: h(t|x) = h_0(t) * exp(beta^T x)."""

    def __init__(self, l2_reg: float = 0.1):
        self.l2_reg = l2_reg
        self.coefficients: np.ndarray = np.array([])
        self.feature_names: List[str] = []
        self.hazard_ratios: Dict[str, float] = {}

    def fit(self, X: np.ndarray, durations: np.ndarray, events: np.ndarray, feature_names: Optional[List[str]] = None) -> "CoxProportionalHazardsModel":
        """Fits beta weights using negative log partial likelihood."""
        X = np.asarray(X, dtype=float)
        durations = np.asarray(durations, dtype=float)
        events = np.asarray(events, dtype=int)
        n_samples, n_features = X.shape

        self.feature_names = feature_names or [f"Feature_{i}" for i in range(n_features)]

        # Sort descending by duration for efficient risk set calculation
        order = np.argsort(-durations)
        X_sort = X[order]
        e_sort = events[order]

        def neg_log_partial_likelihood(beta: np.ndarray) -> float:
            risk_scores = np.dot(X_sort, beta)  # shape (n,)
            # Clamping for stability
            risk_scores = np.clip(risk_scores, -30.0, 30.0)
            exp_scores = np.exp(risk_scores)
            cum_sum_risk = np.cumsum(exp_scores)

            log_lik = 0.0
            for i in range(n_samples):
                if e_sort[i] == 1:
                    log_lik += risk_scores[i] - np.log(max(cum_sum_risk[i], 1e-12))

            l2_penalty = 0.5 * self.l2_reg * np.sum(beta**2)
            return float(-log_lik + l2_penalty)

        init_beta = np.zeros(n_features, dtype=float)
        res = minimize(neg_log_partial_likelihood, init_beta, method="L-BFGS-B")
        self.coefficients = res.x

        self.hazard_ratios = {}
        for name, coef in zip(self.feature_names, self.coefficients):
            hr = float(np.exp(coef))
            self.hazard_ratios[name] = round(hr, 3)

        return self

    def predict_risk_score(self, X: np.ndarray) -> np.ndarray:
        """Returns relative log-hazard risk scores: beta^T x."""
        return np.dot(X, self.coefficients)

    def calculate_concordance_index(self, X: np.ndarray, durations: np.ndarray, events: np.ndarray) -> float:
        """Computes Harrell's C-Index."""
        risk_scores = self.predict_risk_score(X)
        n = len(durations)
        concordant = 0
        admissible = 0

        for i in range(n):
            for j in range(i + 1, n):
                if durations[i] != durations[j]:
                    # Determine which experienced event earlier
                    if durations[i] < durations[j] and events[i] == 1:
                        admissible += 1
                        if risk_scores[i] > risk_scores[j]:
                            concordant += 1
                        elif risk_scores[i] == risk_scores[j]:
                            concordant += 0.5
                    elif durations[j] < durations[i] and events[j] == 1:
                        admissible += 1
                        if risk_scores[j] > risk_scores[i]:
                            concordant += 1
                        elif risk_scores[j] == risk_scores[i]:
                            concordant += 0.5

        if admissible == 0:
            return 0.5
        return round(float(concordant / admissible), 4)
