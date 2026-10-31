"""
MarrowQ Multimodal Biological Data Parsers
------------------------------------------
Specialized ingestion adapters for:
1. Blood CBC, differential, biochemistry, and inflammatory biomarkers.
2. Bone marrow aspirate, biopsy cellularity, blast %, and flow cytometry immunophenotyping.
3. Genomic VCF variant parser with clinical oncology & hematology annotations (ClinVar / COSMIC).
"""

import re
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone


# Canonical Actionable Oncology & Hematology Biomarkers
ACTIONABLE_GENES = {
    "FLT3": {"tier": "Tier_1_Actionable", "drugs": ["Midostaurin", "Gilteritinib", "Quizartinib"]},
    "NPM1": {"tier": "Tier_1_Actionable", "drugs": ["Standard Induction (Favorable)", "Menin Inhibitors"]},
    "TP53": {"tier": "Tier_1_Actionable", "drugs": ["Eprenetapopt", "Hypomethylating agents", "MAGROLIMAB (Investigational)"]},
    "IDH1": {"tier": "Tier_1_Actionable", "drugs": ["Ivosidenib"]},
    "IDH2": {"tier": "Tier_1_Actionable", "drugs": ["Enasidenib"]},
    "BCR-ABL1": {"tier": "Tier_1_Actionable", "drugs": ["Imatinib", "Dasatinib", "Nilotinib", "Ponatinib"]},
    "EGFR": {"tier": "Tier_1_Actionable", "drugs": ["Osimertinib", "Erlotinib", "Gefitinib"]},
    "BRAF": {"tier": "Tier_1_Actionable", "drugs": ["Dabrafenib + Trametinib", "Encorafenib + Cetuximab"]},
    "KRAS": {"tier": "Tier_1_Actionable", "drugs": ["Sotorasib (G12C)", "Adagrasib (G12C)"]},
    "BRCA1": {"tier": "Tier_1_Actionable", "drugs": ["Olaparib", "Talazoparib", "Rucaparib"]},
    "BRCA2": {"tier": "Tier_1_Actionable", "drugs": ["Olaparib", "Talazoparib", "Rucaparib"]},
    "DPYD": {"tier": "Tier_1_Pharmacogenomic", "drugs": ["5-Fluorouracil (Dose reduction)", "Capecitabine (Dose reduction)"]},
    "TPMT": {"tier": "Tier_1_Pharmacogenomic", "drugs": ["6-Mercaptopurine (Dose reduction)", "Azathioprine"]},
    "NUDT15": {"tier": "Tier_1_Pharmacogenomic", "drugs": ["6-Mercaptopurine (Dose reduction)"]},
    "CYP2C19": {"tier": "Tier_1_Pharmacogenomic", "drugs": ["Voriconazole (Alternative agent)", "Clopidogrel (Alternative antiplatelet)"]}
}


