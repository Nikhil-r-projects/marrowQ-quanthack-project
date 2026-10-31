# CURRENT STATE AUDIT: MARROWQ PLATFORM & QUANTUM ML ENGINE

**Audit Date:** 2026-10-31  
**Repository:** `marrowQ-quanthack-project`  
**Auditor:** Antigravity Advanced Agentic AI System

---

## 1. Executive Summary

This audit assesses the state of the MarrowQ precision medicine platform and quantum machine learning engine. It establishes an evidence-based gap analysis comparing current source code against the rigorous clinical and technical requirements of a production-grade multimodal clinical decision-support system (CDSS) and a scientifically defensible quantum computing research platform.

---

## 2. In-Depth Subsystem Inspection

### 2.1 Biological Data Ingestion & Storage
- **Current State:**
  - Files: `backend/app/core/biological_db.py`, `backend/app/core/biological_parsers.py`, `backend/app/api/biological_routes.py`.
  - Tables: `biological_specimens`, `blood_panels`, `bone_marrow_reports`, `genomic_variants`.
  - Parsers: Text/JSON parser for CBC and blood biochem; bone marrow report parser for cellularity and blast counts; simple VCF parser extracting CHROM, POS, REF, ALT, and INFO fields.
- **Audit Findings & Limitations:**
  - Ingestion lacks full binary FCS (Flow Cytometry Standard 3.0/3.1) parsing.
  - Image pathology files (DICOM, WSI TIFF, SVS) are not ingested or indexed in the biological database.
  - Observation provenance does not capture full LOINC code sets for all automated blood analyzers.
  - Missingness is handled by retaining nulls (good), but downstream feature imputation for machine learning lacks Bayesian or clinical domain-informed multiple imputation (e.g., MICE / missForest).

### 2.2 Bone Marrow Analysis & Pathology
- **Current State:**
  - Files: `backend/app/core/biological_parsers.py`, `frontend/src/views/DiagnosticIntelligenceView.tsx`.
  - Parses text fields for blasts, cellularity, dyserythropoiesis, dysgranulopoiesis, dysmegakaryopoiesis.
- **Audit Findings & Limitations:**
  - No active deep learning vision pipeline for bone marrow aspirate smear cell detection or segmentation (e.g., YOLOv8-Pathology / Cellpose / Hover-Net).
  - Bone marrow visual analysis displays an educational 3D organ view (`OrganViewer3D.tsx`) rather than an interactive whole-slide microscopy viewer with cell segmentation overlays.
  - Myeloid-to-erythroid (M:E) ratio and megakaryocyte density quantification are manual report values, not automated computer-vision extractions.

### 2.3 Genomic Intelligence & Variant Curation
- **Current State:**
  - Files: `backend/app/core/biological_parsers.py` (has precomputed hotspot dictionaries for *TP53*, *FLT3*, *NPM1*, *ASXL1*, *RUNX1*, *DNMT3A*).
- **Audit Findings & Limitations:**
  - Lacks dynamic ClinVar XML/VCF query engine and ClinGen expert panel evidence retrieval.
  - HGVS variant nomenclature normalization (e.g., via `mutalyzer` or `hgvs` Python libraries) is not implemented; variants are stored as raw REF/ALT strings.
  - Transcript version tracking (e.g., Ensembl Canonical / MANE Select) is not recorded in `genomic_variants`.
  - Somatic vs. germline distinction relies on presence in cancer hotspot lists rather than paired tumor-normal sequencing or VAF-frequency thresholds.

### 2.4 Flow Cytometry Standard (FCS) Intelligence
- **Current State:**
  - Flow cytometry findings are only captured as textual percentage summaries in `bone_marrow_reports`.
- **Audit Findings & Limitations:**
  - No `.fcs` binary parsing engine (FlowJo / FCS standard binary reader).
  - No automated or semi-automated hierarchical gating workflow (Forward Scatter vs. Side Scatter $\to$ CD45 vs. SSC $\to$ CD34/CD117 blast gate $\to$ lineage immunophenotyping for CD19, CD3, CD33, CD13, HLA-DR).
  - No validated calculation of minimal residual disease (MRD) sensitivity thresholds ($10^{-4}$ to $10^{-5}$).

### 2.5 Disease Intelligence & Clinical Scoring
- **Current State:**
  - Files: `backend/app/core/disease_modules.py`, `backend/app/api/disease_routes.py`.
  - Implemented: AML ELN 2022 risk stratification, MDS Molecular IPSS-M calculation, SAA Modified Camitta criteria, Renal (CKD-EPI 2021, KDIGO AKI), Hepatic (MELD-Na, FIB-4), Cardiac (ACC/AHA ASCVD).
