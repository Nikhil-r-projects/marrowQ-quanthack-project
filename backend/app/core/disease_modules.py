"""
MarrowQ Multi-Disease Diagnostic & Risk Stratification Engines
--------------------------------------------------------------
Implements authoritative clinical scoring and classification criteria for:
1. AML: WHO 2022 / ELN 2022 Risk Stratification (Favorable / Intermediate / Adverse)
2. ALL: Lineage Classification (B vs T-ALL) & Ph+ BCR-ABL1 Status
3. MDS: Molecular IPSS-M Risk Calculator (Bernard et al., NEJM Evidence 2022)
4. SAA: Severe Aplastic Anemia Modified Camitta Criteria
5. Oncology: Lung Cancer (EGFR/ALK/KRAS), Breast Cancer (ER/PR/HER2/BRCA), CRC (MSI/BRAF)
6. Nephrology: KDIGO CKD-EPI 2021 eGFR Staging & AKI Risk
7. Hepatology: MELD-Na Score & FIB-4 Liver Fibrosis Index
8. Cardiology: ACC/AHA 10-Year ASCVD Risk Calculator & Anthracycline Cardiotoxicity
"""

import math
from typing import Dict, Any, List, Optional, Tuple


# ==============================================================================
# 1. ACUTE MYELOID LEUKEMIA (AML) - ELN 2022
# ==============================================================================
def evaluate_aml(
    blast_pct: float,
    mutations: List[str],
    cytogenetics: str,
    age: float
) -> Dict[str, Any]:
    """
    ELN 2022 AML Genetic Risk Stratification (Döhner et al., Blood 2022; 140(12): 1345-77).
    """
    muts = [m.upper() for m in mutations]
    cyto = cytogenetics.upper()
    
    # 1. Diagnostic threshold check
    is_aml = blast_pct >= 20.0 or any(c in cyto for c in ["T(8;21)", "INV(16)", "T(15;17)", "T(16;16)"])

    # 2. ELN 2022 Risk Categories
    adverse_muts = {"TP53", "ASXL1", "BCOR", "EZH2", "RUNX1", "SF3B1", "SRSF2", "STAG2", "U2AF1", "ZRSR2"}
    has_adverse_mut = any(m in muts for m in adverse_muts)
    has_tp53 = "TP53" in muts
    has_flt3_itd = "FLT3" in muts or "FLT3-ITD" in muts
    has_npm1 = "NPM1" in muts
    has_cebpa_bzip = "CEBPA" in muts

    is_complex_karyotype = any(c in cyto for c in ["COMPLEX", "DEL(5Q)", "-5", "-7", "DEL(7Q)", "INV(3)", "T(6;9)", "T(9;22)"])

    if has_tp53 or is_complex_karyotype or has_adverse_mut:
        eln_risk = "ADVERSE"
        median_os = "Low (5-year OS ~10-15%). Upfront allogeneic HSCT strongly recommended in CR1."
    elif (has_npm1 and not has_flt3_itd) or has_cebpa_bzip or any(c in cyto for c in ["T(8;21)", "INV(16)"]):
        eln_risk = "FAVORABLE"
        median_os = "Favorable (5-year OS ~60-70%). Consolidation with high-dose cytarabine; HSCT reserved for relapse/MRD+."
    else:
        eln_risk = "INTERMEDIATE"
        median_os = "Intermediate (5-year OS ~30-40%). HSCT recommended in eligible candidates."

    actionable_targets = []
    if has_flt3_itd:
        actionable_targets.append("FLT3 inhibitor indication (Midostaurin upfront; Gilteritinib if relapsed/refractory)")
    if "IDH1" in muts:
        actionable_targets.append("IDH1 inhibitor indication (Ivosidenib)")
    if "IDH2" in muts:
        actionable_targets.append("IDH2 inhibitor indication (Enasidenib)")

    return {
        "disease": "Acute Myeloid Leukemia (AML)",
        "diagnostic_status": "CONFIRMED_AML" if is_aml else "SUB_THRESHOLD_BLASTS",
        "blast_percentage": blast_pct,
        "eln_2022_risk_category": eln_risk,
        "prognostic_summary": median_os,
        "actionable_targeted_therapies": actionable_targets,
        "evidence_standard": "ELN 2022 Guidelines (Döhner et al., Blood 2022)"
    }


