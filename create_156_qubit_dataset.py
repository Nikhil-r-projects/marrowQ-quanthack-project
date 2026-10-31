"""
Generates the MarrowQ 156-Qubit IBM Heron Precision Medicine Benchmark Cohort.
- Exactly 156 pre-transplant clinical features (Qubit 0 to Qubit 155)
- N = 750 de-identified patient records
- Ground truth target: early_engraftment (Neutrophil recovery <= Day 14)
- Realistic non-linear multi-organ biology with real clinical noise
"""
import numpy as np
import pandas as pd

np.random.seed(42)
N = 750

# 1. Demographics & Anthropometrics (8)
age = np.clip(np.random.normal(46, 17, N), 2.0, 74.0).round(1)
gender = np.random.choice(["Male", "Female"], N, p=[0.58, 0.42])
height = np.clip(np.random.normal(168, 12, N), 120.0, 198.0).round(1)
weight = np.clip(np.random.normal(72, 16, N), 35.0, 125.0).round(1)
bmi = (weight / ((height / 100) ** 2)).round(1)
kps = np.random.choice([60, 70, 80, 90, 100], N, p=[0.05, 0.15, 0.35, 0.35, 0.10])
ecog = np.where(kps >= 90, 0, np.where(kps >= 80, 1, np.where(kps >= 70, 2, 3)))
ethnicity = np.random.choice(["EUR", "AFR", "HIS", "EAS", "SAS", "MIX"], N, p=[0.55, 0.15, 0.12, 0.08, 0.06, 0.04])

# 2. Hematology & CBC Panel (14)
wbc = np.clip(np.random.lognormal(1.2, 0.6, N), 0.4, 45.0).round(2)
anc = np.clip(np.random.lognormal(6.5, 1.1, N), 50, 9500).round(0)
alc = np.clip(np.random.normal(1100, 450, N), 150, 3200).round(0)
amc = np.clip(np.random.normal(420, 180, N), 50, 1100).round(0)
aec = np.clip(np.random.exponential(120, N), 10, 800).round(0)
platelets = np.clip(np.random.lognormal(10.8, 0.9, N), 8000, 380000).round(0)
hb = np.clip(np.random.normal(9.8, 1.8, N), 6.5, 14.8).round(1)
hct = (hb * 3.0 + np.random.normal(0, 1.2, N)).clip(20.0, 48.0).round(1)
mcv = np.clip(np.random.normal(89, 7, N), 70, 112).round(1)
rdw = np.clip(np.random.normal(15.2, 2.1, N), 11.5, 23.0).round(1)
retic_abs = np.clip(np.random.normal(38, 22, N), 5, 120).round(1)
retic_pct = (retic_abs / 40.0).clip(0.2, 3.8).round(2)
bm_cellularity = np.clip(np.random.normal(55, 24, N), 5, 95).round(0)
bm_blasts = np.clip(np.random.exponential(6.5, N), 0.5, 68.0).round(1)

# 3. Metabolic, Renal & Hepatic (14)
creatinine = np.clip(np.random.lognormal(0.05, 0.35, N), 0.5, 3.8).round(2)
bun = np.clip(creatinine * 16 + np.random.normal(0, 4, N), 7, 65).round(1)
egfr = np.clip(141 * np.minimum(creatinine/0.9, 1)**(-0.411) * np.maximum(creatinine/0.9, 1)**(-1.209) * 0.993**age, 15, 125).round(1)
t_bili = np.clip(np.random.lognormal(-0.1, 0.45, N), 0.3, 4.2).round(2)
d_bili = (t_bili * 0.35).round(2)
ast = np.clip(np.random.lognormal(3.3, 0.4, N), 12, 160).round(0)
alt = np.clip(np.random.lognormal(3.4, 0.45, N), 10, 190).round(0)
alp = np.clip(np.random.normal(88, 30, N), 35, 280).round(0)
albumin = np.clip(np.random.normal(3.7, 0.55, N), 2.1, 4.9).round(1)
total_protein = (albumin + np.random.normal(2.8, 0.4, N)).clip(5.2, 8.8).round(1)
ldh = np.clip(np.random.lognormal(5.6, 0.45, N), 140, 1250).round(0)
uric_acid = np.clip(np.random.normal(5.6, 1.4, N), 2.5, 11.0).round(1)
sodium = np.clip(np.random.normal(138, 3.2, N), 127, 147).round(0)
inr = np.clip(np.random.normal(1.08, 0.15, N), 0.85, 2.1).round(2)

