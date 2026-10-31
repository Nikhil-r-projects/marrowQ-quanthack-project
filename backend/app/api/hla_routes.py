"""
MarrowQ HLA Matching & Donor Compatibility Endpoints
----------------------------------------------------
Evaluates 12-allele matching, DPB1 TCE permissiveness, and DSA risk.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.hla import (
    HLATyping, AllelePair, compute_donor_compatibility,
    classify_dpb1_tce, evaluate_dsa
)

router = APIRouter(prefix="/api/v2/hla", tags=["hla"])


class LocusAlleles(BaseModel):
    allele1: str
    allele2: str


class HLATypingInput(BaseModel):
    a: LocusAlleles
    b: LocusAlleles
    c: LocusAlleles
    drb1: LocusAlleles
    dqb1: LocusAlleles
    dpb1: Optional[LocusAlleles] = None


class HLAMatchRequest(BaseModel):
    recipient: HLATypingInput
    donor: HLATypingInput
    recipient_dsa_panel: Optional[Dict[str, float]] = None


@router.post("/evaluate")
def evaluate_hla(req: HLAMatchRequest, user: Dict[str, Any] = Depends(get_current_user)):
    rec = HLATyping(
        a=AllelePair(req.recipient.a.allele1, req.recipient.a.allele2),
        b=AllelePair(req.recipient.b.allele1, req.recipient.b.allele2),
        c=AllelePair(req.recipient.c.allele1, req.recipient.c.allele2),
        drb1=AllelePair(req.recipient.drb1.allele1, req.recipient.drb1.allele2),
        dqb1=AllelePair(req.recipient.dqb1.allele1, req.recipient.dqb1.allele2),
        dpb1=AllelePair(req.recipient.dpb1.allele1, req.recipient.dpb1.allele2) if req.recipient.dpb1 else None
    )
    don = HLATyping(
        a=AllelePair(req.donor.a.allele1, req.donor.a.allele2),
        b=AllelePair(req.donor.b.allele1, req.donor.b.allele2),
        c=AllelePair(req.donor.c.allele1, req.donor.c.allele2),
        drb1=AllelePair(req.donor.drb1.allele1, req.donor.drb1.allele2),
        dqb1=AllelePair(req.donor.dqb1.allele1, req.donor.dqb1.allele2),
        dpb1=AllelePair(req.donor.dpb1.allele1, req.donor.dpb1.allele2) if req.donor.dpb1 else None
    )
    result = compute_donor_compatibility(rec, don, req.recipient_dsa_panel)
    return result

