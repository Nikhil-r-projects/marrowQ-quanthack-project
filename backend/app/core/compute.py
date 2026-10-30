"""What this machine can compute on: CUDA through PyTorch and Qiskit Aer, plus a statevector benchmark."""
import math
import platform
import time
from typing import Any, Callable, Dict

import numpy as np


def detect_capabilities() -> Dict[str, Any]:
    caps: Dict[str, Any] = {"python": platform.python_version(), "platform": platform.platform(), "torch_cuda": False, "aer_devices": []}
    try:
        import torch

        caps["torch"] = torch.__version__
        if torch.cuda.is_available():
            free, total = torch.cuda.mem_get_info()
            caps.update(
                torch_cuda=True,
                gpu_name=torch.cuda.get_device_name(0),
                gpu_memory_total_mb=round(total / 2**20),
                gpu_memory_free_mb=round(free / 2**20),
                # A double-precision statevector needs 16 bytes per amplitude.
                max_statevector_qubits=int(math.log2(free / 16)),
            )
    except ImportError:
        caps["torch"] = None
    try:
        from qiskit_aer import AerSimulator
        import qiskit_aer

        caps["qiskit_aer"] = qiskit_aer.__version__
        caps["aer_devices"] = list(AerSimulator().available_devices())
    except ImportError:
        caps["qiskit_aer"] = None
    return caps


def statevector_benchmark(n_qubits: int, devices: list, progress: Callable[[float, str], None]) -> Dict[str, Any]:
    """Time one ZZ-feature-map statevector simulation per device (the circuit family the kernel engine uses)."""
    from qiskit import transpile
    from qiskit.circuit.library import zz_feature_map
    from qiskit_aer import AerSimulator

    rng = np.random.default_rng(7)
    circuit = zz_feature_map(n_qubits, reps=2, entanglement="linear")
    circuit = circuit.assign_parameters(rng.uniform(0, 2 * np.pi, circuit.num_parameters))
    circuit.save_statevector()

    timings: Dict[str, Any] = {}
    states = {}
    for i, device in enumerate(devices):
        progress(i / len(devices), f"Simulating {n_qubits} qubits on {device}")
        sim = AerSimulator(method="statevector", device=device)
        compiled = transpile(circuit, sim)
        sim.run(compiled).result()  # warm-up: CUDA context creation and kernel loading
        start = time.perf_counter()
        result = sim.run(compiled).result()
        timings[device] = round(time.perf_counter() - start, 4)
        states[device] = np.asarray(result.get_statevector())

    agreement = None
    if "GPU" in states and "CPU" in states:
        agreement = float(np.max(np.abs(states["GPU"] - states["CPU"])))
    return {
        "n_qubits": n_qubits,
        "amplitudes": 2**n_qubits,
        "seconds": timings,
        "speedup_gpu_vs_cpu": round(timings["CPU"] / timings["GPU"], 2) if {"CPU", "GPU"} <= timings.keys() else None,
        "max_amplitude_difference_gpu_cpu": agreement,
    }