# 4. Inflammatory & Immunological Markers (8)
ferritin = np.clip(np.random.lognormal(6.8, 0.9, N), 80, 9500).round(0)
transferrin_sat = np.clip(np.random.normal(36, 16, N), 10, 85).round(1)
crp = np.clip(np.random.lognormal(2.1, 1.1, N), 0.5, 140).round(1)
procalcitonin = np.clip(np.random.exponential(0.18, N), 0.02, 3.8).round(3)
fibrinogen = np.clip(np.random.normal(360, 95, N), 160, 720).round(0)
d_dimer = np.clip(np.random.lognormal(-0.2, 0.7, N), 0.2, 8.5).round(2)
beta2_microglobulin = np.clip(np.random.lognormal(0.8, 0.45, N), 1.1, 8.5).round(2)
esr = np.clip(np.random.normal(28, 18, N), 3, 95).round(0)

# 5. Sorror HCT-CI Comorbidity Domains (16)
hct_arrhythmia = np.random.binomial(1, 0.08, N)
hct_cardiac = np.random.binomial(1, 0.09, N)
hct_ibd = np.random.binomial(1, 0.03, N)
hct_diabetes = np.random.binomial(1, 0.14, N)
hct_cva = np.random.binomial(1, 0.04, N)
hct_hepatic_mild = np.random.binomial(1, 0.16, N)
hct_hepatic_mod_sev = np.random.binomial(1, 0.03, N)
hct_obesity = np.where(bmi >= 35, 1, 0)
hct_peptic = np.random.binomial(1, 0.05, N)
hct_renal = np.where(creatinine > 2.0, 1, 0)
hct_pulm_mod = np.random.binomial(1, 0.22, N)
hct_pulm_sev = np.random.binomial(1, 0.07, N)
hct_prior_tumor = np.random.binomial(1, 0.06, N)
hct_valve = np.random.binomial(1, 0.04, N)
hct_psych = np.random.binomial(1, 0.12, N)
hct_total = (hct_arrhythmia + hct_cardiac*2 + hct_ibd + hct_diabetes + hct_cva +
             hct_hepatic_mild + hct_hepatic_mod_sev*3 + hct_obesity + hct_peptic +
             hct_renal*2 + hct_pulm_mod*2 + hct_pulm_sev*3 + hct_prior_tumor*3 +
             hct_valve + hct_psych).clip(0, 12)

# 6. Cardiac & Pulmonary Physiology (5)
lvef = np.clip(np.random.normal(58, 6.5, N), 35.0, 72.0).round(1)
sbp = np.clip(np.random.normal(124, 15, N), 90, 175).round(0)
dlco = np.clip(np.random.normal(76, 14, N), 40.0, 110.0).round(1)
fev1 = np.clip(np.random.normal(82, 13, N), 45.0, 115.0).round(1)
fvc = np.clip(np.random.normal(84, 12, N), 48.0, 118.0).round(1)

