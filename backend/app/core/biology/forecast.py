"""Patient-specific neutrophil forecast: a particle filter over the calibrated granulopoiesis model.

Particles are drawn from the calibrated population distribution conditioned on the patient's graft
(CD34 dose, source, HLA mismatch), simulated on the GPU, and weighted by how well they reproduce the
patient's own post-infusion ANC draws (log-normal measurement error).
"""
from functools import lru_cache
from typing import Any, Dict, List, Optional

import numpy as np

from app.core.biology import granulopoiesis as g
from app.core.biology.calibrate import covariates, load_params
from app.core.datasets import uci_bmt

PARTICLES = 20000
MEASUREMENT_SD = (0.35, 0.5, 0.75, 1.0)   # log-scale; widened only if the draws are far from every particle
MIN_ESS = 200
DETECTION_FLOOR = 20.0                     # cells/µL; counts below this are not distinguished


@lru_cache(maxsize=1)
def _calibration() -> Dict[str, Any]:
    return load_params()


@lru_cache(maxsize=1)
def _cohort_reference() -> Dict[str, float]:
    df = uci_bmt.load_cohort()
    return {"median_cd34": float(df.cd34_dose.median()), "p90_recovery_day": float(df.anc_recovery_day.quantile(0.9))}


def _weighted_quantiles(values: np.ndarray, weights: np.ndarray, qs: List[float]) -> np.ndarray:
    """Quantiles of each column of `values` (particles × days) under particle weights."""
    order = np.argsort(values, axis=0)
    sorted_vals = np.take_along_axis(values, order, axis=0)
    cum = np.cumsum(weights[order], axis=0)
    return np.stack([sorted_vals[np.argmax(cum >= q, axis=0), np.arange(values.shape[1])] for q in qs])


def forecast(pretransplant: Dict[str, Any], anc_draws: List[Dict[str, float]], seed: int = 0) -> Dict[str, Any]:
    """`anc_draws`: [{"day": int, "value": float}] post-infusion neutrophil counts (cells/µL)."""
    cal = _calibration()
    params = cal["params"]
    cov = covariates({
        "cd34_dose": pretransplant.get("cd34_dose") or _cohort_reference()["median_cd34"],
        "stem_cell_source": pretransplant.get("stem_cell_source"),
        "hla_match": pretransplant.get("hla_match"),
    })
    z = np.random.default_rng(seed).standard_normal((PARTICLES, 3))
    mtt, gamma, seed_cells = g.particle_parameters(params, cov, z)
    anc = g.to_numpy(g.simulate(mtt, gamma, seed_cells))          # particles × (horizon+1)
    days_engrafted = g.to_numpy(g.engraftment_day(anc))
    horizon = anc.shape[1] - 1

    draws = [d for d in anc_draws if 0 < d["day"] <= horizon]
    weights = np.full(PARTICLES, 1.0 / PARTICLES)
    sd_used = None
    if draws:
        idx = np.array([d["day"] for d in draws], dtype=int)
        obs = np.log(np.maximum([d["value"] for d in draws], DETECTION_FLOOR))
        sim = np.log(np.maximum(anc[:, idx], DETECTION_FLOOR))
        sq = ((sim - obs) ** 2).sum(axis=1)
        for sd in MEASUREMENT_SD:
            logw = -sq / (2 * sd ** 2)
            w = np.exp(logw - logw.max())
            w /= w.sum()
            sd_used = sd
            if 1.0 / np.sum(w ** 2) >= MIN_ESS:
                break
        weights = w

    bands = _weighted_quantiles(anc, weights, [0.025, 0.10, 0.5, 0.90, 0.975])
    finite = np.isfinite(days_engrafted)
    p_by = {d: round(float(weights[finite & (days_engrafted <= d)].sum()), 4) for d in (14, 21, 28)}
    order = np.argsort(np.where(finite, days_engrafted, np.inf))
    cum = np.cumsum(weights[order])
    median_day = float(np.where(finite, days_engrafted, np.inf)[order][np.argmax(cum >= 0.5)])
    lo80 = float(np.where(finite, days_engrafted, np.inf)[order][np.argmax(cum >= 0.10)])
    hi80 = float(np.where(finite, days_engrafted, np.inf)[order][np.argmax(cum >= 0.90)])
    cohort_p90 = _cohort_reference()["p90_recovery_day"]
    return {
        "days": list(range(horizon + 1)),
        "median": bands[2].round(1).tolist(),
        "lower_80": bands[1].round(1).tolist(),
        "upper_80": bands[3].round(1).tolist(),
        "lower_95": bands[0].round(1).tolist(),
        "upper_95": bands[4].round(1).tolist(),
        "probability_engrafted_by": p_by,
        "median_engraftment_day": None if not np.isfinite(median_day) else median_day,
        "engraftment_day_80": [lo80 if np.isfinite(lo80) else None, hi80 if np.isfinite(hi80) else None],
        "delayed_engraftment_risk": bool(p_by[28] < 0.5 or (np.isfinite(median_day) and median_day > cohort_p90)),
        "draws_used": len(draws),
        "effective_sample_size": round(float(1.0 / np.sum(weights ** 2)), 1),
        "measurement_sd": sd_used,
        "particles": PARTICLES,
        "device": "GPU (CUDA)" if g.ON_GPU else "CPU",
        "calibration": {
            "n_patients": cal["n_patients"],
            "holdout_coverage_80": cal["holdout_validation"]["coverage_80"],
            "holdout_coverage_95": cal["holdout_validation"]["coverage_95"],
        },
    }
