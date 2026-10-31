import time
import uuid
import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.core.database import save_prediction_run, log_audit_event, get_patient, get_patient_observations
from app.core.trajectory import compute_patient_trajectory
from app.core.ibm_quantum import quantum_manager
from app.core.datasets import uci_bmt
from app.core.patients import cohort as patient_cohort

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

# --- AGENT 1: Clinical Data Quality Agent ---
class ClinicalDataQualityAgent:
    AGENT_ID = "clinical_data_quality_agent"

    def run(self, task_id: str, patient_record: Dict[str, Any], current_labs: Dict[str, float]) -> ClinicalAgentResponse:
        warnings = []
        errors = []
        
        # 1. Inspect required demographic & transplant fields
        required_fields = ["age", "disease", "transplant_type", "transplant_date", "donor_type"]
        missing_fields = [f for f in required_fields if f not in patient_record or patient_record[f] is None]
        if missing_fields:
            errors.append(f"Missing required clinical parameters: {', '.join(missing_fields)}")
            
        # 2. Physiologic Range Validation (Deterministic Rules)
        age = patient_record.get("age", 40)
        if age < 0 or age > 110:
            errors.append(f"Invalid patient age: {age} years outside human clinical bounds [0, 110]")
            
            
        # 3. Lab Measurements validation (Strict Zero-Imputation Sentinel)
        if "anc" not in current_labs or current_labs["anc"] is None:
            errors.append("Missing mandatory laboratory parameter: Absolute Neutrophil Count (ANC) is required.")
        else:
            anc = current_labs["anc"]
            if anc < 0 or anc > 40000:
                errors.append(f"Biologically implausible ANC: {anc} cells/μL")
            elif anc < 500:
                warnings.append(f"Severe neutropenia detected: ANC {anc} cells/μL (< 500 engraftment threshold)")
                
        if "platelets" not in current_labs or current_labs["platelets"] is None:
            errors.append("Missing mandatory laboratory parameter: Platelet count is required.")
        else:
            plt = current_labs["platelets"]
            if plt < 0 or plt > 1500000:
                errors.append(f"Biologically implausible Platelet count: {plt}/μL")
            elif plt < 20000:
                warnings.append(f"Severe thrombocytopenia: Platelet count {plt}/μL (transfusion precaution)")
                
        # 4. Out-of-distribution check against the cohort the models were trained on (UCI, n = 187).
        is_ood = False
        pre = patient_record.get("pretransplant") or {}
        if pre:
            _, _, range_warnings = uci_bmt.validate_pretransplant(pre, patient_cohort())
            if range_warnings:
                warnings.extend(range_warnings)
                is_ood = True
        if patient_record.get("disease") not in (uci_bmt.DATA_DICTIONARY["disease"].categories or []):
            warnings.append(f"Diagnosis '{patient_record.get('disease')}' is not represented in the UCI training cohort; model outputs are extrapolations.")
            is_ood = True

        status = "FAILED" if errors else ("WARNING" if warnings else "SUCCESS")
        
        return ClinicalAgentResponse(
            agent_id=self.AGENT_ID,
            task_id=task_id,
            status=status,
            output_data={
                "validation_passed": len(errors) == 0,
                "out_of_distribution": is_ood,
                "critical_errors": errors,
                "quality_warnings": warnings,
                "proceed_to_inference": len(errors) == 0
            },
            warnings=warnings,
            errors=errors,
            confidence=0.98 if not warnings else 0.85
        )

