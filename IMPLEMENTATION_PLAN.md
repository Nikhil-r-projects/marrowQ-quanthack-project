# MARROWQ PLATFORM & QUANTUM ENGINE: IMPLEMENTATION PLAN

**Document ID:** MARROWQ-PLAN-V2  
**Date:** 2026-10-31  
**Execution Strategy:** Phased Implementation, Strict Leakage-Free Validation, Full-Stack Integration.

---

## 1. Roadmap Overview

```mermaid
flowchart LR
    P0["Phase 0: Audit & Diagnostics"] --> P1["Phase 1: Quantum Research Suite"]
    P1 --> P2["Phase 2: Biological & Vision Ingestion"]
    P2 --> P3["Phase 3: Disease & Treatment Workflows"]
    P3 --> P4["Phase 4: Longitudinal Survival Models"]
    P4 --> P5["Phase 5: Hardware Staged Execution"]
    P5 --> P6["Phase 6: Full-Stack UI Integration"]
    P6 --> P7["Phase 7: Security & Automated Tests"]
    P7 --> P8["Phase 8: Final Audit Reports"]
```

---

## 2. Phase Breakdown and Deliverables

### Phase 0: Repository Audit & Problem Formulation [COMPLETED]
- [x] Complete code inspection across backend, frontend, models, and databases.
- [x] Produce `CURRENT_STATE_AUDIT.md`.
- [x] Produce `PARTIAL_FEATURES.md`.
- [x] Produce `QUANTUM_FAILURE_ANALYSIS.md`.
- [x] Produce `DATASET_AND_EVIDENCE_AUDIT.md`.
- [x] Produce `TARGET_ARCHITECTURE.md`.
- [x] Produce `IMPLEMENTATION_PLAN.md`.

---

### Phase 1: Quantum ML Research Engine & Multi-Architecture Suite
- **Files to Create / Update:**
  - `backend/app/core/quantum/pqk.py`: Projected Quantum Kernel engine (Huang et al. 2021) with Pauli-Z and Pauli-XX observables and classical outer RBF kernel.
  - `backend/app/core/quantum/neural_kernel.py`: Trainable Neural Quantum Kernel (Phys. Rev. Research 2025) with parameterized data re-uploading and gradient-based kernel alignment optimization.
  - `backend/app/core/quantum/vqc.py`: Variational Quantum Classifier with parameter-shift gradients and classical head.
  - `backend/app/core/quantum/hybrid.py`: Hybrid classical-quantum model & stacking ensemble combining classical probabilities with quantum kernel features.
  - `backend/app/core/quantum/diagnostics.py`: Extended diagnostics (Gram heatmap, full eigenvalue spectrum, condition number, off-diagonal variance, kernel-target alignment, class separation).
  - `backend/app/core/quantum/biological_feature_map.py`: Biologically informed domain encodings (Graft, Cytopenia, Immunogenetics, Vulnerability) replacing blind PCA.
  - `backend/app/core/quantum/multi_benchmark.py`: Multi-endpoint benchmark runner (Engraftment, Relapse, Survival C-Index, AML Genetic Risk).

---

### Phase 2: Biological Data Layer & Pathology Vision Pipeline
- **Files to Create / Update:**
  - `backend/app/core/flow_cytometry.py`: Binary FCS 3.0/3.1 parser, hierarchical gating pipeline ($FSC/SSC \to CD45/SSC \to CD34+ \to \text{lineage}$), and automated MRD calculation.
  - `backend/app/core/pathology_vision.py`: Bone marrow smear image processing pipeline: cell detection, nuclear-to-cytoplasmic ratio segmentation, M:E ratio estimation, blast fraction quantification, and visual bounding boxes.
  - `backend/app/core/genomic_curation.py`: HGVS variant normalization, transcript version tracking, and ClinVar/ClinGen/COSMIC annotation engine.
  - `backend/app/api/biological_routes.py`: Endpoints for FCS ingestion, gating plots, pathology smear analysis, and genomic evidence retrieval.