# 7. Disease Staging & Clinical Genetics (9)
disease = np.random.choice(["AML", "MDS", "ALL", "CML", "CLL", "MPN", "MM", "SAA"], N, p=[0.38, 0.20, 0.16, 0.08, 0.05, 0.04, 0.05, 0.04])
disease_status = np.random.choice(["CR1", "CR2", "PR", "Relapse", "Refractory"], N, p=[0.48, 0.22, 0.12, 0.10, 0.08])
dri = np.random.choice(["Low", "Intermediate", "High", "Very High"], N, p=[0.18, 0.50, 0.24, 0.08])
cyto_risk = np.random.choice(["Favorable", "Intermediate", "Adverse"], N, p=[0.24, 0.52, 0.24])
time_diag_to_tx = np.clip(np.random.exponential(180, N) + 45, 30, 950).round(0)
prior_auto_tx = np.random.binomial(1, 0.09, N)
prior_chemo_lines = np.random.choice([1, 2, 3, 4], N, p=[0.55, 0.28, 0.12, 0.05])
prior_radiation = np.random.binomial(1, 0.11, N)
prior_tki = np.where(disease == "CML", 1, np.random.binomial(1, 0.08, N))

# 8. NGS Somatic Mutations (12)
mut_tp53 = np.where(cyto_risk == "Adverse", np.random.binomial(1, 0.35, N), np.random.binomial(1, 0.04, N))
mut_npm1 = np.where(disease == "AML", np.random.binomial(1, 0.32, N), 0)
mut_flt3_itd = np.where(disease == "AML", np.random.binomial(1, 0.24, N), 0)
mut_dnmt3a = np.where(disease == "AML", np.random.binomial(1, 0.22, N), 0)
mut_tet2 = np.random.binomial(1, 0.15, N)
mut_asxl1 = np.where(cyto_risk == "Adverse", np.random.binomial(1, 0.28, N), np.random.binomial(1, 0.08, N))
mut_runx1 = np.random.binomial(1, 0.12, N)
mut_idh1 = np.random.binomial(1, 0.08, N)
mut_idh2 = np.random.binomial(1, 0.10, N)
mut_sf3b1 = np.where(disease == "MDS", np.random.binomial(1, 0.28, N), 0)
mut_jak2 = np.where(disease == "MPN", np.random.binomial(1, 0.65, N), 0)
mut_bcr_abl1 = np.where(disease == "CML", 1, np.where(disease == "ALL", np.random.binomial(1, 0.25, N), 0))

# 9. Flow Cytometry Surface Markers (8)
flow_cd34 = np.clip(np.random.normal(82, 16, N), 25, 99).round(1)
flow_cd117 = np.clip(np.random.normal(78, 18, N), 18, 98).round(1)
flow_cd33 = np.clip(np.random.normal(88, 12, N), 40, 99).round(1)
flow_cd13 = np.clip(np.random.normal(72, 19, N), 20, 98).round(1)
flow_cd38 = np.clip(np.random.normal(85, 14, N), 30, 99).round(1)
flow_hla_dr = np.clip(np.random.normal(79, 17, N), 22, 99).round(1)
flow_cd56 = np.random.binomial(1, 0.18, N)
pre_tx_mrd = np.where(disease_status == "CR1", np.random.binomial(1, 0.22, N), 1)

# 10. Conditioning Regimen & Dosing (10)
cond_intensity = np.where(age > 60, "RIC", np.where(hct_total >= 3, "RIC", np.random.choice(["MAC", "RIC"], N, p=[0.65, 0.35])))
tbi_used = np.random.binomial(1, 0.28, N)
tbi_dose = np.where(tbi_used == 1, np.random.choice([8.0, 12.0, 13.2], N, p=[0.2, 0.5, 0.3]), 0.0)
busulfan_used = np.where(tbi_used == 0, 1, 0)
bu_auc = np.where(busulfan_used == 1, np.clip(np.random.normal(4800, 550, N), 3500, 6200).round(0), 0.0)
cy_used = np.random.binomial(1, 0.72, N)
cy_dose = np.where(cy_used == 1, np.random.choice([100.0, 120.0, 200.0], N, p=[0.3, 0.5, 0.2]), 0.0)
fludarabine_used = np.random.binomial(1, 0.78, N)
fludarabine_dose = np.where(fludarabine_used == 1, np.clip(np.random.normal(150, 25, N), 90, 200).round(0), 0.0)
atg_used = np.random.binomial(1, 0.42, N)

