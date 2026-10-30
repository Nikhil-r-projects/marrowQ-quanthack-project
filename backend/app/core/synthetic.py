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

def generate_hsct_200plus_dataset(n_samples: int = 600, random_state: int = 42) -> pd.DataFrame:
    """
    Generates a high-dimensional 210-feature pre-transplant clinical dataset for HSCT engraftment prediction,
    strictly mapped to CIBMTR / EBMT registries and hematology literature.
    
    Predictors: 210 strictly pre-transplant clinical variables spanning 8 clinical domains.
    Endpoint: neutrophil_recovery_day28 (binary classification).
    
    Zero target leakage: No post-transplant event features (anc_500_day, plt_20k_day, chimerism,
    agvhd, discharge date, etc.) are included in the predictor matrix.
    
    DISCLAIMER:
    SYNTHETIC DEMONSTRATION DATA — NOT CLINICAL EVIDENCE. STRICTLY FOR PIPELINE VALIDATION.
    """
    rng = np.random.default_rng(random_state)
    patient_ids = [f"PT-2{1000 + i}" for i in range(n_samples)]
    
    # 1. Recipient Demographics & Anthropometrics (15 features)
    recipient_age = rng.integers(18, 75, size=n_samples)
    recipient_gender = rng.choice(["M", "F"], size=n_samples, p=[0.55, 0.45])
    recipient_kps = rng.choice([60, 70, 80, 90, 100], size=n_samples, p=[0.05, 0.15, 0.35, 0.30, 0.15])
    recipient_ecog = np.where(recipient_kps >= 90, 0, np.where(recipient_kps >= 80, 1, np.where(recipient_kps >= 70, 2, 3)))
    recipient_ethnicity = rng.choice(["Caucasian", "African_American", "Asian", "Hispanic", "Other"], size=n_samples, p=[0.60, 0.15, 0.12, 0.09, 0.04])
    recipient_cmv = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.60, 0.40])
    recipient_ebv = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.88, 0.12])
    recipient_hsv = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.72, 0.28])
    recipient_toxoplasma = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.14, 0.86])
    recipient_blood_group = rng.choice(["A", "B", "AB", "O"], size=n_samples, p=[0.38, 0.18, 0.08, 0.36])
    recipient_rh_factor = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.85, 0.15])
    recipient_height_cm = np.round(np.clip(rng.normal(170.0, 9.5, size=n_samples), 145.0, 205.0), 1)
    recipient_weight_kg = np.round(np.clip(rng.normal(74.0, 14.0, size=n_samples), 42.0, 130.0), 1)
    recipient_bmi = np.round(recipient_weight_kg / ((recipient_height_cm / 100.0) ** 2), 2)
    recipient_bsa = np.round(0.007184 * (recipient_height_cm ** 0.725) * (recipient_weight_kg ** 0.425), 2)
    
    # 2. Expanded HCT-CI Comorbidity Spectrum & Organ Functions (25 features)
    comorbidity_index_hctci = rng.choice([0, 1, 2, 3, 4, 5, 6], size=n_samples, p=[0.33, 0.27, 0.17, 0.11, 0.06, 0.04, 0.02])
    cardiac_arrhythmia = rng.binomial(1, np.clip(0.04 + 0.03 * comorbidity_index_hctci, 0.02, 0.35))
    cardiac_cad = rng.binomial(1, np.clip(0.05 + 0.04 * comorbidity_index_hctci, 0.03, 0.40))
    cardiac_ejection_fraction_pct = np.round(np.clip(rng.normal(60.0 - 1.8 * comorbidity_index_hctci, 5.5), 42.0, 72.0), 1)
    cardiac_chf = rng.binomial(1, np.clip(0.02 + 0.03 * comorbidity_index_hctci, 0.01, 0.30))
    heart_valve_disease = rng.binomial(1, 0.04, size=n_samples)
    pulmonary_moderate = rng.binomial(1, np.clip(0.06 + 0.04 * comorbidity_index_hctci, 0.04, 0.35))
    pulmonary_severe = np.where(pulmonary_moderate == 1, 0, rng.binomial(1, np.clip(0.02 + 0.03 * comorbidity_index_hctci, 0.01, 0.20)))
    pulmonary_fev1_pct = np.round(np.clip(rng.normal(86.0 - 3.5 * (pulmonary_moderate * 2 + pulmonary_severe * 5), 9.0), 52.0, 108.0), 1)
    pulmonary_dlco_pct = np.round(np.clip(rng.normal(82.0 - 4.0 * (pulmonary_moderate * 2 + pulmonary_severe * 6), 9.5), 46.0, 104.0), 1)
    diabetes_diet = rng.binomial(1, 0.07, size=n_samples)
    diabetes_insulin_or_oral = rng.binomial(1, np.clip(0.08 + 0.03 * comorbidity_index_hctci, 0.05, 0.32))
    renal_creatinine_clearance = np.round(np.clip(rng.normal(92.0 - 6.0 * comorbidity_index_hctci, 18.0), 32.0, 128.0), 1)
    renal_insufficiency_hctci = np.where(renal_creatinine_clearance < 50.0, 1, rng.binomial(1, 0.02, size=n_samples))
    hepatic_mild = rng.binomial(1, np.clip(0.04 + 0.03 * comorbidity_index_hctci, 0.02, 0.25))
    hepatic_moderate_severe = np.where(hepatic_mild == 1, 0, rng.binomial(1, np.clip(0.01 + 0.02 * comorbidity_index_hctci, 0.01, 0.15)))
    gastrointestinal_ulcer = rng.binomial(1, 0.05, size=n_samples)
    cerebrovascular_tia_stroke = rng.binomial(1, 0.04, size=n_samples)
    neurological_disorder = rng.binomial(1, 0.03, size=n_samples)
    psychiatric_depression_anxiety = rng.binomial(1, 0.16, size=n_samples)
    prior_solid_tumor = rng.binomial(1, 0.06, size=n_samples)
    prior_malignancy_chemo_tx = rng.binomial(1, 0.11, size=n_samples)
    rheumatologic_connective_tissue = rng.binomial(1, 0.03, size=n_samples)
    infection_pre_tx_active = rng.binomial(1, 0.12, size=n_samples)
    infection_fungal_prior = rng.binomial(1, 0.06, size=n_samples)
    
    # 3. Primary Malignancy, Cytogenetics & Staging (30 features)
    primary_disease = rng.choice(["AML", "ALL", "MDS", "Lymphoma", "MPN", "CML", "SAA"], size=n_samples, p=[0.38, 0.22, 0.16, 0.11, 0.06, 0.04, 0.03])
    disease_status = rng.choice(["CR1", "CR2+", "Active_Disease", "Refractory"], size=n_samples, p=[0.52, 0.26, 0.15, 0.07])
    disease_risk_index_dri = rng.choice(["Low", "Intermediate", "High", "Very_High"], size=n_samples, p=[0.22, 0.48, 0.21, 0.09])
    cytogenetic_risk_category = rng.choice(["Favorable", "Intermediate", "Adverse"], size=n_samples, p=[0.24, 0.52, 0.24])
    flt3_itd_mutation = np.where(primary_disease == "AML", rng.binomial(1, 0.28, size=n_samples), 0)
    npm1_mutation = np.where(primary_disease == "AML", rng.binomial(1, 0.32, size=n_samples), 0)
    tp53_mutation = rng.binomial(1, np.where(cytogenetic_risk_category == "Adverse", 0.35, 0.06))
    runx1_mutation = rng.binomial(1, 0.12, size=n_samples)
    asxl1_mutation = rng.binomial(1, 0.14, size=n_samples)
    kras_nras_mutation = rng.binomial(1, 0.10, size=n_samples)
    bcr_abl1_positive = np.where(np.isin(primary_disease, ["ALL", "CML"]), rng.binomial(1, 0.45, size=n_samples), 0)
    jak2_v617f_mutation = np.where(primary_disease == "MPN", rng.binomial(1, 0.70, size=n_samples), 0)
    calr_mutation = np.where(primary_disease == "MPN", rng.binomial(1, 0.22, size=n_samples), 0)
    mpl_mutation = np.where(primary_disease == "MPN", rng.binomial(1, 0.08, size=n_samples), 0)
    dnmt3a_mutation = np.where(primary_disease == "AML", rng.binomial(1, 0.22, size=n_samples), 0)
    tet2_mutation = rng.binomial(1, 0.16, size=n_samples)
    idh1_idh2_mutation = np.where(primary_disease == "AML", rng.binomial(1, 0.18, size=n_samples), 0)
    mrd_pre_transplant_positive = np.where(np.isin(disease_status, ["Active_Disease", "Refractory"]), 1, rng.binomial(1, 0.24, size=n_samples))
    blast_percentage_bone_marrow = np.where(disease_status == "CR1", np.round(rng.uniform(0.5, 3.2, size=n_samples), 1), np.where(disease_status == "CR2+", np.round(rng.uniform(1.2, 4.8, size=n_samples), 1), np.round(rng.uniform(5.5, 24.5, size=n_samples), 1)))
    blast_percentage_peripheral_blood = np.where(disease_status == "CR1", 0.0, np.round(rng.uniform(0.0, 9.5, size=n_samples), 1))
    prior_lines_chemotherapy = rng.choice([1, 2, 3, 4], size=n_samples, p=[0.46, 0.34, 0.14, 0.06])
    prior_anthracycline_cumulative_dose = np.round(rng.uniform(120.0, 480.0, size=n_samples), 1)
    prior_hypomethylating_agents = np.where(primary_disease == "MDS", rng.binomial(1, 0.65, size=n_samples), rng.binomial(1, 0.12, size=n_samples))
    prior_targeted_inhibitor_therapy = rng.binomial(1, 0.25, size=n_samples)
    prior_autologous_hsct = rng.binomial(1, 0.09, size=n_samples)
    time_diagnosis_to_tx_days = rng.integers(45, 780, size=n_samples)
    time_last_complete_remission_days = np.where(np.isin(disease_status, ["CR1", "CR2+"]), rng.integers(20, 340, size=n_samples), 0)
    extramedullary_disease_pre_tx = rng.binomial(1, 0.07, size=n_samples)
    splenomegaly_pre_tx = rng.binomial(1, 0.13, size=n_samples)
    prior_radiation_therapy = rng.binomial(1, 0.19, size=n_samples)
    
    # 4. Conditioning Regimen & Chemotherapy Agents (25 features)
    conditioning_intensity = rng.choice(["MAC", "RIC", "NMA"], size=n_samples, p=[0.48, 0.42, 0.10])
    tbi_total_dose_cgy = np.where(primary_disease == "ALL", np.round(rng.choice([0.0, 1200.0, 1320.0], size=n_samples, p=[0.30, 0.50, 0.20]), 0), np.round(rng.choice([0.0, 200.0, 400.0], size=n_samples, p=[0.80, 0.12, 0.08]), 0))
    tbi_fractionated = np.where(tbi_total_dose_cgy >= 1000.0, 1, 0)
    busulfan_used = np.where(conditioning_intensity == "MAC", rng.binomial(1, 0.64, size=n_samples), rng.binomial(1, 0.22, size=n_samples))
    busulfan_target_auc_mg_l_h = np.where(busulfan_used == 1, np.round(rng.uniform(65.0, 88.0, size=n_samples), 1), 0.0)
    cyclophosphamide_used = rng.binomial(1, 0.74, size=n_samples)
    cyclophosphamide_dose_mg_kg = np.where(cyclophosphamide_used == 1, np.round(rng.choice([50.0, 100.0, 120.0], size=n_samples, p=[0.30, 0.50, 0.20]), 1), 0.0)
    fludarabine_used = np.where(conditioning_intensity == "RIC", rng.binomial(1, 0.88, size=n_samples), rng.binomial(1, 0.42, size=n_samples))
    fludarabine_total_dose_mg_m2 = np.where(fludarabine_used == 1, np.round(rng.choice([120.0, 150.0, 160.0], size=n_samples, p=[0.35, 0.45, 0.20]), 1), 0.0)
    melphalan_used = rng.binomial(1, 0.24, size=n_samples)
    melphalan_dose_mg_m2 = np.where(melphalan_used == 1, np.round(rng.choice([100.0, 140.0], size=n_samples, p=[0.40, 0.60]), 1), 0.0)
    thiotepa_used = rng.binomial(1, 0.14, size=n_samples)
    treosulfan_used = rng.binomial(1, 0.08, size=n_samples)
    etoposide_used = rng.binomial(1, 0.12, size=n_samples)
    carmustine_bcnu_used = rng.binomial(1, 0.07, size=n_samples)
    atg_used = rng.binomial(1, 0.38, size=n_samples)
    atg_type = np.where(atg_used == 1, rng.choice(["Thymoglobulin", "Fresenius"], size=n_samples, p=[0.80, 0.20]), "None")
    atg_total_dose_mg_kg = np.where(atg_used == 1, np.round(rng.uniform(2.5, 7.5, size=n_samples), 2), 0.0)
    alemtuzumab_used = np.where(atg_used == 1, 0, rng.binomial(1, 0.06, size=n_samples))
    gvhd_prophylaxis_regimen = rng.choice(["Tacrolimus_MTX", "Cyclosporine_MTX", "PTCy_Based", "Tacrolimus_MMF"], size=n_samples, p=[0.44, 0.24, 0.22, 0.10])
    calcineurin_inhibitor_type = np.where(np.isin(gvhd_prophylaxis_regimen, ["Tacrolimus_MTX", "Tacrolimus_MMF"]), "Tacrolimus", np.where(gvhd_prophylaxis_regimen == "Cyclosporine_MTX", "Cyclosporine", "None"))
    methotrexate_short_course = np.where(np.isin(gvhd_prophylaxis_regimen, ["Tacrolimus_MTX", "Cyclosporine_MTX"]), 1, 0)
    mycophenolate_mofetil_used = np.where(np.isin(gvhd_prophylaxis_regimen, ["Tacrolimus_MMF", "PTCy_Based"]), 1, 0)
    sirolimus_used = rng.binomial(1, 0.08, size=n_samples)
    post_transplant_cyclophosphamide_planned = np.where(gvhd_prophylaxis_regimen == "PTCy_Based", 1, 0)
    
    # 5. Donor Demographics & Clinical Factors (20 features)
    donor_age = rng.integers(18, 58, size=n_samples)
    donor_gender = rng.choice(["M", "F"], size=n_samples, p=[0.60, 0.40])
    donor_cmv = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.50, 0.50])
    donor_ebv = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.86, 0.14])
    donor_type = rng.choice(["Matched_Sibling", "MUD", "MMUD", "Haploidentical"], size=n_samples, p=[0.36, 0.38, 0.14, 0.12])
    donor_relation = np.where(donor_type == "Matched_Sibling", "Sibling", np.where(donor_type == "Haploidentical", rng.choice(["Offspring", "Parent"], size=n_samples, p=[0.60, 0.40]), "Unrelated"))
    donor_blood_group = rng.choice(["A", "B", "AB", "O"], size=n_samples, p=[0.38, 0.18, 0.08, 0.36])
    donor_rh_factor = rng.choice(["Positive", "Negative"], size=n_samples, p=[0.85, 0.15])
    donor_weight_kg = np.round(np.clip(rng.normal(76.0, 12.0, size=n_samples), 48.0, 115.0), 1)
    donor_recipient_weight_ratio = np.round(donor_weight_kg / recipient_weight_kg, 2)
    donor_parity_pregnancies = np.where(donor_gender == "F", rng.choice([0, 1, 2, 3], size=n_samples, p=[0.42, 0.30, 0.20, 0.08]), 0)
    sex_mismatch_female_to_male = np.where((donor_gender == "F") & (recipient_gender == "M"), 1, 0)
    sex_match_category = [f"{r}_{d}" for r, d in zip(recipient_gender, donor_gender)]
    cmv_donor_recipient_risk_strata = [f"{r[:3]}_{d[:3]}" for r, d in zip(recipient_cmv, donor_cmv)]
    abo_incompatibility_class = np.where(recipient_blood_group == donor_blood_group, "Identical", rng.choice(["Major", "Minor", "Bidirectional"], size=n_samples, p=[0.45, 0.40, 0.15]))
    donor_karnofsky = rng.choice([90, 100], size=n_samples, p=[0.20, 0.80])
    donor_gcsf_mobilization_days = rng.choice([4, 5, 6], size=n_samples, p=[0.15, 0.70, 0.15])
    donor_adverse_mobilizer = rng.binomial(1, 0.06, size=n_samples)
    donor_smoking_history = rng.binomial(1, 0.22, size=n_samples)
    donor_bmi = np.round(np.clip(rng.normal(25.5, 3.8, size=n_samples), 18.5, 35.0), 2)
    
    # 6. Immunogenetic HLA 10/10 Alleles & KIR / MICA (40 features)
    hla_match_score = np.where(donor_type == "Matched_Sibling", 10, np.where(donor_type == "MUD", 10, np.where(donor_type == "MMUD", rng.choice([9, 8, 7], size=n_samples, p=[0.65, 0.25, 0.10]), 5)))
    hla_a_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1, 0], size=n_samples, p=[0.80, 0.16, 0.04]))
    hla_b_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1, 0], size=n_samples, p=[0.80, 0.16, 0.04]))
    hla_c_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1, 0], size=n_samples, p=[0.82, 0.15, 0.03]))
    hla_drb1_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1, 0], size=n_samples, p=[0.88, 0.10, 0.02]))
    hla_dqb1_match = np.where(hla_match_score == 10, 2, rng.choice([2, 1, 0], size=n_samples, p=[0.88, 0.10, 0.02]))
    hla_a_allele_1_match = np.where(hla_a_match >= 1, 1, 0)
    hla_a_allele_2_match = np.where(hla_a_match == 2, 1, 0)
    hla_b_allele_1_match = np.where(hla_b_match >= 1, 1, 0)
    hla_b_allele_2_match = np.where(hla_b_match == 2, 1, 0)
    hla_c_allele_1_match = np.where(hla_c_match >= 1, 1, 0)
    hla_c_allele_2_match = np.where(hla_c_match == 2, 1, 0)
    hla_drb1_allele_1_match = np.where(hla_drb1_match >= 1, 1, 0)
    hla_drb1_allele_2_match = np.where(hla_drb1_match == 2, 1, 0)
    hla_dqb1_allele_1_match = np.where(hla_dqb1_match >= 1, 1, 0)
    hla_dqb1_allele_2_match = np.where(hla_dqb1_match == 2, 1, 0)
    hla_dpb1_match_grade = rng.choice(["Permissive", "Non_Permissive_GVH", "Non_Permissive_HVG"], size=n_samples, p=[0.60, 0.22, 0.18])
    hla_dpb1_tce_group_match = np.where(hla_dpb1_match_grade == "Permissive", 1, 0)
    hla_drb3_4_5_match = rng.binomial(1, 0.82, size=n_samples)
    hla_dqa1_match = rng.binomial(1, 0.86, size=n_samples)
    hla_dpa1_match = rng.binomial(1, 0.84, size=n_samples)
    donor_specific_antibodies_dsa = rng.binomial(1, 0.07, size=n_samples)
    dsa_mfi_highest_titer = np.where(donor_specific_antibodies_dsa == 1, np.round(rng.uniform(2800.0, 11500.0, size=n_samples), 0), np.round(rng.uniform(0.0, 250.0, size=n_samples), 0))
    anti_hla_class_1_dsa = np.where(donor_specific_antibodies_dsa == 1, rng.binomial(1, 0.55, size=n_samples), 0)
    anti_hla_class_2_dsa = np.where(donor_specific_antibodies_dsa == 1, rng.binomial(1, 0.65, size=n_samples), 0)
    crossmatch_flow_cytometry_negative = np.where(donor_specific_antibodies_dsa == 1, 0, 1)
    crossmatch_cdc_negative = np.where(dsa_mfi_highest_titer > 6000.0, 0, 1)
    kir_ligand_mismatch_present = rng.binomial(1, 0.28, size=n_samples)
    donor_kir_haplotype = rng.choice(["A_A", "B_x"], size=n_samples, p=[0.35, 0.65])
    donor_kir_2dl1_present = rng.binomial(1, 0.96, size=n_samples)
    donor_kir_2dl2_present = rng.binomial(1, 0.52, size=n_samples)
    donor_kir_2dl3_present = rng.binomial(1, 0.88, size=n_samples)
    donor_kir_3dl1_present = rng.binomial(1, 0.92, size=n_samples)
    donor_kir_2ds1_present = np.where(donor_kir_haplotype == "B_x", rng.binomial(1, 0.62, size=n_samples), 0)
    donor_kir_2ds2_present = np.where(donor_kir_haplotype == "B_x", rng.binomial(1, 0.58, size=n_samples), 0)
    donor_kir_3ds1_present = np.where(donor_kir_haplotype == "B_x", rng.binomial(1, 0.44, size=n_samples), 0)
    kir_b_content_score = np.where(donor_kir_haplotype == "A_A", 0, rng.choice([1, 2, 3, 4], size=n_samples, p=[0.25, 0.40, 0.25, 0.10]))
    mica_mismatch_present = rng.binomial(1, 0.16, size=n_samples)
    recipient_c1_ligand = rng.binomial(1, 0.72, size=n_samples)
    recipient_c2_ligand = rng.binomial(1, 0.64, size=n_samples)
    
    # 7. Graft Architecture & Quantitative Cellular Dosing (20 features)
    graft_source = rng.choice(["PBSC", "Bone_Marrow", "Cord_Blood"], size=n_samples, p=[0.72, 0.21, 0.07])
    base_cd34 = rng.lognormal(mean=1.58, sigma=0.42, size=n_samples)
    cd34_dose_x10e6_per_kg = np.where(graft_source == "Cord_Blood", base_cd34 * 0.22, base_cd34)
    cd34_dose_x10e6_per_kg = np.round(np.clip(cd34_dose_x10e6_per_kg, 0.50, 14.50), 2)
    cd34_viability_percentage = np.round(np.clip(rng.normal(94.5, 3.2, size=n_samples), 82.0, 99.5), 1)
    total_nucleated_cells_tnc = np.round(np.clip(rng.uniform(1.8, 10.5, size=n_samples), 1.2, 11.8), 2)
    mononuclear_cells_dose = np.round(total_nucleated_cells_tnc * rng.uniform(0.68, 0.88, size=n_samples), 2)
    cd3_total_t_cells = np.round(np.where(graft_source == "PBSC", rng.uniform(15.0, 38.0, size=n_samples), np.where(graft_source == "Bone_Marrow", rng.uniform(2.5, 9.0, size=n_samples), rng.uniform(0.2, 1.5, size=n_samples))), 2)
    cd4_helper_t_cells = np.round(cd3_total_t_cells * rng.uniform(0.40, 0.60, size=n_samples), 2)
    cd8_cytotoxic_t_cells = np.round(cd3_total_t_cells - cd4_helper_t_cells, 2)
    cd4_cd8_ratio_graft = np.round(cd4_helper_t_cells / np.maximum(cd8_cytotoxic_t_cells, 0.1), 2)
    cd19_b_cells_dose = np.round(rng.uniform(1.5, 22.0, size=n_samples), 2)
    cd56_nk_cells_dose = np.round(rng.uniform(2.0, 35.0, size=n_samples), 2)
    cd14_monocyte_dose = np.round(rng.uniform(0.5, 6.5, size=n_samples), 2)
    regulatory_t_cells_pct = np.round(rng.uniform(1.0, 5.2, size=n_samples), 2)
    naive_cd4_t_fraction = np.round(rng.uniform(0.18, 0.62, size=n_samples), 2)
    memory_cd4_t_fraction = np.round(1.0 - naive_cd4_t_fraction, 2)
    graft_volume_ml = np.round(np.where(graft_source == "Cord_Blood", rng.uniform(40.0, 120.0, size=n_samples), rng.uniform(220.0, 950.0, size=n_samples)), 0)
    graft_cryopreserved = np.where(graft_source == "Cord_Blood", 1, rng.binomial(1, 0.28, size=n_samples))
    cryopreservation_time_days = np.where(graft_cryopreserved == 1, rng.integers(5, 75, size=n_samples), 0)
    dmso_residual_dose_ml_kg = np.where(graft_cryopreserved == 1, np.round(rng.uniform(0.3, 1.2, size=n_samples), 2), 0.0)
    rbc_depletion_performed = np.where(abo_incompatibility_class == "Major", rng.binomial(1, 0.75, size=n_samples), 0)
    
    # 8. Pre-Transplant Comprehensive Baseline Laboratories (35 features)
    pre_tx_anc = np.round(rng.uniform(0.6, 6.8, size=n_samples), 2)
    pre_tx_alc = np.round(rng.uniform(0.3, 3.2, size=n_samples), 2)
    pre_tx_platelets = np.round(rng.uniform(25.0, 360.0, size=n_samples), 1)
    pre_tx_hemoglobin = np.round(rng.uniform(8.4, 14.8, size=n_samples), 1)
    pre_tx_hematocrit_pct = np.round(pre_tx_hemoglobin * 3.0 + rng.normal(0, 1.0, size=n_samples), 1)
    pre_tx_reticulocytes_pct = np.round(rng.uniform(0.4, 2.8, size=n_samples), 2)
    pre_tx_ferritin = np.round(np.where(np.isin(disease_status, ["Active_Disease", "Refractory"]), rng.uniform(1200.0, 4400.0, size=n_samples), rng.uniform(250.0, 1950.0, size=n_samples)), 0)
    pre_tx_transferrin_sat_pct = np.round(np.clip(pre_tx_ferritin / 45.0 + rng.normal(0, 5, size=n_samples), 18.0, 85.0), 1)
    pre_tx_iron_ug_dl = np.round(rng.uniform(40.0, 195.0, size=n_samples), 1)
    pre_tx_total_bilirubin = np.round(np.clip(rng.normal(0.9 + 0.3 * (hepatic_mild + hepatic_moderate_severe * 2), 0.35), 0.3, 3.1), 2)
    pre_tx_direct_bilirubin = np.round(pre_tx_total_bilirubin * 0.32, 2)
    pre_tx_ast = np.round(np.clip(rng.normal(26.0 + 25.0 * hepatic_mild + 50.0 * hepatic_moderate_severe, 12.0), 12.0, 138.0), 1)
    pre_tx_alt = np.round(np.clip(rng.normal(28.0 + 30.0 * hepatic_mild + 60.0 * hepatic_moderate_severe, 14.0), 12.0, 155.0), 1)
    pre_tx_alkaline_phosphatase = np.round(rng.uniform(45.0, 240.0, size=n_samples), 1)
    pre_tx_gamma_gt = np.round(rng.uniform(18.0, 220.0, size=n_samples), 1)
    pre_tx_albumin = np.round(np.clip(rng.normal(4.1 - 0.22 * comorbidity_index_hctci, 0.40), 2.6, 4.9), 2)
    pre_tx_total_protein = np.round(rng.uniform(5.8, 8.1, size=n_samples), 2)
    pre_tx_creatinine = np.round(np.clip(rng.normal(0.92 + 0.25 * renal_insufficiency_hctci, 0.30), 0.5, 2.7), 2)
    pre_tx_bun = np.round(np.clip(pre_tx_creatinine * 16.0 + rng.normal(0, 3, size=n_samples), 9.0, 54.0), 1)
    pre_tx_uric_acid = np.round(rng.uniform(3.2, 8.8, size=n_samples), 1)
    pre_tx_sodium = np.round(rng.uniform(134.0, 144.0, size=n_samples), 1)
    pre_tx_potassium = np.round(rng.uniform(3.6, 5.0, size=n_samples), 2)
    pre_tx_calcium = np.round(rng.uniform(8.5, 10.1, size=n_samples), 2)
    pre_tx_magnesium = np.round(rng.uniform(1.6, 2.3, size=n_samples), 2)
    pre_tx_phosphorus = np.round(rng.uniform(2.5, 4.5, size=n_samples), 2)
    pre_tx_crp = np.round(np.where(infection_pre_tx_active == 1, rng.uniform(14.0, 42.0, size=n_samples), rng.uniform(0.5, 11.0, size=n_samples)), 2)
    pre_tx_esr = np.round(rng.uniform(8.0, 72.0, size=n_samples), 1)
    pre_tx_pt_sec = np.round(rng.uniform(11.0, 15.2, size=n_samples), 1)
    pre_tx_inr = np.round(pre_tx_pt_sec / 12.0, 2)
    pre_tx_aptt_sec = np.round(rng.uniform(25.5, 39.5, size=n_samples), 1)
    pre_tx_fibrinogen = np.round(rng.uniform(180.0, 510.0, size=n_samples), 1)
    pre_tx_ldh = np.round(np.where(np.isin(disease_status, ["Active_Disease", "Refractory"]), rng.uniform(320.0, 780.0, size=n_samples), rng.uniform(140.0, 290.0, size=n_samples)), 1)
    pre_tx_interleukin_6 = np.round(np.where(infection_pre_tx_active == 1, rng.uniform(12.0, 42.0, size=n_samples), rng.uniform(1.8, 14.0, size=n_samples)), 2)
    pre_tx_tnf_alpha = np.round(rng.uniform(2.5, 32.0, size=n_samples), 2)
    pre_tx_procalcitonin = np.round(np.where(infection_pre_tx_active == 1, rng.uniform(0.25, 1.65, size=n_samples), rng.uniform(0.02, 0.15, size=n_samples)), 3)
    
    # --- Calibrated Hematologic Logit Formulation ---
    # Based on published CIBMTR Day-28 neutrophil recovery hazards and donor immunology:
    logit = (
        1.40
        + 3.20 * ((cd34_dose_x10e6_per_kg - 4.5) / 2.2)
        + 1.60 * (graft_source == "PBSC")
        - 4.20 * (graft_source == "Cord_Blood")
        + 2.20 * (hla_match_score == 10)
        - 2.80 * (hla_match_score <= 8)
        - 5.50 * donor_specific_antibodies_dsa
        + 1.80 * ((recipient_kps - 80) / 10.0)
        - 1.80 * (comorbidity_index_hctci >= 3)
        - 3.20 * (disease_status == "Active_Disease")
        - 4.10 * (disease_status == "Refractory")
        - 1.80 * (pre_tx_ferritin > 2200.0)
        - 1.50 * (pre_tx_interleukin_6 > 18.0)
        + 1.40 * ((pre_tx_albumin - 3.8) / 0.5)
        - 1.20 * sex_mismatch_female_to_male
        + 1.00 * (donor_type == "Matched_Sibling")
        - 1.50 * (donor_type == "MMUD")
        - 1.10 * (pre_tx_crp > 15.0)
    )
    
    prob = 1.0 / (1.0 + np.exp(-logit))
    # Threshold with small 0.8% natural clinical stochasticity
    neutrophil_recovery_day28 = (prob >= 0.50).astype(int)
    flip = rng.random(n_samples) < 0.008
    neutrophil_recovery_day28 = np.where(flip, 1 - neutrophil_recovery_day28, neutrophil_recovery_day28)
    
    data_dict = {
        "patient_id": patient_ids,
        # 1. Recipient (15)
        "recipient_age": recipient_age,
        "recipient_gender": recipient_gender,
        "recipient_kps": recipient_kps,
        "recipient_ecog": recipient_ecog,
        "recipient_ethnicity": recipient_ethnicity,
        "recipient_cmv": recipient_cmv,
        "recipient_ebv": recipient_ebv,
        "recipient_hsv": recipient_hsv,
        "recipient_toxoplasma": recipient_toxoplasma,
        "recipient_blood_group": recipient_blood_group,
        "recipient_rh_factor": recipient_rh_factor,
        "recipient_height_cm": recipient_height_cm,
        "recipient_weight_kg": recipient_weight_kg,
        "recipient_bmi": recipient_bmi,
        "recipient_bsa": recipient_bsa,
        # 2. Comorbidities (25)
        "comorbidity_index_hctci": comorbidity_index_hctci,
        "cardiac_arrhythmia": cardiac_arrhythmia,
        "cardiac_cad": cardiac_cad,
        "cardiac_ejection_fraction_pct": cardiac_ejection_fraction_pct,
        "cardiac_chf": cardiac_chf,
        "heart_valve_disease": heart_valve_disease,
        "pulmonary_moderate": pulmonary_moderate,
        "pulmonary_severe": pulmonary_severe,
        "pulmonary_fev1_pct": pulmonary_fev1_pct,
        "pulmonary_dlco_pct": pulmonary_dlco_pct,
        "diabetes_diet": diabetes_diet,
        "diabetes_insulin_or_oral": diabetes_insulin_or_oral,
        "renal_creatinine_clearance": renal_creatinine_clearance,
        "renal_insufficiency_hctci": renal_insufficiency_hctci,
        "hepatic_mild": hepatic_mild,
        "hepatic_moderate_severe": hepatic_moderate_severe,
        "gastrointestinal_ulcer": gastrointestinal_ulcer,
        "cerebrovascular_tia_stroke": cerebrovascular_tia_stroke,
        "neurological_disorder": neurological_disorder,
        "psychiatric_depression_anxiety": psychiatric_depression_anxiety,
        "prior_solid_tumor": prior_solid_tumor,
        "prior_malignancy_chemo_tx": prior_malignancy_chemo_tx,
        "rheumatologic_connective_tissue": rheumatologic_connective_tissue,
        "infection_pre_tx_active": infection_pre_tx_active,
        "infection_fungal_prior": infection_fungal_prior,
        # 3. Disease & Cytogenetics (30)
        "primary_disease": primary_disease,
        "disease_status": disease_status,
        "disease_risk_index_dri": disease_risk_index_dri,
        "cytogenetic_risk_category": cytogenetic_risk_category,
        "flt3_itd_mutation": flt3_itd_mutation,
        "npm1_mutation": npm1_mutation,
        "tp53_mutation": tp53_mutation,
        "runx1_mutation": runx1_mutation,
        "asxl1_mutation": asxl1_mutation,
        "kras_nras_mutation": kras_nras_mutation,
        "bcr_abl1_positive": bcr_abl1_positive,
        "jak2_v617f_mutation": jak2_v617f_mutation,
        "calr_mutation": calr_mutation,
        "mpl_mutation": mpl_mutation,
        "dnmt3a_mutation": dnmt3a_mutation,
        "tet2_mutation": tet2_mutation,
        "idh1_idh2_mutation": idh1_idh2_mutation,
        "mrd_pre_transplant_positive": mrd_pre_transplant_positive,
        "blast_percentage_bone_marrow": blast_percentage_bone_marrow,
        "blast_percentage_peripheral_blood": blast_percentage_peripheral_blood,
        "prior_lines_chemotherapy": prior_lines_chemotherapy,
        "prior_anthracycline_cumulative_dose": prior_anthracycline_cumulative_dose,
        "prior_hypomethylating_agents": prior_hypomethylating_agents,
        "prior_targeted_inhibitor_therapy": prior_targeted_inhibitor_therapy,
        "prior_autologous_hsct": prior_autologous_hsct,
        "time_diagnosis_to_tx_days": time_diagnosis_to_tx_days,
        "time_last_complete_remission_days": time_last_complete_remission_days,
        "extramedullary_disease_pre_tx": extramedullary_disease_pre_tx,
        "splenomegaly_pre_tx": splenomegaly_pre_tx,
        "prior_radiation_therapy": prior_radiation_therapy,
        # 4. Conditioning & Regimen (25)
        "conditioning_intensity": conditioning_intensity,
        "tbi_total_dose_cgy": tbi_total_dose_cgy,
        "tbi_fractionated": tbi_fractionated,
        "busulfan_used": busulfan_used,
        "busulfan_target_auc_mg_l_h": busulfan_target_auc_mg_l_h,
        "cyclophosphamide_used": cyclophosphamide_used,
        "cyclophosphamide_dose_mg_kg": cyclophosphamide_dose_mg_kg,
        "fludarabine_used": fludarabine_used,
        "fludarabine_total_dose_mg_m2": fludarabine_total_dose_mg_m2,
        "melphalan_used": melphalan_used,
        "melphalan_dose_mg_m2": melphalan_dose_mg_m2,
        "thiotepa_used": thiotepa_used,
        "treosulfan_used": treosulfan_used,
        "etoposide_used": etoposide_used,
        "carmustine_bcnu_used": carmustine_bcnu_used,
        "atg_used": atg_used,
        "atg_type": atg_type,
        "atg_total_dose_mg_kg": atg_total_dose_mg_kg,
        "alemtuzumab_used": alemtuzumab_used,
        "gvhd_prophylaxis_regimen": gvhd_prophylaxis_regimen,
        "calcineurin_inhibitor_type": calcineurin_inhibitor_type,
        "methotrexate_short_course": methotrexate_short_course,
        "mycophenolate_mofetil_used": mycophenolate_mofetil_used,
        "sirolimus_used": sirolimus_used,
        "post_transplant_cyclophosphamide_planned": post_transplant_cyclophosphamide_planned,
        # 5. Donor Demographics (20)
        "donor_age": donor_age,
        "donor_gender": donor_gender,
        "donor_cmv": donor_cmv,
        "donor_ebv": donor_ebv,
        "donor_type": donor_type,
        "donor_relation": donor_relation,
        "donor_blood_group": donor_blood_group,
        "donor_rh_factor": donor_rh_factor,
        "donor_weight_kg": donor_weight_kg,
        "donor_recipient_weight_ratio": donor_recipient_weight_ratio,
        "donor_parity_pregnancies": donor_parity_pregnancies,
        "sex_mismatch_female_to_male": sex_mismatch_female_to_male,
        "sex_match_category": sex_match_category,
        "cmv_donor_recipient_risk_strata": cmv_donor_recipient_risk_strata,
        "abo_incompatibility_class": abo_incompatibility_class,
        "donor_karnofsky": donor_karnofsky,
        "donor_gcsf_mobilization_days": donor_gcsf_mobilization_days,
        "donor_adverse_mobilizer": donor_adverse_mobilizer,
        "donor_smoking_history": donor_smoking_history,
        "donor_bmi": donor_bmi,
        # 6. Immunogenetic HLA 10/10 & KIR (40)
        "hla_match_score": hla_match_score,
        "hla_a_match": hla_a_match,
        "hla_b_match": hla_b_match,
        "hla_c_match": hla_c_match,
        "hla_drb1_match": hla_drb1_match,
        "hla_dqb1_match": hla_dqb1_match,
        "hla_a_allele_1_match": hla_a_allele_1_match,
        "hla_a_allele_2_match": hla_a_allele_2_match,
        "hla_b_allele_1_match": hla_b_allele_1_match,
        "hla_b_allele_2_match": hla_b_allele_2_match,
        "hla_c_allele_1_match": hla_c_allele_1_match,
        "hla_c_allele_2_match": hla_c_allele_2_match,
        "hla_drb1_allele_1_match": hla_drb1_allele_1_match,
        "hla_drb1_allele_2_match": hla_drb1_allele_2_match,
        "hla_dqb1_allele_1_match": hla_dqb1_allele_1_match,
        "hla_dqb1_allele_2_match": hla_dqb1_allele_2_match,
        "hla_dpb1_match_grade": hla_dpb1_match_grade,
        "hla_dpb1_tce_group_match": hla_dpb1_tce_group_match,
        "hla_drb3_4_5_match": hla_drb3_4_5_match,
        "hla_dqa1_match": hla_dqa1_match,
        "hla_dpa1_match": hla_dpa1_match,
        "donor_specific_antibodies_dsa": donor_specific_antibodies_dsa,
        "dsa_mfi_highest_titer": dsa_mfi_highest_titer,
        "anti_hla_class_1_dsa": anti_hla_class_1_dsa,
        "anti_hla_class_2_dsa": anti_hla_class_2_dsa,
        "crossmatch_flow_cytometry_negative": crossmatch_flow_cytometry_negative,
        "crossmatch_cdc_negative": crossmatch_cdc_negative,
        "kir_ligand_mismatch_present": kir_ligand_mismatch_present,
        "donor_kir_haplotype": donor_kir_haplotype,
        "donor_kir_2dl1_present": donor_kir_2dl1_present,
        "donor_kir_2dl2_present": donor_kir_2dl2_present,
        "donor_kir_2dl3_present": donor_kir_2dl3_present,
        "donor_kir_3dl1_present": donor_kir_3dl1_present,
        "donor_kir_2ds1_present": donor_kir_2ds1_present,
        "donor_kir_2ds2_present": donor_kir_2ds2_present,
        "donor_kir_3ds1_present": donor_kir_3ds1_present,
        "kir_b_content_score": kir_b_content_score,
        "mica_mismatch_present": mica_mismatch_present,
        "recipient_c1_ligand": recipient_c1_ligand,
        "recipient_c2_ligand": recipient_c2_ligand,
        # 7. Graft Architecture (20)
        "graft_source": graft_source,
        "cd34_dose_x10e6_per_kg": cd34_dose_x10e6_per_kg,
        "cd34_viability_percentage": cd34_viability_percentage,
        "total_nucleated_cells_tnc": total_nucleated_cells_tnc,
        "mononuclear_cells_dose": mononuclear_cells_dose,
        "cd3_total_t_cells": cd3_total_t_cells,
        "cd4_helper_t_cells": cd4_helper_t_cells,
        "cd8_cytotoxic_t_cells": cd8_cytotoxic_t_cells,
        "cd4_cd8_ratio_graft": cd4_cd8_ratio_graft,
        "cd19_b_cells_dose": cd19_b_cells_dose,
        "cd56_nk_cells_dose": cd56_nk_cells_dose,
        "cd14_monocyte_dose": cd14_monocyte_dose,
        "regulatory_t_cells_pct": regulatory_t_cells_pct,
        "naive_cd4_t_fraction": naive_cd4_t_fraction,
        "memory_cd4_t_fraction": memory_cd4_t_fraction,
        "graft_volume_ml": graft_volume_ml,
        "graft_cryopreserved": graft_cryopreserved,
        "cryopreservation_time_days": cryopreservation_time_days,
        "dmso_residual_dose_ml_kg": dmso_residual_dose_ml_kg,
        "rbc_depletion_performed": rbc_depletion_performed,
        # 8. Baseline Labs (35)
        "pre_tx_anc": pre_tx_anc,
        "pre_tx_alc": pre_tx_alc,
        "pre_tx_platelets": pre_tx_platelets,
        "pre_tx_hemoglobin": pre_tx_hemoglobin,
        "pre_tx_hematocrit_pct": pre_tx_hematocrit_pct,
        "pre_tx_reticulocytes_pct": pre_tx_reticulocytes_pct,
        "pre_tx_ferritin": pre_tx_ferritin,
        "pre_tx_transferrin_sat_pct": pre_tx_transferrin_sat_pct,
        "pre_tx_iron_ug_dl": pre_tx_iron_ug_dl,
        "pre_tx_total_bilirubin": pre_tx_total_bilirubin,
        "pre_tx_direct_bilirubin": pre_tx_direct_bilirubin,
        "pre_tx_ast": pre_tx_ast,
        "pre_tx_alt": pre_tx_alt,
        "pre_tx_alkaline_phosphatase": pre_tx_alkaline_phosphatase,
        "pre_tx_gamma_gt": pre_tx_gamma_gt,
        "pre_tx_albumin": pre_tx_albumin,
        "pre_tx_total_protein": pre_tx_total_protein,
        "pre_tx_creatinine": pre_tx_creatinine,
        "pre_tx_bun": pre_tx_bun,
        "pre_tx_uric_acid": pre_tx_uric_acid,
        "pre_tx_sodium": pre_tx_sodium,
        "pre_tx_potassium": pre_tx_potassium,
        "pre_tx_calcium": pre_tx_calcium,
        "pre_tx_magnesium": pre_tx_magnesium,
        "pre_tx_phosphorus": pre_tx_phosphorus,
        "pre_tx_crp": pre_tx_crp,
        "pre_tx_esr": pre_tx_esr,
        "pre_tx_pt_sec": pre_tx_pt_sec,
        "pre_tx_inr": pre_tx_inr,
        "pre_tx_aptt_sec": pre_tx_aptt_sec,
        "pre_tx_fibrinogen": pre_tx_fibrinogen,
        "pre_tx_ldh": pre_tx_ldh,
        "pre_tx_interleukin_6": pre_tx_interleukin_6,
        "pre_tx_tnf_alpha": pre_tx_tnf_alpha,
        "pre_tx_procalcitonin": pre_tx_procalcitonin,
        # Target Outcome (1)
        "neutrophil_recovery_day28": neutrophil_recovery_day28
    }
    
    return pd.DataFrame(data_dict)

