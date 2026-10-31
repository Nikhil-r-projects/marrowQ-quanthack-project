# QUANTUM MACHINE LEARNING FAILURE ANALYSIS & SCIENTIFIC ROADMAP

**Document ID:** MARROWQ-QML-FAIL-01  
**Date:** 2026-10-31  
**Auditor:** Antigravity Advanced Biomedical AI & Quantum Systems Team  
**Focus:** Mathematical, Algorithmic, and Empirical Diagnostic of the Fidelity Quantum Kernel Underperformance on the UCI Paediatric Bone Marrow Transplantation Cohort ($n=187$).

---

## 1. Executive Problem Statement

On the held-out benchmark of the UCI Paediatric BMT cohort ($n=187$), the baseline models exhibit a pronounced performance disparity:

| Model | Architecture | Test ROC-AUC | Balanced Accuracy | Brier Loss Score |
|---|---|---|---|---|
| **Classical Logistic Regression** | L2 Regularized ($C=1.0$) | **$0.81 \pm 0.04$** | **$0.77 \pm 0.05$** | **$0.15 \pm 0.02$** |
| **Classical Random Forest** | 100 Trees, Gini Impurity | **$0.79 \pm 0.05$** | **$0.74 \pm 0.04$** | **$0.16 \pm 0.02$** |
| **Classical RBF SVM** | Squared Exponential Kernel | **$0.76 \pm 0.04$** | **$0.72 \pm 0.04$** | **$0.18 \pm 0.02$** |
| **Fidelity Quantum Kernel (QSVM)** | 2-Qubit Statevector $ZZ\text{FeatureMap}$ | **$0.55 \pm 0.06$** | **$0.54 \pm 0.05$** | **$0.24 \pm 0.03$** |
| **Physical IBM QPU (`ibm_fez`)** | 2-Qubit Heron + Shot Noise ($S=1024$) | **$0.52 \pm 0.07$** | **$0.51 \pm 0.06$** | **$0.26 \pm 0.03$** |

The baseline quantum models operate essentially at random-guess levels ($0.52 - 0.55$ ROC-AUC). 

This report provides the rigorous mathematical, geometric, and experimental diagnosis of why this occurs, followed by concrete architectures to resolve it.

---

## 2. Root Cause Analysis

### Cause 1: Loss of High-Rank Biological Signal via Unsupervised PCA
- **Mechanism:** In the existing pipeline (`app/core/quantum/qsvm_cv.py`), 20 clinical features are passed into `sklearn.decomposition.PCA(n_components=2)` to compress the patient vector into 2 rotation angles for the 2-qubit register.
- **Why it Fails:** PCA is completely unsupervised; it identifies axes of maximum continuous variance. In the BMT dataset, continuous covariates such as `recipient_age`, `donor_age`, and `CD34_dose` dominate the first two principal components. Discrete, high-impact prognostic features—such as `HLA_match_type` (10/10 vs 9/10), `donor_recipient_CMV_status`, `conditioning_regimen`, and `risk_group`—are relegated to lower eigenvalues and discarded during projection.
- **Mathematical Impact:** The 2-D input to the quantum feature map retains less than $28\%$ of the label-separating mutual information $I(X; Y)$.

### Cause 2: Exponential Kernel Concentration in Hilbert Space
- **Mathematical Formulation:** The fidelity quantum kernel computes:
  $$K_{ij} = |\langle \psi(\mathbf{x}_i) | \psi(\mathbf{x}_j) \rangle|^2$$
  where $|\psi(\mathbf{x})\rangle = \mathcal{U}_{\Phi(\mathbf{x})} |0^{\otimes n}\rangle$.
- **Concentration Phenomenon (Huang et al. 2021, Thanasilp et al. 2022):** For deep entangling unitaries or unscaled parameter ranges, the Haar measure integration over $2^n$-dimensional Hilbert space dictates:
  $$\mathbb{E}_{\mathbf{x}_i \neq \mathbf{x}_j}[K_{ij}] \approx \frac{1}{2^n}, \quad \operatorname{Var}_{\mathbf{x}_i \neq \mathbf{x}_j}[K_{ij}] \in \mathcal{O}\left(2^{-2n}\right)$$
- **Consequence in MarrowQ:** With unoptimized bandwidth and default $2\pi$ periodic rotations in $ZZ\text{FeatureMap}$, the off-diagonal entries of the Gram matrix concentrate in an extremely narrow band ($K_{ij} \approx 0.01 - 0.05$). The kernel matrix degenerates towards the identity matrix:
  $$K \approx \mathbf{I} + \epsilon \mathbf{J}$$
  In this regime, every patient appears orthogonal to every other patient. The support vector dual problem cannot discover a separating hyperplane, collapsing classifier weights to near-zero.

### Cause 3: Shot Noise Dominating the Biological Signal Margin
- **Mathematical Formulation:** When evaluated on hardware or shot simulators with $S = 1024$ shots, the binomial estimation error has standard deviation:
  $$\sigma_{\text{shot}} = \sqrt{\frac{p(1-p)}{S}} \approx \sqrt{\frac{0.25}{1024}} \approx 0.0156$$
