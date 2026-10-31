# DATASET AND CLINICAL EVIDENCE AUDIT

**Document ID:** MARROWQ-DATA-AUDIT-01  
**Date:** 2026-10-31  
**Auditor:** Antigravity Advanced Agentic AI System  
**Scope:** Dataset Provenance, Clinical Evidence Registries, Target Leakage Auditing, and Validation Protocols.

---

## 1. Primary Benchmark Cohort: UCI Paediatric Bone Marrow Transplantation

### 1.1 Dataset Specifications
- **Origin:** UCI Machine Learning Repository / University Children's Hospital, Wroclaw, Poland.
- **Source Citation:** Sikora, M. et al. (2019). "Bone Marrow Transplant: Children." UCI Machine Learning Repository. DOI: `10.24432/C5K88W`.
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0).
- **Cohort Size:** $n = 187$ paediatric patients undergoing allogeneic hematopoietic stem cell transplantation (HSCT).
- **Target Endpoints:**
  1. `early_engraftment`: Binary indicator (1 if neutrophil engraftment occurred $\le 21$ days post-transplant, 0 otherwise). Class balance: $74.3\%$ positive ($n=139$), $25.7\%$ negative ($n=48$).
  2. `relapse`: Binary indicator (1 if disease relapse occurred, 0 if in remission). Class balance: $18.2\%$ relapse ($n=34$), $81.8\%$ relapse-free ($n=153$).
  3. `survival_status` & `survival_time`: Time-to-death or censoring in days. Overall mortality rate: $34.2\%$ ($n=64$ events, $n=123$ censored).

### 1.2 Core Predictor Features (20 Dimensions)
- **Donor Characteristics:** `donor_age`, `donor_age_below_35`, `donor_ABO`, `donor_CMV`.
- **Recipient Characteristics:** `recipient_age`, `recipient_age_below_10`, `recipient_age_int`, `recipient_gender`, `recipient_ABO`, `recipient_rh`, `recipient_CMV`.
- **Disease & Risk:** `disease` (ALL, AML, CML, Non-malignant), `risk_group` (Low vs. High risk), `disease_group` (Malignant vs. Non-malignant).
- **Transplant Compatibility & Regimen:** `HLA_match` (10/10 vs. 9/10 vs. 8/10), `HLA_mismatch`, `antigen`, `allel`, `HLA_group_1`, `conditioning` (Myeloablative vs. Reduced-intensity).
- **Cell Doses:** `CD34_kgx10d6` (infused CD34+ cell dose per kg), `CD3_d_kgx10d8` (infused CD3+ T-cell dose per kg).

### 1.3 Data Leakage Audit
- **Strict Exclusion:** Features measured *after* transplant infusion or engraftment (e.g., `platelet_recovery_day`, `aGvHD_III_IV`, `extensive_cGvHD`) are strictly excluded from baseline prediction matrices to prevent target leakage.
- **Partitioning Protocol:** 80/20 stratified split with fixed seed ($42$). All scalers, imputers, and dimensionality reduction models are fit **strictly on training folds** and applied downstream to test folds.

---

## 2. Clinical Evidence Registries & Guideline Standards

| Registry / Guideline | Version / Authority | Clinical Purpose in MarrowQ | Algorithmic Implementation |
|---|---|---|---|
| **ELN 2022 AML Recommendations** | European LeukemiaNet 2022 | Genetic risk stratification for Acute Myeloid Leukemia (*Favorable, Intermediate, Adverse*) | Evaluates co-mutational status of *NPM1*, *FLT3-ITD* (allelic ratio), *bZIP CEBPA*, *TP53*, *ASXL1*, *RUNX1*, *SRSF2*, *STAG2*, *U2AF1*, *ZRSR2*, and cytogenetics. |
| **Molecular IPSS-M** | Bernard et al., *NEJM Evid* 2022 | Prognostic risk scoring for Myelodysplastic Syndromes (MDS) | Calculates multi-variable risk score incorporating cytogenetic risk category, bone marrow blasts, hemoglobin, platelets, and mutations in 31 genes. |
| **Modified Camitta Criteria** | NIH / EBMT Consensus | Severity classification for Severe Aplastic Anemia (SAA) | Evaluates marrow cellularity ($< 25\%$) and peripheral blood criteria: ANC $< 0.5 \times 10^9/\text{L}$, Platelets $< 20 \times 10^9/\text{L}$, Reticulocytes $< 20 \times 10^9/\text{L}$. |
| **CPIC Pharmacogenomics** | Clinical Pharmacogenetics Implementation Consortium | Gene-drug prescribing guidance | Level A/B recommendations for TPMT/NUDT15 (thiopurines), CYP2C19 (voriconazole), DPYD (fluoropyrimidines), UGT1A1 (irinotecan), CYP2D6, CYP2C9/VKORC1 (warfarin). |
| **Fleischhauer DPB1 TCE** | Fleischhauer et al., *Blood* 2012 | High-resolution HLA-DPB1 T-cell epitope matching in allogeneic HSCT | Classifies DPB1 mismatches into Permissive (TCE Group 1/2/3 compatible) vs. Non-permissive (GvHD vs. GvL risk). |
| **KDIGO & CKD-EPI 2021** | KDIGO / Inker et al., *NEJM* 2021 | Non-invasive renal function and acute kidney injury staging | eGFR calculation without race coefficient; KDIGO Stage 1, 2, 3 AKI staging based on serum creatinine trajectory. |
| **MELD-Na & FIB-4** | UNOS / Kim et al., *Hepatology* 2008 | Hepatic impairment and fibrosis scoring in transplant candidates | MELD-Na 90-day pre-transplant mortality risk and FIB-4 non-invasive fibrosis index. |

---

## 3. Genomic Evidence Standards

- **ClinVar:** Variants are annotated against NCBI ClinVar release definitions (`Pathogenic`, `Likely Pathogenic`, `VUS`, `Likely Benign`, `Benign`).
- **ClinGen:** Gene-disease validity framework distinguishes definitive vs. moderate evidence associations.
- **COSMIC:** Cancer mutation database cross-referenced for somatic hotspot confirmations.
- **HGVS Nomenclature:** Coordinate-level descriptions adhere to HGVS standards on the GRCh38 / hg38 human reference genome build.

---

## 4. Leakage-Free Validation Discipline

1. **Repeated Stratified K-Fold Cross-Validation:** 5 repeats $\times$ 5 folds ($25$ splits total) with stratified target distribution.
2. **Inner Fold Tuning:** All hyperparameters (bandwidth $c$, SVM regularizer $C$, outer kernel $\gamma$, learning rates) are tuned strictly within inner cross-validation folds.
3. **Out-of-Fold Metrics:** ROC-AUC, Balanced Accuracy, Precision, Recall, F1, Brier Score, and Concordance Index are computed on held-out validation folds with $95\%$ bootstrap confidence intervals ($B = 1000$).
4. **Label Permutation Testing:** Permutation tests ($n_{\text{perm}} = 100$) ensure that reported AUC values collapse to $0.50$ under randomized labels, confirming absence of data leakage.
