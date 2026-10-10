import numpy as np
import pandas as pd
from typing import Optional

def generate_hsct_synthetic_dataset(n_samples: int = 500, random_state: int = 42) -> pd.DataFrame:
    """
    Generates a clinically grounded, synthetic hematopoietic stem cell transplant (HSCT)
    dataset designed for demonstrating recovery prediction pipelines.
    
    WARNING:
    SYNTHETIC DEMONSTRATION DATA — NOT CLINICAL EVIDENCE. STRICTLY FOR PIPELINE VALIDATION.
    """
    rng = np.random.default_rng(random_state)
    
    patient_ids = [f"PT-{1000 + i}" for i in range(n_samples)]
    
    # Recipient features
    recipient_age = rng.integers(18, 75, size=n_samples)
    recipient_gender = rng.choice(["M", "F"], size=n_samples, p=[0.55, 0.45])
    recipient_kps = rng.choice([60, 70, 80, 90, 100], size=n_samples, p=[0.05, 0.15, 0.35, 0.30, 0.15])
    recipient_cmv = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.60, 0.40])
    comorbidity_index = rng.choice([0, 1, 2, 3, 4], size=n_samples, p=[0.35, 0.30, 0.20, 0.10, 0.05])
    
    # Disease & Conditioning
    primary_disease = rng.choice(
        ["AML", "ALL", "MDS", "Lymphoma", "MPN"], 
        size=n_samples, 
        p=[0.40, 0.25, 0.15, 0.12, 0.08]
    )
    disease_status = rng.choice(
        ["CR1", "CR2+", "Active_Disease"],
        size=n_samples,
        p=[0.55, 0.30, 0.15]
    )
    conditioning_intensity = rng.choice(
        ["MAC", "RIC", "NMA"],
        size=n_samples,
        p=[0.50, 0.40, 0.10]
    )
    
    # Donor & Graft
    donor_age = rng.integers(18, 55, size=n_samples)
    donor_gender = rng.choice(["M", "F"], size=n_samples, p=[0.60, 0.40])
    donor_cmv = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.50, 0.50])
    graft_source = rng.choice(
        ["PBSC", "Bone_Marrow", "Cord_Blood"],
        size=n_samples,
        p=[0.70, 0.20, 0.10]
    )
    donor_type = rng.choice(
        ["Matched_Sibling", "MUD", "MMUD", "Haploidentical"],
        size=n_samples,
        p=[0.35, 0.40, 0.15, 0.10]
    )
    hla_match_score = rng.choice([8, 7, 6], size=n_samples, p=[0.75, 0.20, 0.05])
    
    # CD34+ cell dose (x10^6 / kg) - strongly associated with engraftment speed
    # PBSC typically has higher CD34 dose than Bone Marrow or Cord Blood
    base_cd34 = rng.lognormal(mean=1.5, sigma=0.4, size=n_samples)
    cd34_dose = np.where(graft_source == "Cord_Blood", base_cd34 * 0.2, base_cd34)
    cd34_dose = np.clip(np.round(cd34_dose, 2), 0.5, 12.0)
    
    total_nucleated_cells = np.round(rng.uniform(1.2, 8.5, size=n_samples), 2)
    
    # Documented physiological probability of timely neutrophil recovery (by Day 28)
    # Higher probability: PBSC graft, high CD34 dose, Matched Sibling, high KPS, lower comorbidity
    # Lower probability: Cord blood (median recovery ~30-35 days), low CD34 dose, severe mismatch, active disease
    logit = (
        0.6
        + 0.50 * (cd34_dose - 4.5) / 2.0
        + 0.40 * (graft_source == "PBSC")
        - 0.95 * (graft_source == "Cord_Blood")
        + 0.35 * (donor_type == "Matched_Sibling")
        - 0.50 * (donor_type == "MMUD")
        + 0.30 * ((recipient_kps - 80) / 10.0)
        - 0.25 * comorbidity_index
        - 0.40 * (disease_status == "Active_Disease")
        - 0.20 * (hla_match_score < 8)
        - 0.15 * ((recipient_age - 50) / 15.0)
    )
    
    prob = 1.0 / (1.0 + np.exp(-logit))
    # Draw binary outcome
    neutrophil_recovery_day28 = rng.binomial(1, prob)
    
    df = pd.DataFrame({
        "patient_id": patient_ids,
        "recipient_age": recipient_age,
        "recipient_gender": recipient_gender,
        "recipient_kps": recipient_kps,
        "recipient_cmv": recipient_cmv,
        "comorbidity_index": comorbidity_index,
        "primary_disease": primary_disease,
        "disease_status": disease_status,
        "conditioning_intensity": conditioning_intensity,
        "donor_age": donor_age,
        "donor_gender": donor_gender,
        "donor_cmv": donor_cmv,
        "donor_type": donor_type,
        "graft_source": graft_source,
        "hla_match_score": hla_match_score,
        "cd34_dose": cd34_dose,
        "total_nucleated_cells": total_nucleated_cells,
        "neutrophil_recovery_day28": neutrophil_recovery_day28,
    })
    
    return df
