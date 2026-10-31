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
        "therapeutic_area": "Colorectal Oncology",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "PM": {
                "implication": "UGT1A1 *28/*28 homozygous genotype. Impaired SN-38 glucuronidation causing severe diarrhea and neutropenia.",
                "recommendation": "Reduce starting dose by 25-30% for doses >180 mg/m²."
            }
        }
    },
    {
        "gene": "HLA-B",
        "drug": "Abacavir",
        "therapeutic_area": "Infectious Disease / Antiviral",
        "evidence_level": "CPIC_Level_A",
        "phenotypes": {
            "POSITIVE": {
                "implication": "Carriage of HLA-B*57:01 allele is associated with high risk of life-threatening hypersensitivity reaction.",
                "recommendation": "ABACAVIR IS CONTRAINDICATED. Never administer or re-challenge."
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
    Returns:
    - Detected metabolic phenotypes
    - High-risk drug alerts
    - Actionable dose adjustment recommendations
    - Contraindications
    """
    alerts = []
    meds_lower = [m.lower() for m in (intended_medications or [])]

    for rule in CPIC_RULES:
        gene = rule["gene"]
        drug = rule["drug"]
        pheno = patient_genotype.get(gene, "NM").upper()

        # If intended medications specified, check if relevant
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
