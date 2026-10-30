import { OrganType, Patient } from '../types';

/**
 * Synthetic demonstration cohort. The backend has no organ metadata yet, so the
 * frontend owns it; API patients are merged with these records by patient_id.
 * All "Day +N" values are computed against a fixed reference date so the demo
 * story stays internally consistent no matter when the site is opened.
 */
export const COHORT_REFERENCE_DATE = '2026-10-30';

export const COHORT_PATIENTS: Patient[] = [
  {
    patient_id: 'PT-9042-BMT',
    name: 'Eleanora Vance',
    age: 42,
    gender: 'Female',
    disease: 'Acute Myeloid Leukemia (AML)',
    transplant_type: 'Allogeneic HSCT',
    donor_type: '10/10 Matched Unrelated Donor',
    transplant_date: '2026-10-14',
    conditioning: 'Bu/Cy Myeloablative',
    cell_dose_cd34: 6.4,
    chimerism_donor_pct: 98.4,
    cmv_status: 'D+/R- (High Risk)',
    hla_match: '10/10',
    status: 'Engraftment Impending',
    created_at: '2026-10-14T08:00:00Z',
    primary_organ_type: 'heart',
    organ_label: 'Heart',
    organ_diagnosis: 'Cyclophosphamide cardiotoxicity surveillance'
  },
  {
    patient_id: 'PT-8104-BMT',
    name: 'Marcus Chen',
    age: 58,
    gender: 'Male',
    disease: 'Myelodysplastic Syndrome (MDS-EB2)',
    transplant_type: 'Allogeneic HSCT',
    donor_type: 'Haploidentical Related Donor',
    transplant_date: '2026-09-26',
    conditioning: 'Flu/Mel Reduced Intensity',
    cell_dose_cd34: 5.2,
    chimerism_donor_pct: 99.8,
    cmv_status: 'D+/R+ (Reactivated, Treated)',
    hla_match: '5/10 Haplo',
    status: 'Engrafted - Stable Outpatient',
    created_at: '2026-09-26T08:00:00Z',
    primary_organ_type: 'liver',
    organ_label: 'Liver',
    organ_diagnosis: 'Hepatic VOD/SOS and liver GvHD surveillance'
  },
  {
    patient_id: 'PT-4421-BMT',
    name: 'Sarah Jenkins',
    age: 29,
    gender: 'Female',
    disease: 'B-Cell Acute Lymphoblastic Leukemia (B-ALL)',
    transplant_type: 'Allogeneic HSCT',
    donor_type: 'Matched Sibling Donor',
    transplant_date: '2026-10-23',
    conditioning: 'TBI/Cy Myeloablative',
    cell_dose_cd34: 7.1,
    chimerism_donor_pct: 92.0,
    cmv_status: 'D-/R- (Low Risk)',
    hla_match: '10/10',
    status: 'Aplastic Nadir - Protective Isolation',
    created_at: '2026-10-23T08:00:00Z',
    primary_organ_type: 'marrow',
    organ_label: 'Bone Marrow',
    organ_diagnosis: 'Marrow aplasia and engraftment kinetics'
  },
  {
    patient_id: 'PT-7730-BMT',
    name: 'David Morales',
    age: 51,
    gender: 'Male',
    disease: 'Multiple Myeloma (High-Risk IgA)',
    transplant_type: 'Autologous PBSCT',
    donor_type: 'Autologous Mobilized Harvest',
    transplant_date: '2026-10-26',
    conditioning: 'High-Dose Melphalan 200 mg/m²',
    cell_dose_cd34: 8.6,
    chimerism_donor_pct: undefined,
    cmv_status: 'R- (Low Risk)',
    hla_match: 'Autologous',
    status: 'Post-Reinfusion - Pre-Engraftment',
    created_at: '2026-10-26T08:00:00Z',
    primary_organ_type: 'stem',
    organ_label: 'Stem Cell Graft',
    organ_diagnosis: 'CD34+ graft dose and homing'
  }
];

/** Expected ANC (≥500/µL) and platelet (≥20k/µL) engraftment days used by the offline trajectory model. */
export const ENGRAFTMENT_PROFILE: Record<string, { ancDay: number; pltDay: number }> = {
  'PT-9042-BMT': { ancDay: 17, pltDay: 21 },
  'PT-8104-BMT': { ancDay: 18, pltDay: 26 },
  'PT-4421-BMT': { ancDay: 16, pltDay: 20 },
  'PT-7730-BMT': { ancDay: 11, pltDay: 13 }
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysPostTransplant(patient: Pick<Patient, 'transplant_date'>, asOf = COHORT_REFERENCE_DATE): number {
  return Math.round((Date.parse(asOf) - Date.parse(patient.transplant_date)) / DAY_MS);
}

/** Fill in organ metadata for patients returned by the API. Unknown patients default to bone marrow. */
export function withCohortMetadata(patient: Patient): Patient {
  const known = COHORT_PATIENTS.find(p => p.patient_id === patient.patient_id);
  if (known) return { ...known, ...patient, primary_organ_type: known.primary_organ_type, organ_label: known.organ_label, organ_diagnosis: known.organ_diagnosis };
  return {
    ...patient,
    primary_organ_type: patient.primary_organ_type ?? 'marrow',
    organ_label: patient.organ_label ?? 'Bone Marrow',
    organ_diagnosis: patient.organ_diagnosis ?? 'Engraftment kinetics'
  };
}

export const ORGAN_LABELS: Record<OrganType, string> = {
  heart: 'Heart',
  liver: 'Liver',
  marrow: 'Bone Marrow',
  stem: 'Stem Cell Graft'
};