# 11. GvHD Prophylaxis (6)
gvhd_prophylaxis = np.random.choice(["Tacrolimus+MTX", "Cyclosporine+MTX", "PTCy+Tacro+MMF", "Tacrolimus+MMF"], N, p=[0.45, 0.25, 0.20, 0.10])
tacro_used = np.where(np.char.find(gvhd_prophylaxis.astype(str), "Tacro") >= 0, 1, 0)
csa_used = np.where(np.char.find(gvhd_prophylaxis.astype(str), "Cyclosporine") >= 0, 1, 0)
mtx_used = np.where(np.char.find(gvhd_prophylaxis.astype(str), "MTX") >= 0, 1, 0)
mmf_used = np.where(np.char.find(gvhd_prophylaxis.astype(str), "MMF") >= 0, 1, 0)
ptcy_used = np.where(np.char.find(gvhd_prophylaxis.astype(str), "PTCy") >= 0, 1, 0)

# 12. Donor Characteristics (8)
donor_age = np.clip(np.random.normal(32, 10, N), 18.0, 65.0).round(1)
donor_gender = np.random.choice(["Male", "Female"], N, p=[0.65, 0.35])
donor_type = np.random.choice(["Matched Sibling", "10/10 MUD", "9/10 MMUD", "Haploidentical"], N, p=[0.32, 0.48, 0.12, 0.08])
female_to_male = np.where((donor_gender == "Female") & (gender == "Male"), 1, 0)
donor_parity = np.where(donor_gender == "Female", np.random.choice([0, 1, 2, 3], N, p=[0.45, 0.25, 0.20, 0.10]), 0)
donor_weight = np.clip(np.random.normal(75, 14, N), 48.0, 115.0).round(1)
donor_recip_weight_ratio = (donor_weight / weight).round(2)
donor_kps = np.random.choice([90, 100], N, p=[0.25, 0.75])

# 13. Serology & Viral Matching (6)
recip_cmv = np.random.choice(["Positive", "Negative"], N, p=[0.60, 0.40])
donor_cmv = np.random.choice(["Positive", "Negative"], N, p=[0.52, 0.48])
cmv_pair = np.where((donor_cmv=="Negative") & (recip_cmv=="Positive"), "D-R+",
           np.where((donor_cmv=="Positive") & (recip_cmv=="Positive"), "D+R+",
           np.where((donor_cmv=="Positive") & (recip_cmv=="Negative"), "D+R-", "D-R-")))
recip_ebv = np.random.choice(["Positive", "Negative"], N, p=[0.92, 0.08])
donor_ebv = np.random.choice(["Positive", "Negative"], N, p=[0.88, 0.12])
toxo_mismatch = np.random.binomial(1, 0.14, N)

# 14. ABO Blood Group Compatibility (4)
recip_abo = np.random.choice(["O", "A", "B", "AB"], N, p=[0.45, 0.40, 0.11, 0.04])
donor_abo = np.random.choice(["O", "A", "B", "AB"], N, p=[0.44, 0.41, 0.11, 0.04])
abo_match = np.where(recip_abo == donor_abo, "Identical",
            np.where((donor_abo=="O") & (recip_abo!="O"), "Minor Mismatch",
            np.where((donor_abo!="O") & (recip_abo=="O"), "Major Mismatch", "Bidirectional")))
recip_rh = np.random.choice(["Positive", "Negative"], N, p=[0.85, 0.15])

# 15. 12-Allele HLA Matching & DSA Antibodies (8)
hla_match_tier = np.where(donor_type == "Matched Sibling", "12/12",
                 np.where(donor_type == "10/10 MUD", "10/10",
                 np.where(donor_type == "9/10 MMUD", "9/10", "Haplo (5-8/10)")))
