"""Clinical review pipeline for one ward patient.

Steps (each recorded in the trail shown to clinicians):
1. Data quality     - required fields, plausible ranges, out-of-distribution vs the UCI training cohort
2. Model scoring    - trained, cross-validated models from the latest UCI experiment score the patient's
                      pre-transplant record (nothing hand-written)
3. Engraftment time - log-logistic AFT curve (pre-transplant) and the GPU particle-filter forecast (with labs)
4. Agreement        - spread and vote of the model scores
5. Evidence         - statements computed from the cohort and the patient's own record
6. Report           - drafted by Claude from these computed facts only, number-checked; template fallback
Every output is a draft until a haematologist signs it off.
"""
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from app.core import inference, survival
from app.core.database import get_patient, get_patient_observations, log_audit_event, save_prediction_run
from app.core.datasets import uci_bmt
from app.core.patients import cohort as patient_cohort
from app.core.report_writer import draft_reports
from app.core.trajectory import compute_patient_trajectory

TARGET_TEXT = f"neutrophil engraftment by Day +{uci_bmt.EARLY_ENGRAFTMENT_DAY}"
VARIANCE_LIMIT = 0.04


def _step(step_id: str, task_id: str, status: str, output: Dict[str, Any], warnings: Optional[List[str]] = None) -> Dict[str, Any]:
    return {
        "agent_id": step_id, "task_id": task_id, "status": status, "output_data": output,
        "warnings": warnings or [], "errors": [], "confidence": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def data_quality(patient: Dict[str, Any], labs: Dict[str, float]) -> Dict[str, Any]:
    warnings, errors = [], []
    pre = patient.get("pretransplant") or {}
    if not pre:
        warnings.append("No pre-transplant record: model scores and graft evidence are unavailable.")
    else:
        _, problems, ranges = uci_bmt.validate_pretransplant(pre, patient_cohort())
        warnings.extend(ranges)
        warnings.extend(p for p in problems if "is required" in p)
    if patient.get("disease") not in (uci_bmt.DATA_DICTIONARY["disease"].categories or []):
        warnings.append(f"Diagnosis '{patient.get('disease')}' is not represented in the UCI training cohort; model outputs are extrapolations.")
    if not 0 <= labs["anc"] <= 40000:
        errors.append(f"Implausible ANC {labs['anc']} cells/uL")
    elif labs["anc"] < 500:
        warnings.append(f"Neutropenia: latest ANC {labs['anc']:,.0f} cells/µL (below the 500 engraftment threshold).")
    if not 0 <= labs["platelets"] <= 1_500_000:
        errors.append(f"Implausible platelet count {labs['platelets']}/uL")
    elif labs["platelets"] < 20000:
        warnings.append(f"Thrombocytopenia: latest platelets {labs['platelets']:,.0f}/µL (below 20,000).")
    return {"warnings": warnings, "errors": errors}


def model_scores(patient: Dict[str, Any]) -> Dict[str, Any]:
    exp = inference.latest_cohort_experiment()
    pre = patient.get("pretransplant") or {}
    if exp is None:
        return {"experiment_id": None, "models": [], "note": "No completed benchmark on the UCI cohort yet. Run one under Research, Run benchmark."}
    if not pre:
        return {"experiment_id": exp["experiment_id"], "models": [], "note": "Patient has no pre-transplant record to score."}
    cohort = patient_cohort()
    base_rate = float(np.mean(cohort[exp["target_column"]])) if exp["target_column"] in cohort else 0.5
    models = []
    for key, metric in exp["metrics"].items():
        if key in ("dummy", "matched_rbf_svm"):
            continue
        try:
            p = inference.score(exp, key, pre)
        except FileNotFoundError:
            continue
        models.append({
            "key": key,
            "display_name": metric["display_name"],
            "probability": round(p, 4),
            "predicted_engraftment": bool(p >= base_rate),
            "roc_auc_cv": metric.get("roc_auc"),
            "roc_auc_ci": metric.get("roc_auc_ci"),
            "evaluation": metric.get("evaluation") or "single held-out split",
            "experimental": key == "quantum_kernel_svm",
        })
    return {"experiment_id": exp["experiment_id"], "models": models, "decision_threshold": round(base_rate, 3), "target": TARGET_TEXT}


def agreement(models: List[Dict[str, Any]]) -> Dict[str, Any]:
    core = [m for m in models if not m["experimental"]]
    if len(core) < 2:
        return {"status": "INSUFFICIENT_MODELS", "label": "Not enough trained models", "warnings": []}
    probs = [m["probability"] for m in core]
    votes = {m["predicted_engraftment"] for m in core}
    var = float(np.var(probs))
    warnings = []
    if len(votes) > 1:
        warnings.append("The trained models fall on both sides of the decision threshold; review the inputs before relying on any single score.")
    if var > VARIANCE_LIMIT:
        warnings.append(f"Model estimates are widely spread (variance {var:.3f}).")
    status = "VALIDATED_CONSENSUS" if not warnings else ("VALIDATED_WITH_DISAGREEMENT" if len(votes) > 1 else "VALIDATED_HIGH_VARIANCE")
    label = {"VALIDATED_CONSENSUS": "Models agree", "VALIDATED_WITH_DISAGREEMENT": "Models disagree", "VALIDATED_HIGH_VARIANCE": "Wide spread"}[status]
    return {"status": status, "label": label, "mean_probability": round(float(np.mean(probs)), 4), "variance": round(var, 4),
            "models_in_agreement": len(votes) == 1, "warnings": warnings}


class ClinicalAgentResponse:
    def __init__(
        self,
        agent_id: str,
        task_id: str,
        status: str, # "SUCCESS", "WARNING", "FAILED"
        output_data: Dict[str, Any],
        warnings: Optional[List[str]] = None,
        errors: Optional[List[str]] = None,
        confidence: Optional[float] = None
    ):
        self.agent_id = agent_id
        self.task_id = task_id
        self.status = status
        self.output_data = output_data
        self.warnings = warnings or []
        self.errors = errors or []
        self.confidence = confidence
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "task_id": self.task_id,
            "status": self.status,
            "output_data": self.output_data,
            "warnings": self.warnings,
            "errors": self.errors,
            "confidence": self.confidence,
            "timestamp": self.timestamp
        }


