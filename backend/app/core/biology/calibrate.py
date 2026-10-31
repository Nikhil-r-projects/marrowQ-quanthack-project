"""Fit the population parameters of the granulopoiesis model to the UCI cohort's recovery days.

Simulated maximum likelihood with common random numbers: every patient gets the same fixed standard-normal
draws, so the objective is smooth in the parameters and Nelder–Mead converges. Recovery days enter through a
Gaussian-kernel density of the simulated engraftment days; the five recipients who never recovered contribute
P(engraftment later than their follow-up).
"""
import json
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from sklearn.model_selection import train_test_split

from app.core.biology import granulopoiesis as g
from app.core.datasets import uci_bmt

PARAMS_PATH = Path(__file__).with_name("calibrated_params.json")
PARAM_NAMES = ["mtt_mu", "log_mtt_sd", "gamma_mu", "log_gamma_sd", "seed_mu", "beta_cd34", "beta_pb", "beta_hla", "log_seed_sd"]
# Weak literature priors (Friberg 2002; Solans 2020): neutrophil MTT ≈ 5.2 days, feedback gamma ≈ 0.2.
PRIORS = {"mtt_mu": (np.log(5.2), 0.3), "gamma_mu": (np.log(0.2), 0.5)}
START = np.array([np.log(5.2), np.log(0.2), np.log(0.2), np.log(0.3), np.log(1.0), 0.5, 0.0, 0.0, np.log(0.5)])
CENSOR_CAP = 40.0
BANDWIDTH = 1.0


def covariates(row) -> Dict[str, float]:
    loci = {"10/10": 0, "9/10": 1, "8/10": 2, "7/10": 3}.get(row.get("hla_match"), 0)
    return {
        "cd34_dose": float(row["cd34_dose"]),
        "peripheral_blood": 1.0 if row.get("stem_cell_source") == "Peripheral blood" else 0.0,
        "hla_mismatched_loci": float(loci),
    }


def unpack(theta: np.ndarray) -> Dict[str, float]:
    p = dict(zip(PARAM_NAMES, map(float, theta)))
    return {
        "mtt_mu": p["mtt_mu"], "mtt_sd": float(np.exp(p["log_mtt_sd"])),
        "gamma_mu": p["gamma_mu"], "gamma_sd": float(np.exp(p["log_gamma_sd"])),
        "seed_mu": p["seed_mu"], "beta_cd34": p["beta_cd34"], "beta_pb": p["beta_pb"], "beta_hla": p["beta_hla"],
        "seed_sd": float(np.exp(p["log_seed_sd"])),
    }


def covariate_matrix(cohort: pd.DataFrame) -> np.ndarray:
    """(patients × 3): log CD34 dose, peripheral-blood graft, mismatched HLA loci."""
    rows = [covariates(r) for _, r in cohort.iterrows()]
    return np.array([[np.log(max(c["cd34_dose"], 0.05)), c["peripheral_blood"], c["hla_mismatched_loci"]] for c in rows])


def particle_arrays(params: Dict[str, float], cov: np.ndarray, z: np.ndarray):
    """Broadcast population parameters over patients × particles; returns flat (MTT, gamma, seed)."""
    log_seed = (params["seed_mu"] + params["beta_cd34"] * cov[:, :1] + params["beta_pb"] * cov[:, 1:2]
                + params["beta_hla"] * cov[:, 2:3] + params["seed_sd"] * z[None, :, 2])
    shape = log_seed.shape
    mtt = np.broadcast_to(np.exp(params["mtt_mu"] + params["mtt_sd"] * z[None, :, 0]), shape)
    gamma = np.broadcast_to(np.exp(params["gamma_mu"] + params["gamma_sd"] * z[None, :, 1]), shape)
    return mtt.ravel(), gamma.ravel(), np.exp(log_seed).ravel()


def simulate_days(params: Dict[str, float], cohort: pd.DataFrame, z: np.ndarray, cov: Optional[np.ndarray] = None) -> np.ndarray:
    """Simulated engraftment days, shape (patients, particles), one GPU batch for the whole cohort."""
    cov = covariate_matrix(cohort) if cov is None else cov
    anc = g.simulate(*particle_arrays(params, cov, z), days=int(CENSOR_CAP) + 5)
    return g.to_numpy(g.engraftment_day(anc)).reshape(len(cov), z.shape[0])


