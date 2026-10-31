"""
MarrowQ Comprehensive HLA Donor Compatibility Engine
----------------------------------------------------
Implements 12-allele high-resolution matching (HLA-A, -B, -C, -DRB1, -DQB1, -DPB1),
DPB1 T-Cell Epitope (TCE) permissiveness classification (Fleischhauer / Zino algorithms),
Donor-Specific Anti-HLA Antibodies (DSA) MFI risk stratification,
and directional Host-vs-Graft (HvG) / Graft-vs-Host (GvH) mismatch evaluation.

References:
- Fleischhauer K, et al. Bone Marrow Transplant / Lancet Oncol 2012; 13: 366-74.
- Zino E, et al. Blood 2004; 103(6): 2417-24.
- Spellman SR, et al. Blood 2012; 119(14): 3345-53.
- NMDP / CIBMTR Guidelines for Unrelated Donor Selection (2023).
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class MatchLocus(str, Enum):
    HLA_A = "A"
    HLA_B = "B"
    HLA_C = "C"
    HLA_DRB1 = "DRB1"
    HLA_DQB1 = "DQB1"
    HLA_DPB1 = "DPB1"


# Fleischhauer TCE functional groups for DPB1 alleles
# Group 1: High immunogenicity hypervariable motif
# Group 2: Intermediate
# Group 3: Common / baseline immunogenicity
DPB1_TCE_GROUPS: Dict[str, int] = {
    # Group 1
    "09:01": 1, "10:01": 1, "17:01": 1, "28:01": 1, "85:01": 1,
    # Group 2
    "03:01": 2, "14:01": 2, "45:01": 2, "86:01": 2,
    # Group 3 (Common alleles)
    "01:01": 3, "02:01": 3, "02:02": 3, "04:01": 3, "04:02": 3,
    "05:01": 3, "06:01": 3, "11:01": 3, "13:01": 3, "15:01": 3,
    "16:01": 3, "18:01": 3, "19:01": 3, "20:01": 3, "23:01": 3,
    "26:01": 3, "27:01": 3, "33:01": 3, "35:01": 3, "39:01": 3,
    "40:01": 3, "41:01": 3, "49:01": 3, "51:01": 3, "55:01": 3,
}

HIGH_RISK_LOCI = {MatchLocus.HLA_A, MatchLocus.HLA_B, MatchLocus.HLA_C, MatchLocus.HLA_DRB1}


@dataclass
class AllelePair:
    allele1: str
    allele2: str

    def to_list(self) -> List[str]:
        return [self.allele1.strip(), self.allele2.strip()]


@dataclass
class HLATyping:
    a: AllelePair
    b: AllelePair
    c: AllelePair
    drb1: AllelePair
    dqb1: AllelePair
    dpb1: Optional[AllelePair] = None

    def get_locus(self, locus: MatchLocus) -> Optional[AllelePair]:
        mapping = {
            MatchLocus.HLA_A: self.a,
            MatchLocus.HLA_B: self.b,
            MatchLocus.HLA_C: self.c,
            MatchLocus.HLA_DRB1: self.drb1,
            MatchLocus.HLA_DQB1: self.dqb1,
            MatchLocus.HLA_DPB1: self.dpb1
        }
        return mapping.get(locus)


def _clean_allele(al: str) -> str:
    """Normalize HLA allele string (e.g., 'HLA-A*02:01:01' -> '02:01' or '02:01')."""
    al = al.strip().upper()
    if "*" in al:
        al = al.split("*", 1)[1]
    # Keep up to 2 fields (e.g. 02:01)
    parts = al.split(":")
    if len(parts) >= 2:
        return f"{parts[0].zfill(2)}:{parts[1]}"
    return al


def evaluate_locus_match(
    recipient_pair: AllelePair,
    donor_pair: AllelePair
) -> Tuple[int, List[str], List[str]]:
    """
    Evaluates matches and directional mismatches between recipient and donor.
    Returns: (match_count_out_of_2, gvh_mismatches, hvg_mismatches)
    - GvH mismatch: donor allele not found in recipient (donor attacks recipient -> GVHD risk).
    - HvG mismatch: recipient allele not found in donor (recipient attacks donor -> graft rejection risk).
    """
    rec_clean = sorted([_clean_allele(recipient_pair.allele1), _clean_allele(recipient_pair.allele2)])
    don_clean = sorted([_clean_allele(donor_pair.allele1), _clean_allele(donor_pair.allele2)])

    # GvH mismatches (donor antigens absent in recipient)
    gvh = [d for d in don_clean if d not in rec_clean]
    # HvG mismatches (recipient antigens absent in donor)
    hvg = [r for r in rec_clean if r not in don_clean]

    # Shared allele count (symmetric bipartite match)
    matches = 0
    temp_don = list(don_clean)
    for r in rec_clean:
        if r in temp_don:
            matches += 1
            temp_don.remove(r)

    return matches, gvh, hvg


def classify_dpb1_tce(recipient_dpb1: AllelePair, donor_dpb1: AllelePair) -> Dict[str, Any]:
    """
    Fleischhauer T-Cell Epitope (TCE) permissiveness algorithm for HLA-DPB1.
    TCE Group 1: 09:01, 10:01...
    TCE Group 2: 03:01, 14:01...
    TCE Group 3: 01:01, 02:01, 04:01, 04:02...
    """
    rec_al1 = _clean_allele(recipient_dpb1.allele1)
    rec_al2 = _clean_allele(recipient_dpb1.allele2)
    don_al1 = _clean_allele(donor_dpb1.allele1)
    don_al2 = _clean_allele(donor_dpb1.allele2)

    g_rec = {DPB1_TCE_GROUPS.get(rec_al1, 3), DPB1_TCE_GROUPS.get(rec_al2, 3)}
    g_don = {DPB1_TCE_GROUPS.get(don_al1, 3), DPB1_TCE_GROUPS.get(don_al2, 3)}

    # Check identical alleles
    matches, gvh_alleles, hvg_alleles = evaluate_locus_match(recipient_dpb1, donor_dpb1)
    if matches == 2:
        return {
            "status": "IDENTICAL",
            "permissiveness": "PERMISSIVE_IDENTICAL",
            "is_permissive": True,
            "clinical_significance": "Full DPB1 match. Baseline GVHD and TRM risk.",
            "gvh_group_shift": False
        }

    # Directional group evaluation
    # GvH non-permissive shift: Donor carries group 1 or 2 while recipient only carries group 3
    gvh_non_permissive = any(gd in {1, 2} and 3 in g_rec and gd not in g_rec for gd in g_don)
    # HvG non-permissive shift: Recipient carries group 1 or 2 while donor only carries group 3
    hvg_non_permissive = any(gr in {1, 2} and 3 in g_don and gr not in g_don for gr in g_rec)

    if not gvh_non_permissive and not hvg_non_permissive:
        return {
            "status": "PERMISSIVE_MISMATCH",
            "permissiveness": "PERMISSIVE",
            "is_permissive": True,
            "clinical_significance": "Permissive DPB1 mismatch. Does not significantly elevate severe GVHD or NRM.",
            "gvh_group_shift": False
        }
    elif gvh_non_permissive and not hvg_non_permissive:
        return {
            "status": "NON_PERMISSIVE_GVH",
            "permissiveness": "NON_PERMISSIVE",
            "is_permissive": False,
            "clinical_significance": "Non-permissive in GvH direction. Significantly elevated Grade III-IV acute GVHD and NRM risk (Fleischhauer et al., 2012).",
            "gvh_group_shift": True
        }
    elif hvg_non_permissive and not gvh_non_permissive:
        return {
            "status": "NON_PERMISSIVE_HVG",
            "permissiveness": "NON_PERMISSIVE",
            "is_permissive": False,
            "clinical_significance": "Non-permissive in HvG direction. Elevated graft rejection / primary graft failure risk.",
            "gvh_group_shift": False
        }
    else:
        return {
            "status": "BI_DIRECTIONAL_NON_PERMISSIVE",
            "permissiveness": "NON_PERMISSIVE",
            "is_permissive": False,
            "clinical_significance": "Bi-directional non-permissive DPB1 mismatch. Highest risk profile for both GVHD and graft failure.",
            "gvh_group_shift": True
        }


def evaluate_dsa(mismatched_donor_alleles: List[str], recipient_dsa_panel: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    """
    Evaluates Donor-Specific anti-HLA Antibodies (DSA) in recipient serum.
    recipient_dsa_panel: dict mapping allele strings to Mean Fluorescence Intensity (MFI) values.
    MFI Thresholds:
    < 1,000 MFI: Negative / Low Risk
    1,000 - 4,999 MFI: Moderate Risk / Desensitization recommended
    >= 5,000 MFI: High Risk / High probability of primary graft failure
    """
    if not recipient_dsa_panel:
        return {
            "screened": False,
            "status": "NOT_SCREENED",
            "max_mfi": 0.0,
            "positive_dsas": [],
            "risk_tier": "UNKNOWN",
            "recommendation": "DSA screening recommended for all mismatched allogeneic grafts."
        }

    positive_dsas = []
    max_mfi = 0.0

    for allele in mismatched_donor_alleles:
        clean = _clean_allele(allele)
        for dsa_allele, mfi in recipient_dsa_panel.items():
            if _clean_allele(dsa_allele) == clean and mfi >= 1000.0:
                positive_dsas.append({"allele": allele, "mfi": mfi})
                if mfi > max_mfi:
                    max_mfi = mfi

    if max_mfi >= 5000.0:
        risk_tier = "HIGH_RISK_CONTRAINDICATION"
        rec = "Strong positive DSA (MFI ≥ 5,000). High risk of immediate graft failure. Pre-transplant desensitization (plasma exchange, IVIG, rituximab) or alternative donor mandatory."
    elif max_mfi >= 1000.0:
        risk_tier = "MODERATE_RISK"
        rec = "Moderate DSA detected (MFI 1,000-4,999). Assess complement-fixing activity (C1q/C3d). Consider peri-transplant desensitization protocol."
    else:
        risk_tier = "LOW_RISK_NEGATIVE"
        rec = "No clinically significant DSA detected against donor mismatches (MFI < 1,000)."

    return {
        "screened": True,
        "status": "POSITIVE" if positive_dsas else "NEGATIVE",
        "max_mfi": max_mfi,
        "positive_dsas": positive_dsas,
        "risk_tier": risk_tier,
        "recommendation": rec
    }


def compute_donor_compatibility(
    recipient: HLATyping,
    donor: HLATyping,
    recipient_dsa_panel: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Comprehensive HLA Donor Compatibility Assessment:
    - 10/10 Locus matching (A, B, C, DRB1, DQB1)
    - 12/12 Extended matching (including DPB1)
    - High-risk locus mismatch flags
    - DPB1 TCE Permissiveness
    - DSA Screen & MFI Risk Stratification
    """
    results_by_locus = {}
    total_matched_10 = 0
    total_matched_12 = 0
    all_gvh_mismatches = []
    all_hvg_mismatches = []
    high_risk_mismatch_loci = []

    # 1. 10/10 Core Loci
    core_loci = [MatchLocus.HLA_A, MatchLocus.HLA_B, MatchLocus.HLA_C, MatchLocus.HLA_DRB1, MatchLocus.HLA_DQB1]
    for locus in core_loci:
        rec_pair = recipient.get_locus(locus)
        don_pair = donor.get_locus(locus)
        if rec_pair and don_pair:
            matches, gvh, hvg = evaluate_locus_match(rec_pair, don_pair)
            total_matched_10 += matches
            total_matched_12 += matches
            results_by_locus[locus.value] = {
                "matched_alleles": matches,
                "out_of": 2,
                "gvh_mismatches": gvh,
                "hvg_mismatches": hvg
            }
            all_gvh_mismatches.extend([f"HLA-{locus.value}*{al}" for al in gvh])
            all_hvg_mismatches.extend([f"HLA-{locus.value}*{al}" for al in hvg])
            if matches < 2 and locus in HIGH_RISK_LOCI:
                high_risk_mismatch_loci.append(locus.value)

    # 2. DPB1 Locus (12/12 evaluation)
    dpb1_eval = None
    if recipient.dpb1 and donor.dpb1:
        dpb1_matches, dpb1_gvh, dpb1_hvg = evaluate_locus_match(recipient.dpb1, donor.dpb1)
        total_matched_12 += dpb1_matches
        results_by_locus["DPB1"] = {
            "matched_alleles": dpb1_matches,
            "out_of": 2,
            "gvh_mismatches": dpb1_gvh,
            "hvg_mismatches": dpb1_hvg
        }
        all_gvh_mismatches.extend([f"HLA-DPB1*{al}" for al in dpb1_gvh])
        all_hvg_mismatches.extend([f"HLA-DPB1*{al}" for al in dpb1_hvg])
        dpb1_eval = classify_dpb1_tce(recipient.dpb1, donor.dpb1)
    else:
        results_by_locus["DPB1"] = {"status": "NOT_TYPED"}

    # 3. DSA Assessment
    dsa_eval = evaluate_dsa(all_gvh_mismatches, recipient_dsa_panel)

    # 4. Overall Clinical Compatibility Classification
    if total_matched_10 == 10 and (not dpb1_eval or dpb1_eval.get("is_permissive", True)) and dsa_eval.get("risk_tier") != "HIGH_RISK_CONTRAINDICATION":
        compatibility_tier = "OPTIMAL_MATCH"
        clinical_summary = f"10/10 Matched Donor (Extended score: {total_matched_12}/12). Low immunological risk."
    elif total_matched_10 == 9 and not high_risk_mismatch_loci and (not dpb1_eval or dpb1_eval.get("is_permissive", True)) and dsa_eval.get("risk_tier") != "HIGH_RISK_CONTRAINDICATION":
        compatibility_tier = "PERMISSIBLE_SINGLE_MISMATCH"
        clinical_summary = f"9/10 Single Mismatch at low-risk locus. Permissive profile; standard GVHD prophylaxis."
    elif total_matched_10 == 9 and high_risk_mismatch_loci:
        compatibility_tier = "HIGH_RISK_SINGLE_MISMATCH"
        clinical_summary = f"9/10 Mismatch at high-risk locus ({', '.join(high_risk_mismatch_loci)}). Intensified GVHD prophylaxis or alternative donor consideration recommended."
    elif total_matched_10 >= 7:
        compatibility_tier = "MISMATCHED_UNRELATED"
        clinical_summary = f"{total_matched_10}/10 Mismatched Unrelated Donor. Significant risk of NRM and GVHD."
    else:
        compatibility_tier = "HAPLOIDENTICAL_OR_POOR"
        clinical_summary = f"{total_matched_10}/10 Match. Haploidentical protocol (PTCy) required if used as donor."

    if dsa_eval.get("risk_tier") == "HIGH_RISK_CONTRAINDICATION":
        compatibility_tier = "CONTRAINDICATED_DSA"
        clinical_summary = f"CONTRAINDICATED: {dsa_eval.get('recommendation')}"

    return {
        "score_10": f"{total_matched_10}/10",
        "score_12": f"{total_matched_12}/12" if recipient.dpb1 and donor.dpb1 else "NOT_TYPED",
        "total_matched_core_10": total_matched_10,
        "total_matched_extended_12": total_matched_12 if recipient.dpb1 and donor.dpb1 else None,
        "compatibility_tier": compatibility_tier,
        "clinical_summary": clinical_summary,
        "high_risk_mismatch_loci": high_risk_mismatch_loci,
        "locus_breakdown": results_by_locus,
        "directional_mismatches": {
            "graft_versus_host_count": len(all_gvh_mismatches),
            "graft_versus_host_alleles": all_gvh_mismatches,
            "host_versus_graft_count": len(all_hvg_mismatches),
            "host_versus_graft_alleles": all_hvg_mismatches
        },
        "dpb1_tce_assessment": dpb1_eval,
        "dsa_assessment": dsa_eval,
        "provenance": "MarrowQ_HLA_Engine_v1.0"
    }




