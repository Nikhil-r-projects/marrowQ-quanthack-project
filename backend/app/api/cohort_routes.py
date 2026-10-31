"""Real cohort data (UCI BMT children) and ward admissions built on its variables."""
from fastapi import APIRouter, HTTPException

from app.core import patients as patient_service
from app.core import survival
from app.core.database import delete_patient, get_patient, log_audit_event, save_patient
from app.core.datasets import uci_bmt
from app.schemas import ExamplePatientsRequest, PatientCreateRequest

router = APIRouter(prefix="/api", tags=["cohort"])


@router.get("/cohort")
def get_cohort_overview():
    df = patient_service.cohort()
    return {
        "dataset_id": uci_bmt.DATASET_ID,
        "citation": uci_bmt.CITATION,
        "license": uci_bmt.LICENSE,
        "source_url": uci_bmt.SOURCE_URL,
        "summary": uci_bmt.summary(df),
        "quality_notes": uci_bmt.quality_notes(uci_bmt.fetch_raw(), df),
        "required_for_intake": uci_bmt.REQUIRED_FOR_INTAKE,
        "dictionary": uci_bmt.dictionary_payload(df),
    }


@router.get("/cohort/records")
def get_cohort_records():
    df = patient_service.cohort()
    # NaN is not valid JSON; send nulls.
    return df.astype(object).where(df.notna(), None).to_dict(orient="records")


@router.post("/patients", status_code=201)
def admit_patient(req: PatientCreateRequest):
    clean, errors, warnings = uci_bmt.validate_pretransplant(req.pretransplant, patient_service.cohort())
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors, "warnings": warnings})
    patient = patient_service.build_patient(clean, req.label.strip(), req.transplant_date, req.conditioning.strip() or "Not recorded")
    save_patient(patient)
    log_audit_event("PATIENT_ADMITTED", patient["patient_id"], "CLINICIAN", {"source": "intake", "warnings": warnings})
    return {"patient": patient, "warnings": warnings}


@router.post("/patients/examples", status_code=201)
def admit_example_patients(req: ExamplePatientsRequest):
    created = patient_service.create_example_patients(req.count, req.seed)
    if not created:
        raise HTTPException(status_code=409, detail="Every cohort record is already in use as an example patient.")
    for p in created:
        log_audit_event("PATIENT_ADMITTED", p["patient_id"], "CLINICIAN", {"source": "example", "record": p["source_record"]})
    return created


@router.delete("/patients/{patient_id}")
def discharge_patient(patient_id: str):
    if not get_patient(patient_id):
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    delete_patient(patient_id)
    log_audit_event("PATIENT_REMOVED", patient_id, "CLINICIAN", {})
    return {"status": "removed", "patient_id": patient_id}


@router.post("/engraftment-curve")
def get_engraftment_curve(pretransplant: dict):
    """P(neutrophil engraftment by day d) from the log-logistic AFT model trained on the UCI cohort."""
    clean, errors, warnings = uci_bmt.validate_pretransplant(pretransplant, patient_service.cohort())
    # Missing values are imputed for a what-if curve; anything else invalid is rejected.
    blocking = [e for e in errors if "is required" not in e]
    if blocking:
        raise HTTPException(status_code=422, detail={"errors": blocking, "warnings": warnings})
    return {**survival.engraftment_curve(clean), "warnings": warnings}