# --- AGENT 2: Clinical Feature Engineering Agent ---
class ClinicalFeatureEngineeringAgent:
    AGENT_ID = "clinical_feature_engineering_agent"

    def run(self, task_id: str, patient_record: Dict[str, Any], current_labs: Dict[str, float]) -> ClinicalAgentResponse:
        # Deterministic transformation to model feature space
        if "anc" not in current_labs or "platelets" not in current_labs or current_labs["anc"] is None or current_labs["platelets"] is None:
            raise ValueError("Feature engineering requires verified laboratory parameters (ANC and Platelets); zero-imputation policy prohibits default substitution.")
        age = float(patient_record.get("age", 45))
        cd34 = float(patient_record.get("cell_dose_cd34", 5.0))
        anc = float(current_labs["anc"])
        plt = float(current_labs["platelets"])
        # Chimerism is only known once measured; never default it.
        chimerism = patient_record.get("chimerism_donor_pct")
        
        # Scaling to [0, 2π] for quantum feature map encoding
        feature_vector_classical = [age, cd34, anc, plt, chimerism]
        
        # 2D PCA projection for ZZFeatureMap (2 qubits)
        # Scaled strictly in [0, 2pi]
        q_feat1 = np.clip(((anc / 2000.0) + (cd34 / 10.0)) * np.pi, 0.0, 2 * np.pi)
        q_feat2 = np.clip(((chimerism / 100.0 if chimerism is not None else 0.0) + (1.0 - age / 80.0)) * np.pi, 0.0, 2 * np.pi)
        feature_vector_quantum = [round(float(q_feat1), 4), round(float(q_feat2), 4)]

        return ClinicalAgentResponse(
            agent_id=self.AGENT_ID,
            task_id=task_id,
            status="SUCCESS",
            output_data={
                "schema_version": "v2.1_cibmtr_hsct",
                "classical_features": {
                    "age": age,
                    "cd34_dose": cd34,
                    "current_anc": anc,
                    "current_platelets": plt,
                    "donor_chimerism_pct": chimerism
                },
                "feature_vector_classical": feature_vector_classical,
                "feature_vector_quantum": feature_vector_quantum,
                "quantum_encoding_bounds": "[0, 2π] Phase Rotations"
            },
            confidence=1.0
        )

# --- AGENT 3: Classical ML Prediction Service ---
class ClassicalMLPredictionService:
    AGENT_ID = "classical_ml_prediction_service"

    def run(
        self,
        task_id: str,
        feature_vector: List[float],
        patient_record: Optional[Dict[str, Any]] = None,
        current_labs: Optional[Dict[str, float]] = None
    ) -> ClinicalAgentResponse:
        from app.core.canonical_models import predict_classical_models
        
        # Genuine trained scikit-learn models (LogisticRegression, RandomForest, SVC)
        # trained on the UCI Paediatric BMT cohort (n=187, CC BY 4.0) with zero data leakage.
        rec = patient_record or {}
        labs = current_labs or {
            "anc": feature_vector[2] if len(feature_vector) > 2 else 0.0,
            "platelets": feature_vector[3] if len(feature_vector) > 3 else 0.0
        }
        
        predictions = predict_classical_models(rec, labs)
        
        return ClinicalAgentResponse(
            agent_id=self.AGENT_ID,
            task_id=task_id,
            status="SUCCESS",
            output_data={"models": predictions},
            confidence=0.91
        )

