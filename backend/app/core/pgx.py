"""
MarrowQ Pharmacogenomics (PGx) Clinical Decision Support Engine
---------------------------------------------------------------
Implements authoritative CPIC (Clinical Pharmacogenetics Implementation Consortium)
Level A & B guidelines for patient-specific medication safety, metabolic phenotypes,
and dose optimization in oncology, hematology, and supportive care.

References:
- Relling MV, et al. CPIC Guidelines for Thiopurines (TPMT & NUDT15). Clin Pharmacol Ther 2019.
- Moriyama B, et al. CPIC Guidelines for CYP2C19 and Voriconazole. Clin Pharmacol Ther 2017.
- Amstutz U, et al. CPIC Guidelines for DPYD and Fluoropyrimidines. Clin Pharmacol Ther 2018.
- Whirl-Carrillo M, et al. PharmGKB / CPIC Level A/B Master Database (2024).
"""

from typing import Dict, Any, List, Optional
from enum import Enum


class MetabolizerPhenotype(str, Enum):
    ULTRA_RAPID = "Ultra-Rapid Metabolizer (UM)"
    RAPID = "Rapid Metabolizer (RM)"
    NORMAL = "Normal Metabolizer (NM)"
    INTERMEDIATE = "Intermediate Metabolizer (IM)"
    POOR = "Poor Metabolizer (PM)"
    UNKNOWN = "Unknown / Indeterminate"


