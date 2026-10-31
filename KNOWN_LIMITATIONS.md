# MarrowQ Known Limitations & Clinical Decision-Support Boundaries

**Date:** October 31, 2026  
**Scope:** Regulatory Status, Scope of Intended Use, Algorithmic Boundaries, and Non-Fabrication Guarantees  
**Status:** Mandatory Governance Document  

---

## 1. Regulatory Status & Scope of Intended Use

MarrowQ is designed and developed strictly as a **Research and Clinical Decision-Support System (CDSS)** under FDA Clinical Decision Support Software Guidance (September 2022) and EU Medical Device Regulation (EU MDR 2017/745, Annex VIII Rule 11).

> [!CAUTION]
> **NOT AN AUTONOMOUS MEDICAL DEVICE.**  
> MarrowQ is not intended, certified, or cleared to autonomously diagnose diseases, prescribe pharmaceutical agents, determine chemotherapy dosages, or authorize haematopoietic stem cell transplantation. All outputs, risk scores, differential diagnoses, and treatment options represent **draft synthesized summaries for review by qualified medical professionals**.

---

## 2. Specific Technical & Clinical Limitations

### 2.1 Model Predictions and Generalizability
* **Cohort Demographics:** Classical and quantum benchmark models are trained primarily on the UCI paediatric bone marrow transplant cohort ($N=187$, single European centre, patients aged $0.1\text{--}20\text{ years}$, allogeneic transplants). Extrapolations to adult populations ($> 20\text{ years}$), alternative conditioning regimens, or autologous procedures must be interpreted with extreme caution.
* **Non-Causal Nature:** Machine learning models identify statistical correlations within training datasets; they do not establish biological causation. High predicted engraftment probability does not guarantee immune tolerance or prevent graft failure.
* **Calibration Decay:** Predictive models are subject to dataset shift over time as supportive care, conditioning protocols, and antibiotic prophylaxis evolve. Periodic re-calibration is required.

### 2.2 Quantum Machine Learning (QML) Boundaries
* **No Proven Quantum Advantage:** MarrowQ's quantum kernel SVM (QSVM) and 156-qubit Heron QPU experiments represent **exploratory translational research**. Quantum advantage over classical gradient boosting (XGBoost/LightGBM) or tuned RBF SVMs has **not** been definitively proven on current noisy intermediate-scale quantum (NISQ) hardware.
* **Barren Plateaus:** At qubit widths $\ge 12$, fidelity quantum kernels using random or overly expressive entangling gates exhibit exponential concentration of measure, limiting gradient flow and classification variance.
* **Hardware Noise:** Physical IBM Quantum executions are subject to two-qubit gate errors ($\sim 0.3\%$), thermal relaxation ($T_1 \sim 150\text{ }\mu\text{s}$), dephasing ($T_2 \sim 120\text{ }\mu\text{s}$), and readout errors ($\sim 1\text{--}2\%$). Error mitigation reduces but does not completely eliminate physical noise.

### 2.3 Pharmacogenomics & Medication Suitability
* **Incomplete Genomic Coverage:** Pharmacogenomic suitability checks are limited to variants and star-alleles explicitly detected in the patient's genetic testing panel. A wild-type designation ($*1/*1$) indicates absence of tested pathogenic variants, not the definitive absence of novel or unprobed rare mutations.
* **Phenoconversion:** Drug-drug interactions, severe renal impairment, hepatic cirrhosis, and systemic inflammation (high IL-6) can alter in vivo enzyme activity independently of genotype (phenoconversion).

### 2.4 Anatomical and 3D Visualisations
* **Educational Reference Meshes:** The 3D organ visualisations (Heart, Liver, Bone Marrow, Stem Cell) are generic anatomical models provided for educational and spatial reference. They **do not represent patient-specific radiologic reconstructions or biopsy pathology**.

---

## 3. Strict Non-Fabrication Guarantees

MarrowQ operates under an absolute technical and ethical protocol of transparency:
1. **Zero Fabricated External Data:** The platform will never fabricate connections to external donor registries (NMDP, Be The Match, DATRI) or restricted clinical databases (CIBMTR research files) without verified API credentials and signed Data Use Agreements.
2. **Zero Fabricated QPU Execution:** Real hardware execution requires authenticated IBM Quantum Platform credentials and available quantum execution seconds. The system will never fabricate QPU execution times, job IDs, or superconducting telemetry.
3. **Zero Fabricated Patient Outcomes:** Synthetic test patients are permanently marked with explicit demonstration tags (`data_mode: "synthetic"`). Real clinical patient files remain strictly segregated.
