# MarrowQ API Contracts & Schema Specification

**Date:** October 31, 2026  
**Framework:** FastAPI 0.115+ / Pydantic v2 / OpenAPI 3.1  
**Security:** OAuth2 Bearer JWT (`Authorization: Bearer <token>`) & Role-Based Access Guards  

---

## 1. Authentication & Security Endpoints (`/api/v2/auth`)

### `POST /api/v2/auth/login`
* **Description:** Authenticates user credentials and issues a signed JWT access token and HttpOnly refresh token.
* **Request:**
  ```json
  {
    "username": "dr_varsha_hematology",
    "password": "<secure_password>"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1Ni...",
    "token_type": "bearer",
    "expires_in_seconds": 900,
    "user": {
      "user_id": "usr_78a1b2c3",
      "username": "dr_varsha_hematology",
      "role": "clinician_doctor",
      "full_name": "Dr. Varsha R., MD, DM (Haematology)"
    }
  }
  ```
* **Error Codes:** 401 Unauthorized (`INVALID_CREDENTIALS`), 403 Forbidden (`ACCOUNT_DISABLED`).

---

## 2. Multimodal Biological Data Endpoints (`/api/v2/biological`)

### `POST /api/v2/biological/observations`
* **Role Guard:** `@require_roles(["clinician_doctor", "hospital_admin"])`
* **Request:**
  ```json
  {
    "patient_id": "MQ-PT-802",
    "modality": "haematology",
    "metric_name": "Absolute Neutrophil Count (ANC)",
    "loinc_code": "751-8",
    "numeric_value": 540.0,
    "unit": "cells/μL",
    "day_post_tx": 16,
    "recorded_at": "2026-10-31T06:30:00Z"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "observation_id": "obs_4f92b1a0",
    "patient_id": "MQ-PT-802",
    "status": "RECORDED",
    "engraftment_evaluation": {
      "is_consecutive_day_1": true,
      "consecutive_days_above_threshold": 1,
      "engraftment_status": "PENDING_CONFIRMATORY_DRAWS"
    }
  }
  ```

### `POST /api/v2/biological/genomics/vcf/upload`
* **Role Guard:** `@require_roles(["clinician_doctor", "clinical_researcher"])`
* **Request:** `multipart/form-data` with `.vcf` or `.vcf.gz` file and `patient_id`.
* **Response (200 OK):**
  ```json
  {
    "variants_extracted": 14,
    "pathogenic_variants": [
      {
        "gene": "FLT3",
        "variant": "c.1788_1835dup",
        "hgvs_p": "p.Glu611_Asn612insTyrPhe...",
        "vaf": 0.38,
        "clinical_significance": "Pathogenic (ELN 2022 Adverse / Targetable)"
      },
      {
        "gene": "TPMT",
        "variant": "c.719A>G",
        "diplotype": "*1/*3C",
        "phenotype": "Intermediate Metaboliser"
      }
    ],
    "pharmacogenomic_alerts_generated": 1
  }
  ```

---

## 3. Disease Intelligence & Differential Diagnosis (`/api/v2/disease`)

### `POST /api/v2/disease/assess`
* **Description:** Runs the comprehensive differential diagnostic workflow for suspected haematological condition.
* **Request:**
  ```json
  {
    "patient_id": "MQ-PT-802",
    "include_differential": true,
    "target_disease_family": "myeloid"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "patient_id": "MQ-PT-802",
    "suspected_primary_diagnosis": {
      "disease_code": "DIS-HEM-AML",
      "disease_name": "Acute Myeloid Leukaemia with mutated NPM1",
      "who_2022_classification": "AML with defining recurring genetic abnormalities",
      "eln_2022_risk": "Favourable",
      "evidence_alignment_score": 0.94,
      "supporting_findings": [
        "Bone marrow aspirate blasts: 26% (>= 20% threshold)",
        "Flow cytometry: CD34+, CD117+, CD33+, MPO+",
        "Genomics: NPM1 exon 12 4-bp duplication (c.860_863dupTCTG), VAF 42%",
        "Genomics: FLT3-ITD negative (wild-type)"
      ],
      "contradictory_findings": [],
      "missing_investigations": [
        "Cytogenetic karyotyping report pending final chromosome banding"
      ],
      "clinician_signoff_status": "PENDING_REVIEW"
    }
  }
  ```

---

## 4. Medication Suitability & Pharmacogenomics (`/api/v2/medication`)