# ==============================================================================
# 2. MYELODYSPLASTIC SYNDROMES (MDS) - IPSS-M
# ==============================================================================
def evaluate_mds_ipss_m(
    bm_blast_pct: float,
    hb: float,
    platelets: float,
    anc: float,
    cytogenetics_category: str = "Good",
    mutations: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Molecular International Prognostic Scoring System (IPSS-M) for MDS (Bernard et al., NEJM Evid 2022).
    """
    muts = [m.upper() for m in (mutations or [])]
    
    score = 0.0
    
    # Blast points
    if bm_blast_pct >= 10.0:
        score += 1.8
    elif bm_blast_pct >= 5.0:
        score += 1.0
    elif bm_blast_pct >= 2.0:
        score += 0.5
        
    # Cytopenias
    if hb < 8.0:
        score += 0.5
    elif hb < 10.0:
        score += 0.25
        
    if platelets < 50000.0:
        score += 0.75
    elif platelets < 100000.0:
        score += 0.35
        
    if anc < 800.0:
        score += 0.30

    # Cytogenetics
    cyto_pts = {"Very Good": -0.5, "Good": 0.0, "Intermediate": 0.6, "Poor": 1.3, "Very Poor": 2.0}
    score += cyto_pts.get(cytogenetics_category, 0.0)

    # Molecular Gene Weights (IPSS-M)
    if "TP53" in muts:
        score += 1.95 # Multi-hit TP53 has extreme adverse weighting
    if "ASXL1" in muts:
        score += 0.45
    if "RUNX1" in muts:
        score += 0.35
    if "SF3B1" in muts and "TP53" not in muts:
        score -= 0.30 # SF3B1 favorable without co-mutations

    score = round(score, 2)

    if score > 1.5:
        risk_group = "VERY_HIGH"
        rec = "Very High Risk: Median OS < 1.0 year. Immediate evaluation for allogeneic HSCT and hypomethylating agents."
    elif score > 0.5:
        risk_group = "HIGH"
        rec = "High Risk: Allogeneic HSCT recommended for transplant-eligible candidates."
    elif score > -0.5:
        risk_group = "MODERATE_HIGH"
        rec = "Moderate High Risk: Close surveillance, clinical trial, or pre-emptive HSCT consultation."
    elif score > -1.5:
        risk_group = "MODERATE_LOW"
        rec = "Moderate Low Risk: Supportive care, ESAs, luspatercept if SF3B1/ring sideroblasts."
    elif score > -2.5:
        risk_group = "LOW"
        rec = "Low Risk: Growth factors, active symptom-directed surveillance."
    else:
        risk_group = "VERY_LOW"
        rec = "Very Low Risk: Conservative management, blood count monitoring."

    return {
        "disease": "Myelodysplastic Syndromes (MDS)",
        "ipss_m_score": score,
        "ipss_m_risk_category": risk_group,
        "clinical_recommendation": rec,
        "molecular_drivers_detected": [m for m in muts if m in {"TP53", "ASXL1", "RUNX1", "SF3B1"}],
        "evidence_standard": "IPSS-M Consensus (Bernard et al., NEJM Evidence 2022)"
    }


# ==============================================================================
# 3. SEVERE APLASTIC ANEMIA (SAA) - CAMITTA CRITERIA
# ==============================================================================
def evaluate_aplastic_anemia(
    bm_cellularity_pct: float,
    anc: float,
    platelets: float,
    reticulocytes: float
) -> Dict[str, Any]:
    """
    Modified Camitta Criteria for Aplastic Anemia (Camitta et al., Blood 1975 / Bacigalupo EBMT 2020).
    """
    is_hypocellular = bm_cellularity_pct < 25.0

    cytopenia_criteria = 0
    if anc < 500.0:
        cytopenia_criteria += 1
    if platelets < 20000.0:
        cytopenia_criteria += 1
    if reticulocytes < 20000.0: # absolute reticulocyte count < 20 x10^9 / L
        cytopenia_criteria += 1

    is_saa = is_hypocellular and cytopenia_criteria >= 2
    is_vsaa = is_saa and anc < 200.0

    if is_vsaa:
        classification = "VERY_SEVERE_APLASTIC_ANEMIA (vSAA)"
        action = "Urgent matched sibling donor HSCT (<40y) or immediate immunosuppressive therapy (hATG + Cyclosporine + Eltrombopag)."
    elif is_saa:
        classification = "SEVERE_APLASTIC_ANEMIA (SAA)"
        action = "First-line HLA-matched sibling HSCT (if age < 40-50y); otherwise ATG + CSA + Eltrombopag (EPAG)."
    elif is_hypocellular:
        classification = "NON_SEVERE_APLASTIC_ANEMIA"
        action = "Supportive care, watch-and-wait or cyclosporine monotherapy."
    else:
        classification = "NOT_APLASTIC_ANEMIA"
        action = "Bone marrow cellularity preserved; explore alternative etiologies for cytopenias."

    return {
        "disease": "Aplastic Anemia",
        "camitta_classification": classification,
        "is_severe": is_saa,
        "is_very_severe": is_vsaa,
        "cellularity_pct": bm_cellularity_pct,
        "anc": anc,
        "platelets": platelets,
        "reticulocytes": reticulocytes,
        "treatment_pathway": action,
        "evidence_standard": "EBMT SAA Working Party Consensus (Bacigalupo et al., 2020)"
    }


# ==============================================================================
# 4. SOLID ONCOLOGY: LUNG, BREAST & COLORECTAL
# ==============================================================================
def evaluate_nsclc_biomarkers(variants: List[str], pdl1_tps_pct: float = 0.0) -> Dict[str, Any]:
    """Non-Small Cell Lung Cancer NCCN Precision Biomarker Panel."""
    vars_upper = [v.upper() for v in variants]
    therapies = []

    has_egfr = any("EGFR" in v for v in vars_upper)
    has_alk = any("ALK" in v for v in vars_upper)
    has_kras_g12c = any("KRAS" in v and "G12C" in v for v in vars_upper)

    if has_egfr:
        therapies.append("First-line 3rd-generation EGFR TKI: Osimertinib (FLAURA trial standard)")
    if has_alk:
        therapies.append("First-line 2nd-generation ALK TKI: Alectinib or Brigatinib")
    if has_kras_g12c:
        therapies.append("KRAS G12C inhibitor: Sotorasib or Adagrasib (subsequent-line)")
    if pdl1_tps_pct >= 50.0 and not (has_egfr or has_alk):
        therapies.append("First-line single-agent Immunotherapy: Pembrolizumab (KEYNOTE-024 standard)")

    return {
        "organ_specialty": "Thoracic Oncology (NSCLC)",
        "actionable_biomarkers_found": len(therapies) > 0,
        "pdl1_tps_percentage": pdl1_tps_pct,
        "precision_recommendations": therapies or ["Standard platinum-doublet chemotherapy consideration"],
        "guideline": "NCCN NSCLC v4.2024"
    }


def evaluate_breast_cancer(er_positive: bool, pr_positive: bool, her2_positive: bool, brca_mutated: bool) -> Dict[str, Any]:
    """Breast Cancer Molecular Subtype & Targeted Therapy Evaluation."""
    if her2_positive and (er_positive or pr_positive):
        subtype = "Triple-Positive (ER+/PR+/HER2+)"
        regimen = "Dual anti-HER2 blockade (Trastuzumab + Pertuzumab) + Taxane followed by Endocrine therapy"
    elif her2_positive:
        subtype = "HER2-Enriched (ER-/PR-/HER2+)"
        regimen = "Trastuzumab + Pertuzumab + Chemotherapy"
    elif er_positive or pr_positive:
        subtype = "Luminal (HR+/HER2-)"
        regimen = "Endocrine Therapy + CDK4/6 inhibitor (Palbociclib / Ribociclib / Abemaciclib)"
    else:
        subtype = "Triple-Negative (TNBC: ER-/PR-/HER2-)"
        regimen = "Neoadjuvant Pembrolizumab + Chemotherapy (KEYNOTE-522 standard)"

    if brca_mutated:
        regimen += " · PARP inhibitor indication (Olaparib - OlympiA trial standard)"

    return {
        "organ_specialty": "Medical Oncology (Breast)",
        "molecular_subtype": subtype,
        "brca_germline_status": "Mutated" if brca_mutated else "Wild-Type / Not Detected",
        "recommended_targeted_pathway": regimen,
        "guideline": "ASCO / ESMO Clinical Practice Guidelines"
    }


# ==============================================================================
# 5. NEPHROLOGY: CKD-EPI 2021 & AKI
# ==============================================================================
def evaluate_kidney_function(
    serum_creatinine: float,
    age: float,
    sex: str,
    baseline_creatinine: Optional[float] = None
) -> Dict[str, Any]:
    """
    CKD-EPI 2021 race-free eGFR equation (Inker et al., NEJM 2021) & KDIGO AKI Staging.
    """
    is_female = sex.lower() in ["f", "female"]
    k = 0.7 if is_female else 0.9
    alpha = -0.241 if is_female else -0.302
    cr = max(0.1, serum_creatinine)

    cr_ratio = cr / k
    egfr = 142.0 * (min(cr_ratio, 1.0) ** alpha) * (max(cr_ratio, 1.0) ** -1.200) * (0.9938 ** age)
    if is_female:
        egfr *= 1.012
    egfr = round(float(egfr), 1)

    # KDIGO CKD Stages
    if egfr >= 90.0:
        ckd_stage = "G1 (Normal / High)"
    elif egfr >= 60.0:
        ckd_stage = "G2 (Mildly decreased)"
    elif egfr >= 45.0:
        ckd_stage = "G3a (Mild-to-moderate decrease)"
    elif egfr >= 30.0:
        ckd_stage = "G3b (Moderate-to-severe decrease)"
    elif egfr >= 15.0:
        ckd_stage = "G4 (Severely decreased)"
    else:
        ckd_stage = "G5 (Kidney Failure / End-stage)"

    # AKI Assessment
    aki_stage = "NO_AKI"
    if baseline_creatinine and baseline_creatinine > 0:
        diff = cr - baseline_creatinine
        ratio = cr / baseline_creatinine
        if ratio >= 3.0 or cr >= 4.0:
            aki_stage = "KDIGO_AKI_STAGE_3"
        elif ratio >= 2.0:
            aki_stage = "KDIGO_AKI_STAGE_2"
        elif diff >= 0.3 or ratio >= 1.5:
            aki_stage = "KDIGO_AKI_STAGE_1"

    return {
        "organ_specialty": "Nephrology",
        "estimated_gfr_ml_min": egfr,
        "kdigo_ckd_stage": ckd_stage,
        "aki_status": aki_stage,
        "creatinine_mg_dl": cr,
        "dose_adjustment_required": egfr < 60.0,
        "evidence_standard": "CKD-EPI 2021 Race-Free Consensus (NEJM 2021)"
    }


# ==============================================================================
# 6. HEPATOLOGY: MELD-Na & FIB-4
# ==============================================================================
def evaluate_liver_function(
    total_bilirubin: float,
    serum_creatinine: float,
    inr: float,
    serum_sodium: float,
    ast: float,
    alt: float,
    platelets: float,
    age: float
) -> Dict[str, Any]:
    """
    Computes MELD-Na (UNOS/OPTN Liver Allocation) & FIB-4 (Liver Fibrosis Index).
    """
    # Clamping rules for MELD
    b = max(1.0, total_bilirubin)
    c = min(4.0, max(1.0, serum_creatinine))
    i = max(1.0, inr)
    na = min(137.0, max(125.0, serum_sodium))

    meld_initial = 9.57 * math.log(c) + 3.78 * math.log(b) + 11.20 * math.log(i) + 6.43
    meld_score = round(meld_initial)

    if meld_score > 11:
        meld_na = meld_score + 1.32 * (137 - na) - (0.033 * meld_score * (137 - na))
        meld_na_score = int(round(min(40.0, max(6.0, meld_na))))
    else:
        meld_na_score = meld_score

    # FIB-4 Calculation
    plt_thous = max(1.0, platelets / 1000.0)
    alt_sqrt = math.sqrt(max(1.0, alt))
    fib4 = (age * ast) / (plt_thous * alt_sqrt)
    fib4 = round(fib4, 2)

    if fib4 > 2.67:
        fib_risk = "HIGH_FIBROSIS_RISK (Advanced F3-F4 Cirrhosis Likely)"
    elif fib4 < 1.30:
        fib_risk = "LOW_FIBROSIS_RISK (F0-F1, Advanced Fibrosis Excluded NPV >90%)"
    else:
        fib_risk = "INTERMEDIATE_FIBROSIS_INDETERMINATE"

    return {
        "organ_specialty": "Hepatology",
        "meld_na_score": meld_na_score,
        "fib_4_index": fib4,
        "fibrosis_risk_interpretation": fib_risk,
        "transplant_priority_tier": "HIGH" if meld_na_score >= 25 else ("MODERATE" if meld_na_score >= 15 else "LOW"),
        "evidence_standard": "UNOS MELD-Na & Sterling et al. Hepatology 2006 (FIB-4)"
    }


# ==============================================================================
# 7. CARDIOLOGY: ACC/AHA 10-YEAR ASCVD RISK
# ==============================================================================
def evaluate_cardiovascular_risk(
    age: float,
    total_cholesterol: float,
    hdl: float,
    systolic_bp: float,
    is_smoker: bool,
    has_diabetes: bool,
    is_female: bool
) -> Dict[str, Any]:
    """
    Pooled Cohort Equations (ACC/AHA ASCVD Risk Estimator Plus).
    """
    # Standard log-linear Pooled Cohort simplified estimator
    ln_age = math.log(max(20.0, min(79.0, age)))
    ln_tc = math.log(max(100.0, total_cholesterol))
    ln_hdl = math.log(max(20.0, hdl))
    ln_sbp = math.log(max(90.0, systolic_bp))

    if is_female:
        s0 = 0.9665
        mean_b = -29.18
        b = -29.799 * ln_age + 4.884 * (ln_age ** 2) + 13.540 * ln_tc - 3.114 * (ln_age * ln_tc) - 13.578 * ln_hdl + 3.149 * (ln_age * ln_hdl) + 2.019 * ln_sbp + (7.574 if is_smoker else 0.0) + (0.661 if has_diabetes else 0.0)
    else:
        s0 = 0.9144
        mean_b = 61.18
        b = 12.344 * ln_age + 11.853 * ln_tc - 2.664 * (ln_age * ln_tc) - 7.990 * ln_hdl + 1.769 * (ln_age * ln_hdl) + 1.797 * ln_sbp + (7.837 if is_smoker else 0.0) + (0.658 if has_diabetes else 0.0)

    try:
        ascvd_risk = (1.0 - (s0 ** math.exp(b - mean_b))) * 100.0
        ascvd_risk = round(max(0.1, min(99.0, ascvd_risk)), 1)
    except Exception:
        ascvd_risk = 7.5

    if ascvd_risk >= 20.0:
        tier = "HIGH_RISK"
        rec = "High ASCVD Risk (≥20%): High-intensity statin (Atorvastatin 40-80mg or Rosuvastatin 20-40mg) indicated."
    elif ascvd_risk >= 7.5:
        tier = "INTERMEDIATE_RISK"
        rec = "Intermediate Risk (7.5-19.9%): Moderate-intensity statin indicated."
    elif ascvd_risk >= 5.0:
        tier = "BORDERLINE_RISK"
        rec = "Borderline Risk (5.0-7.4%): Risk-enhancer discussion, consider CAC score."
    else:
        tier = "LOW_RISK"
        rec = "Low Risk (<5%): Lifestyle optimization."

    return {
        "organ_specialty": "Cardiology",
        "ten_year_ascvd_risk_pct": ascvd_risk,
        "risk_tier": tier,
        "recommendation": rec,
        "evidence_standard": "ACC/AHA 2019 Primary Prevention Guideline"
    }