---

### Phase 3: Comprehensive Disease & Treatment Intelligence
- **Files to Create / Update:**
  - `backend/app/core/disease_modules.py`: Complete hematology modules (ALL, CML, CLL, MPN, Multiple Myeloma, Lymphoma) + deep organ specialty workflows (Nephrology, Hepatology, Cardiology, Neurology, Endocrinology, Oncology).
  - `backend/app/core/treatment_intelligence.py`: Treatment comparison engine evaluating regimens against patient age, ECOG score, HCT-CI comorbidity index, and organ contraindications.
  - `backend/app/core/pgx.py`: Expanded CPIC engine covering CYP2D6, CYP2C9, VKORC1, SLCO1B1, and interactive eGFR/bilirubin dosage adjustments.
  - `backend/app/core/hla.py`: Comprehensive transplant compatibility incorporating non-HLA donor factors (donor age, CMV mismatch, ABO incompatibility) and solid-organ crossmatching.
  - `backend/app/api/disease_routes.py`, `treatment_routes.py`: Corresponding API endpoints.

---

### Phase 4: Longitudinal Recovery & Survival Engine
- **Files to Create / Update:**
  - `backend/app/core/survival_models.py`: Kaplan-Meier survival curves, Cox Proportional Hazards models with hazard ratios and confidence intervals for OS, EFS, and relapse.
  - `backend/app/core/longitudinal_tracker.py`: Actual vs. predicted milestone tracker computing real-time MAE, RMSE, and time-dependent Brier scores across daily lab observations.
  - `backend/app/core/patient_timeline.py`: Unified chronological clinical timeline builder.

---

### Phase 5: IBM Hardware Execution & Error Mitigation
- **Files to Create / Update:**
  - `backend/app/core/ibm_quantum.py`: Implement staged execution pipeline (Statevector $\to$ FakeFez Noisy Sim $\to$ Hardware Submission) with job deduplication, shot budgets, execution time tracking, and Twirled Readout Error Extrapolation (TREX) logging.
  - Real job ID persistence and telemetry verification against `ibm_fez` (156-qubit Heron QPU).

---

### Phase 6: Full-Stack UI Integration
- **Files to Create / Update:**
  - `frontend/src/views/QuantumLabView.tsx`: Research-grade interface featuring Multi-Model Arena (Fidelity, PQK, NQK, VQC, Hybrid), Kernel Diagnostics heatmap and eigenvalue chart, and IBM Hardware Console.
  - `frontend/src/views/DiagnosticIntelligenceView.tsx`: Integrated multi-tab clinical workstation with Flow Cytometry gating viewer, Bone Marrow Vision analysis, Treatment Comparison engine, and Expanded Disease Registry.
  - `frontend/src/views/PatientProgressView.tsx`: Unified chronological patient timeline with predicted vs. actual bands and role-based viewports.

---

### Phase 7: Security, RBAC & Automated Test Suite
- **Files to Create / Update:**
  - Route-level JWT authorization enforcement across all API endpoints.
  - SQLite clinical audit logging (`clinical_audit_logs`).
  - Automated pytest test suites: `test_quantum_suite.py`, `test_biological_flow.py`, `test_disease_expanded.py`, `test_survival.py`, `test_auth_rbac.py`.

---

### Phase 8: Final Acceptance Reports & Evidence
- **Deliverables:**
  - `FINAL_IMPLEMENTATION_REPORT.md`
  - `FINAL_QUANTUM_BENCHMARK.md`
  - `FINAL_CLINICAL_MODULE_STATUS.md`
  - `MODEL_VALIDATION_REPORT.md`
  - `QPU_EXECUTION_EVIDENCE.md`
  - `SECURITY_AUDIT.md`
  - `KNOWN_LIMITATIONS.md`
  - `RUN_AND_DEPLOY_GUIDE.md`