hla_ag_diffs = np.where(hla_match_tier == "12/12", 0, np.where(hla_match_tier == "10/10", 0, np.where(hla_match_tier == "9/10", 1, 3)))
hla_allele_diffs = np.where(hla_match_tier == "12/12", 0, np.where(hla_match_tier == "10/10", 0, np.where(hla_match_tier == "9/10", 1, 4)))
hla_class_i_diffs = np.where(hla_ag_diffs > 0, np.random.binomial(1, 0.6, N), 0)
hla_class_ii_diffs = np.where(hla_ag_diffs > 0, np.random.binomial(1, 0.5, N), 0)
dpb1_tce = np.random.choice(["Permissive", "Non-permissive"], N, p=[0.72, 0.28])
dsa_class_i_mfi = np.clip(np.random.exponential(450, N), 50, 9500).round(0)
dsa_class_ii_mfi = np.clip(np.random.exponential(380, N), 40, 8200).round(0)

# 16. Graft Formulation & Stem Cell Dosing (8)
graft_source = np.random.choice(["PBSC", "Bone Marrow"], N, p=[0.76, 0.24])
cd34_dose = np.where(graft_source == "PBSC",
                     np.clip(np.random.normal(6.8, 2.1, N), 2.2, 14.5),
                     np.clip(np.random.normal(3.8, 1.2, N), 1.5, 7.5)).round(2)
cd3_dose = np.where(graft_source == "PBSC",
                    np.clip(np.random.normal(4.2, 1.4, N), 1.2, 8.8),
                    np.clip(np.random.normal(0.42, 0.15, N), 0.12, 0.95)).round(2)
cd34_cd3_ratio = (cd34_dose / np.maximum(cd3_dose, 0.1)).round(2)
tnc_dose = (cd34_dose * 1.8 + np.random.normal(0, 0.6, N)).clip(2.0, 25.0).round(2)
mnc_dose = (cd34_dose * 0.95 + np.random.normal(0, 0.3, N)).clip(1.1, 15.0).round(2)
graft_cryopreserved = np.random.binomial(1, 0.14, N)
transit_hours = np.clip(np.random.exponential(8, N) + 2, 2.0, 48.0).round(1)

# 17. Pharmacogenomics Activity Scores (9)
tpmt_score = np.random.choice([0.0, 0.5, 1.0, 1.5, 2.0], N, p=[0.01, 0.04, 0.10, 0.35, 0.50])
nudt15_score = np.random.choice([0.0, 1.0, 2.0], N, p=[0.01, 0.08, 0.91])
cyp2c19_score = np.random.choice(["UM", "RM", "NM", "IM", "PM"], N, p=[0.05, 0.25, 0.40, 0.22, 0.08])
dpyd_score = np.random.choice([1.0, 1.5, 2.0], N, p=[0.02, 0.06, 0.92])
ugt1a1_score = np.random.choice(["*1/*1", "*1/*28", "*28/*28"], N, p=[0.45, 0.42, 0.13])
cyp2d6_score = np.random.choice([0.0, 0.5, 1.0, 1.5, 2.0], N, p=[0.07, 0.12, 0.35, 0.30, 0.16])
cyp2c9_score = np.random.choice([0.5, 1.0, 1.5, 2.0], N, p=[0.05, 0.18, 0.32, 0.45])
vkorc1_genotype = np.random.choice(["GG", "GA", "AA"], N, p=[0.38, 0.46, 0.16])
slco1b1_score = np.random.choice(["Normal", "Intermediate", "Poor"], N, p=[0.70, 0.26, 0.04])

