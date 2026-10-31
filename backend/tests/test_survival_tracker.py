"""Automated Test Suite for Survival Models, Longitudinal Tracker & Unified Timeline.
"""
import pytest
import numpy as np
from app.core.survival_models import KaplanMeierEstimator, CoxProportionalHazardsModel
from app.core.longitudinal_tracker import LongitudinalTracker
from app.core.patient_timeline import build_unified_patient_timeline


def test_kaplan_meier_estimator():
    durations = np.array([5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0])
    events = np.array([1, 0, 1, 1, 0, 1, 0, 1])

    km = KaplanMeierEstimator()
    km.fit(durations, events)

    assert len(km.timeline) == 8
    assert len(km.survival_probabilities) == 8
    assert km.survival_probabilities[0] == 0.875  # 1 - 1/8
    assert km.survival_probabilities[-1] < 1.0

    s, low, high = km.predict_at_time(12.0)
    assert 0.0 <= s <= 1.0
    assert low <= s <= high


def test_cox_proportional_hazards_model():
    np.random.seed(42)
    X = np.random.randn(20, 2)
    durations = np.random.uniform(10.0, 100.0, 20)
    events = np.random.binomial(1, 0.6, 20)

    cox = CoxProportionalHazardsModel(l2_reg=0.1)
    cox.fit(X, durations, events, feature_names=["Age", "CellDose"])

    assert len(cox.coefficients) == 2
    assert "Age" in cox.hazard_ratios
    assert "CellDose" in cox.hazard_ratios
    assert cox.hazard_ratios["Age"] > 0.0

    c_index = cox.calculate_concordance_index(X, durations, events)
    assert 0.0 <= c_index <= 1.0


def test_longitudinal_tracker():
    tracker = LongitudinalTracker(graft_source="PBSC", cd34_dose=6.0, recipient_age=12.0)

    # 15 days of lab observations
    daily_obs = []
    for day in range(1, 16):
        if day < 5:
            anc = 1000.0 - day * 200.0
            plt = 80.0 - day * 15.0
        elif day < 12:
            anc = 50.0 + (day - 5) * 40.0
            plt = 15.0
        else:
            # Reconstitution
            anc = 520.0 + (day - 12) * 400.0
            plt = 25.0 + (day - 12) * 10.0

        daily_obs.append({
            "day": float(day),
            "anc": anc,
            "platelets": plt,
            "transfusion_given": False,
        })

    res = tracker.track_observations(daily_obs)

    assert "predictions" in res
    assert "actual_milestones" in res
    # Days 12, 13, 14 have ANC >= 500 -> engraftment achieved on Day 12
    assert res["actual_milestones"]["actual_anc_engraftment_day"] == 12.0
    assert "trajectory_error_metrics" in res
    assert res["trajectory_error_metrics"]["anc_mean_absolute_error_cells_ul"] >= 0.0


def test_unified_patient_timeline():
    timeline = build_unified_patient_timeline("PATIENT-TEST-001")
    assert timeline["patient_id"] == "PATIENT-TEST-001"
    assert timeline["total_milestones_recorded"] >= 8
    events = timeline["events"]
    # Check strict chronological order
    days = [e["day_relative"] for e in events]
    assert days == sorted(days)

