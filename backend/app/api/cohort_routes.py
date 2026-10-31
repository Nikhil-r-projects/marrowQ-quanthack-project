"""Real cohort data (UCI BMT children) and ward admissions built on its variables."""
from fastapi import APIRouter, HTTPException

from app.core import patients as patient_service
from app.core import survival
from app.core.database import delete_patient, get_patient, list_prediction_runs, log_audit_event, review_prediction_run, save_patient
from app.core.datasets import uci_bmt
from app.schemas import ExamplePatientsRequest, PatientCreateRequest, ReviewDecisionRequest

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
    created = patient_service.create_example_patients(req.count, req.seed, with_observations=req.with_observations)
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


@router.post("/predictions/{prediction_id}/review")
def sign_off_review(prediction_id: str, req: ReviewDecisionRequest):
    """Haematologist sign-off of a clinical review draft (audited)."""
    run = next((r for r in list_prediction_runs() if r["prediction_id"] == prediction_id), None)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Review '{prediction_id}' not found.")
    if run["clinician_review_status"] != "PENDING_REVIEW":
        raise HTTPException(status_code=409, detail=f"Review already {run['clinician_review_status'].lower()}.")
    status = "APPROVED" if req.decision == "approve" else "REJECTED"
    review_prediction_run(prediction_id, status, req.reviewer.strip(), (req.notes or "").strip() or None)
    log_audit_event(f"REVIEW_{status}", run["patient_id"], "CLINICIAN", {"prediction_id": prediction_id, "reviewer": req.reviewer, "notes": req.notes})
    return {"prediction_id": prediction_id, "status": status}


@router.get("/patients/{patient_id}/approved-summary")
def latest_approved_summary(patient_id: str):
    """Most recent signed-off review; the patient view only ever shows approved text."""
    run = next((r for r in list_prediction_runs(patient_id) if r["clinician_review_status"] == "APPROVED"), None)
    if run is None:
        return {"available": False}
    reports = (run["predictions"] or {}).get("reports") or {}
    return {"available": True, "prediction_id": run["prediction_id"], "reviewed_by": run["reviewed_by"],
            "created_at": run["created_at"], "patient_summary": reports.get("patient_friendly_summary") or reports.get("patient_summary")}


@router.post("/patients/{patient_id}/seed-surveillance")
def seed_surveillance(patient_id: str):
    p = get_patient(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    baseline = 28.4
    if p.get("pretransplant") and p["pretransplant"].get("recipient_body_mass"):
        baseline = float(p["pretransplant"]["recipient_body_mass"])
    count = patient_service.seed_patient_surveillance_panel(
        patient_id=patient_id,
        transplant_date_str=p["transplant_date"],
        days=16,
        baseline_mass=baseline
    )
    return {"status": "seeded", "patient_id": patient_id, "observations_created": count}


@router.post("/patients/seed-all-surveillance")
def seed_all_patients_surveillance():
    from app.core.database import list_patients, get_patient_observations
    seeded = []
    for p in list_patients():
        obs = get_patient_observations(p["patient_id"])
        if len(obs) < 5:
            baseline = 28.4
            if p.get("pretransplant") and p["pretransplant"].get("recipient_body_mass"):
                baseline = float(p["pretransplant"]["recipient_body_mass"])
            count = patient_service.seed_patient_surveillance_panel(
                patient_id=p["patient_id"],
                transplant_date_str=p["transplant_date"],
                days=16,
                baseline_mass=baseline
            )
            seeded.append({"patient_id": p["patient_id"], "observations": count})
    return {"status": "completed", "seeded_patients": seeded}