# Build Dictionary of 156 features
features = {
    # 1. Demographics (8)
    "q000_recipient_age": age,
    "q001_recipient_gender": gender,
    "q002_recipient_height_cm": height,
    "q003_recipient_weight_kg": weight,
    "q004_recipient_bmi": bmi,
    "q005_recipient_kps": kps,
    "q006_recipient_ecog": ecog,
    "q007_ethnicity_ancestry": ethnicity,

    # 2. Hematology CBC (14)
    "q008_pre_tx_wbc": wbc,
    "q009_pre_tx_anc": anc,
    "q010_pre_tx_alc": alc,
    "q011_pre_tx_amc": amc,
    "q012_pre_tx_aec": aec,
    "q013_pre_tx_platelets": platelets,
    "q014_pre_tx_hemoglobin": hb,
    "q015_pre_tx_hematocrit": hct,
    "q016_pre_tx_mcv": mcv,
    "q017_pre_tx_rdw": rdw,
    "q018_pre_tx_reticulocytes_abs": retic_abs,
    "q019_pre_tx_reticulocytes_pct": retic_pct,
    "q020_bm_cellularity_pct": bm_cellularity,
    "q021_bm_blasts_pct": bm_blasts,

    # 3. Metabolic & Biochemistry (14)
    "q022_serum_creatinine": creatinine,
    "q023_serum_bun": bun,
    "q024_serum_egfr": egfr,
    "q025_serum_total_bilirubin": t_bili,
    "q026_serum_direct_bilirubin": d_bili,
    "q027_serum_ast": ast,
    "q028_serum_alt": alt,
    "q029_serum_alp": alp,
    "q030_serum_albumin": albumin,
    "q031_serum_total_protein": total_protein,
    "q032_serum_ldh": ldh,
    "q033_serum_uric_acid": uric_acid,
    "q034_serum_sodium": sodium,
    "q035_serum_inr": inr,

    # 4. Inflammatory & Immune (8)
    "q036_serum_ferritin": ferritin,
    "q037_transferrin_saturation": transferrin_sat,
    "q038_serum_crp": crp,
    "q039_serum_procalcitonin": procalcitonin,
    "q040_serum_fibrinogen": fibrinogen,
    "q041_serum_d_dimer": d_dimer,
    "q042_beta2_microglobulin": beta2_microglobulin,
    "q043_serum_esr": esr,

    # 5. HCT-CI Comorbidity (16)
    "q044_hctci_arrhythmia": hct_arrhythmia,
    "q045_hctci_cardiac": hct_cardiac,
    "q046_hctci_ibd": hct_ibd,
    "q047_hctci_diabetes": hct_diabetes,
    "q048_hctci_cva": hct_cva,
    "q049_hctci_hepatic_mild": hct_hepatic_mild,
    "q050_hctci_hepatic_severe": hct_hepatic_mod_sev,
    "q051_hctci_obesity": hct_obesity,
    "q052_hctci_peptic_ulcer": hct_peptic,
    "q053_hctci_renal": hct_renal,
    "q054_hctci_pulm_mod": hct_pulm_mod,
    "q055_hctci_pulm_sev": hct_pulm_sev,
    "q056_hctci_prior_tumor": hct_prior_tumor,
    "q057_hctci_valve_disease": hct_valve,
    "q058_hctci_psychiatric": hct_psych,
    "q059_hctci_total_score": hct_total,

    # 6. Cardiopulmonary Physiology (5)
    "q060_cardiac_lvef_pct": lvef,
    "q061_systolic_bp": sbp,
    "q062_pulmonary_dlco_pct": dlco,
    "q063_pulmonary_fev1_pct": fev1,
    "q064_pulmonary_fvc_pct": fvc,

    # 7. Disease & Genetics (9)
    "q065_primary_disease": disease,
    "q066_disease_status_at_tx": disease_status,
    "q067_disease_risk_index_dri": dri,
    "q068_cytogenetic_risk": cyto_risk,
    "q069_time_diag_to_tx_days": time_diag_to_tx,
    "q070_prior_auto_transplant": prior_auto_tx,
    "q071_prior_chemo_lines": prior_chemo_lines,
    "q072_prior_radiation": prior_radiation,
    "q073_prior_tki_therapy": prior_tki,

    # 8. NGS Mutations (12)
    "q074_mutation_tp53": mut_tp53,
    "q075_mutation_npm1": mut_npm1,
    "q076_mutation_flt3_itd": mut_flt3_itd,
    "q077_mutation_dnmt3a": mut_dnmt3a,
    "q078_mutation_tet2": mut_tet2,
    "q079_mutation_asxl1": mut_asxl1,
    "q080_mutation_runx1": mut_runx1,
    "q081_mutation_idh1": mut_idh1,
    "q082_mutation_idh2": mut_idh2,
    "q083_mutation_sf3b1": mut_sf3b1,
    "q084_mutation_jak2": mut_jak2,
    "q085_mutation_bcr_abl1": mut_bcr_abl1,

    # 9. Flow Cytometry (8)
    "q086_flow_cd34_positive": flow_cd34,
    "q087_flow_cd117_positive": flow_cd117,
    "q088_flow_cd33_positive": flow_cd33,
    "q089_flow_cd13_positive": flow_cd13,
    "q090_flow_cd38_positive": flow_cd38,
    "q091_flow_hla_dr_positive": flow_hla_dr,
    "q092_flow_cd56_aberrant": flow_cd56,
    "q093_pre_tx_mrd_positive": pre_tx_mrd,

    # 10. Conditioning Regimen (10)
    "q094_conditioning_intensity": cond_intensity,
    "q095_tbi_used": tbi_used,
    "q096_tbi_dose_gy": tbi_dose,
    "q097_busulfan_used": busulfan_used,
    "q098_busulfan_target_auc": bu_auc,
    "q099_cyclophosphamide_used": cy_used,
    "q100_cyclophosphamide_dose": cy_dose,
    "q101_fludarabine_used": fludarabine_used,
    "q102_fludarabine_dose": fludarabine_dose,
    "q103_atg_serotherapy": atg_used,

    # 11. GvHD Prophylaxis (6)
    "q104_gvhd_prophylaxis_regimen": gvhd_prophylaxis,
    "q105_tacrolimus_prophylaxis": tacro_used,
    "q106_cyclosporine_prophylaxis": csa_used,
    "q107_methotrexate_prophylaxis": mtx_used,
    "q108_mmf_prophylaxis": mmf_used,
    "q109_ptcy_prophylaxis": ptcy_used,

    # 12. Donor Factors (8)
    "q110_donor_age": donor_age,
    "q111_donor_gender": donor_gender,
    "q112_donor_type": donor_type,
    "q113_female_to_male_mismatch": female_to_male,
    "q114_donor_parity": donor_parity,
    "q115_donor_weight_kg": donor_weight,
    "q116_donor_recip_weight_ratio": donor_recip_weight_ratio,
    "q117_donor_kps": donor_kps,

    # 13. Viral Status (6)
    "q118_recipient_cmv": recip_cmv,
    "q119_donor_cmv": donor_cmv,
    "q120_cmv_serostatus_pair": cmv_pair,
    "q121_recipient_ebv": recip_ebv,
    "q122_donor_ebv": donor_ebv,
    "q123_toxoplasma_mismatch": toxo_mismatch,

    # 14. ABO Compatibility (4)
    "q124_recipient_abo": recip_abo,
    "q125_donor_abo": donor_abo,
    "q126_abo_match_category": abo_match,
    "q127_recipient_rh_factor": recip_rh,

    # 15. HLA Typing & DSA (8)
    "q128_hla_match_tier": hla_match_tier,
    "q129_hla_antigen_diffs": hla_ag_diffs,
    "q130_hla_allele_diffs": hla_allele_diffs,
    "q131_hla_class_i_diffs": hla_class_i_diffs,
    "q132_hla_class_ii_diffs": hla_class_ii_diffs,
    "q133_dpb1_tce_permissive": dpb1_tce,
    "q134_dsa_class_i_mfi": dsa_class_i_mfi,
    "q135_dsa_class_ii_mfi": dsa_class_ii_mfi,

    # 16. Stem Cell Graft Formulation (8)
    "q136_graft_source": graft_source,
    "q137_cd34_dose_x10e6_kg": cd34_dose,
    "q138_cd3_dose_x10e8_kg": cd3_dose,
    "q139_cd34_cd3_ratio": cd34_cd3_ratio,
    "q140_tnc_dose_x10e8_kg": tnc_dose,
    "q141_mnc_dose_x10e8_kg": mnc_dose,
    "q142_graft_cryopreserved": graft_cryopreserved,
    "q143_transit_time_hours": transit_hours,

    # 17. Pharmacogenomics (12)
    "q144_tpmt_activity_score": tpmt_score,
    "q145_nudt15_activity_score": nudt15_score,
    "q146_cyp2c19_phenotype": cyp2c19_score,
    "q147_dpyd_activity_score": dpyd_score,
    "q148_ugt1a1_genotype": ugt1a1_score,
    "q149_cyp2d6_activity_score": cyp2d6_score,
    "q150_cyp2c9_activity_score": cyp2c9_score,
    "q151_vkorc1_genotype": vkorc1_genotype,
    "q152_slco1b1_phenotype": slco1b1_score,
    "q153_hla_b5701_carrier": np.random.binomial(1, 0.05, N),
    "q154_calcineurin_clearance_index": np.clip(egfr / 90.0, 0.4, 1.4).round(2),
    "q155_busulfan_clearance_index": np.clip(weight / 70.0 + np.random.normal(0, 0.1, N), 0.5, 1.8).round(2)
}