class EvidenceAndClinicalContextAgent:
    """Every statement is computed from the UCI cohort or the patient's own record; nothing is quoted from memory."""
    AGENT_ID = "evidence_clinical_context_agent"

    @staticmethod
    def _median_day(frame) -> Optional[float]:
        days = frame["anc_recovery_day"].dropna()
        return float(days.median()) if len(days) else None

    def run(self, task_id: str, patient_record: Dict[str, Any], current_labs: Dict[str, float]) -> ClinicalAgentResponse:
        df = patient_cohort()
        source = f"UCI BMT children cohort (n = {len(df)}), computed"
        pre = patient_record.get("pretransplant") or {}
        evidence_factors = []

        cd34 = patient_record.get("cell_dose_cd34")
        if cd34 is not None:
            above, below = df[df.cd34_dose >= cd34], df[df.cd34_dose < cd34]
            m_above, m_below = self._median_day(above), self._median_day(below)
            if m_above is not None and m_below is not None:
                evidence_factors.append({
                    "factor": "CD34+ cell dose",
                    "observation": f"{cd34:g} ×10⁶/kg infused ({(df.cd34_dose < cd34).mean() * 100:.0f}th percentile of the cohort)",
                    "clinical_impact": f"Cohort recipients at or above this dose recovered neutrophils at a median of Day +{m_above:g} (n = {len(above)}), versus Day +{m_below:g} below it (n = {len(below)}).",
                    "reference_registry": source,
                })

        graft = pre.get("stem_cell_source")
        if graft:
            same = df[df.stem_cell_source == graft]
            m = self._median_day(same)
            if m is not None:
                evidence_factors.append({
                    "factor": "Stem-cell source",
                    "observation": graft,
                    "clinical_impact": f"Median neutrophil recovery with this source in the cohort: Day +{m:g} (n = {len(same)}).",
                    "reference_registry": source,
                })

        hla = pre.get("hla_match") or patient_record.get("hla_match")
        if hla:
            same = df[df.hla_match == hla]
            m = self._median_day(same)
            if m is not None:
                evidence_factors.append({
                    "factor": "HLA match",
                    "observation": hla,
                    "clinical_impact": f"Median neutrophil recovery for {hla} transplants in the cohort: Day +{m:g} (n = {len(same)}).",
                    "reference_registry": source,
                })

        anc_draws = [o for o in patient_record.get("observations", []) if "ANC" in o["metric_type"]]
        if anc_draws:
            last = anc_draws[-1]
            trend = ""
            if len(anc_draws) > 1:
                prev = anc_draws[-2]
                trend = f"; {last['value'] - prev['value']:+,.0f} since Day +{prev['day_post_tx']}"
            evidence_factors.append({
                "factor": "Neutrophil count",
                "observation": f"{last['value']:,.0f} cells/μL on Day +{last['day_post_tx']}{trend}",
                "clinical_impact": "At or above the 500/μL engraftment threshold." if last["value"] >= 500 else "Below the 500/μL engraftment threshold; engraftment needs three consecutive daily counts ≥ 500.",
                "reference_registry": "Patient record · EBMT neutrophil engraftment definition",
            })

        chimerism = patient_record.get("chimerism_donor_pct")
        if chimerism is not None:
            evidence_factors.append({
                "factor": "Donor chimerism",
                "observation": f"{chimerism}% donor DNA in peripheral blood",
                "clinical_impact": "Full donor chimerism (≥ 95%)." if chimerism >= 95 else "Mixed chimerism (< 95%): repeat testing is usual.",
                "reference_registry": "Patient record",
            })

        return ClinicalAgentResponse(
            agent_id=self.AGENT_ID,
            task_id=task_id,
            status="SUCCESS",
            output_data={
                "evidence_items": evidence_factors,
                "limitations": "Associations in a single-centre paediatric cohort (n = 187); they describe that cohort, not causal effects for this patient.",
            },
            confidence=None,
        )


