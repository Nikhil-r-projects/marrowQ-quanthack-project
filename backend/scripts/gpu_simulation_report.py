"""Runs the GPU simulations on this machine and writes the measured results to results/gpu_simulation_report.{json,md}.

  cd backend && python scripts/gpu_simulation_report.py

Covers: device info, granulopoiesis kernel throughput (GPU vs CPU) and accuracy vs the FP64 reference,
held-out calibration coverage on the UCI cohort, particle-filter forecasts for real cohort patients, and the
Qiskit Aer statevector benchmark (GPU vs CPU).
"""
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.biology import calibrate, granulopoiesis as g  # noqa: E402
from app.core.biology.forecast import forecast  # noqa: E402
from app.core.compute import detect_capabilities, statevector_benchmark  # noqa: E402
from app.core.datasets import uci_bmt  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "results"


def _timed(fn, repeats=3):
    fn()  # warm-up (kernel compile, allocations)
    best = float("inf")
    for _ in range(repeats):
        t0 = time.perf_counter()
        out = fn()
        if g.ON_GPU:
            g.xp.cuda.Device().synchronize()
        best = min(best, time.perf_counter() - t0)
    return best, out


def device_info():
    info = {"python": platform.python_version(), "platform": platform.platform(), "cupy_gpu": g.ON_GPU}
    if g.ON_GPU:
        props = g.xp.cuda.runtime.getDeviceProperties(0)
        free, total = g.xp.cuda.runtime.memGetInfo()
        info.update({"gpu": props["name"].decode(), "gpu_memory_gb": round(total / 1e9, 2),
                     "gpu_memory_free_gb": round(free / 1e9, 2),
                     "cuda_runtime": g.xp.cuda.runtime.runtimeGetVersion(), "cupy": g.xp.__version__})
    return info


def kernel_benchmark():
    params = calibrate.load_params()["params"]
    rows = []
    for n in (1_000, 10_000, 100_000, 1_000_000):
        z = np.random.default_rng(1).standard_normal((n, 3))
        m, gm, sd = g.particle_parameters(params, {"cd34_dose": 5.0, "peripheral_blood": 1, "hla_mismatched_loci": 0}, z)
        gpu_s, anc = _timed(lambda: g.simulate(m, gm, sd))
        days = g.to_numpy(g.engraftment_day(anc))
        row = {"particles": n, "gpu_seconds": round(gpu_s, 4), "particles_per_second": round(n / gpu_s),
               "median_engraftment_day": float(np.median(days[np.isfinite(days)])) if np.isfinite(days).any() else None}
        if n <= 10_000:  # FP64 NumPy reference on the CPU (slow, so only for the small sizes)
            mc, gc, sc = (g.to_numpy(v) for v in (m, gm, sd))
            t0 = time.perf_counter()
            ref = _cpu_reference(mc, gc, sc)
            row["cpu_fp64_seconds"] = round(time.perf_counter() - t0, 3)
            row["speedup_vs_cpu"] = round(row["cpu_fp64_seconds"] / gpu_s, 1)
            row["max_relative_error_vs_fp64"] = float(np.max(np.abs(g.to_numpy(anc) - ref) / np.maximum(ref, 1.0)))
        rows.append(row)
        print(f"  {n:>9,} particles: {gpu_s:.4f}s", flush=True)
    return rows


def _cpu_reference(m, gm, sd):
    xp, g.xp = g.xp, np
    try:
        return np.asarray(g.simulate_reference(m, gm, sd))
    finally:
        g.xp = xp


def calibration_check():
    from sklearn.model_selection import train_test_split
    saved = calibrate.load_params()
    cohort = uci_bmt.load_cohort()
    _, test = train_test_split(cohort, test_size=0.2, random_state=42, stratify=cohort["early_engraftment"])
    t0 = time.perf_counter()
    validation = calibrate.validate(saved["params"], test.reset_index(drop=True))
    return {"saved_fit": {k: saved[k] for k in ("holdout_validation", "fit_seconds", "device", "n_patients", "neg_log_likelihood")},
            "recheck_on_holdout_with_full_fit_params": validation, "seconds": round(time.perf_counter() - t0, 3)}


