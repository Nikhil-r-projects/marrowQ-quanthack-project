import pytest
from app.core.biological_parsers import parse_blood_panel, parse_bone_marrow, parse_vcf_content
from app.core.biological_db import init_biological_tables, save_specimen, save_blood_panel, save_genomic_variant, get_patient_biological_profile

def test_parse_blood_panel_abnormalities():
    raw_data = {
        "hb": 6.8, # Severe anemia (<7)
        "wbc": 0.8, # Leukopenia
        "anc": 150.0, # Severe neutropenia (<500)
        "platelets": 14000.0, # Severe thrombocytopenia (<20000)
        "creatinine": 2.1, # Renal alert (>1.5)
        "total_bilirubin": 2.8 # Hepatic alert (>2.0)
    }
    panel = parse_blood_panel(raw_data, patient_id="PT-TEST-001")
    assert panel["has_critical_alerts"] is True
    assert any("Severe anemia" in a for a in panel["abnormalities"])
    assert any("Severe neutropenia" in a for a in panel["abnormalities"])
    assert any("Severe thrombocytopenia" in a for a in panel["abnormalities"])


def test_parse_bone_marrow():
    raw_data = {
        "cellularity_pct": 15.0,
        "blast_pct": 24.5, # >= 20% Acute Leukemia threshold
        "fibrosis_grade": 1,
        "flow_cytometry": {"CD34": "+", "CD117": "+", "HLA-DR": "+"}
    }
    bm_rep = parse_bone_marrow(raw_data, patient_id="PT-TEST-001")
    assert bm_rep["blast_pct"] == 24.5
    assert "Acute Leukemia" in bm_rep["clinical_classification"]


def test_parse_vcf_content():
    vcf_text = """##fileformat=VCFv4.2
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO
chr13\t28608258\t.\tA\tT\t100\tPASS\tGENE=FLT3;VAF=0.38;CLINVAR=Pathogenic
chr3\t25245350\t.\tC\tT\t100\tPASS\tGENE=NPM1;VAF=0.45;CLINVAR=Pathogenic
chr17\t7577538\t.\tC\tT\t100\tPASS\tGENE=TP53;VAF=0.52;CLINVAR=Pathogenic
chr10\t9654123\t.\tG\tA\t100\tPASS\tGENE=CYP2C19;VAF=0.50;CLINVAR=Risk_Factor
"""
    variants = parse_vcf_content(vcf_text, patient_id="PT-TEST-001")
    assert len(variants) == 4
    flt3 = next(v for v in variants if v["gene_symbol"] == "FLT3")
    assert flt3["is_actionable"] is True
    assert "Midostaurin" in flt3["therapeutic_implications"]
    tp53 = next(v for v in variants if v["gene_symbol"] == "TP53")
    assert tp53["is_actionable"] is True


def test_biological_db_profile():
    init_biological_tables()
    spec = {
        "specimen_id": "SPEC-001",
        "patient_id": "PT-BIO-01",
        "specimen_type": "Bone Marrow Aspirate",
        "verification_status": "VERIFIED"
    }
    save_specimen(spec)
    prof = get_patient_biological_profile("PT-BIO-01")
    assert len(prof["specimens"]) >= 1

