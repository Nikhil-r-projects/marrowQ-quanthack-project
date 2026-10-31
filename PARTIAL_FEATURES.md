# PARTIAL FEATURES & GAP AUDIT: MARROWQ PLATFORM

**Audit Date:** 2026-10-31  
**Repository:** `marrowQ-quanthack-project`  

---

## 1. Feature Status Breakdown

| Domain | Feature Area | Current Implementation Status | What is Reported / Implemented Now | What True Completion Requires |
|---|---|---|---|---|
| **Biological Data** | Ingestion & Harmonization | **PARTIAL** | Text/JSON parsing for CBC and blood biochem; bone marrow report parsing; simple VCF parser for selected mutations. | Binary FCS ingestion; WSI TIFF/DICOM pathology metadata; LOINC and SNOMED CT standardization; quality control flags; provenance tracking with SHA-256 hashes. |
| **Pathology** | Bone Marrow Microscopy | **PARTIAL / PLACEHOLDER** | Displays 3D anatomical model (`OrganViewer3D.tsx`) and manual report text. | Real image analysis pipeline: cell detection, nuclear-cytoplasmic ratio segmentation, M:E ratio calculation, blast percentage estimation with confidence intervals, and human-in-the-loop review overlays. |
| **Genomics** | Variant Curation | **PARTIAL** | Hardcoded hotspot dictionaries for 6 genes (*TP53*, *FLT3*, *NPM1*, *ASXL1*, *RUNX1*, *DNMT3A*). | Full HGVS normalization; Ensembl/RefSeq transcript version tracking; ClinVar, ClinGen, and COSMIC API integration; somatic vs. germline classification; co-occurrence analysis. |
| **Immunophenotyping** | Flow Cytometry | **MISSING** | No direct FCS processing; text summaries only. | FCS 3.0/3.1 binary reader; automated hierarchical gating (FSC/SSC $\to$ CD45/SSC $\to$ CD34+ blasts $\to$ Lineage markers); automated MRD sensitivity calculation ($10^{-4}$). |
| **Hematology** | Disease Workflows | **PARTIAL** | AML (ELN 2022), MDS (IPSS-M), SAA (Camitta criteria). | Complete disease modules for ALL, CML, CLL, MPN (Myelofibrosis, PV, ET), Multiple Myeloma, Hodgkin and Non-Hodgkin Lymphoma with differential diagnoses, required investigations, and staging. |
| **Specialty Medicine** | Non-Hematology Modules | **PARTIAL / CALCULATOR** | Single-point risk formulas: CKD-EPI 2021, KDIGO AKI, MELD-Na, FIB-4, ASCVD 10-yr. | Comprehensive disease management workflows for Nephrology, Hepatology, Cardiology, Neurology, Endocrinology, and Solid Oncology with diagnostic criteria, contraindications, and longitudinal monitoring. |
| **Therapeutics** | Treatment Intelligence | **PARTIAL** | Static regimen listings per disease module. | Patient-specific treatment comparison engine; HCT-CI comorbidity evaluation; ECOG/Karnofsky scoring; contraindication matrix; causal treatment effect vs. observational risk distinction. |
| **Pharmacogenomics** | Precision Medication | **PARTIAL** | CPIC Level A/B rules for 5 genes (TPMT, NUDT15, CYP2C19, DPYD, UGT1A1). | Expansion to CYP2D6, CYP2C9, VKORC1, SLCO1B1; dynamic renal/hepatic dosage adjustment algorithms; drug-drug interaction screening; CPIC guideline version tracking. |
| **Transplantation** | HLA & Compatibility | **PARTIAL** | 12-allele matching (HLA-A, B, C, DRB1, DQB1, DPB1); Fleischhauer DPB1 TCE permissiveness; DSA MFI risk grading. | Non-HLA donor factors (donor age, CMV serostatus mismatch, ABO incompatibility, graft source, CD34+ dose); solid-organ vs. HSCT workflow separation; virtual crossmatch simulation. |
| **Prognosis** | Longitudinal Recovery | **PARTIAL** | Deterministic sigmoid trajectory calibrated by graft source and CD34+ dose. | Trained and validated survival models (Kaplan-Meier, Cox Proportional Hazards, Random Survival Forest); actual vs. predicted milestone tracking; time-dependent error metrics (Brier score, MAE). |
| **Patient Journey** | Clinical Timeline | **PARTIAL** | Isolated patient progress dashboard with milestones. | Single unified longitudinal timeline connecting baseline $\to$ diagnosis $\to$ conditioning $\to$ engraftment $\to$ complications $\to$ survival; role-tailored views (Doctor, Patient, Researcher). |
| **Quantum ML** | Model Suite & Benchmarking | **PARTIAL / UNDERPERFORMING** | 2-qubit Fidelity Kernel with $ZZ\text{FeatureMap}$ and unsupervised PCA; ROC-AUC $\approx 0.52 - 0.55$. | Multi-architecture suite: Projected Quantum Kernels (PQK), Trainable Neural Quantum Kernels (NQK), Variational Quantum Classifiers (VQC), Hybrid Classical-Quantum networks; biologically informed feature mapping; full kernel diagnostics; multi-endpoint evaluation. |
| **Governance** | Security, RBAC & Audit | **PARTIAL** | PBKDF2 hashing and JWT token issuance; role claims in token. | Enforced route-level dependency injection across all endpoints; database-persisted clinical audit logging; automated security and role-access test suite. |

---

## 2. Action Plan to Transition Features from Partial to Complete

1. **Biological Layer:** Implement binary FCS parser and lightweight synthetic whole-slide cell segmentation pipeline.
2. **Genomics Layer:** Create comprehensive variant annotation engine linking HGVS coordinates to ClinVar, ClinGen, and COSMIC knowledge bases.
3. **Disease & Treatment Layer:** Implement full clinical modules for ALL, CML, CLL, MPN, Myeloma, and Lymphoma; build the HCT-CI treatment comparison engine.
4. **Precision Medicine Layer:** Integrate CYP2D6, CYP2C9, VKORC1 into PGx and connect with renal/hepatic clearance calculators; enrich HLA with donor age, CMV, and ABO scoring.
5. **Survival & Progress Layer:** Implement genuine Cox Proportional Hazards and Kaplan-Meier estimators for time-to-engraftment, relapse, and survival; build unified patient timeline.
6. **Quantum Research Engine:** Overhaul quantum pipeline with Projected Quantum Kernels, Trainable Neural Quantum Kernels, and Biologically Informed Encodings.
7. **Security Layer:** Enforce JWT authentication on all endpoints and log clinical data access events to SQLite.