def patient_forecasts(k=8):
    cohort = uci_bmt.load_cohort()
    rec = cohort[cohort["anc_recovery_day"].notna()].sample(k, random_state=3)
    out = []
    for _, row in rec.iterrows():
        pre = {f: (None if (isinstance(row[f], float) and np.isnan(row[f])) else row[f]) for f in uci_bmt.CORE_FEATURES if f in row}
        t0 = time.perf_counter()
        fc = forecast(pre, [])
        out.append({"observed_recovery_day": float(row["anc_recovery_day"]),
                    "forecast_median_day": fc["median_engraftment_day"], "interval_80": fc["engraftment_day_80"],
                    "p_by_day": fc["probability_engrafted_by"], "particles": fc["particles"], "device": fc["device"],
                    "seconds": round(time.perf_counter() - t0, 3)})
    return out


def main():
    started = time.perf_counter()
    report = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "device": device_info()}
    print("granulopoiesis kernel", flush=True)
    report["granulopoiesis_kernel"] = kernel_benchmark()
    print("calibration", flush=True)
    report["calibration"] = calibration_check()
    print("forecasts", flush=True)
    report["patient_forecasts"] = patient_forecasts()
    print("aer statevector", flush=True)
    caps = detect_capabilities()
    report["qiskit_aer"] = {"capabilities": caps, "statevector": [
        statevector_benchmark(q, [d for d in ("GPU", "CPU") if d in caps["aer_devices"]], lambda f, m: None)
        for q in (16, 20, 24)]}
    report["total_seconds"] = round(time.perf_counter() - started, 1)

    OUT.mkdir(exist_ok=True)
    (OUT / "gpu_simulation_report.json").write_text(json.dumps(report, indent=2, default=str))
    (OUT / "gpu_simulation_report.md").write_text(to_markdown(report), encoding="utf-8")
    print(f"written {OUT / 'gpu_simulation_report.json'}")


def to_markdown(r):
    d = r["device"]
    lines = [f"# GPU simulation report ({r['generated_at']})", "",
             f"Device: {d.get('gpu', 'CPU only')} · {d.get('gpu_memory_gb', '–')} GB · CuPy {d.get('cupy', '–')} · Python {d['python']}", "",
             "## Granulopoiesis model (fused CUDA RK4 kernel, FP32)", "",
             "| Particles | GPU s | Particles/s | CPU FP64 s | Speed-up | Max rel. error | Median engraftment day |", "|---|---|---|---|---|---|---|"]
    for k in r["granulopoiesis_kernel"]:
        err = f"{k['max_relative_error_vs_fp64']:.1e}" if "max_relative_error_vs_fp64" in k else "–"
        lines.append(f"| {k['particles']:,} | {k['gpu_seconds']} | {k['particles_per_second']:,} | {k.get('cpu_fp64_seconds', '–')} | "
                     f"{k.get('speedup_vs_cpu', '–')} | {err} | {k['median_engraftment_day']} |")
    v = r["calibration"]["saved_fit"]["holdout_validation"]
    lines += ["", "## Calibration to the UCI cohort (held-out 20%)", "",
              f"80% interval coverage {v['coverage_80']:.0%}, 95% coverage {v['coverage_95']:.0%}, "
              f"median absolute error {v['median_abs_error_days']} days (cohort-median baseline {v['baseline_median_abs_error_days']}).", "",
              "## Forecasts for cohort patients (pre-transplant data only)", "",
              "| Observed day | Forecast median | 80% interval | P(≤14) | P(≤21) | P(≤28) | s |", "|---|---|---|---|---|---|---|"]
    for f in r["patient_forecasts"]:
        p = f["p_by_day"]
        lines.append(f"| {f['observed_recovery_day']:g} | {f['forecast_median_day']} | {f['interval_80']} | "
                     f"{p[14]:.0%} | {p[21]:.0%} | {p[28]:.0%} | {f['seconds']} |")
    lines += ["", "## Qiskit Aer statevector, ZZ feature map (GPU vs CPU)", "",
              "| Qubits | Amplitudes | GPU s | CPU s | Speed-up | Max amplitude difference |", "|---|---|---|---|---|---|"]
    for b in r["qiskit_aer"]["statevector"]:
        s = b["seconds"]
        lines.append(f"| {b['n_qubits']} | {b['amplitudes']:,} | {s.get('GPU', '–')} | {s.get('CPU', '–')} | "
                     f"{b.get('speedup_gpu_vs_cpu', '–')} | {b.get('max_amplitude_difference_gpu_cpu', float('nan')):.1e} |")
    lines += ["", f"Total run time {r['total_seconds']} s."]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    main()