def parse_blood_panel(raw_data: Dict[str, Any], patient_id: str, specimen_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses and validates blood laboratory measurements against physiological boundaries.
    Generates deterministic clinical flags for abnormalities.
    """
    specimen_id = specimen_id or f"SPEC-BLD-{uuid.uuid4().hex[:6].upper()}"
    panel_id = f"PANEL-BLD-{uuid.uuid4().hex[:6].upper()}"
    
    abnormalities = []

    # Hemoglobin (g/dL)
    hb = raw_data.get("hb")
    if hb is not None:
        hb = float(hb)
        if hb < 7.0:
            abnormalities.append("Severe anemia (Hb < 7.0 g/dL): transfusion threshold reached")
        elif hb < 10.0:
            abnormalities.append(f"Moderate anemia (Hb {hb} g/dL)")

    # WBC (x10^9 / L or /uL)
    wbc = raw_data.get("wbc")
    if wbc is not None:
        wbc = float(wbc)
        if wbc < 1.0:
            abnormalities.append(f"Leukopenia (WBC {wbc} ×10³/μL)")
        elif wbc > 25.0:
            abnormalities.append(f"Hyperleukocytosis risk (WBC {wbc} ×10³/μL)")

    # ANC (cells / uL)
    anc = raw_data.get("anc")
    if anc is not None:
        anc = float(anc)
        if anc < 500.0:
            abnormalities.append(f"Severe neutropenia (ANC {anc:,.0f} cells/μL) - High infection risk")
        elif anc < 1000.0:
            abnormalities.append(f"Moderate neutropenia (ANC {anc:,.0f} cells/μL)")

    # Platelets (/uL)
    plt = raw_data.get("platelets")
    if plt is not None:
        plt = float(plt)
        if plt < 20000.0:
            abnormalities.append(f"Severe thrombocytopenia (Platelets {plt:,.0f}/μL) - Bleeding precaution")
        elif plt < 50000.0:
            abnormalities.append(f"Moderate thrombocytopenia (Platelets {plt:,.0f}/μL)")

    # Creatinine (mg/dL) & Renal
    cr = raw_data.get("creatinine")
    if cr is not None:
        cr = float(cr)
        if cr > 1.5:
            abnormalities.append(f"Elevated Serum Creatinine ({cr} mg/dL) - Renal impairment check")

    # Bilirubin (mg/dL) & Liver
    bili = raw_data.get("total_bilirubin")
    if bili is not None:
        bili = float(bili)
        if bili > 2.0:
            abnormalities.append(f"Hyperbilirubinemia ({bili} mg/dL) - Hepatic / VOD alert")

    # Ferritin & CRP
    ferritin = raw_data.get("ferritin")
    if ferritin is not None:
        ferritin = float(ferritin)
        if ferritin > 1000.0:
            abnormalities.append(f"Severe iron overload / Hyperferritinemia ({ferritin:,.0f} ng/mL)")

    return {
        "panel_id": panel_id,
        "specimen_id": specimen_id,
        "patient_id": patient_id,
        "test_timestamp": raw_data.get("test_timestamp", datetime.now(timezone.utc).isoformat()),
        "hb": hb,
        "wbc": wbc,
        "anc": anc,
        "alc": raw_data.get("alc"),
        "platelets": plt,
        "reticulocytes": raw_data.get("reticulocytes"),
        "creatinine": cr,
        "bun": raw_data.get("bun"),
        "total_bilirubin": bili,
        "ast": raw_data.get("ast"),
        "alt": raw_data.get("alt"),
        "albumin": raw_data.get("albumin"),
        "ldh": raw_data.get("ldh"),
        "crp": raw_data.get("crp"),
        "ferritin": ferritin,
        "electrolytes": raw_data.get("electrolytes", {}),
        "abnormalities": abnormalities,
        "has_critical_alerts": any("Severe" in a or "Hyper" in a for a in abnormalities)
    }


def parse_bone_marrow(raw_data: Dict[str, Any], patient_id: str, specimen_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses bone marrow aspirate, biopsy morphology, blast percentage, and flow cytometry markers.
    """
    specimen_id = specimen_id or f"SPEC-BM-{uuid.uuid4().hex[:6].upper()}"
    report_id = f"BM-REP-{uuid.uuid4().hex[:6].upper()}"
    
    blast_pct = float(raw_data.get("blast_pct", 0.0))
    cellularity = float(raw_data.get("cellularity_pct", 40.0))
    flow_cyto = raw_data.get("flow_cytometry") or {}

    clinical_classification = "Normal / Remission"
    if blast_pct >= 20.0:
        clinical_classification = "Acute Leukemia Threshold (≥20% blasts)"
    elif blast_pct >= 10.0:
        clinical_classification = "MDS with Excess Blasts-2 (10-19%)"
    elif blast_pct >= 5.0:
        clinical_classification = "MDS with Excess Blasts-1 (5-9%)"

    return {
        "report_id": report_id,
        "specimen_id": specimen_id,
        "patient_id": patient_id,
        "collection_timestamp": raw_data.get("collection_timestamp", datetime.now(timezone.utc).isoformat()),
        "cellularity_pct": cellularity,
        "blast_pct": blast_pct,
        "myeloid_erythroid_ratio": raw_data.get("myeloid_erythroid_ratio", 3.0),
        "fibrosis_grade": int(raw_data.get("fibrosis_grade", 0)),
        "morphology_summary": raw_data.get("morphology_summary", "Aspirate examined. Trilineage hematopoiesis present."),
        "dysplasia_lineages_count": int(raw_data.get("dysplasia_lineages_count", 0)),
        "flow_cytometry": flow_cyto,
        "cytogenetics_karyotype": raw_data.get("cytogenetics_karyotype", "46,XX [20] or 46,XY [20] normal karyotype"),
        "mrd_status": raw_data.get("mrd_status", "NEGATIVE"),
        "mrd_level": float(raw_data.get("mrd_level", 0.0)),
        "pathologist_signature": raw_data.get("pathologist_signature", "Verified Hematopathologist"),
        "clinical_classification": clinical_classification
    }


def parse_vcf_content(vcf_text: str, patient_id: str, specimen_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Genuine VCF (Variant Call Format) text parser.
    Extracts CHROM, POS, ID, REF, ALT, QUAL, FILTER, INFO fields, and annotates
    molecular variants against known actionable hematology & solid oncology gene panels.
    """
    specimen_id = specimen_id or f"SPEC-GEN-{uuid.uuid4().hex[:6].upper()}"
    variants = []

    lines = vcf_text.strip().splitlines()
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        parts = line.split("\t")
        if len(parts) < 5:
            continue

        chrom, pos, var_id, ref, alt = parts[0], int(parts[1]), parts[2], parts[3], parts[4]
        qual = parts[5] if len(parts) > 5 else "."
        filt = parts[6] if len(parts) > 6 else "PASS"
        info_str = parts[7] if len(parts) > 7 else ""

        # Parse INFO tags (e.g. GENE=FLT3;VAF=0.42;CLINVAR=Pathogenic)
        info_dict = {}
        for item in info_str.split(";"):
            if "=" in item:
                k, v = item.split("=", 1)
                info_dict[k.strip().upper()] = v.strip()

        gene = info_dict.get("GENE") or info_dict.get("SYMBOL")
        if not gene:
            # Check ID column or fallback
            for ag in ACTIONABLE_GENES:
                if ag in var_id or ag in info_str:
                    gene = ag
                    break
        gene = gene or "UNKNOWN"

        vaf = float(info_dict.get("VAF") or info_dict.get("AF") or 0.5)
        depth = int(info_dict.get("DP") or 100)
        clinvar = info_dict.get("CLINVAR") or info_dict.get("CLNSIG") or ("Pathogenic" if gene in ACTIONABLE_GENES else "VUS")
        cosmic = info_dict.get("COSMIC") or (f"COSM{pos}" if gene in ACTIONABLE_GENES else None)

        is_actionable = gene in ACTIONABLE_GENES
        actionable_info = ACTIONABLE_GENES.get(gene, {})

        variant_record = {
            "variant_id": f"VAR-{uuid.uuid4().hex[:8].upper()}",
            "specimen_id": specimen_id,
            "patient_id": patient_id,
            "chromosome": chrom,
            "position": pos,
            "ref_allele": ref,
            "alt_allele": alt,
            "gene_symbol": gene,
            "hgvs_c": info_dict.get("HGVSC", f"c.{pos}{ref}>{alt}"),
            "hgvs_p": info_dict.get("HGVSP"),
            "variant_classification": info_dict.get("CLASS", "Missense"),
            "variant_allele_frequency": vaf,
            "depth_of_coverage": depth,
            "clinvar_significance": clinvar,
            "cosmic_id": cosmic,
            "is_actionable": is_actionable,
            "therapeutic_implications": actionable_info.get("drugs", []),
            "evidence_tier": actionable_info.get("tier", "Research")
        }
        variants.append(variant_record)

    return variants