print(f"Total clinical features generated: {len(features)}")
assert len(features) == 156, f"Expected 156 features, got {len(features)}"

# Compute Ground Truth Non-Linear Biological Probability
# Positive drivers: high CD34 dose, PBSC graft, 10/10 or 12/12 match, young donor, low HCT-CI
# Negative drivers: HLA mismatch, older recipient, high ferritin, adverse cyto, TP53 mut, CMV mismatch
z = (
    + 0.55 * (cd34_dose - 5.5) / 2.0
    + 0.45 * np.where(graft_source == "PBSC", 1.0, -0.6)
    + 0.40 * np.where(hla_match_tier.isin(["12/12", "10/10"]), 1.0, -0.9)
    - 0.35 * (hct_total - 2.0) / 2.0
    - 0.30 * (donor_age - 32.0) / 12.0
    - 0.25 * (age - 45.0) / 18.0
    - 0.30 * np.where(cmv_pair == "D-R+", 1.0, 0.0)
    - 0.35 * np.where(cyto_risk == "Adverse", 1.0, 0.0)
    - 0.30 * mut_tp53
    - 0.25 * np.where(dsa_class_i_mfi > 3000, 1.0, 0.0)
    - 0.20 * female_to_male
    + 0.25 * np.where(cond_intensity == "MAC", 0.5, -0.2)
    # Biological interaction terms:
    + 0.30 * np.where((cd34_dose > 6.0) & (hla_match_tier == "12/12"), 1.0, -0.3)
    - 0.40 * np.where((female_to_male == 1) & (cmv_pair == "D-R+"), 1.0, 0.0)
    # Realistic clinical Gaussian noise (sigma = 0.85)
    + np.random.normal(0, 0.85, N)
)

prob = 1.0 / (1.0 + np.exp(-z))
early_engraftment = (prob >= 0.50).astype(int)

print(f"Target 'early_engraftment' balance: {np.bincount(early_engraftment)}")

# Assemble DataFrame: patient_id + 156 features + early_engraftment = 158 columns
df_out = pd.DataFrame({"patient_id": [f"QPU-PT-{i:04d}" for i in range(1, N + 1)]})
for col_name, col_data in features.items():
    df_out[col_name] = col_data
df_out["early_engraftment"] = early_engraftment

output_path = "MarrowQ_156Qubit_Heron_Precision_Cohort_N750.csv"
df_out.to_csv(output_path, index=False)
df_out.to_csv("backend/app/data/MarrowQ_156Qubit_Heron_Precision_Cohort_N750.csv", index=False)
print(f"Successfully generated {output_path} with shape {df_out.shape}!")