# ==============================================================================
# NON-HLA DONOR FACTORS & TRANSPLANT IMMUNOGENETICS
# ==============================================================================
def evaluate_non_hla_donor_factors(
    donor_age: float,
    recipient_cmv: str,  # "POSITIVE" or "NEGATIVE"
    donor_cmv: str,      # "POSITIVE" or "NEGATIVE"
    recipient_abo: str,  # "A", "B", "AB", "O"
    donor_abo: str,      # "A", "B", "AB", "O"
    graft_source: str = "PBSC"  # "PBSC", "BM", "CB"
) -> Dict[str, Any]:
    """
    Evaluates EBMT non-HLA donor prognostic factors: age, CMV concordance, and ABO compatibility.
    """
    # 1. Donor Age Scoring (CIBMTR/EBMT standard: Younger donor <30 is single most important non-HLA factor)
    if donor_age < 30.0:
        age_tier = "OPTIMAL (Age < 30)"
        age_comment = "Younger donor associated with superior OS and lower non-relapse mortality."
    elif donor_age <= 45.0:
        age_tier = "ACCEPTABLE (Age 30-45)"
        age_comment = "Standard age range; modest increase in chronic GVHD risk compared to <30."
    else:
        age_tier = "SUBOPTIMAL (Age > 45)"
        age_comment = "Older donor associated with increased graft failure, chronic GVHD, and non-relapse mortality."

    # 2. CMV Serostatus Concordance
    r_cmv = recipient_cmv.upper().strip()
    d_cmv = donor_cmv.upper().strip()

    if r_cmv == "NEGATIVE" and d_cmv == "NEGATIVE":
        cmv_risk = "LOW_RISK (D-/R-)"
        cmv_mgmt = "Lowest risk of CMV reactivation. Transfuse only CMV-seronegative or leukoreduced blood products."
    elif r_cmv == "POSITIVE" and d_cmv == "POSITIVE":
        cmv_risk = "INTERMEDIATE_PROTECTED (D+/R+)"
        cmv_mgmt = "Recipient at risk for reactivation; donor memory T-cells provide protective cellular immunity. Weekly CMV PCR."
    elif r_cmv == "NEGATIVE" and d_cmv == "POSITIVE":
        cmv_risk = "INTERMEDIATE_PRIMARY (D+/R-)"
        cmv_mgmt = "Risk of primary CMV transmission from graft. Prophylactic letermovir or weekly PCR surveillance."
    else:  # R+ and D-
        cmv_risk = "HIGH_RISK_REACTIVATION (D-/R+)"
        cmv_mgmt = "Highest risk of severe CMV reactivation without donor memory T-cell immunity. Mandatory Letermovir prophylaxis and biweekly PCR."

    # 3. ABO Compatibility Evaluation
    r_abo = recipient_abo.upper().strip()
    d_abo = donor_abo.upper().strip()

    # Define isohemagglutinins
    # O has anti-A, anti-B
    # A has anti-B
    # B has anti-A
    # AB has neither
    if r_abo == d_abo:
        abo_status = "ABO_IDENTICAL"
        abo_mgmt = "No immunohematologic incompatibility. Standard transfusion support."
    elif (r_abo == "O" and d_abo in ["A", "B", "AB"]) or (r_abo in ["A", "B"] and d_abo == "AB"):
        abo_status = "MAJOR_ABO_INCOMPATIBILITY"
        abo_mgmt = "Recipient has antibodies against donor RBCs. Risk of acute hemolysis and delayed erythroid engraftment (PRCA). Monitor isohemagglutinin titers; consider red cell depletion of graft if titer >= 1:32."
    elif (d_abo == "O" and r_abo in ["A", "B", "AB"]) or (d_abo in ["A", "B"] and r_abo == "AB"):
        abo_status = "MINOR_ABO_INCOMPATIBILITY"
        abo_mgmt = "Donor graft contains antibodies against recipient RBCs. Risk of Passenger Lymphocyte Syndrome (acute delayed hemolysis at day 7-14). Avoid transfusing donor-incompatible RBCs."
    else:
        abo_status = "BIDIRECTIONAL_ABO_INCOMPATIBILITY"
        abo_mgmt = "Both recipient and donor have mutual isohemagglutinins. Risk of both acute hemolysis and passenger lymphocyte syndrome. Requires dual RBC and plasma volume reduction."

    # 4. Graft Source Characteristics
    source_upper = graft_source.upper().strip()
    if "PBSC" in source_upper:
        graft_summary = "PBSC: Rapid neutrophil (14d) and platelet (16d) engraftment; higher incidence of extensive chronic GVHD."
    elif "BM" in source_upper:
        graft_summary = "Bone Marrow: Intermediate engraftment (18.5d); lower incidence of chronic GVHD; preferred in SAA and pediatric non-malignant diseases."
    else:
        graft_summary = "Cord Blood: Tolerates 1-2 HLA mismatches; delayed engraftment (24d); lowest incidence of chronic GVHD."

    return {
        "donor_age_assessment": {
            "donor_age": donor_age,
            "tier": age_tier,
            "clinical_impact": age_comment
        },
        "cmv_concordance": {
            "recipient_cmv": r_cmv,
            "donor_cmv": d_cmv,
            "risk_tier": cmv_risk,
            "clinical_management": cmv_mgmt
        },
        "abo_compatibility": {
            "recipient_abo": r_abo,
            "donor_abo": d_abo,
            "incompatibility_type": abo_status,
            "management_protocol": abo_mgmt
        },
        "graft_source_kinetics": {
            "selected_source": graft_source,
            "biological_profile": graft_summary
        },
        "evidence_standard": "EBMT / CIBMTR Unrelated Donor Consensus Recommendations"
    }


