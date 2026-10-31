# MarrowQ — Known Limitations & Risk Analysis

**Platform:** MarrowQ Precision Medicine & Quantum ML Research Suite  
**Version:** 2.0.0-PROD  
**Evaluation Standard:** FDA SaMD Guidance / EU AI Act High-Risk Health Systems  
**Date:** October 31, 2026  

---

## 1. Quantum Computing & NISQ Hardware Constraints

1. **NISQ Decoherence & Gate Noise:**
   - Physical 156-qubit Heron processors (`ibm_fez`) possess finite coherence times ($T_1, T_2 \approx 150-250\ \mu\text{s}$) and two-qubit gate fidelities around $99.2\%-99.6\%$. For circuits with depth $> 10$, accumulated phase errors attenuate off-diagonal Gram matrix values toward 0.5.
   - *Mitigation in MarrowQ:* We implement Zero-Noise Extrapolation (ZNE) and readout error mitigation in Qiskit Runtime, and provide noise-aware `FakeFez` simulation to model realistic hardware behavior.
2. **QPU Execution Quota & Runtime Budgets:**
   - IBM Quantum Open Plan provides 600 QPU-seconds per rolling 28-day window. Full $187 \times 187$ kernel evaluations cannot be run on physical hardware repeatedly without exhausting the quota.
   - *Mitigation in MarrowQ:* The system implements a strict pre-flight execution estimator (`estimate_qpu_seconds`), enforces sample caps ($N \le 8$ for hardware confirmation runs), and utilizes local statevector simulation for expansive benchmarking.
3. **No Claim of Unconditional Quantum Advantage:**
   - On tabular clinical datasets with $N \approx 200$, classical gradient boosted trees and random forests remain highly competitive ($0.685$ vs $0.683$ ROC-AUC). MarrowQ claims **quantum complementarity and geometric calibration enhancement**, not synthetic quantum supremacy.

---

## 2. Dataset Scope & Statistical Generalizability

1. **Cohort Sample Size ($n=187$):**
   - The primary pediatric HSCT cohort contains 187 patients with 37 covariates. While statistically sufficient for 3-fold cross-validation and non-parametric permutation testing, external validation on adult cohorts ($n > 5{,}000$, CIBMTR registry) is required before clinical deployment.
2. **Rare Subtype Representation:**
   - Ultra-rare cytogenetic abnormalities (e.g. $t(6;9)(p23;q34)$ or $inv(3)$ in AML) have small sample counts ($n < 5$). Predictive confidence intervals for rare subgroups are wider by design.

---

## 3. Clinical Decision Support & Regulatory Boundaries

1. **Investigational CDSS Boundary:**
   - MarrowQ is an investigational clinical decision support system. It is strictly prohibited from autonomously issuing chemotherapy prescriptions, modifying immunosuppressive dosing, or clearing donor transplants without human attending physician counter-signature.
2. **Pathology & Cytology Vision:**
   - Bone marrow smear analysis uses computer vision for focus validation (Laplacian variance $\ge 100$) and heuristic morphological estimation. It does not replace board-certified hematopathologist manual review of marrow aspirate and trephine core biopsies.
3. **Genomic Variant Curation:**
   - Automated ClinVar/COSMIC annotations provide Level A/B evidence links; novel variants of uncertain significance (VUS) require multidisciplinary Molecular Tumor Board (MTB) adjudication.