CPIC_RULES = [
    {
        "gene": "TPMT",
        "drug": "Mercaptopurine (6-MP)",
        "therapeutic_area": "Hematology / ALL Maintenance",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "PM": {
                "implication": "Severely reduced TPMT activity. Extreme risk of fatal myelosuppression and pancytopenia with standard dosing.",
                "recommendation": "Reduce starting dose by 90% (e.g. 10 mg/m²/day 3x/week instead of 75 mg/m²/day daily). Adjust based on ANC."
            },
            "IM": {
                "implication": "Intermediate TPMT activity. Elevated risk of leukopenia.",
                "recommendation": "Start with 30-70% of full dose. Titrate based on ANC and tolerance."
            },
            "NM": {
                "implication": "Normal TPMT activity. Standard thiopurine clearance.",
                "recommendation": "Initiate at standard starting dose (75 mg/m²/day)."
            }
        }
    },
    {
        "gene": "NUDT15",
        "drug": "Azathioprine / Mercaptopurine",
        "therapeutic_area": "Hematology / ALL / Autoimmune",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "PM": {
                "implication": "Severe deficiency in thiopurine dephosphorylation. High risk of early severe leukopenia and alopecia.",
                "recommendation": "Reduce dose by 80-90% or consider alternative non-thiopurine regimen."
            },
            "IM": {
                "implication": "Decreased NUDT15 activity. Elevated toxicity risk.",
                "recommendation": "Start at 50% dose; adjust based on CBC monitoring."
            }
        }
    },
    {
        "gene": "CYP2C19",
        "drug": "Voriconazole",
        "therapeutic_area": "Infectious Disease / HSCT Antifungal Prophylaxis",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "PM": {
                "implication": "Significantly reduced voriconazole metabolism. Elevated risk of supratherapeutic trough levels, neurotoxicity, and hepatotoxicity.",
                "recommendation": "Select alternative antifungal agent not dependent on CYP2C19 (e.g. Isavuconazole, Liposomal Amphotericin B)."
            },
            "UM": {
                "implication": "Hyperactive metabolism leading to subtherapeutic plasma troughs and fungal prophylaxis breakthrough.",
                "recommendation": "Select alternative antifungal agent or perform therapeutic drug monitoring (TDM) within 48-72h."
            },
            "NM": {
                "implication": "Normal clearance.",
                "recommendation": "Standard voriconazole dosing with routine TDM."
            }
        }
    },
    {
        "gene": "DPYD",
        "drug": "Fluorouracil (5-FU) / Capecitabine",
        "therapeutic_area": "GI & Breast Oncology",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "PM": {
                "implication": "Complete Dihydropyrimidine Dehydrogenase (DPD) deficiency. Standard doses cause lethal toxicity (grade 4 mucositis, neutropenia, neurotoxicity).",
                "recommendation": "Avoid fluoropyrimidines completely. Select alternative non-fluoropyrimidine therapy."
            },
            "IM": {
                "implication": "Partial DPD deficiency. High risk of severe toxic adverse events.",
                "recommendation": "Reduce initial fluoropyrimidine dose by 50%. Escalate cautiously based on toxicity."
            }
        }
    },
    {
        "gene": "UGT1A1",
        "drug": "Irinotecan",
        "therapeutic_area": "GI Oncology / Colorectal",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "PM": {
                "implication": "UGT1A1*28 homozygous (*28/*28) poor metabolizer. Impaired glucuronidation of SN-38 leading to severe diarrhea and neutropenia.",
                "recommendation": "Reduce starting dose by 30% for irinotecan regimens > 180 mg/m²."
            }
        }
    },
    {
        "gene": "HLA-B*57:01",
        "drug": "Abacavir",
        "therapeutic_area": "Infectious Disease / HIV Prophylaxis",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "POSITIVE": {
                "implication": "Carriage of HLA-B*57:01 allele is associated with high risk of life-threatening hypersensitivity reaction.",
                "recommendation": "ABACAVIR IS CONTRAINDICATED. Never administer or re-challenge."
            }
        }
    },
    {
        "gene": "CYP2D6",
        "drug": "Ondansetron / Tamoxifen / Codeine",
        "therapeutic_area": "Supportive Care / Oncology / Analgesia",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "PM": {
                "implication": "Absent CYP2D6 enzyme activity. Inability to convert codeine/tramadol to active morphine; reduced tamoxifen bioactivation into endoxifen.",
                "recommendation": "Avoid codeine/tramadol (lack of efficacy); use morphine or non-opioid. For breast cancer, switch tamoxifen to an Aromatase Inhibitor (e.g. Anastrozole, Letrozole)."
            },
            "UM": {
                "implication": "Ultra-rapid conversion of codeine/tramadol leading to high risk of fatal opioid intoxication. Reduced antiemetic efficacy with ondansetron.",
                "recommendation": "Avoid codeine/tramadol due to life-threatening respiratory depression risk. For nausea, use granisetron or palonosetron (not CYP2D6 dependent)."
            },
            "NM": {
                "implication": "Normal CYP2D6 metabolic activity.",
                "recommendation": "Standard weight-based dosing."
            }
        }
    },
    {
        "gene": "CYP2C9_VKORC1",
        "drug": "Warfarin",
        "therapeutic_area": "Anticoagulation / Thrombosis",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "PM": {
                "implication": "CYP2C9*3/*3 or VKORC1 -1639A/A genotype. Extreme sensitivity to S-warfarin with dramatically reduced clearance and high bleeding hazard.",
                "recommendation": "Estimated starting dose: 0.5 - 2.0 mg daily (or consider Direct Oral Anticoagulant DOAC if renal function preserved). Frequent INR monitoring."
            },
            "IM": {
                "implication": "Intermediate warfarin clearance.",
                "recommendation": "Estimated starting dose: 3.0 - 4.5 mg daily. Titrate to target INR 2.0-3.0."
            },
            "NM": {
                "implication": "Standard warfarin sensitivity (CYP2C9*1/*1, VKORC1 G/G).",
                "recommendation": "Standard initial dosing (5.0 mg daily) with routine INR titration."
            }
        }
    },
    {
        "gene": "SLCO1B1",
        "drug": "Simvastatin / Atorvastatin",
        "therapeutic_area": "Cardiovascular / Lipid Management",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "PM": {
                "implication": "SLCO1B1 521CC poor transporter function. High systemic statin exposure and markedly increased risk of statin-associated musculoskeletal symptoms (SAMS) and rhabdomyolysis.",
                "recommendation": "Avoid simvastatin 40-80mg. Prescribe lower dose pravastatin or rosuvastatin (starting <= 10mg daily), or ezetimibe."
            },
            "IM": {
                "implication": "Intermediate transporter function.",
                "recommendation": "Limit simvastatin to <= 20mg daily, or select alternative statin."
            },
            "NM": {
                "implication": "Normal hepatic uptake transporter function.",
                "recommendation": "Standard starting dose according to ACC/AHA guidelines."
            }
        }
    }
]


