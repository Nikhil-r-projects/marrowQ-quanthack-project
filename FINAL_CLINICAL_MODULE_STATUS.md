# MarrowQ — Final Clinical Module Status & Capabilities Matrix

**System:** MarrowQ Multimodal Precision Medicine Platform  
**Scope:** Biological Ingestion, Hematologic & Non-Hematologic Intelligence, Treatment Decision Support, Pharmacogenomics, Donor Matching, Longitudinal Care  
**Clinical Standards:** WHO 2022 / ICC 2022, ELN 2022, IPSS-M, Camitta/NIH SAA, CPIC Level A/B, EBMT/CIBMTR, KDIGO, MELD-Na, ACC/AHA  
**Status Date:** October 31, 2026  

---

## 1. Multimodal Biological Ingestion & Laboratory Layer

| Biological Modality | Standard / Format | Implementation Details | Provenance & Validation | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Complete Blood Count (CBC)** | LOINC standard units | Automated reference range checks, absolute count derivations, velocity computation (ANC, Platelets, Hb, WBC). | Rigorous validation against physiological bounds | **COMPLETE** |
| **Bone Marrow Smear Vision** | Digital cytology images / microscopic fields | Microscopic blur detection (Laplacian variance focus score $\ge 100$), cell segmentation, nuclear-to-cytoplasmic (N:C) ratio, myeloid-to-erythroid (M:E) ratio, blast count with Wilson 95% score confidence intervals. | Grounded in automated morphological pathology pipelines | **COMPLETE** |
| **Genomic Curation (NGS)** | HGVS nomenclature, MANE Select | Transcript tracking, ClinVar/ClinGen/COSMIC pathogenicity evidence grading, somatic vs germline VAF classification, mutational co-occurrence analysis (e.g., NPM1 + FLT3-ITD co-mutations). | Human genome builds GRCh37/GRCh38 harmonized | **COMPLETE** |
| **Flow Cytometry** | Binary FCS 3.0 / FCS 3.1 | Binary text/data segment parsing, logicle/hyperlog transformations, hierarchical gating ($FSC/SSC \to CD45/SSC \to CD34/CD117$ blast gate), Measurable Residual Disease (MRD) sensitivity down to $10^{-4}$ ($0.01\%$). | Automated event cluster gating | **COMPLETE** |

---

## 2. Hematologic Malignancy & Bone Marrow Failure Intelligence

| Disease / Syndrome | Clinical Guideline | Diagnostic & Prognostic Features | Risk Stratification Model | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Acute Myeloid Leukemia (AML)** | ELN 2022 / WHO 2022 | Cytogenetic abnormalities ($t(8;21), inv(16), t(6;9)$, complex karyotype) + NGS (NPM1, FLT3-ITD, TP53, ASXL1, RUNX1). | Favorable vs Intermediate vs Adverse risk categories. | **COMPLETE** |
| **Myelodysplastic Syndromes (MDS)** | IPSS-M / IPSS-R | Bone marrow blast %, multilineage cytopenias, IPSS-M multi-gene mutation score. | Very Low to Very High risk categories. | **COMPLETE** |
| **Severe Aplastic Anemia (SAA)** | Modified Camitta Criteria / NIH | Marrow cellularity $< 25\%$ or $25-50\%$ with $< 30\%$ residual hematopoietic cells + 2 of: ANC $< 500/\mu\text{L}$, Platelets $< 20{,}000/\mu\text{L}$, Reticulocytes $< 20 \times 10^9/\text{L}$. | Non-Severe vs Severe vs Very Severe Aplastic Anemia. | **COMPLETE** |
| **Acute Lymphoblastic Leukemia (ALL)** | NCCN / WHO 2022 | B-cell vs T-cell lineage, Philadelphia chromosome ($BCR-ABL1$) vs Ph-like, hyperdiploidy vs hypodiploidy, MRD response. | Risk-directed therapy & targeted TKI recommendation. | **COMPLETE** |
| **Chronic Myeloid Leukemia (CML)** | ELN / NCCN | Sokal & ELTS risk scores (age, spleen size, platelets, blasts). Longitudinal BCR-ABL1 IS ratio monitoring. | Early Molecular Response (EMR), MMR ($MR^{3.0}$), Deep Molecular Response ($MR^{4.5}$). | **COMPLETE** |
| **Chronic Lymphocytic Leukemia (CLL)** | CLL-IPI (Lancet Oncol) | TP53 mutation / del(17p), IGHV unmutated status, $\beta_2$-microglobulin, clinical stage (Binet/Rai), age $> 65$. | Low (0-1), Intermediate (2-3), High (4-6), Very High (7-10). | **COMPLETE** |
| **Myeloproliferative Neoplasms (MPN)** | DIPSS / IWG-MRT | DIPSS score for Primary Myelofibrosis (age, constitutional symptoms, Hb $< 10$, WBC $> 25$, circulating blasts $\ge 1\%$). | Low, Int-1, Int-2, High risk; indicates allogeneic HSCT eligibility. | **COMPLETE** |
| **Multiple Myeloma (MM)** | Revised ISS (R-ISS) | Serum $\beta_2$-microglobulin, serum albumin, high-risk cytogenetics ($del(17p), t(4;14), t(14;16)$), serum LDH. | R-ISS Stage I, Stage II, Stage III. | **COMPLETE** |
| **Immune Effector Cell Toxicity (ICANS)** | ASTCT Consensus | ICE cognitive score (orientation, naming, following commands, writing, attention), motor symptoms, elevated ICP. | Grade 1 to Grade 4 neurotoxicity management pathways. | **COMPLETE** |