class MultiAgentOrchestrator:
    """Public entry point used by the API (orchestrator.orchestrate_prediction)."""

    def __init__(self):
        self.evidence_agent = EvidenceAndClinicalContextAgent()

    def orchestrate_prediction(self, patient_id: str, current_labs: Optional[Dict[str, float]] = None,
                               quantum_backend: str = "aer_simulator_statevector", execution_mode: str = "auto_fallback") -> Dict[str, Any]:
        task_id = f"review-{uuid.uuid4().hex[:8]}"
        started = time.time()
        patient = get_patient(patient_id)
        if not patient:
            return {"task_id": task_id, "status": "FAILED", "error": f"Patient {patient_id} not found"}
        observations = get_patient_observations(patient_id)

        # Latest recorded counts (observations are ordered by day). Nothing is substituted when missing.
        if not current_labs:
            anc = next((o["value"] for o in reversed(observations) if "ANC" in o["metric_type"]), None)
            plt = next((o["value"] for o in reversed(observations) if "Platelet" in o["metric_type"]), None)
            if anc is None or plt is None:
                return {"task_id": task_id, "status": "FAILED", "error": "Record at least one neutrophil (ANC) and one platelet count before running a clinical review."}
            current_labs = {"anc": float(anc), "platelets": float(plt)}
        days_post = (datetime.now(timezone.utc).date() - datetime.fromisoformat(patient["transplant_date"][:10]).date()).days
        context = {**patient, "days_post_tx": days_post, "current_anc": current_labs["anc"],
                   "current_plt": current_labs["platelets"], "observations": observations}
        trail = []

        dq = data_quality(patient, current_labs)
        trail.append(_step("data_quality", task_id, "FAILED" if dq["errors"] else "WARNING" if dq["warnings"] else "SUCCESS", dq, dq["warnings"]))
        if dq["errors"]:
            return {"task_id": task_id, "status": "FAILED", "error": "; ".join(dq["errors"])}

        scores = model_scores(patient)
        trail.append(_step("model_scoring", task_id, "SUCCESS" if scores["models"] else "WARNING", scores,
                           [scores["note"]] if scores.get("note") else []))

        progress = compute_patient_trajectory(patient_id)
        curve = survival.engraftment_curve(patient["pretransplant"]) if patient.get("pretransplant") else None
        timing = {"forecast": progress.get("forecast"), "engrafted": progress.get("is_anc_engrafted"),
                  "aft_median_day": curve["median_day"] if curve else None,
                  "aft_probability_by_day": curve["probability_by_day"] if curve else None}
        trail.append(_step("engraftment_time", task_id, "SUCCESS", timing))

        agree = agreement(scores["models"])
        trail.append(_step("agreement", task_id, "WARNING" if agree["warnings"] else "SUCCESS", agree, agree["warnings"]))

        evidence = self.evidence_agent.run(task_id, context, current_labs).to_dict()
        evidence["agent_id"] = "evidence"
        trail.append(evidence)

        fc = progress.get("forecast") or {}
        confirmed = next((m.get("actual_day") for m in progress.get("milestones", []) if m["id"] == "anc_engraftment" and m["status"] == "COMPLETED"), None)
        facts = {
            "patient_label": patient["name"], "disease": patient["disease"], "age_years": patient["age"],
            "days_post_transplant": days_post,
            "latest_counts": {"anc": current_labs["anc"], "platelets": current_labs["platelets"]},
            "neutrophil_engraftment_confirmed_day": confirmed,
            "engraftment_forecast": {"median_engraftment_day": fc.get("median_engraftment_day"),
                                     "probability_engrafted_by": {str(k): v for k, v in (fc.get("probability_engrafted_by") or {}).items()},
                                     "delayed_engraftment_risk": fc.get("delayed_engraftment_risk"),
                                     "draws_used": fc.get("draws_used")},
            "model_target": TARGET_TEXT,
            "models": [{"display_name": m["display_name"], "probability": m["probability"], "roc_auc_cv": m["roc_auc_cv"] or 0.0}
                       for m in scores["models"] if not m["experimental"]],
            "agreement": {"status": agree["label"]},
            "evidence": [{k: e[k] for k in ("factor", "observation", "clinical_impact")} for e in evidence["output_data"]["evidence_items"]],
            "warnings": dq["warnings"] + agree["warnings"],
            "model_scope": "Models trained on 187 paediatric recipients from one centre (UCI cohort).",
        }
        reports = draft_reports(facts)
        reports["generated_at"] = datetime.now(timezone.utc).isoformat()
        trail.append(_step("report", task_id, "SUCCESS" if reports["author"] != "template" else "WARNING",
                           {"author": reports["author"], "note": reports["note"]},
                           [] if reports["author"] != "template" else [f"Report written from the template ({reports['note']})."]))

        prediction_id = f"PR-{patient_id}-{int(time.time())}"
        save_prediction_run({
            "prediction_id": prediction_id, "patient_id": patient_id,
            "models_executed": [m["display_name"] for m in scores["models"]],
            "predictions": {"models": scores["models"], "experiment_id": scores["experiment_id"], "reports": reports},
            "disagreement": {"flag": not agree.get("models_in_agreement", True), "variance": agree.get("variance")},
            "validation_status": agree["status"], "warnings": dq["warnings"] + agree["warnings"],
            "clinician_review_status": "PENDING_REVIEW", "reviewed_by": None, "review_notes": None,
            "backend_provenance": f"experiment:{scores['experiment_id']}",
        })
        log_audit_event("CLINICAL_REVIEW_RUN", patient_id, "SYSTEM", {"task_id": task_id, "prediction_id": prediction_id})
        return {
            "task_id": task_id, "prediction_id": prediction_id, "patient_id": patient_id, "status": "COMPLETED",
            "duration_ms": round((time.time() - started) * 1000, 1),
            "validation_status": agree["status"], "disagreement_detected": not agree.get("models_in_agreement", True),
            "experiment_id": scores["experiment_id"], "models": scores["models"], "model_note": scores.get("note"),
            "decision_threshold": scores.get("decision_threshold"), "target": TARGET_TEXT,
            "agreement": agree, "engraftment_time": timing,
            "evidence": evidence["output_data"]["evidence_items"],
            "reports": reports, "review_status": "PENDING_REVIEW",
            "agent_trail": trail,
        }


orchestrator = MultiAgentOrchestrator()
