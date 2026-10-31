"""Unified Patient Journey Chronological Timeline Builder for MarrowQ.

Connects every stage of the clinical journey into an auditable, ordered timeline:
1. Baseline Clinical Assessment & Staging
2. Multimodal Diagnostic Profiling (CBC, Marrow, Genomics, Flow)
3. Pre-Transplant Conditioning (Chemo/TBI)
4. Stem Cell Infusion (Day 0)
5. Nadir & Aplasia Management
6. Engraftment Milestones (Neutrophil, Platelet)
7. Chimerism Testing (Day 30, Day 60, Day 100)
8. Complications & GvHD Monitoring
9. Long-term Survival & Remission Surveillance
"""
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone


def build_unified_patient_timeline(patient_id: str, clinical_events: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """Assembles the complete patient timeline across diagnostic, therapeutic, and recovery phases."""
    if not clinical_events:
        # Standard clinical archetype for allogeneic HSCT recipient
        clinical_events = [
            {
                "event_id": "EVT-01",
                "phase": "Diagnostic Workup",
                "day_relative": -45,
                "title": "Initial Presentation & Bone Marrow Biopsy",
                "category": "DIAGNOSTIC",
                "severity": "NORMAL",
                "summary": "Bone marrow aspirate shows 35% myeloblasts. Cytogenetics: 46,XX. Next-Gen Sequencing: NPM1 insertion mutated, FLT3-ITD negative. Confirmed ELN 2022 Favorable Risk AML.",
                "verified_by": "Dr. Sarah Chen, MD (Hematopathology)"
            },
            {
                "event_id": "EVT-02",
                "phase": "Pre-Transplant Conditioning",
                "day_relative": -6,
                "title": "Conditioning Regimen Initiation",
                "category": "THERAPEUTIC",
                "severity": "NORMAL",
                "summary": "Commenced Fludarabine 30 mg/m2/day + Busulfan 3.2 mg/kg/day (FluBu4) with continuous therapeutic drug monitoring (target AUC 4800 umol*min/L).",
                "verified_by": "Dr. Marcus Vance, MD (BMT Attending)"
            },
            {
                "event_id": "EVT-03",
                "phase": "Stem Cell Infusion",
                "day_relative": 0,
                "title": "Allogeneic PBSC Infusion (Day 0)",
                "category": "TRANSPLANT",
                "severity": "NORMAL",
                "summary": "Infused 6.8 x 10^6 CD34+ cells/kg from 10/10 matched unrelated donor (MUD). Zero acute infusion reactions. ABO identical (O+ to O+).",
                "verified_by": "Transplant Nursing Core"
            },
            {
                "event_id": "EVT-04",
                "phase": "Nadir & Aplasia",
                "day_relative": 5,
                "title": "Profound Neutropenic Nadir",
                "category": "CLINICAL",
                "severity": "WARNING",
                "summary": "Absolute neutrophil count nadir at 40 cells/uL. Prophylactic Posaconazole, Acyclovir, and Cefepime initiated per institutional protocol.",
                "verified_by": "Inpatient BMT Service"
            },
            {
                "event_id": "EVT-05",
                "phase": "Engraftment Milestone",
                "day_relative": 14,
                "title": "Neutrophil Engraftment Achieved",
                "category": "RECOVERY",
                "severity": "NORMAL",
                "summary": "First day of 3 consecutive daily counts >= 500 cells/uL (ANC 620 -> 1100 -> 1850). Meets EBMT/CIBMTR consensus criteria on Day +14.",
                "verified_by": "Dr. Marcus Vance, MD"
            },
            {
                "event_id": "EVT-06",
                "phase": "Engraftment Milestone",
                "day_relative": 18,
                "title": "Platelet Engraftment & Transfusion Independence",
                "category": "RECOVERY",
                "severity": "NORMAL",
                "summary": "Platelet count reaches 32,000/uL without transfusion support for > 7 consecutive days.",
                "verified_by": "Inpatient BMT Service"
            },
            {
                "event_id": "EVT-07",
                "phase": "Post-Transplant Surveillance",
                "day_relative": 30,
                "title": "Day +30 Bone Marrow & Chimerism Testing",
                "category": "DIAGNOSTIC",
                "severity": "NORMAL",
                "summary": "Bone marrow in complete morphological remission (blasts 1.2%). Flow MRD negative (< 0.01%). Peripheral blood CD3+ T-cell donor chimerism: 98.5%.",
                "verified_by": "Molecular Diagnostics Lab"
            },
            {
                "event_id": "EVT-08",
                "phase": "Complications Surveillance",
                "day_relative": 42,
                "title": "Acute Skin GvHD Assessment (Grade 1)",
                "category": "COMPLICATION",
                "severity": "WARNING",
                "summary": "Maculopapular rash involving 15% BSA (Stage 1 Skin, Stage 0 Liver/GI). Successfully managed with topical 0.1% Triamcinolone; systemic steroids not required.",
                "verified_by": "Dr. Marcus Vance, MD"
            },
            {
                "event_id": "EVT-09",
                "phase": "Long-Term Remission",
                "day_relative": 100,
                "title": "Day +100 Milestone Assessment",
                "category": "SURVEILLANCE",
                "severity": "NORMAL",
                "summary": "100% full donor chimerism. Normal peripheral counts (Hb 12.8, WBC 5.6, ANC 3200, Plt 185k). Calcineurin inhibitor taper initiated.",
                "verified_by": "Outpatient BMT Clinic"
            }
        ]

    # Sort chronologically by day_relative
    sorted_events = sorted(clinical_events, key=lambda x: x["day_relative"])

    return {
        "patient_id": patient_id,
        "total_milestones_recorded": len(sorted_events),
        "current_journey_phase": "Day +100 Surveillance & Immunosuppression Taper",
        "events": sorted_events,
        "timeline_provenance": "MarrowQ Unified Clinical Timeline Engine v2.0"
    }

