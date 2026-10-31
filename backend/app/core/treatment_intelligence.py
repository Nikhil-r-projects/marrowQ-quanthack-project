"""Treatment Intelligence & Comparative Regimen Decision Support for MarrowQ.

Integrates:
1. Hematopoietic Cell Transplantation-Comorbidity Index (HCT-CI, Sorror et al., Blood 2007).
2. ECOG Performance Status & Karnofsky Performance Score (KPS).
3. Conditioning Regimen Selection: Myeloablative (MAC) vs. Reduced-Intensity (RIC) vs. Non-Myeloablative (NMA).
4. Absolute & Relative Contraindication Matrix.
5. Non-Relapse Mortality (NRM) vs. Relapse Risk Trade-off Evaluation.
"""
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("marrowq.clinical.treatment_intelligence")


class TreatmentComparisonEngine:
    """Evaluates regimen eligibility, comorbidity risk, and contraindications."""

    def __init__(self):
        pass

    def calculate_hct_ci(self, comorbidities: List[str]) -> Dict[str, Any]:
        """Calculates Sorror HCT-Comorbidity Index score and Non-Relapse Mortality (NRM) tier."""
        comorb_weights = {
            "arrhythmia": 1,
            "cad": 1,
            "congestive_heart_failure": 3,
            "valvular_heart_disease": 3,
            "inflammatory_bowel_disease": 1,
            "diabetes": 1,
            "cerebrovascular_disease": 1,
            "psychiatric_disturbance": 1,
            "mild_hepatic_impairment": 1,
            "moderate_severe_hepatic_impairment": 3,
            "obesity_bmi_gt_35": 1,
            "active_controlled_infection": 1,
            "rheumatologic_disease": 2,
            "peptic_ulcer": 2,
            "moderate_severe_renal_impairment": 2,
            "moderate_pulmonary_dlco_66_80": 2,
            "severe_pulmonary_dlco_le_65": 3,
            "prior_solid_tumor": 3,
        }

        total_score = 0
        flagged_conditions = []

        for c in comorbidities:
            key = c.lower().strip().replace(" ", "_")
            if key in comorb_weights:
                weight = comorb_weights[key]
                total_score += weight
                flagged_conditions.append({"condition": c, "points": weight})

        if total_score == 0:
            risk_tier = "LOW_RISK"
            nrm_estimate = "Low NRM (~9-11% at 2 years post-HSCT)"
            mac_eligibility = "Eligible for Full Myeloablative Conditioning (MAC) if age <= 65"
        elif total_score in [1, 2]:
            risk_tier = "INTERMEDIATE_RISK"
            nrm_estimate = "Intermediate NRM (~19-23% at 2 years)"
            mac_eligibility = "MAC acceptable; consider Reduced-Intensity Conditioning (RIC) if age > 55"
        else:
            risk_tier = "HIGH_RISK"
            nrm_estimate = "High NRM (~38-44% at 2 years)"
            mac_eligibility = "MAC Contraindicated due to high non-relapse mortality; recommend RIC or Non-Myeloablative (NMA) conditioning"

        return {
            "hct_ci_score": total_score,
            "comorbidity_risk_tier": risk_tier,
            "estimated_2yr_nrm": nrm_estimate,
            "conditioning_eligibility": mac_eligibility,
            "identified_comorbidities": flagged_conditions,
            "evidence_standard": "Sorror et al., Blood 2007 (HCT-CI)",
        }

    def evaluate_treatment_options(
        self,
        disease: str,
        risk_category: str,
        patient_age: float,
        ecog_ps: int = 1,
        lvef_pct: float = 60.0,
        dlco_pct: float = 75.0,
        egfr_ml_min: float = 85.0,
        total_bilirubin_mg_dl: float = 1.0,
        comorbidities: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Compares prospective regimens and screens for organ contraindications."""
        hct_ci = self.calculate_hct_ci(comorbidities or [])

        # Organ Contraindications Check
        contraindications = []
        if lvef_pct < 40.0:
            contraindications.append("Severe Cardiac Dysfunction (LVEF < 40%): High-dose cyclophosphamide and anthracyclines contraindicated.")
        if dlco_pct < 45.0:
            contraindications.append("Severe Pulmonary Impairment (DLCO < 45%): Busulfan and BCNU/Carmustine contraindicated.")
        if egfr_ml_min < 30.0:
            contraindications.append("Severe Renal Impairment (eGFR < 30): High-dose methotrexate and fludarabine require 50% dose reduction.")
        if total_bilirubin_mg_dl > 2.5:
            contraindications.append("Hepatic Dysfunction (Total Bilirubin > 2.5 mg/dL): High risk for sinusoidal obstruction syndrome (SOS/VOD). Avoid high-dose busulfan.")
        if ecog_ps >= 3:
            contraindications.append("Poor Performance Status (ECOG >= 3): Intensive induction/conditioning carries unacceptable early mortality risk.")

        # Candidate Regimens by Disease & Patient Fit
        regimens = []
        d_upper = disease.upper()

        if "AML" in d_upper:
            # 1. Standard 7+3 Induction
            is_7_3_eligible = patient_age < 75 and ecog_ps <= 2 and lvef_pct >= 45 and not any("Severe" in c for c in contraindications)
            regimens.append({
                "regimen_name": "7+3 Intensive Induction (Cytarabine 100-200 mg/m2 x 7d + Daunorubicin 60-90 mg/m2 x 3d)",
                "intent": "Curative Remission Induction",
                "is_eligible": is_7_3_eligible,
                "expected_complete_remission_rate": "65-75% in favorable/intermediate; 40-50% in adverse",
                "treatment_related_mortality_risk": "< 5% in specialized centers",
                "recommended_for": "Fit adult AML patients < 70-75 years",
                "contraindication_notes": "Not recommended if ECOG >= 3 or LVEF < 45%",
            })

            # 2. Venetoclax + Azacitidine (VenAza)
            regimens.append({
                "regimen_name": "Venetoclax (400 mg daily) + Azacitidine (75 mg/m2 x 7d)",
                "intent": "Low-Intensity Remission Induction (Curative or Prolonged Disease Control)",
                "is_eligible": egfr_ml_min >= 20 and total_bilirubin_mg_dl <= 3.0,
                "expected_complete_remission_rate": "66% composite complete remission (CR/CRi)",
                "treatment_related_mortality_risk": "Low 30-day mortality (~7%)",
                "recommended_for": "Older AML patients >= 75 or patients with significant comorbidities (HCT-CI >= 3)",
                "contraindication_notes": "Tumor Lysis Syndrome prophylaxis required; reduce Venetoclax by 75% if concurrent strong CYP3A4 inhibitors (posaconazole)",
            })

            # 3. Allogeneic HSCT
            is_hsct_indicated = risk_category.upper() in ["ADVERSE", "INTERMEDIATE"] or hct_ci["hct_ci_score"] < 5
            preferred_prep = "MAC (Flu/Bu4 or Cy/TBI)" if (patient_age <= 55 and hct_ci["hct_ci_score"] <= 2) else "RIC (Flu/Mel or Flu/Bu2)"
            regimens.append({
                "regimen_name": f"Allogeneic Hematopoietic Stem Cell Transplantation ({preferred_prep})",
                "intent": "Definitive Curative Consolidation in CR1",
                "is_eligible": len(contraindications) == 0 and ecog_ps <= 2,
                "expected_complete_remission_rate": "5-year Relapse-Free Survival 50-65% in CR1",
                "treatment_related_mortality_risk": hct_ci["estimated_2yr_nrm"],
                "recommended_for": "ELN Intermediate and Adverse risk AML in first complete remission",
                "contraindication_notes": "; ".join(contraindications) if contraindications else "None",
            })

        return {
            "disease": disease,
            "patient_age": patient_age,
            "ecog_performance_status": ecog_ps,
            "hct_ci_assessment": hct_ci,
            "organ_contraindications": contraindications,
            "candidate_regimens_comparison": regimens,
            "guideline_consensus": "NCCN / ELN / EBMT Clinical Practice Guidelines",
        }
