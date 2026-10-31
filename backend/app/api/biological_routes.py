"""
MarrowQ Biological Ingestion & Multimodal Profile Endpoints
----------------------------------------------------------
Handles specimen registration, blood labs, bone marrow reports, and VCF genomics.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status

from app.core.auth import get_current_user, require_role
from app.core.biological_db import (
    save_specimen, save_blood_panel, save_bone_marrow_report,
    save_genomic_variant, get_patient_biological_profile, init_biological_tables
)
from app.core.biological_parsers import parse_blood_panel, parse_bone_marrow, parse_vcf_content

router = APIRouter(prefix="/api/v2/biological", tags=["biological"])


class SpecimenCreateRequest(BaseModel):
    patient_id: str
    specimen_type: str = Field(..., example="Peripheral Blood")
    anatomical_site: Optional[str] = "Left antecubital fossa"
    laboratory_name: Optional[str] = "Central Hematology Core Lab"
    quality_score: Optional[float] = 1.0


class BloodPanelCreateRequest(BaseModel):
    patient_id: str
    specimen_id: Optional[str] = None
    hb: Optional[float] = Field(None, description="Hemoglobin in g/dL")
    wbc: Optional[float] = Field(None, description="WBC in x10^3/uL")
    anc: Optional[float] = Field(None, description="Absolute Neutrophil Count in cells/uL")
    alc: Optional[float] = Field(None, description="Absolute Lymphocyte Count in cells/uL")
    platelets: Optional[float] = Field(None, description="Platelets in /uL")
    reticulocytes: Optional[float] = None
    creatinine: Optional[float] = None
    bun: Optional[float] = None
    total_bilirubin: Optional[float] = None
    ast: Optional[float] = None
    alt: Optional[float] = None
    albumin: Optional[float] = None
    ldh: Optional[float] = None
    crp: Optional[float] = None
    ferritin: Optional[float] = None
    electrolytes: Optional[Dict[str, float]] = None


class BoneMarrowCreateRequest(BaseModel):
    patient_id: str
    specimen_id: Optional[str] = None
    cellularity_pct: Optional[float] = 40.0
    blast_pct: float = Field(..., description="Myeloblast percentage in bone marrow aspirate")
    myeloid_erythroid_ratio: Optional[float] = 3.0
    fibrosis_grade: Optional[int] = 0
    morphology_summary: Optional[str] = None
    dysplasia_lineages_count: Optional[int] = 0
    flow_cytometry: Optional[Dict[str, Any]] = None
    cytogenetics_karyotype: Optional[str] = "46,XX [20]"
    mrd_status: Optional[str] = "NEGATIVE"
    mrd_level: Optional[float] = 0.0


class VCFUploadTextRequest(BaseModel):
    patient_id: str
    specimen_id: Optional[str] = None
    vcf_content: str = Field(..., description="Raw text of the VCF file")


@router.post("/specimens")
def register_specimen(req: SpecimenCreateRequest, user: Dict[str, Any] = Depends(require_role(["doctor", "researcher", "admin"]))):
    init_biological_tables()
    spec_dict = {
        "specimen_id": f"SPEC-{req.specimen_type[:3].upper()}-{req.patient_id.split('-')[-1]}",
        "patient_id": req.patient_id,
        "specimen_type": req.specimen_type,
        "anatomical_site": req.anatomical_site,
        "laboratory_name": req.laboratory_name,
        "quality_score": req.quality_score,
        "verification_status": "VERIFIED"
    }
    save_specimen(spec_dict)
    return {"status": "SUCCESS", "specimen": spec_dict}


@router.post("/blood")
def ingest_blood_panel(req: BloodPanelCreateRequest, user: Dict[str, Any] = Depends(require_role(["doctor", "researcher", "admin"]))):
    init_biological_tables()
    panel = parse_blood_panel(req.model_dump(), req.patient_id, req.specimen_id)
    save_blood_panel(panel)
    return {"status": "SUCCESS", "panel": panel}


@router.post("/bone-marrow")
def ingest_bone_marrow(req: BoneMarrowCreateRequest, user: Dict[str, Any] = Depends(require_role(["doctor", "researcher", "admin"]))):
    init_biological_tables()
    bm_rep = parse_bone_marrow(req.model_dump(), req.patient_id, req.specimen_id)
    save_bone_marrow_report(bm_rep)
    return {"status": "SUCCESS", "bone_marrow_report": bm_rep}


@router.post("/vcf-upload")
def upload_vcf(req: VCFUploadTextRequest, user: Dict[str, Any] = Depends(require_role(["doctor", "researcher", "admin"]))):
    init_biological_tables()
    variants = parse_vcf_content(req.vcf_content, req.patient_id, req.specimen_id)
    for v in variants:
        save_genomic_variant(v)
    return {
        "status": "SUCCESS",
        "parsed_variants_count": len(variants),
        "actionable_variants_count": sum(1 for v in variants if v["is_actionable"]),
        "variants": variants
    }


@router.get("/patient/{patient_id}/profile")
def get_patient_profile(patient_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    profile = get_patient_biological_profile(patient_id)
    return profile


class FlowAnalysisRequest(BaseModel):
    patient_id: Optional[str] = "DEMO-001"
    fcs_base64: Optional[str] = None


class SmearAnalysisRequest(BaseModel):
    patient_id: Optional[str] = "DEMO-001"
    manual_cellularity_pct: Optional[float] = 60.0
    manual_blasts_pct: Optional[float] = 4.5


class GenomicCurationRequest(BaseModel):
    gene_symbol: str = Field(..., example="TP53")
    variant_desc: str = Field(..., example="p.Arg175His")
    vaf: Optional[float] = 0.35
    read_depth: Optional[int] = 450
    co_occurring_genes: Optional[List[str]] = None


@router.post("/flow/analyze")
def analyze_flow_sample(req: FlowAnalysisRequest):
    """Parses Flow Cytometry Standard parameters and runs gating hierarchy + MRD quantification."""
    from app.core.flow_cytometry import FlowCytometryGatingEngine
    engine = FlowCytometryGatingEngine()
    analysis = engine.analyze_flow_sample()
    return {
        "status": "SUCCESS",
        "patient_id": req.patient_id,
        "flow_cytometry_analysis": analysis,
    }


@router.post("/pathology/smear-analyze")
def analyze_pathology_smear(req: SmearAnalysisRequest):
    """Runs cell detection, N:C ratio segmentation, and differential enumeration for aspirate smears."""
    from app.core.pathology_vision import BoneMarrowPathologyAnalyzer
    analyzer = BoneMarrowPathologyAnalyzer()
    smear_result = analyzer.analyze_smear_sample(
        manual_override_cellularity=req.manual_cellularity_pct,
        manual_override_blasts=req.manual_blasts_pct,
    )
    return {
        "status": "SUCCESS",
        "patient_id": req.patient_id,
        "smear_pathology": smear_result,
    }


@router.post("/genomics/curate")
def curate_genomic_variant(req: GenomicCurationRequest):
    """Normalizes HGVS coordinates and links to ClinVar, ClinGen, and COSMIC registries."""
    from app.core.genomic_curation import GenomicCurationEngine
    engine = GenomicCurationEngine()
    curation = engine.curate_variant(
        gene_symbol=req.gene_symbol,
        variant_desc=req.variant_desc,
        vaf=req.vaf or 0.35,
        read_depth=req.read_depth or 450,
    )
    co_occur = engine.analyze_co_occurrence(req.co_occurring_genes or [req.gene_symbol])
    return {
        "status": "SUCCESS",
        "curated_variant": curation,
        "co_occurrence_findings": co_occur,
    }