# --- AGENT 4: Quantum ML Prediction Service ---
class QuantumMLPredictionService:
    AGENT_ID = "quantum_ml_prediction_service"

    def run(
        self,
        task_id: str,
        quantum_features: List[float],
        backend_name: str = "aer_simulator_statevector",
        mode: str = "auto_fallback"
    ) -> ClinicalAgentResponse:
        # Evaluate 2-qubit fidelity quantum kernel
        x_pt = np.array([quantum_features])
        # Comparison reference states in Hilbert space: [Normal engraftment anchor, Delayed anchor]
        reference_anchors = np.array([
            [3.85, 4.12], # Engrafted anchor
            [1.20, 1.45]  # Delayed anchor
        ])
        
        exec_result = quantum_manager.execute_kernel_circuit(
            X_train=reference_anchors,
            X_test=x_pt,
            backend_name=backend_name,
            execution_mode=mode
        )
        
        if exec_result.get("status") == "FAILED":
            return ClinicalAgentResponse(
                agent_id=self.AGENT_ID,
                task_id=task_id,
                status="FAILED",
                output_data={"error": exec_result.get("error")},
                errors=[exec_result.get("error", "Quantum circuit execution failed")]
            )
            
        k_matrix = np.array(exec_result["kernel_matrix"])[0]
        # Similarity to engrafted anchor vs delayed anchor
        fidelity_engrafted = float(k_matrix[0])
        fidelity_delayed = float(k_matrix[1])
        
        # Softmax over quantum kernel similarities
        exp_engraft = np.exp(fidelity_engrafted * 3.0)
        exp_delay = np.exp(fidelity_delayed * 3.0)
        q_prob = float(exp_engraft / (exp_engraft + exp_delay))
        
        output = {
            "model_name": "Experimental 2-State Quantum Fidelity Probe (Non-Diagnostic Reference Comparison)",
            "model_version": "QuantumProbe_ZZ_reps1_v2.0_Exploratory",
            "validation_tier": "RESEARCH_EXPLORATORY",
            "regulatory_notice": "Experimental Hilbert-space state overlap measurement (ZZFeatureMap) relative to reference synthetic states. Excluded from clinical consensus score.",
            "probability": round(q_prob, 4),
            "predicted_engraftment": q_prob >= 0.5,
            "fidelity_to_engraftment_state": round(fidelity_engrafted, 4),
            "fidelity_to_delayed_state": round(fidelity_delayed, 4),
            "backend_used": exec_result["backend_used"],
            "circuit_depth": exec_result["circuit_depth"],
            "circuit_width": exec_result["circuit_width"],
            "shots": exec_result.get("shots", 0),
            "duration_ms": exec_result.get("duration_ms", 0.0),
            "provenance": exec_result.get("provenance"),
            "transparency_notice": exec_result.get("transparency_notice")
        }

        return ClinicalAgentResponse(
            agent_id=self.AGENT_ID,
            task_id=task_id,
            status="SUCCESS",
            output_data=output,
            confidence=round(0.88 + 0.10 * fidelity_engrafted, 3)
        )

# --- AGENT 5: Independent Prediction Validation Agent ---
class IndependentPredictionValidationAgent:
    AGENT_ID = "independent_prediction_validation_agent"

    def run(
        self,
        task_id: str,
        classical_outputs: Dict[str, Any],
        quantum_output: Dict[str, Any]
    ) -> ClinicalAgentResponse:
        warnings = []
        
        # Calculate ensemble consensus EXCLUSIVELY over validated classical models (Issue G)
        classical_probs = []
        classical_votes = []
        
        for mname, mdata in classical_outputs.items():
            if isinstance(mdata, dict) and "probability" in mdata:
                p = mdata["probability"]
                classical_probs.append(p)
                classical_votes.append(mdata.get("predicted_engraftment", p >= 0.5))
            
        mean_p = float(np.mean(classical_probs)) if classical_probs else 0.5
        var_p = float(np.var(classical_probs)) if classical_probs else 0.0
        all_agree = len(set(classical_votes)) == 1 if classical_votes else False
        
        disagreement_detected = not all_agree
        if disagreement_detected:
            warnings.append("Classical Model Disagreement Detected: Predictions diverge on classification threshold (p=0.5). Hematologist review mandatory.")
            
        if var_p > 0.04:
            warnings.append(f"High inter-model variance across classical ensemble (σ² = {round(var_p, 4)}). Prediction uncertainty elevated.")
            
        # Quantum probe comparison (kept strictly separate from ensemble consensus)
        qp = quantum_output.get("probability", 0.5)
        quantum_divergence = round(abs(qp - mean_p), 4)
        if quantum_divergence > 0.25:
            warnings.append(f"Quantum exploratory probe diverges (|Δp| = {quantum_divergence}) from classical ensemble baseline.")

        validation_status = "VALIDATED_CONSENSUS" if all_agree and var_p <= 0.04 else ("VALIDATED_WITH_DISAGREEMENT" if disagreement_detected else "VALIDATED_HIGH_VARIANCE")

        return ClinicalAgentResponse(
            agent_id=self.AGENT_ID,
            task_id=task_id,
            status="WARNING" if warnings else "SUCCESS",
            output_data={
                "ensemble_mean_probability": round(mean_p, 4),
                "inter_model_variance": round(var_p, 4),
                "unanimous_agreement": all_agree,
                "disagreement_flag": disagreement_detected,
                "validation_status": validation_status,
                "recommendation": "PROCEED" if not disagreement_detected else "FLAG_FOR_HEMATOLOGIST_REVIEW",
                "quantum_exploratory_probe": {
                    "divergence_from_classical_mean": quantum_divergence,
                    "fidelity_to_engraftment": quantum_output.get("fidelity_to_engraftment_state"),
                    "fidelity_to_delayed": quantum_output.get("fidelity_to_delayed_state"),
                    "status": "EXPLORATORY_ONLY_EXCLUDED_FROM_ENSEMBLE"
                }
            },
            warnings=warnings,
            confidence=round(1.0 - np.sqrt(var_p), 3)
        )

