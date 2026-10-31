"""
MarrowQ Multi-Disease Diagnostic Intelligence Endpoints
-------------------------------------------------------
Provides disease classification, clinical risk scores, and precision oncology assessment.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends

from app.core.auth import get_current_user
from app.core.disease_modules import (
    evaluate_aml, evaluate_mds_ipss_m, evaluate_aplastic_anemia,
    evaluate_nsclc_biomarkers, evaluate_breast_cancer, evaluate_kidney_function,
    evaluate_liver_function, evaluate_cardiovascular_risk
)

router = APIRouter(prefix="/api/v2/diseases", tags=["diseases"])


class AMLEvaluationRequest(BaseModel):
    blast_percentage: float = Field(..., ge=0, le=100, description="Bone marrow or peripheral blood blast percentage")
    mutations: List[str] = Field(default_factory=list, example=["NPM1", "FLT3-ITD"])
    cytogenetics: str = Field(default="Normal karyotype", example="t(8;21)(q22;q22.1)")
    age: float = Field(default=55.0)


class MDSEvaluationRequest(BaseModel):
    bone_marrow_blast_pct: float = Field(..., ge=0, le=100)
    hemoglobin: float = Field(..., description="Hemoglobin in g/dL")
    platelets: float = Field(..., description="Platelets in /uL")
    anc: float = Field(..., description="ANC in cells/uL")
    cytogenetics_category: str = Field(default="Good", example="Good")
    mutations: List[str] = Field(default_factory=list, example=["ASXL1", "SF3B1"])


class SAAEvaluationRequest(BaseModel):
    cellularity_pct: float = Field(..., ge=0, le=100)
    anc: float = Field(..., description="Absolute neutrophil count")
    platelets: float = Field(...)
    reticulocytes: float = Field(..., description="Absolute reticulocyte count /uL")


class KidneyEvaluationRequest(BaseModel):
    serum_creatinine: float = Field(..., description="Serum creatinine in mg/dL")
    age: float = Field(default=50.0)
    sex: str = Field(default="Male")
    baseline_creatinine: Optional[float] = None


class LiverEvaluationRequest(BaseModel):
    total_bilirubin: float = Field(..., description="mg/dL")
    serum_creatinine: float = Field(..., description="mg/dL")
    inr: float = Field(..., description="International Normalized Ratio")
    serum_sodium: float = Field(default=138.0, description="mEq/L")
    ast: float = Field(default=35.0, description="U/L")
    alt: float = Field(default=40.0, description="U/L")
    platelets: float = Field(default=150000.0, description="/uL")
    age: float = Field(default=50.0)


class CardioEvaluationRequest(BaseModel):
    age: float
    total_cholesterol: float
    hdl: float
    systolic_bp: float
    is_smoker: bool = False
    has_diabetes: bool = False
    is_female: bool = False


@router.post("/aml")
def assess_aml(req: AMLEvaluationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return evaluate_aml(req.blast_percentage, req.mutations, req.cytogenetics, req.age)


@router.post("/mds")
def assess_mds(req: MDSEvaluationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return evaluate_mds_ipss_m(
        req.bone_marrow_blast_pct, req.hemoglobin, req.platelets, req.anc,
        req.cytogenetics_category, req.mutations
    )


@router.post("/aplastic-anemia")
def assess_saa(req: SAAEvaluationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return evaluate_aplastic_anemia(req.cellularity_pct, req.anc, req.platelets, req.reticulocytes)


@router.post("/nephrology")
def assess_kidney(req: KidneyEvaluationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return evaluate_kidney_function(req.serum_creatinine, req.age, req.sex, req.baseline_creatinine)


@router.post("/hepatology")
def assess_liver(req: LiverEvaluationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return evaluate_liver_function(
        req.total_bilirubin, req.serum_creatinine, req.inr, req.serum_sodium,
        req.ast, req.alt, req.platelets, req.age
    )


@router.post("/cardiology")
def assess_cardio(req: CardioEvaluationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return evaluate_cardiovascular_risk(
        req.age, req.total_cholesterol, req.hdl, req.systolic_bp,
        req.is_smoker, req.has_diabetes, req.is_female
    )

