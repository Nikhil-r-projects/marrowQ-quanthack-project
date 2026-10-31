"""Quantum computing engine and QSVM modules for MarrowQ."""
from app.core.quantum.legacy import (
    train_quantum_kernel_svm,
    simulate_quantum_circuit_and_state,
    run_quantum_pipeline_experiment,
    QISKIT_AVAILABLE,
    QISKIT_VERSION,
)
from app.core.quantum.kernel_engine import GPUQuantumKernelEngine
from app.core.quantum.diagnostics import (
    kernel_off_diagonal_variance,
    kernel_target_alignment,
    geometric_difference,
    compute_kernel_diagnostics,
)
from app.core.quantum.qsvm_cv import evaluate_qsvm_cv, run_qubit_sweep
from app.core.quantum.noisy_simulation import HeronNoisySimulator, compare_ideal_vs_noisy

__all__ = [
    "train_quantum_kernel_svm",
    "simulate_quantum_circuit_and_state",
    "run_quantum_pipeline_experiment",
    "QISKIT_AVAILABLE",
    "QISKIT_VERSION",
    "GPUQuantumKernelEngine",
    "HeronNoisySimulator",
    "compare_ideal_vs_noisy",
    "kernel_off_diagonal_variance",
    "kernel_target_alignment",
    "geometric_difference",
    "compute_kernel_diagnostics",
    "evaluate_qsvm_cv",
    "run_qubit_sweep",
]