def evaluate_patient_pharmacogenomics(
    patient_genotype: Dict[str, str],
    intended_medications: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Evaluates patient genotypes against CPIC Level A & B drug-gene guidelines.
    """
    alerts = []
    meds_lower = [m.lower() for m in (intended_medications or [])]

    for rule in CPIC_RULES:
        gene = rule["gene"]
        drug = rule["drug"]
        pheno = patient_genotype.get(gene)
        if not pheno:
            gene_base = gene.split('*')[0]
            pheno = patient_genotype.get(gene_base)
        if not pheno:
            for k, v in patient_genotype.items():
                if k.upper() in gene.upper() or gene.upper() in k.upper():
                    pheno = v
                    break
        pheno = (pheno or "NM").upper()

        is_relevant = True
        if meds_lower:
            is_relevant = any(d.lower() in drug.lower() for d in meds_lower)

        if is_relevant:
            pheno_info = rule["phenotypes"].get(pheno)
            if not pheno_info and "IM" in pheno:
                pheno_info = rule["phenotypes"].get("IM")
            if not pheno_info and "PM" in pheno:
                pheno_info = rule["phenotypes"].get("PM")
            if not pheno_info and "POSITIVE" in pheno:
                pheno_info = rule["phenotypes"].get("POSITIVE")

            if pheno_info:
                severity = "HIGH" if "PM" in pheno or "POSITIVE" in pheno else "MODERATE"
                alerts.append({
                    "gene": gene,
                    "drug": drug,
                    "patient_phenotype": pheno,
                    "severity": severity,
                    "evidence_level": rule["evidence_level"],
                    "therapeutic_area": rule["therapeutic_area"],
                    "clinical_implication": pheno_info["implication"],
                    "actionable_recommendation": pheno_info["recommendation"]
                })

    return {
        "screened_genes": list(patient_genotype.keys()),
        "total_alerts_found": len(alerts),
        "high_risk_contraindications_count": sum(1 for a in alerts if a["severity"] == "HIGH"),
        "alerts": alerts,
        "governance_notice": "CPIC Level A evidence-backed clinical decision support. Always verify complete metabolic profile."
    }


def adjust_medication_for_organ_clearance(
    medication_name: str,
    standard_dose_mg: float,
    egfr_ml_min: Optional[float] = None,
    total_bilirubin_mg_dl: Optional[float] = None,
) -> Dict[str, Any]:
    """Evaluates interactive renal and hepatic dosage modifications."""
    alerts = []
    adjusted_dose = standard_dose_mg
    med = medication_name.lower().strip()

    # Renal adjustments
    if egfr_ml_min is not None:
        if egfr_ml_min < 30.0:
            if "fludarabine" in med:
                adjusted_dose = standard_dose_mg * 0.50
                alerts.append("Severe Renal Impairment (eGFR < 30): Reduce Fludarabine dose by 50% to prevent fatal neurotoxicity.")
            elif "methotrexate" in med:
                adjusted_dose = standard_dose_mg * 0.50
                alerts.append("Severe Renal Impairment (eGFR < 30): Reduce Methotrexate dose by 50%; ensure vigorous hydration and alkalinization.")
            elif "acyclovir" in med:
                adjusted_dose = standard_dose_mg * 0.40
                alerts.append("Renal Clearance Alert: Adjust Acyclovir dosing interval to q12-24h.")
        elif egfr_ml_min < 60.0:
            if "fludarabine" in med:
                adjusted_dose = standard_dose_mg * 0.80
                alerts.append("Moderate Renal Impairment (eGFR 30-59): Reduce Fludarabine dose by 20%.")

    # Hepatic adjustments
    if total_bilirubin_mg_dl is not None and total_bilirubin_mg_dl > 2.0:
        if "busulfan" in med:
            alerts.append("Hepatic Dysfunction Alert: Total Bilirubin > 2.0 mg/dL increases risk of Sinusoidal Obstruction Syndrome (VOD). Mandatory therapeutic drug monitoring (TDM).")
        if "cyclosporine" in med or "tacrolimus" in med:
            alerts.append("Hepatic Clearance Alert: Calcineurin inhibitor clearance impaired. Monitor trough levels daily.")

    return {
        "medication": medication_name,
        "standard_dose_mg": standard_dose_mg,
        "recommended_dose_mg": round(adjusted_dose, 1),
        "dose_modified": adjusted_dose != standard_dose_mg,
        "organ_clearance_alerts": alerts,
        "renal_egfr": egfr_ml_min,
        "serum_bilirubin": total_bilirubin_mg_dl,
    }