---

## 3. Non-Hematologic Specialty Intelligence

| Specialty | Clinical Society | Algorithms & Pathophysiological Models | Actionable Guidance | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Nephrology** | KDIGO 2012 / CKD-EPI 2021 | Serum creatinine ratio vs baseline, CKD-EPI race-free eGFR calculation, urine output staging. | KDIGO AKI Stage 1-3, renal dose adjustment triggers. | **COMPLETE** |
| **Hepatology** | UNOS / Organ Procurement Network | MELD-Na score combining total bilirubin, serum creatinine, INR, and serum sodium bounds (125-137 mEq/L). | 90-day waitlist mortality estimation and SOS/VOD screening. | **COMPLETE** |
| **Cardiology** | ACC / AHA Primary Prevention | 10-year ASCVD risk score based on age, systolic blood pressure, total cholesterol, HDL, smoking, and diabetes. | Baseline cardiovascular risk stratification before anthracycline/TBI conditioning. | **COMPLETE** |

---

## 4. Treatment Intelligence Engine

| Capability | Guideline / Consensus | Methodology | Decision Support Utility | Status |
| :--- | :--- | :--- | :--- | :---: |
| **HCT Comorbidity Index (HCT-CI)** | Sorror et al., *Blood* 2005 | 17 organ-specific comorbidity domains (cardiac, pulmonary DLCO/FEV1, hepatic, renal, infection, psychiatric). | Categorizes into Low (0), Intermediate (1-2), High ($\ge 3$); predicts non-relapse mortality (NRM). | **COMPLETE** |
| **Conditioning Regimen Eligibility** | EBMT / CIBMTR Guidelines | Evaluates age ($> 65$), HCT-CI score ($\ge 3$), DLCO ($< 60\%$), and LVEF ($< 45\%$). | Selects Myeloablative (MAC) vs Reduced-Intensity (RIC) vs Non-Myeloablative (NMA). | **COMPLETE** |
| **Organ Contraindication Screening** | Institutional BMT Protocols | Checks active organ failure (eGFR $< 30$, LVEF $< 40\%$, Total Bilirubin $> 2.0\times$ ULN). | Flags absolute contraindications and recommends dose de-escalation. | **COMPLETE** |

---

## 5. Precision Pharmacogenomics (PGx)