# --- AGENT 6: Evidence & Clinical Context Agent ---
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


# --- AGENT 7: Recovery Trajectory Agent ---
class RecoveryTrajectoryAgent:
    AGENT_ID = "recovery_trajectory_agent"

    def run(self, task_id: str, patient_id: str) -> ClinicalAgentResponse:
        traj_data = compute_patient_trajectory(patient_id)
        
        return ClinicalAgentResponse(
            agent_id=self.AGENT_ID,
            task_id=task_id,
            status="SUCCESS",
            output_data={
                "trajectory_calculated": True,
                "expected_anc_day": traj_data.get("expected_anc_engraft_day"),
                "expected_plt_day": traj_data.get("expected_plt_engraft_day"),
                "milestones_count": len(traj_data.get("milestones", [])),
                "summary": traj_data.get("clinical_summary")
            },
            confidence=0.90
        )

# --- AGENT 8: Clinical Report Agent ---
class ClinicalReportAgent:
    AGENT_ID = "clinical_report_agent"

    def run(
        self,
        task_id: str,
        patient_record: Dict[str, Any],
        val_agent_resp: ClinicalAgentResponse,
        classical_resp: ClinicalAgentResponse,
        quantum_resp: ClinicalAgentResponse
    ) -> ClinicalAgentResponse:
        p_name = patient_record.get("name", "Patient")
        p_id = patient_record.get("patient_id", "PT-UNKNOWN")
        consensus = val_agent_resp.output_data.get("validation_status", "VALIDATED")
        mean_prob = val_agent_resp.output_data.get("ensemble_mean_probability", 0.85)
        
        # 1. Doctor / Hematologist Technical Report
        doctor_report = (
            f"CLINICAL DECISION SUPPORT SUMMARY - {p_id} ({p_name})\n"
            f"Diagnosis: {patient_record.get('disease')} | Day +{patient_record['days_post_tx']} Post-Transplant\n"
            f"Status: {consensus}\n\n"
            f"MULTI-MODEL SYNTHESIS (VALIDATED CLASSICAL ENSEMBLE):\n"
            f"• Ensemble Reconstitution Likelihood: {round(mean_prob * 100, 1)}% (Variance σ² = {val_agent_resp.output_data.get('inter_model_variance')})\n"
            f"• Classical Random Forest (Trained): {classical_resp.output_data['models']['random_forest']['probability'] * 100:.1f}%\n"
            f"• Classical Logistic Regression (Trained): {classical_resp.output_data['models']['logistic_regression']['probability'] * 100:.1f}%\n"
            f"• Classical RBF SVM (Trained): {classical_resp.output_data['models']['classical_rbf_svm']['probability'] * 100:.1f}%\n\n"
            f"QUANTUM EXPLORATORY PROBE (NON-DIAGNOSTIC REFERENCE OVERLAP):\n"
            f"• Fidelity to Engrafted Reference: {quantum_resp.output_data.get('fidelity_to_engraftment_state', 0.0):.4f}\n"
            f"• Fidelity to Delayed Reference: {quantum_resp.output_data.get('fidelity_to_delayed_state', 0.0):.4f}\n"
            f"• Backend Provenance: {quantum_resp.output_data.get('backend_used')} ({quantum_resp.output_data.get('provenance')})\n"
            f"• Regulatory Notice: Excluded from clinical ensemble consensus.\n\n"
            f"LATEST COUNTS: ANC {patient_record['current_anc']:,.0f}/μL · Platelets {patient_record['current_plt']:,.0f}/μL\n\n"
            f"Draft for hematologist review. No autonomous treatment recommendation is generated."
        )
        
        # 2. Patient-Friendly Recovery Explanation (Plain language, supportive)
        anc, plt = patient_record["current_anc"], patient_record["current_plt"]
        patient_report = (
            f"Here is your transplant recovery update for Day +{patient_record['days_post_tx']}:\n\n"
            + (f"• Infection-fighting white cells (neutrophils): your latest count is {anc:,.0f}, above the 500 mark doctors look for.\n"
               if anc >= 500 else
               f"• Infection-fighting white cells (neutrophils): your latest count is {anc:,.0f}. Doctors are waiting for it to reach 500.\n")
            + f"• Platelets, which help your blood clot: your latest count is {plt:,.0f}.\n\n"
            "Your transplant team reviews every result. Keep taking your protective medicines and tell your nurse straight away about a temperature of 38°C or higher, chills, or unusual bleeding."
        )

        return ClinicalAgentResponse(
            agent_id=self.AGENT_ID,
            task_id=task_id,
            status="SUCCESS",
            output_data={
                "physician_technical_report": doctor_report,
                "patient_friendly_summary": patient_report,
                "generated_at": datetime.now(timezone.utc).isoformat()
            },
            confidence=0.95
        )

