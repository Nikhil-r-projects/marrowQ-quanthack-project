"""Tests for IBM Quantum budget guard and refusal logic."""
import os
import numpy as np
import pytest

from app.core.ibm_quantum import quantum_manager, BudgetExceededError


def test_estimate_qpu_seconds():
    # 10 circuits, 1000 shots: overhead 5s + 10 * 1000 * 0.00025 = 7.5s (calibrated on a measured ibm_kingston run)
    est = quantum_manager.estimate_qpu_seconds(total_circuits=10, shots=1000)
    assert est == pytest.approx(7.5, rel=1e-2)

    # 500 circuits, 8192 shots: 5.0 + 500 * 8192 * 0.00025 = 1029s
    large_est = quantum_manager.estimate_qpu_seconds(total_circuits=500, shots=8192)
    assert large_est > 600.0


def test_budget_refusal_guard(monkeypatch):
    # Set maximum budget to 10 seconds for testing
    monkeypatch.setenv("IBM_MAX_SECONDS_PER_RUN", "10.0")

    X_train = np.random.uniform(0, np.pi, size=(20, 4))
    X_test = np.random.uniform(0, np.pi, size=(5, 4))

    # With 20 samples, number of upper-triangular pairs is 190, plus test pairs
    # Total circuits ~ 250, with 1024 shots => estimated ~ 43s > 10s budget
    with pytest.raises(BudgetExceededError) as exc_info:
        quantum_manager.execute_kernel_matrices(
            X_train=X_train,
            X_test=X_test,
            backend_name="ibm_fez",
            execution_mode="hardware",
            shots=1024,
            max_hardware_samples=20,
        )

    assert "BudgetRefusal" in str(exc_info.value)
    assert "exceeds maximum allowed budget" in str(exc_info.value)