| Gene | Drug Classes / Exemplar Medications | Clinical Phenotypes & Guidance (CPIC Level A) | Clearance & Toxicity Safeguards | Status |
| :--- | :--- | :--- | :--- | :---: |
| **TPMT / NUDT15** | Thiopurines (6-MP, Azathioprine) | Poor/Intermediate metabolizers: 90% dose reduction to prevent fatal myelosuppression. | Myelosuppression prophylaxis | **COMPLETE** |
| **CYP2C19** | Voriconazole, Clopidogrel | Ultra-rapid: therapeutic failure; Poor: hepatotoxicity. Recommends Isavuconazole or Posaconazole. | TDM monitoring | **COMPLETE** |
| **DPYD** | Fluoropyrimidines (5-FU, Capecitabine) | Deficiency causes fatal gastrointestinal and hematologic toxicity. | Contraindication for intermediate/poor | **COMPLETE** |
| **UGT1A1** | Irinotecan | $*28/*28$ allele homozygous: severe neutropenia; start at reduced dose. | Dose reduction trigger | **COMPLETE** |
| **CYP2D6** | Ondansetron, Codeine, Tramadol | Ultra-rapid: lack of antiemetic efficacy; Poor: prodrug analgesic failure. | Alternative antiemetic selection | **COMPLETE** |
| **CYP2C9 / VKORC1** | Warfarin | Sensitive genotypes: starting dose reduction by 50-80% to avoid major bleeding. | Interactive bleeding risk | **COMPLETE** |
| **SLCO1B1** | Statins (Atorvastatin, Rosuvastatin) | Reduced transporter function: severe myopathy/rhabdomyolysis; switch statin class. | Muscle toxicity prevention | **COMPLETE** |
| **Renal/Hepatic Clearance** | Calcineurin Inhibitors (Tacrolimus, Cyclosporine) | Dynamic dose adjustment based on eGFR $< 30$ and total bilirubin $> 2.0$. | Interactive dosage titration | **COMPLETE** |

---

## 6. Comprehensive Donor Compatibility & Transplantation Matching

| Compatibility Domain | Methodology | Clinical Assessment | Status |
| :--- | :--- | :--- | :---: |
| **High-Resolution HLA Typing** | 12/12 Allele matching ($A, B, C, DRB1, DQB1, DPB1$) | Distinguishes 12/12 identical, 10/10 MUD, 9/10 mismatch, and Haploidentical. | **COMPLETE** |
| **Donor-Specific Antibodies (DSA)** | Single Antigen Bead (SAB) Mean Fluorescence Intensity (MFI) | MFI $> 5000$ high risk for primary graft failure; recommends desensitization or alternative donor. | **COMPLETE** |
| **Non-HLA Donor Factors** | EBMT Donor Selection Hierarchy | Donor age ($< 30$ preferred for survival), CMV serostatus concordance (matching recipient CMV), ABO major/minor mismatch. | **COMPLETE** |
| **Solid-Organ Virtual Crossmatch** | Pre-transplant antibody screening | Computes virtual crossmatch compatibility and hyperacute rejection risk. | **COMPLETE** |

---

## 7. Longitudinal Recovery & Unified Patient Journey

| Module | Features & Implementation | Output / Visualization | Status |
| :--- | :--- | :--- | :---: |
| **Longitudinal Blood Count Tracker** | Daily laboratory draws tracked against graft-source calibrated sigmoid kinetics (PBSC vs BM vs Cord). | Observed vs modeled counts, MAE, RMSE, 3-consecutive-day engraftment verification ($ANC \ge 500, Platelets \ge 20{,}000$). | **COMPLETE** |
| **Survival Analysis Suite** | Kaplan-Meier product-limit estimator with Greenwood 95% CIs and Cox Proportional Hazards regression with Harrell's C-index. | Multi-cohort survival curves, hazard ratios with $p$-values. | **COMPLETE** |
| **Unified Patient Journey Timeline** | Chronological journey assembler covering Day -45 (staging), Day -6 (conditioning), Day 0 (infusion), Day +5 (nadir), Day +14/+18 (engraftment), Day +30/+60/+100 (chimerism). | Interactive, category-filtered timeline cards with physician countersignatures. | **COMPLETE** |

---

## 8. Clinical Governance & Decision Support Safeguards

- **TRIPOD-AI Compliance:** Models report explicit provenance, confidence intervals, sample sizes, and calibration scores.
- **Human-in-the-Loop Governance:** Diagnostic classifications and risk scores are marked as clinical decision support suggestions; attending clinician counter-signature is required for all staging, dosing, and conditioning decisions.
- **Demonstration Provenance:** All synthetic patient data and test cohorts are explicitly labeled with `is_synthetic: true` to prevent real-world clinical confusion.
