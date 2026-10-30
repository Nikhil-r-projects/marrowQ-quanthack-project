import numpy as np
import pandas as pd
from typing import Optional

def generate_hsct_50plus_dataset(n_samples: int = 500, random_state: int = 42) -> pd.DataFrame:
    """
    Generates a 50+ feature pre-transplant clinical dataset for HSCT engraftment prediction,
    grounded in CIBMTR (Center for International Blood and Marrow Transplant Research) and
    EBMT registry publications.
    
    Predictors: 60 strictly pre-transplant clinical variables.
    Endpoint: neutrophil_recovery_day28 (binary classification).
    
    Zero target leakage: No post-transplant events (such as date of actual engraftment,
    acute GVHD onset, chimerism, Day-100 survival, or discharge dates) are included in the predictor matrix.
    
    DISCLAIMER:
    SYNTHETIC DEMONSTRATION DATA — NOT CLINICAL EVIDENCE. STRICTLY FOR PIPELINE VALIDATION.
    """
    rng = np.random.default_rng(random_state)
    
    patient_ids = [f"PT-{1000 + i}" for i in range(n_samples)]
    
    # --- 1. Recipient Demographics & Anthropometrics (9 features) ---
    recipient_age = rng.integers(18, 75, size=n_samples)
    recipient_gender = rng.choice(["M", "F"], size=n_samples, p=[0.55, 0.45])
    recipient_kps = rng.choice([60, 70, 80, 90, 100], size=n_samples, p=[0.05, 0.15, 0.35, 0.30, 0.15])
    recipient_cmv = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.60, 0.40])
    recipient_blood_group = rng.choice(["A", "B", "AB", "O"], size=n_samples, p=[0.38, 0.18, 0.08, 0.36])
    recipient_rh_factor = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.85, 0.15])
    recipient_height_cm = np.round(rng.normal(170.0, 9.5, size=n_samples), 1)
    recipient_height_cm = np.clip(recipient_height_cm, 145.0, 205.0)
    recipient_weight_kg = np.round(rng.normal(74.0, 14.0, size=n_samples), 1)
    recipient_weight_kg = np.clip(recipient_weight_kg, 42.0, 130.0)
    recipient_bmi = np.round(recipient_weight_kg / ((recipient_height_cm / 100.0) ** 2), 2)
    
    # --- 2. HCT-CI Comorbidity Spectrum (8 features) ---
    comorbidity_index_hctci = rng.choice([0, 1, 2, 3, 4, 5], size=n_samples, p=[0.32, 0.28, 0.18, 0.12, 0.06, 0.04])
    cardiac_history = rng.binomial(1, np.clip(0.04 + 0.04 * comorbidity_index_hctci, 0.02, 0.40))
    pulmonary_moderate_severe = rng.binomial(1, np.clip(0.05 + 0.05 * comorbidity_index_hctci, 0.03, 0.45))
    diabetes_treated = rng.binomial(1, np.clip(0.08 + 0.03 * comorbidity_index_hctci, 0.05, 0.35))
    renal_insufficiency = rng.binomial(1, np.clip(0.02 + 0.03 * comorbidity_index_hctci, 0.01, 0.25))
    hepatic_mild_severe = rng.binomial(1, np.clip(0.03 + 0.03 * comorbidity_index_hctci, 0.02, 0.30))
    prior_solid_tumor = rng.binomial(1, 0.06, size=n_samples)
    infection_pre_tx = rng.binomial(1, 0.14, size=n_samples)
    
    # --- 3. Primary Malignancy & Pre-Transplant Staging (8 features) ---
    primary_disease = rng.choice(
        ["AML", "ALL", "MDS", "Lymphoma", "MPN"], 
        size=n_samples, 
        p=[0.40, 0.24, 0.16, 0.12, 0.08]
    )
    disease_status = rng.choice(
        ["CR1", "CR2+", "Active_Disease", "Refractory"],
        size=n_samples,
        p=[0.52, 0.28, 0.14, 0.06]
    )
    disease_risk_index = rng.choice(
        ["Low", "Intermediate", "High", "Very_High"],
        size=n_samples,
        p=[0.20, 0.50, 0.22, 0.08]
    )
    prior_lines_therapy = rng.choice([1, 2, 3, 4], size=n_samples, p=[0.48, 0.34, 0.13, 0.05])
    blast_percentage_pre_tx = np.where(
        disease_status == "CR1", 
        np.round(rng.uniform(0.5, 3.0, size=n_samples), 1),
        np.round(rng.uniform(2.5, 16.5, size=n_samples), 1)
    )
    time_diagnosis_to_tx_days = rng.integers(60, 650, size=n_samples)
    prior_autologous_tx = rng.binomial(1, 0.09, size=n_samples)
    prior_radiation = rng.binomial(1, 0.18, size=n_samples)
    
    # --- 4. Conditioning Regimen & Prophylaxis (10 features) ---
    conditioning_intensity = rng.choice(
        ["MAC", "RIC", "NMA"],
        size=n_samples,
        p=[0.48, 0.42, 0.10]
    )
    total_body_irradiation_tbi = np.where(
        primary_disease == "ALL",
        rng.binomial(1, 0.65, size=n_samples),
        rng.binomial(1, 0.15, size=n_samples)
    )
    busulfan_used = np.where(conditioning_intensity == "MAC", rng.binomial(1, 0.60, size=n_samples), rng.binomial(1, 0.20, size=n_samples))
    cyclophosphamide_used = rng.binomial(1, 0.72, size=n_samples)
    fludarabine_used = np.where(conditioning_intensity == "RIC", rng.binomial(1, 0.85, size=n_samples), rng.binomial(1, 0.40, size=n_samples))
    melphalan_used = rng.binomial(1, 0.22, size=n_samples)
    atg_alemtuzumab_serotherapy = rng.binomial(1, 0.38, size=n_samples)
    gvhd_prophylaxis_type = rng.choice(
        ["Tacrolimus_MTX", "Cyclosporine_MTX", "PTCy_Based", "Tacrolimus_MMF"],
        size=n_samples,
        p=[0.45, 0.25, 0.20, 0.10]
    )
    calcineurin_inhibitor = np.where(
        np.isin(gvhd_prophylaxis_type, ["Tacrolimus_MTX", "Tacrolimus_MMF"]),
        "Tacrolimus",
        np.where(gvhd_prophylaxis_type == "Cyclosporine_MTX", "Cyclosporine", "None")
    )
    methotrexate_used = np.where(np.isin(gvhd_prophylaxis_type, ["Tacrolimus_MTX", "Cyclosporine_MTX"]), 1, 0)
    
    # --- 5. Donor Demographics & Matching (11 features) ---
    donor_age = rng.integers(18, 55, size=n_samples)
    donor_gender = rng.choice(["M", "F"], size=n_samples, p=[0.60, 0.40])
    donor_cmv = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.50, 0.50])
    donor_type = rng.choice(
        ["Matched_Sibling", "MUD", "MMUD", "Haploidentical"],
        size=n_samples,
        p=[0.35, 0.38, 0.15, 0.12]
    )
    donor_blood_group = rng.choice(["A", "B", "AB", "O"], size=n_samples, p=[0.38, 0.18, 0.08, 0.36])
    donor_rh_factor = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.85, 0.15])
    donor_weight_kg = np.round(rng.normal(76.0, 12.0, size=n_samples), 1)
    donor_weight_kg = np.clip(donor_weight_kg, 48.0, 115.0)
    donor_recipient_weight_ratio = np.round(donor_weight_kg / recipient_weight_kg, 2)
    donor_pregnancy_history = np.where(donor_gender == "F", rng.choice([0, 1, 2], size=n_samples, p=[0.45, 0.30, 0.25]), 0)
    
    # Pairwise Interaction Variables
    sex_match_pair = [
        f"{r}_{d}" for r, d in zip(recipient_gender, donor_gender)
    ]
    cmv_serostatus_pair = [
        f"{r[:3]}_{d[:3]}" for r, d in zip(recipient_cmv, donor_cmv)
    ]
    abo_compatibility = np.where(
        recipient_blood_group == donor_blood_group,
        "Identical",
        rng.choice(["Major_Incompatibility", "Minor_Incompatibility", "Bidirectional"], size=n_samples, p=[0.45, 0.40, 0.15])
    )
    
    # --- 6. Immunogenetic HLA Compatibility (6 features) ---
    hla_match_score = rng.choice([10, 9, 8, 7], size=n_samples, p=[0.55, 0.25, 0.15, 0.05])
    hla_a_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1], size=n_samples, p=[0.85, 0.15]))
    hla_b_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1], size=n_samples, p=[0.85, 0.15]))
    hla_c_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1], size=n_samples, p=[0.85, 0.15]))
    hla_drb1_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1], size=n_samples, p=[0.90, 0.10]))
    hla_dqb1_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1], size=n_samples, p=[0.90, 0.10]))
    
    # --- 7. Graft Architecture & Cellular Dosing (4 features) ---
    graft_source = rng.choice(
        ["PBSC", "Bone_Marrow", "Cord_Blood"],
        size=n_samples,
        p=[0.70, 0.22, 0.08]
    )
    base_cd34 = rng.lognormal(mean=1.55, sigma=0.38, size=n_samples)
    cd34_dose = np.where(graft_source == "Cord_Blood", base_cd34 * 0.22, base_cd34)
    cd34_dose = np.clip(np.round(cd34_dose, 2), 0.5, 12.0)
    total_nucleated_cells_tnc = np.round(rng.uniform(1.5, 9.0, size=n_samples), 2)
    mononuclear_cells_dose = np.round(total_nucleated_cells_tnc * rng.uniform(0.65, 0.90, size=n_samples), 2)
    
    # --- 8. Pre-Transplant Baseline Laboratories (6 features) ---
    pre_tx_anc = np.round(rng.uniform(0.8, 6.2, size=n_samples), 2)
    pre_tx_platelets = np.round(rng.uniform(35.0, 320.0, size=n_samples), 1)
    pre_tx_hemoglobin = np.round(rng.uniform(8.5, 14.2, size=n_samples), 1)
    pre_tx_ferritin = np.round(rng.uniform(280.0, 3200.0, size=n_samples), 0)
    pre_tx_albumin = np.round(rng.uniform(3.0, 4.8, size=n_samples), 2)
    pre_tx_crp = np.round(rng.uniform(0.5, 22.0, size=n_samples), 2)
    
    # --- Primary Clinical Endpoint: Day 28 Neutrophil Recovery ---
    # Logit calculation based on clinical odds ratios:
    logit = (
        0.55
        + 0.55 * (cd34_dose - 4.5) / 2.0
        + 0.42 * (graft_source == "PBSC")
        - 1.10 * (graft_source == "Cord_Blood")
        + 0.38 * (donor_type == "Matched_Sibling")
        - 0.55 * (donor_type == "MMUD")
        + 0.28 * ((recipient_kps - 80) / 10.0)
        - 0.22 * comorbidity_index_hctci
        - 0.35 * (disease_status == "Active_Disease")
        - 0.25 * (hla_match_score < 10)
        - 0.18 * ((recipient_age - 50) / 15.0)
        + 0.15 * (pre_tx_albumin - 3.8)
        - 0.12 * (pre_tx_ferritin > 1500)
    )
    
    prob = 1.0 / (1.0 + np.exp(-logit))
    neutrophil_recovery_day28 = rng.binomial(1, prob)
    
    data_dict = {
        "patient_id": patient_ids,
        # Recipient (9)
        "recipient_age": recipient_age,
        "recipient_gender": recipient_gender,
        "recipient_kps": recipient_kps,
        "recipient_cmv": recipient_cmv,
        "recipient_blood_group": recipient_blood_group,
        "recipient_rh_factor": recipient_rh_factor,
        "recipient_height_cm": recipient_height_cm,
        "recipient_weight_kg": recipient_weight_kg,
        "recipient_bmi": recipient_bmi,
        # Comorbidities (8)
        "comorbidity_index_hctci": comorbidity_index_hctci,
        "cardiac_history": cardiac_history,
        "pulmonary_moderate_severe": pulmonary_moderate_severe,
        "diabetes_treated": diabetes_treated,
        "renal_insufficiency": renal_insufficiency,
        "hepatic_mild_severe": hepatic_mild_severe,
        "prior_solid_tumor": prior_solid_tumor,
        "infection_pre_tx": infection_pre_tx,
        # Primary Disease (8)
        "primary_disease": primary_disease,
        "disease_status": disease_status,
        "disease_risk_index": disease_risk_index,
        "prior_lines_therapy": prior_lines_therapy,
        "blast_percentage_pre_tx": blast_percentage_pre_tx,
        "time_diagnosis_to_tx_days": time_diagnosis_to_tx_days,
        "prior_autologous_tx": prior_autologous_tx,
        "prior_radiation": prior_radiation,
        # Conditioning & Prophylaxis (10)
        "conditioning_intensity": conditioning_intensity,
        "total_body_irradiation_tbi": total_body_irradiation_tbi,
        "busulfan_used": busulfan_used,
        "cyclophosphamide_used": cyclophosphamide_used,
        "fludarabine_used": fludarabine_used,
        "melphalan_used": melphalan_used,
        "atg_alemtuzumab_serotherapy": atg_alemtuzumab_serotherapy,
        "gvhd_prophylaxis_type": gvhd_prophylaxis_type,
        "calcineurin_inhibitor": calcineurin_inhibitor,
        "methotrexate_used": methotrexate_used,
        # Donor Demographics & Matching (11)
        "donor_age": donor_age,
        "donor_gender": donor_gender,
        "donor_cmv": donor_cmv,
        "donor_type": donor_type,
        "donor_blood_group": donor_blood_group,
        "donor_rh_factor": donor_rh_factor,
        "donor_weight_kg": donor_weight_kg,
        "donor_recipient_weight_ratio": donor_recipient_weight_ratio,
        "donor_pregnancy_history": donor_pregnancy_history,
        "sex_match_pair": sex_match_pair,
        "cmv_serostatus_pair": cmv_serostatus_pair,
        "abo_compatibility": abo_compatibility,
        # HLA Resolution (6)
        "hla_match_score": hla_match_score,
        "hla_a_match": hla_a_match,
        "hla_b_match": hla_b_match,
        "hla_c_match": hla_c_match,
        "hla_drb1_match": hla_drb1_match,
        "hla_dqb1_match": hla_dqb1_match,
        # Graft (4)
        "graft_source": graft_source,
        "cd34_dose": cd34_dose,
        "total_nucleated_cells_tnc": total_nucleated_cells_tnc,
        "mononuclear_cells_dose": mononuclear_cells_dose,
        # Baseline Labs (6)
        "pre_tx_anc": pre_tx_anc,
        "pre_tx_platelets": pre_tx_platelets,
        "pre_tx_hemoglobin": pre_tx_hemoglobin,
        "pre_tx_ferritin": pre_tx_ferritin,
        "pre_tx_albumin": pre_tx_albumin,
        "pre_tx_crp": pre_tx_crp,
        # Target Outcome (1)
        "neutrophil_recovery_day28": neutrophil_recovery_day28
    }
    
    return pd.DataFrame(data_dict)

def generate_hsct_synthetic_dataset(n_samples: int = 500, random_state: int = 42) -> pd.DataFrame:
    """Backwards-compatible wrapper returning the 50+ feature HSCT dataset"""
    return generate_hsct_50plus_dataset(n_samples=n_samples, random_state=random_state)