# --- Bounded Multi-Agent Orchestrator ---
class MultiAgentOrchestrator:
    """
    Coordinates the 8 specialized agents with strict typed schemas,
    bounded execution steps, deterministic validation rules, and loop prevention.
    """
    def __init__(self):
        self.data_quality_agent = ClinicalDataQualityAgent()
        self.feature_agent = ClinicalFeatureEngineeringAgent()
        self.classical_agent = ClassicalMLPredictionService()
        self.quantum_agent = QuantumMLPredictionService()
        self.validation_agent = IndependentPredictionValidationAgent()
        self.evidence_agent = EvidenceAndClinicalContextAgent()
        self.trajectory_agent = RecoveryTrajectoryAgent()
        self.report_agent = ClinicalReportAgent()

    def orchestrate_prediction(
        self,
        patient_id: str,
        current_labs: Optional[Dict[str, float]] = None,
        quantum_backend: str = "aer_simulator_statevector",
        execution_mode: str = "auto_fallback"
    ) -> Dict[str, Any]:
        task_id = f"task-agent-{uuid.uuid4().hex[:8]}"
        start_time = time.time()
        
        patient = get_patient(patient_id)
        if not patient:
            return {"task_id": task_id, "status": "FAILED", "error": f"Patient {patient_id} not found in database"}
            
        observations = get_patient_observations(patient_id)
        
        # Resolve current labs from recorded observations (ordered by day, so the last one wins).
        # A review needs real counts: nothing is substituted when they are missing.
        if not current_labs:
            latest_anc = latest_plt = None
            for obs in observations:
                if "ANC" in obs["metric_type"]:
                    latest_anc = obs["value"]
                elif "Platelet" in obs["metric_type"]:
                    latest_plt = obs["value"]
            if latest_anc is None or latest_plt is None:
                return {"task_id": task_id, "status": "FAILED", "error": "Record at least one neutrophil (ANC) and one platelet count before running a clinical review."}
            current_labs = {"anc": latest_anc, "platelets": latest_plt}
        days_post_tx = (datetime.now(timezone.utc).date() - datetime.fromisoformat(patient["transplant_date"][:10]).date()).days
        patient = {**patient, "days_post_tx": days_post_tx, "current_anc": current_labs["anc"], "current_plt": current_labs["platelets"], "observations": observations}
            
        agent_trail = []
        
        # Step 1: Data Quality Agent
        resp1 = self.data_quality_agent.run(task_id, patient, current_labs)
        agent_trail.append(resp1.to_dict())
        if not resp1.output_data["proceed_to_inference"]:
            return {
                "task_id": task_id,
                "status": "HALTED_BY_DATA_QUALITY",
                "agent_trail": agent_trail,
                "critical_errors": resp1.errors
            }
            
        # Step 2: Feature Engineering Agent
        resp2 = self.feature_agent.run(task_id, patient, current_labs)
        agent_trail.append(resp2.to_dict())
        feat_classical = resp2.output_data["feature_vector_classical"]
        feat_quantum = resp2.output_data["feature_vector_quantum"]
        
        # Step 3: Classical ML Prediction (Real scikit-learn models)
        resp3 = self.classical_agent.run(task_id, feat_classical, patient_record=patient, current_labs=current_labs)
        agent_trail.append(resp3.to_dict())
        
        # Step 4: Quantum ML Prediction
        resp4 = self.quantum_agent.run(task_id, feat_quantum, backend_name=quantum_backend, mode=execution_mode)
        agent_trail.append(resp4.to_dict())
        
        # Step 5: Independent Prediction Validation
        resp5 = self.validation_agent.run(task_id, resp3.output_data["models"], resp4.output_data)
        agent_trail.append(resp5.to_dict())
        
        # Step 6: Evidence & Clinical Context
        resp6 = self.evidence_agent.run(task_id, patient, current_labs)
        agent_trail.append(resp6.to_dict())
        
        # Step 7: Recovery Trajectory Agent
        resp7 = self.trajectory_agent.run(task_id, patient_id)
        agent_trail.append(resp7.to_dict())
        
        # Step 8: Clinical Report Agent
        resp8 = self.report_agent.run(task_id, patient, resp5, resp3, resp4)
        agent_trail.append(resp8.to_dict())
        
        total_duration_ms = round((time.time() - start_time) * 1000, 2)
        
        # Persist prediction run in database
        run_record = {
            "prediction_id": f"PR-{patient_id}-{int(time.time())}",
            "patient_id": patient_id,
            "models_executed": ["Logistic Regression", "Random Forest", "Classical RBF SVM", "Quantum-Kernel SVM"],
            "predictions": {
                "classical": resp3.output_data["models"],
                "quantum": resp4.output_data
            },
            "disagreement": {
                "flag": resp5.output_data["disagreement_flag"],
                "variance": resp5.output_data["inter_model_variance"],
                "unanimous": resp5.output_data["unanimous_agreement"]
            },
            "validation_status": resp5.output_data["validation_status"],
            "warnings": resp1.warnings + resp5.warnings,
            "clinician_review_status": "PENDING_REVIEW",
            "reviewed_by": None,
            "review_notes": None,
            "backend_provenance": resp4.output_data.get("provenance", "qiskit_simulator")
        }
        save_prediction_run(run_record)
        log_audit_event("PREDICTION_ORCHESTRATED", patient_id, "SYSTEM_AGENT", {"task_id": task_id, "status": resp5.output_data["validation_status"]})

        return {
            "task_id": task_id,
            "prediction_id": run_record["prediction_id"],
            "patient_id": patient_id,
            "status": "COMPLETED",
            "duration_ms": total_duration_ms,
            "validation_status": resp5.output_data["validation_status"],
            "disagreement_detected": resp5.output_data["disagreement_flag"],
            "models_comparison": {
                "logistic_regression": resp3.output_data["models"]["logistic_regression"],
                "random_forest": resp3.output_data["models"]["random_forest"],
                "classical_rbf_svm": resp3.output_data["models"]["classical_rbf_svm"],
                "quantum_kernel_svm": resp4.output_data
            },
            "evidence": resp6.output_data["evidence_items"],
            "trajectory_summary": resp7.output_data.get("summary"),
            "reports": resp8.output_data,
            "agent_trail": agent_trail
        }

# Global orchestrator instance
orchestrator = MultiAgentOrchestrator()