- **Audit Findings & Limitations:**
  - Missing standalone hematology workflows for: ALL (Ph+ vs Ph-like, hyperdiploidy, MRD stratification), CML (Sokal, Hasford, ELTS scores, BCR-ABL1 transcript tracking), CLL (CLL-IPI, IGHV mutational status, TP53 disruption), MPN (IPSS/DIPSS for Myelofibrosis, JAK2/CALR/MPL driver mutations), Multiple Myeloma (R-ISS, FISH cytogenetics: t(4;14), del(17p), 1q21 gain), and Lymphoma (Ann Arbor, IPI, Hans algorithm for DLBCL).
  - Organ modules operate as isolated calculators rather than longitudinal multi-organ disease management workflows with clinical decision rules.

### 2.6 Treatment Intelligence & Clinical Decision Support
- **Current State:**
  - Disease modules list general therapy indications (e.g., 7+3 Induction, Venetoclax + Azacitidine, HSCT).
- **Audit Findings & Limitations:**
  - Lacks a patient-specific treatment comparison engine that evaluates eligibility criteria, Karnofsky/ECOG performance status, HCT-CI (Hematopoietic Cell Transplantation-Comorbidity Index), and organ contraindications.
  - Lacks explicit distinction between observational outcome predictions and causal treatment effect estimates.
  - Lacks drug-drug interaction screening for transplant conditioning and supportive care (e.g., azole antifungals + calcineurin inhibitors + busulfan/cyclophosphamide).

### 2.7 Pharmacogenomics (PGx)
- **Current State:**
  - Files: `backend/app/core/pgx.py`, `backend/app/api/pgx_routes.py`.
  - Implemented: CPIC guidelines for TPMT/NUDT15, CYP2C19, DPYD, UGT1A1, HLA-B*57:01.
- **Audit Findings & Limitations:**
  - Missing CYP2D6 (tamoxifen, ondansetron, codeine), CYP2C9/VKORC1 (warfarin dosing algorithm), and SLCO1B1 (statins).
  - Does not evaluate renal clearance (eGFR) and liver impairment (total bilirubin, ALT) interactively during dosage recommendation.
  - Lacks version tracking of CPIC guideline releases.

### 2.8 HLA & Transplant Compatibility
- **Current State:**
  - Files: `backend/app/core/hla.py`, `backend/app/api/hla_routes.py`.
  - Implemented: 12-allele locus comparison (HLA-A, B, C, DRB1, DQB1, DPB1), Fleischhauer DPB1 T-cell epitope (TCE) permissiveness (Group 1, 2, 3), and DSA MFI threshold grading.
- **Audit Findings & Limitations:**
  - Lacks donor non-HLA prognostic scoring: donor age (EBMT risk score), CMV serostatus mismatch (+/- recipient/donor risk), ABO major/minor incompatibility, and graft source (PBSC vs BM vs CB) impact.
  - Lacks solid-organ transplant crossmatching (e.g., Kidney KDPI / CPRA virtual crossmatching).

### 2.9 Longitudinal Recovery & Time-to-Event Models
- **Current State:**
  - Files: `backend/app/core/trajectory.py`, `backend/app/core/survival.py`.
  - Implemented: Biological sigmoid kinetics calibrated by graft source, CD34+ cell dose, and age; CIBMTR/EBMT engraftment definitions.
- **Audit Findings & Limitations:**
  - Sigmoid curve is parametric and deterministic; it is not a genuine survival model (e.g. Kaplan-Meier, Cox Proportional Hazards, or Random Survival Forest).
  - Lacks prediction vs. actual observation tracking with historical error metrics (MAE, RMSE, time-dependent Brier score).
  - Lacks longitudinal mixed-effects modeling of daily ANC and platelet reconstitution.

### 2.10 Patient Progress Workstation
- **Current State:**
  - Files: `frontend/src/views/PatientProgressView.tsx`.
  - Displays recovery milestone checklists, engraftment dates, and lab trajectory charts.
- **Audit Findings & Limitations:**
  - Does not connect all stages of the patient journey into a unified, chronological timeline (baseline $\to$ diagnosis $\to$ conditioning $\to$ infusion $\to$ engraftment $\to$ chimerism $\to$ complications $\to$ long-term survival).
  - Lacks role-tailored views with strict permission enforcement (e.g., Patient view hiding technical raw metrics and unverified experimental annotations).

