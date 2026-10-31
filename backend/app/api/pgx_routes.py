"""
MarrowQ Pharmacogenomics (PGx) Endpoints
----------------------------------------
Evaluates drug-gene interactions and CPIC Level A/B recommendations.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.pgx import evaluate_patient_pharmacogenomics, CPIC_RULES

router = APIRouter(prefix="/api/v2/pgx", tags=["pharmacogenomics"])


class PGxEvaluationRequest(BaseModel):
    genotypes: Dict[str, str] = Field(
        ...,
        example={"TPMT": "IM", "NUDT15": "NM", "CYP2C19": "PM", "DPYD": "NM"}
    )
    intended_medications: Optional[List[str]] = Field(
        default_factory=list,
        example=["Voriconazole", "Mercaptopurine"]
    )


@router.post("/evaluate")
def evaluate_pgx(req: PGxEvaluationRequest, user: Dict[str, Any] = Depends(get_current_user)):
    return evaluate_patient_pharmacogenomics(req.genotypes, req.intended_medications)


@router.get("/guidelines")
def list_cpic_guidelines(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "guideline_count": len(CPIC_RULES),
        "guidelines": CPIC_RULES
    }