def log_likelihood(days: np.ndarray, cohort: pd.DataFrame) -> np.ndarray:
    observed = cohort["anc_recovery_day"].to_numpy()
    censor_at = np.minimum(cohort["follow_up_days"].to_numpy(), CENSOR_CAP)
    finite = np.isfinite(days)
    diff = np.where(finite, days - np.nan_to_num(observed)[:, None], np.inf)
    dens = np.exp(-0.5 * (diff / BANDWIDTH) ** 2).sum(axis=1) / (days.shape[1] * BANDWIDTH * np.sqrt(2 * np.pi))
    later = (days > censor_at[:, None]).mean(axis=1)
    return np.where(np.isnan(observed), np.log(later + 1e-4), np.log(dens + 1e-6))


def fit(cohort: pd.DataFrame, particles: int = 1000, seed: int = 7, max_iter: int = 2000, progress: Optional[Callable[[float, str], None]] = None):
    z = np.random.default_rng(seed).standard_normal((particles, 3))
    cov = covariate_matrix(cohort)
    calls = {"n": 0}

    def objective(theta):
        calls["n"] += 1
        params = unpack(theta)
        prior = sum(((params[k] - mu) / sd) ** 2 / 2 for k, (mu, sd) in PRIORS.items())
        value = -log_likelihood(simulate_days(params, cohort, z, cov), cohort).sum() + prior
        if progress and calls["n"] % 10 == 0:
            progress(min(calls["n"] / max_iter, 0.99), f"Calibration step {calls['n']}: −log L {value:.1f}")
        return value

    # Nelder–Mead stalls in 9 dimensions; restart it from its own optimum, then polish with Powell.
    x = START
    for _ in range(3):
        x = minimize(objective, x, method="Nelder-Mead", options={"maxfev": max_iter, "xatol": 1e-4, "fatol": 1e-3, "adaptive": True}).x
    result = minimize(objective, x, method="Powell", options={"maxfev": max_iter, "xtol": 1e-4, "ftol": 1e-5})
    return unpack(result.x), float(result.fun), calls["n"]


def predictive_days(params: Dict[str, float], cohort: pd.DataFrame, particles: int = 2000, seed: int = 99) -> np.ndarray:
    z = np.random.default_rng(seed).standard_normal((particles, 3))
    return simulate_days(params, cohort, z)


def validate(params: Dict[str, float], cohort: pd.DataFrame) -> Dict[str, float]:
    """Coverage of held-out recovery days by predictive intervals, and error of the predicted median day."""
    days = predictive_days(params, cohort)
    obs = cohort["anc_recovery_day"].to_numpy()
    rec = ~np.isnan(obs)
    lo80, hi80 = np.nanpercentile(np.where(np.isfinite(days), days, np.nan), [10, 90], axis=1)
    lo95, hi95 = np.nanpercentile(np.where(np.isfinite(days), days, np.nan), [2.5, 97.5], axis=1)
    med = np.nanmedian(np.where(np.isfinite(days), days, np.nan), axis=1)
    return {
        "n": int(rec.sum()),
        "coverage_80": round(float(np.mean((obs[rec] >= lo80[rec]) & (obs[rec] <= hi80[rec]))), 3),
        "coverage_95": round(float(np.mean((obs[rec] >= lo95[rec]) & (obs[rec] <= hi95[rec]))), 3),
        "median_abs_error_days": round(float(np.median(np.abs(med[rec] - obs[rec]))), 2),
        "baseline_median_abs_error_days": round(float(np.median(np.abs(np.median(obs[rec]) - obs[rec]))), 2),
    }


def run(progress: Optional[Callable[[float, str], None]] = None) -> Dict:
    cohort = uci_bmt.load_cohort()
    train, test = train_test_split(cohort, test_size=0.2, random_state=42, stratify=cohort["early_engraftment"])
    t0 = time.perf_counter()
    held_params, _, _ = fit(train.reset_index(drop=True), progress=progress)
    validation = validate(held_params, test.reset_index(drop=True))
    params, nll, evals = fit(cohort, progress=progress)
    result = {
        "params": params,
        "neg_log_likelihood": round(nll, 2),
        "objective_evaluations": evals,
        "holdout_validation": validation,
        "fit_seconds": round(time.perf_counter() - t0, 1),
        "device": "GPU (CuPy)" if g.ON_GPU else "CPU (NumPy)",
        "n_patients": int(len(cohort)),
    }
    PARAMS_PATH.write_text(json.dumps(result, indent=2))
    return result


def load_params() -> Dict:
    return json.loads(PARAMS_PATH.read_text())


if __name__ == "__main__":
    print(json.dumps(run(lambda f, m: print(f"{f:.0%} {m}", flush=True)), indent=2))