# ==============================================================================
# SOLID-ORGAN COMPATIBILITY WORKFLOW (KIDNEY TRANSPLANT)
# ==============================================================================
def evaluate_solid_organ_crossmatch(
    recipient_pra_pct: float,
    donor_specific_antibodies: List[Dict[str, Any]],
    recipient_blood_group: str,
    donor_blood_group: str
) -> Dict[str, Any]:
    """
    Evaluates solid-organ (Kidney) compatibility: Virtual Crossmatch and Calculated PRA (CPRA).
    """
    has_strong_dsa = any(d.get("mfi", 0) >= 5000 for d in donor_specific_antibodies)
    has_mod_dsa = any(2000 <= d.get("mfi", 0) < 5000 for d in donor_specific_antibodies)

    if has_strong_dsa:
        xm_result = "VIRTUAL_CROSSMATCH_POSITIVE (High Immunologic Risk)"
        rec = "Strong DSA detected (MFI >= 5000). Hyperacute / acute antibody-mediated rejection (ABMR) risk. Desensitization or alternative donor required."
    elif has_mod_dsa:
        xm_result = "VIRTUAL_CROSSMATCH_BORDERLINE"
        rec = "Moderate DSA (MFI 2000-5000). Requires physical flow crossmatch (FCXM), induction with anti-thymocyte globulin (ATG), and post-op DSA monitoring."
    else:
        xm_result = "VIRTUAL_CROSSMATCH_NEGATIVE"
        rec = "Negative virtual crossmatch. Standard immunologic risk."

    is_abo_incompatible = recipient_blood_group.upper() != donor_blood_group.upper() and recipient_blood_group.upper() != "AB"

    return {
        "organ": "Kidney (Renal Allograft)",
        "calculated_pra_percentage": recipient_pra_pct,
        "virtual_crossmatch_status": xm_result,
        "is_abo_incompatible": is_abo_incompatible,
        "immunological_recommendation": rec,
        "evidence_standard": "AST / KDIGO Kidney Transplant Guidelines"
    }
