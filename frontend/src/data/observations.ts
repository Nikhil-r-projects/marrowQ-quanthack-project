import { ClinicalObservation, Patient } from '../types';

/**
 * Every measurement a clinician can record. `label` is the metric_type stored by the backend
 * (trajectory.py matches ANC, platelets, Hb and WBC by these names); LOINC codes identify the
 * test for later FHIR import. Limits reject typing errors, not abnormal results.
 */
export interface ObservationType {
  label: string;
  unit: string;
  loinc?: string;
  min: number;
  max: number;
  digits: number;
  group: 'Blood counts' | 'Graft' | 'Cardiac' | 'Hepatic' | 'Vitals';
}

export const OBSERVATION_TYPES = {
  anc: { label: 'Absolute Neutrophil Count (ANC)', unit: 'cells/μL', loinc: '751-8', min: 0, max: 40000, digits: 0, group: 'Blood counts' },
  plt: { label: 'Platelets', unit: '/μL', loinc: '777-3', min: 0, max: 1500000, digits: 0, group: 'Blood counts' },
  hb: { label: 'Hemoglobin', unit: 'g/dL', loinc: '718-7', min: 2, max: 25, digits: 1, group: 'Blood counts' },
  wbc: { label: 'White Blood Cells (WBC)', unit: 'x10^3/μL', loinc: '6690-2', min: 0, max: 200, digits: 1, group: 'Blood counts' },
  chimerism: { label: 'Donor chimerism', unit: '%', min: 0, max: 100, digits: 0, group: 'Graft' },
  lvef: { label: 'LV ejection fraction', unit: '%', loinc: '10230-1', min: 5, max: 90, digits: 0, group: 'Cardiac' },
  troponin: { label: 'hs-Troponin T', unit: 'ng/L', loinc: '67151-1', min: 0, max: 10000, digits: 0, group: 'Cardiac' },
  ntprobnp: { label: 'NT-proBNP', unit: 'pg/mL', loinc: '33762-6', min: 0, max: 70000, digits: 0, group: 'Cardiac' },
  qtc: { label: 'QTc interval', unit: 'ms', loinc: '8636-3', min: 250, max: 700, digits: 0, group: 'Cardiac' },
  bilirubin: { label: 'Total bilirubin', unit: 'mg/dL', loinc: '1975-2', min: 0, max: 60, digits: 1, group: 'Hepatic' },
  alt: { label: 'ALT', unit: 'U/L', loinc: '1742-6', min: 0, max: 10000, digits: 0, group: 'Hepatic' },
  ast: { label: 'AST', unit: 'U/L', loinc: '1920-8', min: 0, max: 10000, digits: 0, group: 'Hepatic' },
  weight: { label: 'Body weight', unit: 'kg', loinc: '29463-7', min: 1, max: 250, digits: 1, group: 'Vitals' }
} as const satisfies Record<string, ObservationType>;

export type ObservationKey = keyof typeof OBSERVATION_TYPES;

/** Window event dispatched after a lab result is saved so alerts refresh without a page reload. */
export const OBSERVATIONS_CHANGED = 'marrowq:observations-changed';

export interface LatestReading {
  value: number;
  day: number;
  date: string;
}

/** Most recent value per observation type (latest Day post-transplant wins). */
export function latestReadings(observations: ClinicalObservation[]): Partial<Record<ObservationKey, LatestReading>> {
  const byLabel = new Map<string, ObservationKey>(
    (Object.keys(OBSERVATION_TYPES) as ObservationKey[]).map(k => [OBSERVATION_TYPES[k].label, k])
  );
  const out: Partial<Record<ObservationKey, LatestReading>> = {};
  for (const o of observations) {
    const key = byLabel.get(o.metric_type);
    if (!key) continue;
    const prev = out[key];
    if (!prev || o.day_post_tx >= prev.day) out[key] = { value: o.value, day: o.day_post_tx, date: o.recorded_date };
  }
  return out;
}

const DAY_MS = 86_400_000;

/** Whole days since stem-cell infusion (Day 0), against today's local date. */
export function daysPostTransplant(patient: Pick<Patient, 'transplant_date'>, today = new Date()): number {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [y, m, d] = patient.transplant_date.slice(0, 10).split('-').map(Number);
  return Math.round((t - new Date(y, m - 1, d).getTime()) / DAY_MS);
}
