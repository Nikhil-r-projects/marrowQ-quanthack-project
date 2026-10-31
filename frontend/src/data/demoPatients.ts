import { Patient, PatientProgress, ClinicalObservation } from '../types';

export const DEMO_PATIENTS: Patient[] = [
  {
    patient_id: 'PT-1001',
    name: 'Elena Rostova',
    age: 48,
    gender: 'Female',
    disease: 'AML (Acute Myeloid Leukemia)',
    transplant_type: 'Allogeneic PBSC',
    donor_type: '10/10 Matched Unrelated Donor (MUD)',
    transplant_date: '2026-09-15',
    conditioning: 'Flu/Bu4 (Fludarabine + Busulfan)',
    cell_dose_cd34: 6.8,
    chimerism_donor_pct: 99.2,
    current_anc: 2450,
    current_plt: 112000,
    cmv_status: 'D+/R+',
    hla_match: '10/10',
    status: 'Engrafted · Stable Recovery',
    created_at: '2026-09-01T08:00:00Z',
    source: 'example',
    pretransplant: {
      karnofsky: 90,
      hct_ci: 1,
      cmv_donor: 'Positive',
      cmv_recipient: 'Positive',
      marrow_blasts_pct: 3.5,
    }
  },
  {
    patient_id: 'PT-1002',
    name: 'Marcus Holloway',
    age: 54,
    gender: 'Male',
    disease: 'MDS (Myelodysplastic Syndrome)',
    transplant_type: 'Allogeneic Bone Marrow',
    donor_type: '12/12 Matched Sibling',
    transplant_date: '2026-10-01',
    conditioning: 'RIC (Fludarabine + Melphalan)',
    cell_dose_cd34: 4.2,
    chimerism_donor_pct: 95.0,
    current_anc: 1850,
    current_plt: 68000,
    cmv_status: 'D-/R-',
    hla_match: '12/12',
    status: 'Engrafted · Low-Grade Rash',
    created_at: '2026-09-15T09:30:00Z',
    source: 'example',
    pretransplant: {
      karnofsky: 80,
      hct_ci: 2,
      cmv_donor: 'Negative',
      cmv_recipient: 'Negative',
      marrow_blasts_pct: 4.2,
    }
  },
  {
    patient_id: 'PT-1003',
    name: 'Aisha Al-Mansoor',
    age: 32,
    gender: 'Female',
    disease: 'Severe Aplastic Anemia (SAA)',
    transplant_type: 'Allogeneic PBSC',
    donor_type: '9/10 Mismatched Unrelated Donor',
    transplant_date: '2026-10-10',
    conditioning: 'Cy/ATG (Cyclophosphamide + ATG)',
    cell_dose_cd34: 5.5,
    chimerism_donor_pct: 88.4,
    current_anc: 420,
    current_plt: 18500,
    cmv_status: 'D-/R+',
    hla_match: '9/10',
    status: 'Day +21 · Engraftment Pending',
    created_at: '2026-09-25T11:00:00Z',
    source: 'example',
    pretransplant: {
      karnofsky: 70,
      hct_ci: 0,
      cmv_donor: 'Negative',
      cmv_recipient: 'Positive',
      cellularity_pct: 10,
    }
  },
  {
    patient_id: 'PT-1004',
    name: 'David Chen',
    age: 61,
    gender: 'Male',
    disease: 'Multiple Myeloma',
    transplant_type: 'Autologous PBSC',
    donor_type: 'Autologous',
    transplant_date: '2026-10-18',
    conditioning: 'High-Dose Melphalan 200mg/m2',
    cell_dose_cd34: 8.1,
    chimerism_donor_pct: 100.0,
    current_anc: 950,
    current_plt: 45000,
    cmv_status: 'D+/R+',
    hla_match: 'Autologous',
    status: 'Day +13 · Early Recovery',
    created_at: '2026-10-05T14:15:00Z',
    source: 'example',
    pretransplant: {
      karnofsky: 90,
      hct_ci: 1,
      iss_stage: 2,
    }
  }
];

