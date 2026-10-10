# MarrowQ — Clinical Dataset Research & Target Specification

**Project:** MarrowQ — Quantum-Assisted Prediction of Hematopoietic Stem Cell Transplant (HSCT) Recovery  
**Document Version:** 1.0.0  
**Status:** Completed Workspace Audit & Research Phase

---

## 1. Executive Summary & Research Context

Predicting recovery following Hematopoietic Stem Cell Transplantation (HSCT) is a critical clinical decision-support problem. Delayed hematologic recovery—specifically delayed neutrophil engraftment—leaves patients severely immunocompromised, significantly elevating risks of invasive fungal/bacterial infections, graft failure, and 100-day transplant-related mortality.

This document synthesizes clinical literature, public research repository access requirements (Center for International Blood and Marrow Transplantation Research - CIBMTR), machine learning target definitions, and quantum computing feasibility.

---

## 2. Research Sources & Literature Review

### 2.1 CIBMTR Public Research Datasets & Data Collection
- **Sources:**
  - [CIBMTR Publicly Available Datasets](https://cibmtr.org/CIBMTR/Resources/Publicly-Available-Datasets)
  - [CIBMTR Research Data Collection](https://cibmtr.org/CIBMTR/Research/Data-Collection)
- **Governance & Terms of Use:**
  - CIBMTR publishes final analysis datasets linked to peer-reviewed secondary-analysis research papers in accordance with NIH and NCI Cancer Moonshot Public Access and Data Sharing Policies.
  - Access conditions require agreeing to CIBMTR terms and conditions, protecting participant confidentiality (HIPAA de-identification), prohibiting patient re-identification attempts, and limiting use strictly to bona fide research purposes.
  - Because public download requires user-level acceptance of data usage agreements (DUA), bundling third-party patient-level records without permission directly into a public code repository is ethically and legally restricted.
- **Data Dictionary Findings:**
  - Commonly collected variables include: recipient demographics (age, sex, Karnofsky performance status), disease characteristics (primary malignancy, stage/remission status, cytogenetic risk), donor demographics (age, sex, relation, HLA match level 8/8 vs 7/8), graft characteristics (graft source: bone marrow, peripheral blood stem cells, cord blood; CD34+ cell dose, TNC count), conditioning regimens (myeloablative conditioning [MAC] vs reduced-intensity conditioning [RIC]), and outcomes (time to neutrophil engraftment, time to platelet engraftment, acute/chronic GVHD, overall survival, relapse).

### 2.2 Published Neutrophil Recovery Prediction Research
- **Source:** *Machine Learning Prediction Model for Neutrophil Recovery after Unrelated Cord Blood Transplantation* (PMID: 38336299, DOI: [10.1016/j.jtct.2024.01.066](https://pubmed.ncbi.nlm.nih.gov/38336299/)).
- **Cohort & Target:** Evaluated 2,991 single-unit cord blood transplant recipients. Evaluated neutrophil recovery at Days 14, 28, and 42 post-transplantation.
- **Reported Benchmark:** Day 28 neutrophil recovery model achieved a median AUC of 0.74 (across 100 repeated runs), Day 14 AUC was 0.88, and Day 42 AUC was 0.68.
- **Clinical Insight:** Day 28 serves as the standard clinical benchmark for timely engraftment in registry studies. Prediction accuracy is highest when using verified pre-transplant recipient, donor, and graft features.

### 2.3 Survival & Outcomes Modeling Research
- **Source:** *Survival Prediction in Allogeneic Haematopoietic Stem Cell Transplant Recipients Using Pre- and Post-Transplant Factors and Computational Intelligence* (PMCID: PMC12381535, PMID: 40859746).
- **Cohort & Caution:** 564 consecutive adult allo-HSCT patients. Explored soft computing and feature importance.
- **Data Leakage Risk Identified:** PMC12381535 utilized post-transplant events (e.g., acute GVHD onset, early infectious complications) to refine survival estimates. For pre-transplant clinical decision support (e.g. donor selection or conditioning optimization), **post-transplant variables constitute severe target leakage**. MarrowQ strictly enforces pre-transplant feature boundaries.

---

## 3. Prediction Target Formulation

### Primary ML Target: Neutrophil Recovery by Day 28 (Binary Classification)

| Element | Specification |
|---|---|
| **Target Name** | `neutrophil_recovery_day28` |
| **Clinical Definition** | Achievement of Absolute Neutrophil Count (ANC) $\ge 500/\mu\text{L}$ ($\ge 0.5 \times 10^9/\text{L}$) for 3 consecutive days on or before post-transplant Day +28 |
| **Positive Class (1)** | Successful timely neutrophil recovery by Day 28 |
| **Negative Class (0)** | Delayed neutrophil recovery (> 28 days) or primary graft failure |
| **Prediction Timestamp** | Pre-transplant baseline (Day 0 or prior, e.g., at donor selection / conditioning planning) |
| **Inclusion Criteria** | Allogeneic HSCT recipients (adult or pediatric) undergoing initial transplantation for hematologic malignancies or marrow disorders |
| **Exclusion Criteria** | Early death prior to Day 14 due to non-engraftment causes (documented as competing risk), missing engraftment confirmation, autologous rescue |
| **Handling Missing Labels** | Records with missing outcome documentation must be excluded from training/evaluation and flagged in data profiling; never imputed |

### Target Feasibility & Competing Risks
- In prospective clinical practice, time-to-event survival analysis (e.g., Fine-Gray subdistribution hazards for competing risks of early death) is the ultimate epidemiological tool.
- However, for the quantum-versus-classical MVP comparison, reducing to a rigorously defined binary horizon (Day 28 neutrophil engraftment) provides a mathematically well-defined supervised classification task with balanced accuracy, precision, recall, and ROC-AUC.

---

## 4. Permitted Feature Space vs. Target Leakage Exclusions

### Permitted Features (Available at Pre-Transplant Prediction Time)
1. **Recipient Characteristics:**
   - `recipient_age` (numeric, years)
   - `recipient_gender` (categorical: M, F)
   - `recipient_kps` (numeric: Karnofsky Performance Score 0-100)
   - `recipient_cmv` (categorical: Positive, Negative)
   - `comorbidity_index` (numeric: HCT-CI score 0-5+)
2. **Disease & Treatment Strategy:**
   - `primary_disease` (categorical: AML, ALL, MDS, MPN, Lymphoma)
   - `disease_status` (categorical: CR1, CR2+, Relapse/Refractory, Active)
   - `conditioning_intensity` (categorical: MAC [Myeloablative], RIC [Reduced Intensity], NMA [Non-myeloablative])
3. **Donor & Graft Compatibility:**
   - `donor_age` (numeric, years)
   - `donor_gender` (categorical: M, F)
   - `donor_cmv` (categorical: Positive, Negative)
   - `donor_recipient_sex_match` (categorical: M-M, F-F, M-F, F-M [higher GVHD/rejection risk])
   - `donor_type` (categorical: Matched Sibling, Matched Unrelated [MUD], Mismatched Unrelated [MMUD], Haploidentical, Cord)
   - `hla_match_score` (numeric: e.g. 8/8, 7/8, 6/8, or 10/10)
   - `graft_source` (categorical: PBSC, BM, Cord Blood)
   - `cd34_dose` (numeric: $\times 10^6$ CD34+ cells/kg recipient weight)
   - `total_nucleated_cells` (numeric: $\times 10^7$ TNC/kg)

### Explicitly Excluded Features (Target Leakage)
- Day of actual neutrophil recovery (`anc_500_day`)
- Post-transplant platelet recovery dates (`plt_20k_day`, `plt_50k_day`)
- Chimerism assay results at Day 30/100
- Acute Graft-versus-Host Disease (aGVHD) grade or onset date
- Day 30 CMV reactivation or post-transplant bloodstream infections
- Cause of post-transplant death or hospital discharge date

---

## 5. Dual Data Operational Modes

### Mode 1: Research Dataset Upload & Validation Mode
- Supports user-uploaded CSV files (e.g. approved CIBMTR secondary analysis extract or institutional registry export).
- Ingests raw data immutably, performs automated schema type inference, detects missingness and class balance, issues data leakage warnings if known post-transplant keywords appear in columns, and enforces leak-free train/test splitting.

### Mode 2: Synthetic Demonstration Mode
- A fully reproducible generator based on published clinical distributions from the CIBMTR and Japanese Cord Blood Registry literature.
- Configurable sample size (default $N=500$, stratified).
- Realistically encodes known clinical correlations:
  - Higher CD34+ cell dose and PBSC graft source positively correlate with earlier engraftment.
  - Cord blood graft, low cell dose, severe HLA mismatch, and high HCT-CI comorbidity correlate with delayed engraftment.
- **Mandatory Disclaimers:** Every UI view, API response, plot, and generated research report clearly displays:
  > **"SYNTHETIC DEMONSTRATION DATA — NOT CLINICAL EVIDENCE. STRICTLY FOR PIPELINE VALIDATION AND RESEARCH FEASIBILITY TESTING."**

---

## 6. Quantum Machine Learning Grounding & Architecture

### 6.1 Quantum Methodology
- **Qiskit ML Pipeline:** Uses `qiskit` 2.5.2 and `qiskit_machine_learning` 0.9.1.
- **Encoding:** A quantum feature map (e.g. 2 to 4 qubits) maps classically preprocessed and dimensionally reduced clinical features (via PCA or SelectKBest) into Hilbert space quantum statevectors:
  $$|\Phi(x)\rangle = U_{\Phi}(x)|0\rangle^{\otimes n}$$
- **Kernel Evaluation:** A `FidelityQuantumKernel` computes the transition amplitude inner products between patient statevectors:
  $$K_{ij} = |\langle\Phi(x_i)|\Phi(x_j)\rangle|^2$$
- **Classification:** A classical Support Vector Classifier (`sklearn.svm.SVC(kernel='precomputed')`) is trained on the training Gram matrix $K_{\text{train}}$ and evaluated on the test-vs-train Gram matrix $K_{\text{test, train}}$.

### 6.2 Scientific Baselines & Controlled Comparisons
To evaluate whether the quantum kernel provides genuine representation utility, MarrowQ executes a rigorous 5-model comparator suite:
1. **DummyClassifier:** Most-frequent and stratified baseline.
2. **Logistic Regression:** Linear, interpretable clinical reference standard with $L_2$ regularization.
3. **Random Forest Classifier:** Nonlinear ensemble handling interactions and categorical structures.
4. **Classical RBF SVM:** **Critical comparator** using classical radial basis function kernel on the exact same feature subset and scaled representations as the quantum kernel.
5. **Quantum Kernel SVM:** Fidelity-based quantum statevector kernel SVM.

### 6.3 Scientific Safeguards
- Preprocessing (StandardScaler, OneHotEncoder, SimpleImputer) is fit **strictly on training partitions**.
- Zero data leakage between train and test splits.
- Honest reporting: Class counts, ROC-AUC, precision, recall, F1, balanced accuracy, confusion matrices, and computation runtimes are tracked. Quantum advantage is treated as an empirical hypothesis, not an assumed outcome.