### 2.11 Quantum Machine Learning Engine & Benchmark Protocol
- **Current State:**
  - Files: `backend/app/core/quantum/` (`kernel_engine.py`, `qsvm_cv.py`, `diagnostics.py`, `noisy_simulation.py`), `backend/app/core/ibm_quantum.py`.
  - Backend: `AerSimulator` (statevector GPU/CPU), `FakeFez` noise model, and IBM Quantum Runtime (`ibm_fez`, `ibm_kingston`, `ibm_marrakesh`).
- **Audit Findings & Critical Limitations:**
  - **Severe Performance Gap:** Reported test ROC-AUC is $0.52 - 0.55$, compared to Classical Logistic Regression ($0.81$) and Random Forest ($0.79$).
  - **Over-compression via Uninformed PCA:** Compressing 20 clinical variables down to 2 or 4 qubits via unsupervised PCA discards crucial non-linear clinical signals.
  - **Exponential Kernel Concentration:** The default $ZZ\text{FeatureMap}$ with full/linear entanglement causes statevector inner products $|\langle \psi(x_i)|\psi(x_j)\rangle|^2$ to concentrate around a constant value, flattening the Gram matrix.
  - **Single Architecture Reliance:** Currently tests only Fidelity Quantum Kernel with $ZZ$ feature map. Lacks Projected Quantum Kernels (PQK), Trainable Neural Quantum Kernels (NQK), Variational Quantum Classifiers (VQC), and Hybrid classical-quantum networks.
  - **Single Endpoint Limitation:** Benchmarks only early engraftment on the UCI BMT dataset ($n=187$). Lacks multi-endpoint evaluation (relapse, survival, AML risk).

### 2.12 Security, Authentication & Access Control
- **Current State:**
  - Files: `backend/app/core/auth.py`, `backend/app/api/auth_routes.py`.
  - Implemented: PBKDF2-HMAC-SHA256 password hashing, PyJWT bearer token issuance, role checks (`doctor`, `researcher`, `patient`, `admin`).
- **Audit Findings & Limitations:**
  - Route handlers in `routes.py`, `biological_routes.py`, `disease_routes.py` do not enforce `Depends(get_current_active_user)` uniformly across all endpoints.
  - Audit logging table for clinical data access and QPU circuit submissions is not persisted to SQLite.

---

## 3. Repository Verification Matrix

| Subsystem | Audit Status | Primary Code Files | Key Action Required |
|---|---|---|---|
| **Biological Ingestion** | Partial | `biological_db.py`, `biological_parsers.py` | Add FCS binary reader, whole-slide metadata, LOINC coding |
| **Bone Marrow Vision** | Partial / Simulated | `biological_parsers.py`, `OrganViewer3D.tsx` | Add real cell segmentation & morphological quantification pipeline |
| **Genomic Curation** | Partial | `biological_parsers.py` | Integrate ClinVar/ClinGen/COSMIC API annotations & HGVS parser |
| **Flow Cytometry** | Missing | None | Build FCS standard parser, gating hierarchy & MRD quantification |
| **Disease Intelligence** | Partial | `disease_modules.py`, `disease_routes.py` | Add ALL, CML, CLL, MPN, Myeloma, Lymphoma & organ workflows |
| **Treatment Intelligence** | Partial | `disease_modules.py` | Implement treatment comparison engine, HCT-CI, contraindication matrix |
| **Pharmacogenomics** | Partial | `pgx.py`, `pgx_routes.py` | Add CYP2D6, CYP2C9/VKORC1, renal/hepatic dosing adjustments |
| **HLA Matching** | Partial | `hla.py`, `hla_routes.py` | Add non-HLA donor score (age, CMV, ABO), solid-organ workflow |
| **Longitudinal Models** | Partial | `trajectory.py`, `survival.py` | Implement Kaplan-Meier, Cox Proportional Hazards, actual vs predicted error |
| **Patient Progress** | Partial | `PatientProgressView.tsx` | Build unified chronological timeline & role-tailored viewports |
| **Quantum ML Engine** | Needs Scientific Overhaul | `kernel_engine.py`, `qsvm_cv.py` | Implement PQK, NQK, VQC, Hybrid, kernel diagnostics & multi-endpoints |
| **Security & RBAC** | Partial | `auth.py`, `auth_routes.py` | Enforce route-level JWT auth & create clinical audit logging table |

