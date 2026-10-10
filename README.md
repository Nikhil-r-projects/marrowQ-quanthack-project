# MarrowQ — Quantum-Assisted HSCT Recovery Prediction System

[![Tests](https://img.shields.io/badge/pytest-10%20passed-brightgreen.svg)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-1.0.0-009688.svg)]()
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)]()
[![Qiskit](https://img.shields.io/badge/Qiskit-2.5.2-6929C4.svg)]()
[![Qiskit ML](https://img.shields.io/badge/Qiskit_ML-0.9.1-8A3FFC.svg)]()

> **CLINICAL BOUNDARY & REGULATORY NOTICE:**  
> **SYNTHETIC DEMONSTRATION DATA — NOT CLINICAL EVIDENCE.**  
> MarrowQ is an investigational clinical machine learning and quantum computing research prototype. Results must not be used for autonomous clinical triage, treatment recommendation, or therapeutic decisions.

---

## 1. Research Grounding & Problem Definition

Delayed hematologic recovery—specifically delayed neutrophil engraftment—following Hematopoietic Stem Cell Transplantation (HSCT) leaves patients severely neutropenic and susceptible to life-threatening infectious complications and transplant-related mortality.

### Prediction Target Specification
- **Primary Endpoint:** Neutrophil recovery by post-transplant Day +28 (`neutrophil_recovery_day28`).
- **Clinical Definition:** Absolute Neutrophil Count (ANC) $\ge 500/\mu\text{L}$ ($\ge 0.5 \times 10^9/\text{L}$) for 3 consecutive days on or before Day +28.
  - **Class 1 (Positive):** Timely neutrophil engraftment on or before Day 28.
  - **Class 0 (Negative):** Delayed engraftment (> Day 28) or primary graft failure.
- **Prediction Timestamp:** Baseline Day 0 or prior (pre-transplant planning).
- **Leakage Prevention Boundary:** Longitudinal post-transplant variables (e.g. onset of acute GVHD, post-transplant infection dates, chimerism percentages) are strictly excluded from the feature space.

### CIBMTR Public Research Datasets & Access Policy
- CIBMTR provides final analysis datasets linked to published studies on secondary-analysis terms.
- Due to Data Use Agreements (DUA) and HIPAA de-identification restrictions, real patient datasets require institutional credentialing and cannot be bundled into public repositories.
- MarrowQ provides two operational modes:
  1. **Research Dataset Mode:** Ingests and profiles de-identified CSV extracts with schema inference, missingness audits, and automatic leakage keyword alerts.
  2. **Synthetic Demonstration Mode:** Generates a reproducible cohort ($N=500$) based on published CIBMTR and cord-blood registry distributions (e.g., PMID: 38336299).

---

## 2. Quantum vs. Classical Methodology

MarrowQ implements a scientifically rigorous 5-model comparative evaluation:

| Model | Purpose / Specification |
|---|---|
| **DummyClassifier** | Establishes trivial baseline (most-frequent / prior class distribution) |
| **Logistic Regression** | Linear, interpretable clinical reference standard with $L_2$ regularization |
| **Random Forest** | Non-linear ensemble capturing complex covariate interactions |
| **Classical RBF SVM** | Standard non-linear kernel baseline |
| **Matched RBF SVM** | Classical RBF SVM evaluated on the exact same compressed feature subspace as the quantum model |
| **Quantum-Kernel SVM** | Qiskit Machine Learning `FidelityQuantumKernel` with parameterized `ZZFeatureMap` executed on a local statevector simulator |

### Leakage-Safe Preprocessing Pipeline
1. Dataset split occurs **before** any fitting.
2. Imputation (median for numeric, mode for categorical), scaling (`StandardScaler`), and encoding (`OneHotEncoder`) are fit **strictly on training partitions**.
3. Dimensionality reduction (PCA to $N$-qubit space) is fit exclusively on training data, followed by $[0, 2\pi]$ angle scaling.

---

## 3. Architecture & Repository Structure

```
varsha/
├── DATA_RESEARCH.md            # Deep clinical literature & CIBMTR analysis
├── README.md                   # System documentation & quickstart
├── .env.example                # Environment variables template
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py       # REST API endpoints (health, datasets, experiments, prediction)
│   │   ├── core/
│   │   │   ├── synthetic.py    # Clinically grounded HSCT synthetic generator
│   │   │   ├── profiler.py     # Schema inference & leakage detection
│   │   │   ├── pipeline.py     # Leakage-safe ColumnTransformer & train/test splitter
│   │   │   ├── classical.py    # Classical model training & timing
│   │   │   ├── quantum.py      # Qiskit FidelityQuantumKernel SVM
│   │   │   ├── evaluator.py    # Metric computations (ROC-AUC, F1, Balanced Acc, CM)
│   │   │   ├── database.py     # SQLite persistence for datasets and runs
│   │   │   └── reporter.py     # Markdown research report generator
│   │   ├── schemas.py          # Pydantic request/response models
│   │   └── main.py             # FastAPI entrypoint, CORS, static mounting
│   ├── tests/
│   │   └── test_all.py         # Pytest automated test suite (10 test cases)
│   └── requirements.txt        # Backend dependencies
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Header.tsx      # System health & data mode badges
    │   │   └── Navigation.tsx  # 7-view tab navigation bar
    │   ├── views/
    │   │   ├── OverviewView.tsx     # 1. Project overview & executive summary
    │   │   ├── DatasetView.tsx      # 2. CSV upload, synthetic demo, leakage alerts
    │   │   ├── SetupView.tsx        # 3. Covariate toggles & quantum hyperparams
    │   │   ├── MonitorView.tsx      # 4. Lifecycle stages & live execution logs
    │   │   ├── ResultsView.tsx      # 5. Metrics table, confusion matrix, runtimes
    │   │   ├── PredictionView.tsx   # 6. Pre-transplant patient demonstration
    │   │   └── ReportView.tsx       # 7. Auto-generated research report
    │   ├── types.ts            # TypeScript interfaces
    │   ├── api.ts              # API client
    │   └── App.tsx             # Root React application
    ├── index.html              # HTML shell with Google Fonts
    └── package.json            # Frontend build configuration
```

---

## 4. Quickstart & Commands

### Prerequisites
- Python 3.10+ (Tested on Python 3.13)
- Node.js 18+ (Tested on Node.js 24)

### 1. Install Backend Dependencies
```bash
pip install -r backend/requirements.txt
```

### 2. Run Backend Automated Test Suite
```bash
python -m pytest backend/tests/test_all.py -v
```
*Executes all 10 unit and integration tests including pipeline leakage checks, classical training, Qiskit fidelity quantum kernel evaluation, and API routes.*

### 3. Build Frontend Production Assets
```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Start Application
```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser. Both API and full React UI are served seamlessly.

---

## 5. API Endpoints Contract

- `GET /api/health` — System health, runtime package versions.
- `GET /api/datasets/demo` — Generates and returns profiled CIBMTR synthetic cohort.
- `POST /api/datasets/upload` — Upload and profile user CSV dataset.
- `GET /api/datasets/{dataset_id}/profile` — Profile metadata for loaded dataset.
- `POST /api/experiments` — Configure an experiment run.
- `POST /api/experiments/{experiment_id}/run` — Execute training pipeline in background.
- `GET /api/experiments` — List experiment runs.
- `GET /api/experiments/{experiment_id}` — Status, lifecycle stage, and real metrics.
- `GET /api/models` — List trained model artifacts available for inference.
- `POST /api/predictions` — Execute patient inference using trained pipeline.
- `GET /api/reports/{experiment_id}` — Generate full scientific Markdown report.

---

## 6. Scientific Limitations & Ethical Principles
1. **Synthetic Mode vs. Patient Cohorts:** Synthetic cohorts model published marginal distributions and correlations, but lack prospective biological heterogeneity.
2. **Competing Risks:** Binary classification at Day 28 does not account for early non-relapse mortality prior to day 28; prospective clinical registries require Fine-Gray subdistribution hazard modeling.
3. **Quantum Simulator Limits:** Local statevector simulation scales quadratically with sample size; production quantum hardware with error mitigation is needed for large-scale clinical trials.
