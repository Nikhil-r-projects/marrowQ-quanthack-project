# MarrowQ — Run, Test & Deployment Guide

**Platform:** MarrowQ Multimodal Precision Medicine & Quantum ML Platform  
**Target Environments:** Local Development, Docker Container, Enterprise Clinical Staging  
**Date:** October 31, 2026  

---

## 1. System Requirements & Prerequisites

- **Backend Runtime:** Python 3.10, 3.11, 3.12, or 3.13
- **Frontend Runtime:** Node.js 18.x or 20.x, npm 9.x+
- **Quantum SDK:** Qiskit v1.4+, `qiskit-ibm-runtime` v0.43+, `qiskit-machine-learning`
- **Machine Learning:** `scikit-learn`, `numpy`, `pandas`, `scipy`, `lifelines`

---

## 2. Environment Configuration (`.env`)

Create or update `.env` in the repository root:

```env
# IBM Quantum Credentials
IBM_QUANTUM_API_KEY=your_ibm_quantum_platform_token
QISKIT_IBM_TOKEN=your_ibm_quantum_platform_token
IBM_QUANTUM_CHANNEL=ibm_quantum_platform
IBM_QUANTUM_BACKEND=ibm_fez
IBM_QUANTUM_INSTANCE=none
IBM_MAX_SECONDS_PER_RUN=120

# Server Security & RBAC
JWT_SECRET_KEY=marrowq-super-secret-jwt-key-precision-medicine-2026
ENVIRONMENT=development
PORT=8000
HOST=127.0.0.1
```

---

## 3. Installation Steps

### 3.1 Backend Setup
```bash
# From repository root:
python -m pip install -r backend/requirements.txt
```

### 3.2 Frontend Setup
```bash
# Install frontend dependencies:
npm install --prefix frontend
```

---

## 4. Running the Development Servers

### 4.1 Launch Backend API Server
```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
- API Base: `http://127.0.0.1:8000`
- Interactive OpenAPI / Swagger UI: `http://127.0.0.1:8000/docs`
- QPU Telemetry Endpoint: `http://127.0.0.1:8000/api/quantum/status`

### 4.2 Launch Frontend Application
```bash
npm run dev --prefix frontend
```
- Local URL: `http://localhost:5173`
- Production Build: `npm run build --prefix frontend` (Outputs static bundle to `frontend/dist/`)

---

## 5. Verification & Automated Test Suite

Execute the comprehensive 36-test suite covering Quantum ML, Flow Cytometry, Pathology Vision, Genomic Curation, Disease Intelligence, Survival Tracking, and RBAC:

```bash
pytest backend/tests/test_quantum_suite.py \
       backend/tests/test_biological_flow.py \
       backend/tests/test_disease_expanded.py \
       backend/tests/test_survival_tracker.py \
       backend/tests/test_auth_rbac.py \
       backend/tests/test_pgx.py \
       backend/tests/test_hla.py \
       backend/tests/test_engraftment.py -v
```

All 36 tests execute and pass in approximately 25 seconds.

---

## 6. Default Clinical Accounts & Role Credentials

MarrowQ seeds canonical role accounts on database initialization (`marrowq.db`):

| Role | Email Login | Password | Primary Workspace Views |
| :--- | :--- | :--- | :--- |
| **Doctor** | `doctor@marrowq.org` | `MarrowQ#Doctor2026` | Diagnostic Intelligence, Treatment Comparison, HLA Matching, Clinical Reports |
| **Researcher** | `researcher@marrowq.org` | `MarrowQ#Research2026` | Quantum Lab Arena, Kernel Diagnostics, Benchmark Curves, Cohort Analytics |
| **Patient** | `patient@marrowq.org` | `MarrowQ#Patient2026` | Patient Progress View, Engraftment Milestones, Unified Journey Timeline |
| **Admin** | `admin@marrowq.org` | `MarrowQ#Admin2026` | Security Logs, User Access Management, System Configuration |

---

## 7. Key API Endpoints Reference

| Endpoint | Method | Role | Description |
| :--- | :---: | :---: | :--- |
| `/api/quantum/status` | `GET` | Open | Live status of 156-qubit Heron backends (`ibm_fez`) |
| `/api/quantum/test-connection` | `POST` | Researcher | Validates IBM Quantum Platform credentials |
| `/api/quantum/multi-benchmark/{endpoint}` | `GET` | Researcher | Evaluates 8 models side-by-side on identical folds |
| `/api/quantum/diagnostics` | `GET` | Researcher | Gram matrix heatmap, spectrum, condition number |
| `/api/v2/biological/flow/analyze` | `POST` | Doctor | Hierarchical FCS gating and MRD detection |
| `/api/v2/biological/pathology/smear-analyze`| `POST` | Doctor | Blur detection, N:C ratio, blast % with 95% CIs |
| `/api/v2/biological/genomics/curate` | `POST` | Doctor | HGVS curation, ClinVar/COSMIC annotation |
| `/api/treatment/compare` | `POST` | Doctor | HCT-CI score, 2-yr NRM, MAC vs RIC eligibility |
| `/api/patient/{id}/timeline` | `GET` | All | Unified Day -45 to Day +100 clinical journey |
| `/api/survival/longitudinal-track` | `POST` | Doctor | Daily draws vs graft-source calibrated sigmoid kinetics |