export function getDemoProgress(patient: Patient): PatientProgress {
  const days = [
    { day: -6, anc: 4200, plt: 185000, hb: 12.8, wbc: 5.8 },
    { day: -3, anc: 1900, plt: 120000, hb: 11.2, wbc: 2.9 },
    { day: 0, anc: 450, plt: 48000, hb: 9.8, wbc: 0.9 },
    { day: 3, anc: 80, plt: 22000, hb: 8.9, wbc: 0.2 },
    { day: 7, anc: 30, plt: 15000, hb: 8.1, wbc: 0.1 },
    { day: 11, anc: 120, plt: 18000, hb: 8.4, wbc: 0.3 },
    { day: 14, anc: 480, plt: 24000, hb: 8.7, wbc: 1.1 },
    { day: 16, anc: 890, plt: 36000, hb: 9.2, wbc: 1.8 },
    { day: 20, anc: 1850, plt: 72000, hb: 9.9, wbc: 3.4 },
    { day: 28, anc: 2450, plt: 112000, hb: 10.6, wbc: 4.8 },
  ];

  return {
    patient_id: patient.patient_id,
    patient_name: patient.name,
    transplant_date: patient.transplant_date,
    latest_observed_day: 28,
    expected_anc_engraft_day: 15,
    expected_plt_engraft_day: 19,
    is_anc_engrafted: true,
    is_plt_engrafted: true,
    timeline_series: days.map(d => {
      const ancPred = Math.round(5000 / (1 + Math.exp(-0.35 * (d.day - 14))));
      const pltPred = Math.round(150000 / (1 + Math.exp(-0.25 * (d.day - 18))));
      return {
        day: d.day,
        is_observed: true,
        anc_observed: d.anc,
        anc_predicted: ancPred,
        anc_lower_95: Math.max(0, Math.round(ancPred * 0.75)),
        anc_upper_95: Math.round(ancPred * 1.25),
        plt_observed: d.plt,
        plt_predicted: pltPred,
        plt_lower_95: Math.max(0, Math.round(pltPred * 0.75)),
        plt_upper_95: Math.round(pltPred * 1.25),
        hb_observed: d.hb,
        wbc_observed: d.wbc,
      };
    }),
    milestones: [
      { id: 'm1', name: 'Stem Cell Infusion (Day 0)', target_day: 0, actual_day: 0, status: 'COMPLETED', notes: 'PBSC infused without adverse reaction.' },
      { id: 'm2', name: 'Nadir Recovery Start', target_day: 10, actual_day: 11, status: 'COMPLETED', notes: 'ANC began steady rise above 100.' },
      { id: 'm3', name: 'Neutrophil Engraftment (ANC ≥ 500)', target_day: 15, actual_day: 15, status: 'COMPLETED', notes: 'Verified over 3 consecutive draws.' },
      { id: 'm4', name: 'Platelet Independence (Plt ≥ 20k)', target_day: 19, actual_day: 16, status: 'COMPLETED', notes: 'Transfusion independent > 7 days.' },
      { id: 'm5', name: 'Day +30 Chimerism Assessment', target_day: 30, status: 'PROJECTED', forecast_interval: 'Day +28 to +32', notes: 'Bone marrow aspirate and donor STR chimerism.' },
      { id: 'm6', name: 'Day +100 Immune Reconstitution', target_day: 100, status: 'PROJECTED', forecast_interval: 'Target Day +100', notes: 'Comprehensive CD4/CD8 flow panel.' },
    ],
    clinical_summary: {
      current_anc: patient.current_anc ?? 2450,
      current_plt: patient.current_plt ?? 112000,
      current_hb: 10.6,
      current_wbc: 4.8,
      velocity: 'Rising',
      status_description: 'Hematopoietic engraftment confirmed. Robust trilineage reconstitution.',
    }
  };
}

export function getDemoObservations(patientId: string): ClinicalObservation[] {
  return [
    { id: 1, patient_id: patientId, day_post_tx: 28, recorded_date: '2026-10-13', metric_type: 'Neutrophil count (ANC)', value: 2450, unit: 'cells/µL', source: 'Automated CBC', recorded_by: 'Lab Core', status: 'verified' },
    { id: 2, patient_id: patientId, day_post_tx: 28, recorded_date: '2026-10-13', metric_type: 'Platelet count', value: 112000, unit: '/µL', source: 'Automated CBC', recorded_by: 'Lab Core', status: 'verified' },
    { id: 3, patient_id: patientId, day_post_tx: 28, recorded_date: '2026-10-13', metric_type: 'Hemoglobin', value: 10.6, unit: 'g/dL', source: 'Automated CBC', recorded_by: 'Lab Core', status: 'verified' },
    { id: 4, patient_id: patientId, day_post_tx: 28, recorded_date: '2026-10-13', metric_type: 'White blood cells (WBC)', value: 4.8, unit: '×10³/µL', source: 'Automated CBC', recorded_by: 'Lab Core', status: 'verified' },
  ];
}
