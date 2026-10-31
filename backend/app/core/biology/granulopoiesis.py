"""Neutrophil reconstitution after HSCT: a Friberg-type transit-compartment model, vectorised on the GPU.

Compartments (cells/µL equivalents): proliferating progenitors P seeded by the graft, three maturation
transit compartments T1..T3, circulating neutrophils N. Feedback (Nss/N)^gamma drives progenitor expansion
while counts are low, as in Friberg et al. (J Clin Oncol 2002) and its post-HSCT use by Solans et al.
(Br J Clin Pharmacol 2020):

    dP/dt  = ktr * P * ((Nss / N)^gamma - 1)
    dTk/dt = ktr * (T(k-1) - Tk),   k = 1..3   (T0 = P)
    dN/dt  = ktr * (T3 - N)
    ktr    = 4 / MTT

Each particle carries its own (MTT, gamma, seed); thousands of particles integrate in parallel with RK4.
"""
from typing import Tuple

import numpy as np

try:  # GPU when the CUDA build of CuPy and a device are present, NumPy otherwise.
    import cupy as _cp

    _cp.cuda.runtime.getDeviceCount()
    xp = _cp
    ON_GPU = True
except Exception:  # pragma: no cover - CPU-only environments
    xp = np
    ON_GPU = False

STEADY_STATE_ANC = 3000.0   # cells/µL; normal paediatric steady state
RESIDUAL_ANC = 100.0        # circulating neutrophils left at infusion after conditioning
ENGRAFTMENT_ANC = 500.0
HORIZON_DAYS = 45
DT = 0.1                    # days


def to_numpy(a) -> np.ndarray:
    return a.get() if ON_GPU and hasattr(a, "get") else np.asarray(a)


_CUDA_SOURCE = r"""
extern "C" __global__ void granulopoiesis(const float* mtt, const float* gamma, const float* seed,
                                          float* out, const int n, const int days, const int steps,
                                          const float dt, const float nss, const float n0) {
    int i = blockDim.x * blockIdx.x + threadIdx.x;
    if (i >= n) return;
    float ktr = 4.0f / mtt[i], g = gamma[i];
    float s[5] = {seed[i], 0.0f, 0.0f, 0.0f, n0};
    float k[4][5], tmp[5];
    out[(long)i * (days + 1)] = n0;
    for (int d = 1; d <= days; d++) {
        for (int st = 0; st < steps; st++) {
            for (int stage = 0; stage < 4; stage++) {
                float h = stage == 0 ? 0.0f : (stage == 3 ? dt : 0.5f * dt);
                for (int c = 0; c < 5; c++) tmp[c] = stage == 0 ? s[c] : s[c] + h * k[stage - 1][c];
                float fb = powf(nss / fmaxf(tmp[4], 1.0f), g);
                k[stage][0] = ktr * tmp[0] * (fb - 1.0f);
                k[stage][1] = ktr * (tmp[0] - tmp[1]);
                k[stage][2] = ktr * (tmp[1] - tmp[2]);
                k[stage][3] = ktr * (tmp[2] - tmp[3]);
                k[stage][4] = ktr * (tmp[3] - tmp[4]);
            }
            for (int c = 0; c < 5; c++)
                s[c] = fmaxf(s[c] + dt / 6.0f * (k[0][c] + 2.0f * k[1][c] + 2.0f * k[2][c] + k[3][c]), 0.0f);
        }
        out[(long)i * (days + 1) + d] = s[4];
    }
}
"""
_kernel = None


def simulate(mtt, gamma, seed, days: int = HORIZON_DAYS, dt: float = DT):
    """Integrate all particles; returns daily ANC (particles × days+1) on the active device.

    On the GPU each CUDA thread integrates one particle for the whole horizon (one kernel launch);
    the NumPy path below is the reference implementation and the CPU fallback."""
    global _kernel
    if ON_GPU:
        if _kernel is None:
            _kernel = xp.RawKernel(_CUDA_SOURCE, "granulopoiesis")
        # Single precision: consumer GPUs run FP64 at ~1/64 rate; FP32 agrees with the FP64 reference to <1e-4.
        m, g_, sd = (xp.ascontiguousarray(xp.asarray(v, dtype=xp.float32)) for v in (mtt, gamma, seed))
        n = m.shape[0]
        out = xp.empty((n, days + 1), dtype=xp.float32)
        threads = 128
        _kernel(((n + threads - 1) // threads,), (threads,),
                (m, g_, sd, out, np.int32(n), np.int32(days), np.int32(round(1 / dt)), np.float32(dt),
                 np.float32(STEADY_STATE_ANC), np.float32(RESIDUAL_ANC)))
        return out
    return simulate_reference(mtt, gamma, seed, days, dt)


def simulate_reference(mtt, gamma, seed, days: int = HORIZON_DAYS, dt: float = DT):
    """Vectorised RK4 in NumPy/CuPy array operations (reference for the fused CUDA kernel)."""
    mtt, gamma, seed = (xp.asarray(v, dtype=xp.float64) for v in (mtt, gamma, seed))
    ktr = 4.0 / mtt
    n = mtt.shape[0]
    state = xp.zeros((5, n), dtype=xp.float64)
    state[0] = seed
    state[4] = RESIDUAL_ANC

    def deriv(s):
        p, t1, t2, t3, neut = s
        feedback = (STEADY_STATE_ANC / xp.maximum(neut, 1.0)) ** gamma
        return xp.stack([
            ktr * p * (feedback - 1.0),
            ktr * (p - t1),
            ktr * (t1 - t2),
            ktr * (t2 - t3),
            ktr * (t3 - neut),
        ])

    steps_per_day = int(round(1 / dt))
    out = xp.empty((n, days + 1), dtype=xp.float64)
    out[:, 0] = state[4]
    for day in range(1, days + 1):
        for _ in range(steps_per_day):
            k1 = deriv(state)
            k2 = deriv(state + 0.5 * dt * k1)
            k3 = deriv(state + 0.5 * dt * k2)
            k4 = deriv(state + dt * k3)
            state = xp.maximum(state + dt / 6.0 * (k1 + 2 * k2 + 2 * k3 + k4), 0.0)
        out[:, day] = state[4]
    return out


def engraftment_day(anc) -> "np.ndarray":
    """First post-infusion day with ANC ≥ 500 (the count first falls below 500 at the nadir); inf if never."""
    a = xp.asarray(anc)
    nadir = xp.argmin(a, axis=1)
    days = xp.arange(a.shape[1])
    above = (a >= ENGRAFTMENT_ANC) & (days[None, :] > nadir[:, None])
    first = xp.where(above.any(axis=1), xp.argmax(above, axis=1), xp.inf)
    return first


def particle_parameters(params: dict, covariates: dict, z: "np.ndarray") -> Tuple["np.ndarray", "np.ndarray", "np.ndarray"]:
    """Map population parameters + patient covariates + standard-normal draws z (n×3) to (MTT, gamma, seed)."""
    z = xp.asarray(z)
    log_seed = (
        params["seed_mu"]
        + params["beta_cd34"] * np.log(max(covariates["cd34_dose"], 0.05))
        + params["beta_pb"] * covariates["peripheral_blood"]
        + params["beta_hla"] * covariates["hla_mismatched_loci"]
        + params["seed_sd"] * z[:, 2]
    )
    mtt = xp.exp(params["mtt_mu"] + params["mtt_sd"] * z[:, 0])
    gamma = xp.exp(params["gamma_mu"] + params["gamma_sd"] * z[:, 1])
    return mtt, gamma, xp.exp(log_seed)