### `POST /api/v2/medication/suitability-check`
* **Request:**
  ```json
  {
    "patient_id": "MQ-PT-802",
    "proposed_medications": ["voriconazole", "mercaptopurine", "codeine"]
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "patient_id": "MQ-PT-802",
    "evaluated_drugs": [
      {
        "medication": "voriconazole",
        "gene": "CYP2C19",
        "diplotype": "*2/*2",
        "phenotype": "Poor Metaboliser",
        "status": "CONTRAINDICATED",
        "action": "Avoid voriconazole due to elevated plasma concentration and high neuro/hepatotoxicity risk. Switch to isavuconazole or liposomal amphotericin B.",
        "cpic_level": "Level A",
        "guideline_doi": "10.1002/cpt.583"
      },
      {
        "medication": "mercaptopurine",
        "gene": "TPMT",
        "diplotype": "*1/*3C",
        "phenotype": "Intermediate Metaboliser",
        "status": "DOSE_REDUCTION_REQUIRED",
        "action": "Reduce initial starting dose by 50%. Titrate based on serial ANC monitoring.",
        "cpic_level": "Level A",
        "guideline_doi": "10.1002/cpt.1304"
      },
      {
        "medication": "codeine",
        "gene": "CYP2D6",
        "diplotype": "*1/*1",
        "phenotype": "Normal Metaboliser",
        "status": "SAFE",
        "action": "Standard label dosing recommended.",
        "cpic_level": "Level A",
        "guideline_doi": "10.1002/cpt.2064"
      }
    ]
  }
  ```

---

## 5. HLA Donor Compatibility Engine (`/api/v2/transplant/donor`)

### `POST /api/v2/transplant/donor/evaluate-compatibility`
* **Request:**
  ```json
  {
    "recipient_id": "MQ-PT-802",
    "candidate_donor_id": "DNR-NMDP-90412"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "recipient_id": "MQ-PT-802",
    "donor_id": "DNR-NMDP-90412",
    "locus_breakdown": {
      "hla_a": { "recipient": ["*02:01", "*24:02"], "donor": ["*02:01", "*24:02"], "match": "2/2" },
      "hla_b": { "recipient": ["*07:02", "*44:02"], "donor": ["*07:02", "*44:02"], "match": "2/2" },
      "hla_c": { "recipient": ["*07:01", "*05:01"], "donor": ["*07:01", "*05:01"], "match": "2/2" },
      "hla_drb1": { "recipient": ["*04:01", "*15:01"], "donor": ["*04:01", "*15:01"], "match": "2/2" },
      "hla_dqb1": { "recipient": ["*03:02", "*06:02"], "donor": ["*03:02", "*06:02"], "match": "2/2" },
      "hla_dpb1": { "recipient": ["*04:01", "*02:01"], "donor": ["*04:01", "*09:01"], "match": "1/2" }
    },
    "summary_grade": "10/10 Allele Match (11/12 High-Res)",
    "dpb1_tce_permissiveness": "PERMISSIVE_MISMATCH",
    "dsa_evaluation": {
      "dsa_detected": false,
      "max_mfi": 240,
      "clinical_risk": "Negative (Safe to proceed)"
    },
    "abo_compatibility": {
      "recipient_abo": "O+",
      "donor_abo": "A+",
      "classification": "MAJOR_MISMATCH",
      "monitoring_requirements": "Monitor for delayed erythroid engraftment and pure red cell aplasia (PRCA). Isohaemagglutinin titration required."
    },
    "donor_age": 24,
    "cmv_status": "D-/R- (Serologically Concordant)",
    "overall_candidate_rank": 1,
    "recommendation": "PREFERRED_DONOR_CANDIDATE"
  }
  ```

---

## 6. Longitudinal Patient Recovery (`/api/v2/transplant/recovery`)

### `GET /api/v2/transplant/recovery/{patient_id}`
* **Response (200 OK):**
  ```json
  {
    "patient_id": "MQ-PT-802",
    "days_post_transplant": 18,
    "astct_milestones": {
      "neutrophil_engraftment": {
        "status": "COMPLETED",
        "engraftment_day": 16,
        "consecutive_qualifying_counts": [
          { "day": 16, "anc": 540.0 },
          { "day": 17, "anc": 720.0 },
          { "day": 18, "anc": 1150.0 }
        ],
        "definition": "First of 3 consecutive daily counts >= 500 cells/μL"
      },
      "platelet_engraftment": {
        "status": "PENDING",
        "consecutive_qualifying_counts": [
          { "day": 17, "platelets": 24000.0 },
          { "day": 18, "platelets": 31000.0 }
        ],
        "transfusion_free_days": 4,
        "definition": "First of 3 consecutive counts >= 20,000/μL with 7 days transfusion independence"
      }
    }
  }
  ```