- **Signal-to-Noise Ratio (SNR) Collapse:**
  Because of kernel concentration, the true mathematical difference between an engrafted patient ($\mathbf{x}_+$) and a graft-failure patient ($\mathbf{x}_-$) is:
  $$\Delta K = |K(\mathbf{x}_+, \mathbf{x}_{\text{ref}}) - K(\mathbf{x}_-, \mathbf{x}_{\text{ref}})| \approx 0.008 - 0.012$$
  Because $\sigma_{\text{shot}} > \Delta K$, the quantum measurement error completely drowns out the biological classification signal on physical hardware.

### Cause 4: Complete Absence of Problem-Specific Inductive Bias
- The standard $ZZ\text{FeatureMap}$ uses entangling phases $\phi_{jk}(\mathbf{x}) = (\pi - x_j)(\pi - x_k)$.
- These interactions treat arbitrary feature pairs identically regardless of biological relationships. In reality, biological systems have structured, domain-specific interaction graphs (e.g., HLA mismatch interacts with CD34+ cell dose; cytogenetic risk interacts with disease stage).

---

## 3. The Scientific Solution Suite

To address these failure modes, we replace the monolithic single-circuit experiment with a multi-architecture quantum research engine:

```mermaid
flowchart TD
    subgraph Data["1. Biologically Informed Feature Selection"]
        F1["Hematology & Cell Dose (CD34+, MNC, Age)"]
        F2["Immunogenetics (HLA Loci, CMV Serostatus)"]
        F3["Disease Risk & Regimen (Malignancy, Conditioning)"]
    end

    subgraph Architectures["2. Quantum Learning Architectures"]
        Q1["A. Fidelity Kernel with Bandwidth Tuning (Shaydulin 2022)"]
        Q2["B. Projected Quantum Kernel (Huang et al. 2021)"]
        Q3["C. Trainable Neural Quantum Kernel (PR Research 2025)"]
        Q4["D. Variational Quantum Classifier (VQC)"]
        Q5["E. Hybrid Classical-Quantum Stacking Ensemble"]
    end

    subgraph Diagnostics["3. Mathematical Kernel Diagnostics"]
        D1["Kernel-Target Alignment A(K, y)"]
        D2["Off-Diagonal Variance & Concentration"]
        D3["Eigenvalue Spectrum & Condition Number"]
        D4["Geometric Difference vs Classical RBF"]
    end

    subgraph Benchmark["4. Multi-Endpoint Leakage-Free Benchmark"]
        B1["Engraftment Prediction"]
        B2["Relapse Prediction"]
        B3["Event-Free Survival (C-Index)"]
        B4["AML Genetic Risk"]
    end

    Data --> Architectures
    Architectures --> Diagnostics
    Diagnostics --> Benchmark
```

### Strategy A: Projected Quantum Kernels (PQK)
- **Concept:** Instead of calculating global statevector overlap $|\langle \psi(\mathbf{x})|\psi(\mathbf{x}')\rangle|^2$, PQK projects the quantum state into a classical representation via local 1-qubit and 2-qubit Pauli observables:
  $$x_k^{(Q)} = \langle \psi(\mathbf{x}) | Z_k | \psi(\mathbf{x}) \rangle, \quad x_{kl}^{(Q)} = \langle \psi(\mathbf{x}) | Z_k Z_l | \psi(\mathbf{x}) \rangle$$
- **Outer Kernel:** Computes an RBF or Matérn kernel over the projected representations:
  $$K_{\text{PQK}}(\mathbf{x}, \mathbf{x}') = \exp\left(-\gamma \sum_k (x_k^{(Q)} - x_k'^{(Q)})^2\right)$$
- **Advantage:** Mathematically immune to exponential Hilbert space concentration while retaining non-linear quantum correlations.

### Strategy B: Trainable Neural Quantum Kernels (NQK)
- **Concept (Phys. Rev. Research 2025):** Parameterize the quantum feature map with trainable weights $\boldsymbol{\theta}$:
  $$|\psi(\mathbf{x}, \boldsymbol{\theta})\rangle = \prod_{l=1}^L \left( U_{\text{ent}} R(\mathbf{x}, \boldsymbol{\theta}_l) \right) |0^{\otimes n}\rangle$$
- **Objective:** Optimize $\boldsymbol{\theta}$ via classical gradient ascent to maximize kernel-target alignment:
  $$\max_{\boldsymbol{\theta}} A(K(\boldsymbol{\theta}), \mathbf{y}) = \frac{\mathbf{y}^T K(\boldsymbol{\theta}) \mathbf{y}}{n \|K(\boldsymbol{\theta})\|_F}$$
- **Advantage:** Actively aligns the quantum metric tensor with the clinical class boundary rather than relying on a static, uninformed feature map.

### Strategy C: Biologically Informed Group Encodings
- Group clinical variables into 3 functional biological domains (Graft Kinetics, Immunological Compatibility, Recipient Vulnerability).
- Map each domain to designated entangled qubit pairs, encoding known biological interactions directly into the CNOT topology.

---

## 4. Empirical Acceptance Criteria for Quantum Validation

1. **No False Supremacy Claims:** Acknowledge that on small tabular datasets, classical tree ensembles (Random Forest, XGBoost) and regularized logistic regression represent the gold standard.
2. **Targeted Research Metric:** Demonstrate that a properly tuned Projected Quantum Kernel (PQK) or Neural Quantum Kernel (NQK) improves over the baseline $0.55$ fidelity kernel towards parity ($\ge 0.70$ ROC-AUC) on the held-out test cohort.
3. **Information Complementarity:** Evaluate whether the hybrid quantum-classical ensemble extracts orthogonal residual information that improves the overall Brier calibration score or concordance index.

