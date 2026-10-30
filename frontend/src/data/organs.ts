import { ClinicalObservation, OrganType, Patient } from '../types';
import { LatestReading, OBSERVATION_TYPES, ObservationKey, latestReadings } from './observations';

/** 'missing' = nothing recorded yet; never shown as abnormal. */
export type MetricStatus = 'normal' | 'watch' | 'alert' | 'missing';

export interface OrganMetric {
  key: string;
  label: string;
  value: string;
  unit?: string;
  reference: string;
  status: MetricStatus;
  note: string;
  /** Direction from the model centre; the viewer ray-casts along it to place the pin on the surface. */
  pin: [number, number, number];
}

export interface OrganProfile {
  organ: OrganType;
  title: string;
  /** Why this organ is monitored after HSCT. */
  rationale: string;
  metrics: OrganMetric[];
}

export const ORGAN_LABELS: Record<OrganType, string> = {
  heart: 'Heart',
  liver: 'Liver',
  marrow: 'Bone marrow',
  stem: 'Stem-cell graft'
};

export const STATUS_LABEL: Record<MetricStatus, string> = {
  normal: 'In range',
  watch: 'Watch',
  alert: 'Act now',
  missing: 'No data'
};

type Grade = (v: number) => { status: Exclude<MetricStatus, 'missing'>; note: string };

interface MetricSpec {
  key: ObservationKey;
  label?: string;
  reference: string;
  grade: Grade;
  pin: [number, number, number];
}

function fromReading(spec: MetricSpec, reading: LatestReading | undefined): OrganMetric {
  const type = OBSERVATION_TYPES[spec.key];
  const base = { key: spec.key, label: spec.label ?? type.label, unit: type.unit, reference: spec.reference, pin: spec.pin };
  if (!reading) return { ...base, value: '—', status: 'missing', note: 'No reading recorded yet. Use Record lab result on the recovery tracker.' };
  const { status, note } = spec.grade(reading.value);
  const value = reading.value.toLocaleString('en-US', { minimumFractionDigits: type.digits, maximumFractionDigits: type.digits });
  return { ...base, value, status, note: `${note} (Day ${reading.day >= 0 ? '+' : ''}${reading.day}).` };
}

// Thresholds follow standard post-HSCT monitoring criteria named in each reference.
const MARROW: MetricSpec[] = [
  {
    key: 'anc', label: 'Neutrophils (ANC)', reference: '≥ 500 cells/µL', pin: [0.2, 0.85, 0.5],
    grade: v => v < 100 ? { status: 'alert', note: 'Profound neutropenia: neutropenic precautions' }
      : v < 500 ? { status: 'watch', note: 'Below the engraftment threshold' }
      : { status: 'normal', note: 'At or above the engraftment threshold' }
  },
  {
    key: 'plt', label: 'Platelets', reference: '≥ 20,000 /µL unsupported', pin: [-0.6, 0.1, 0.7],
    grade: v => v < 10000 ? { status: 'alert', note: 'Below the prophylactic transfusion trigger' }
      : v < 20000 ? { status: 'watch', note: 'Below the platelet engraftment threshold' }
      : { status: 'normal', note: 'Above the platelet engraftment threshold' }
  },
  {
    key: 'hb', reference: '≥ 8.0 g/dL', pin: [0.55, -0.55, 0.55],
    grade: v => v < 7 ? { status: 'alert', note: 'Below the red-cell transfusion trigger' }
      : v < 8 ? { status: 'watch', note: 'Approaching the transfusion trigger' }
      : { status: 'normal', note: 'Above the transfusion trigger' }
  },
  {
    key: 'chimerism', reference: '≥ 95% full donor', pin: [-0.1, -0.9, -0.4],
    grade: v => v < 90 ? { status: 'alert', note: 'Mixed chimerism: risk of graft loss or relapse' }
      : v < 95 ? { status: 'watch', note: 'Mixed chimerism: repeat testing advised' }
      : { status: 'normal', note: 'Full donor haematopoiesis' }
  }
];

const HEART: MetricSpec[] = [
  {
    key: 'lvef', reference: '≥ 55%', pin: [0.5, 0.05, 0.85],
    grade: v => v < 40 ? { status: 'alert', note: 'Reduced ejection fraction' }
      : v < 55 ? { status: 'watch', note: 'Below the normal range' }
      : { status: 'normal', note: 'Normal systolic function' }
  },
  {
    key: 'troponin', reference: '< 14 ng/L', pin: [-0.35, -0.75, 0.6],
    grade: v => v >= 52 ? { status: 'alert', note: 'Marked rise: myocardial injury likely' }
      : v >= 14 ? { status: 'watch', note: 'Above the 99th percentile upper limit' }
      : { status: 'normal', note: 'No myocardial injury signal' }
  },
  {
    key: 'ntprobnp', reference: '< 125 pg/mL', pin: [-0.2, 0.9, 0.35],
    grade: v => v >= 900 ? { status: 'alert', note: 'Markedly raised: assess for heart failure (cut-offs are age-dependent)' }
      : v >= 125 ? { status: 'watch', note: 'Raised: ventricular strain or fluid load' }
      : { status: 'normal', note: 'No ventricular strain' }
  },
  {
    key: 'qtc', reference: '< 470 ms', pin: [0.7, -0.4, -0.5],
    grade: v => v >= 500 ? { status: 'alert', note: 'High arrhythmia risk: review QT-prolonging drugs' }
      : v >= 470 ? { status: 'watch', note: 'Prolonged: relevant with azole prophylaxis' }
      : { status: 'normal', note: 'Normal corrected QT' }
  }
];

const LIVER: MetricSpec[] = [
  {
    key: 'bilirubin', reference: '< 1.2 mg/dL (VOD criterion ≥ 2.0)', pin: [0.55, 0.35, 0.75],
    grade: v => v >= 2 ? { status: 'alert', note: 'Meets the bilirubin criterion for VOD/SOS (EBMT)' }
      : v >= 1.2 ? { status: 'watch', note: 'Raised, below the VOD/SOS criterion' }
      : { status: 'normal', note: 'Within normal range' }
  },
  {
    key: 'alt', reference: '< 40 U/L', pin: [0.1, -0.6, 0.8],
    grade: v => v >= 200 ? { status: 'alert', note: 'Marked hepatocellular injury' }
      : v >= 40 ? { status: 'watch', note: 'Raised transaminase' }
      : { status: 'normal', note: 'Within normal range' }
  },
  {
    key: 'ast', reference: '< 40 U/L', pin: [-0.1, -0.3, -0.95],
    grade: v => v >= 200 ? { status: 'alert', note: 'Marked hepatocellular injury' }
      : v >= 40 ? { status: 'watch', note: 'Raised transaminase' }
      : { status: 'normal', note: 'Within normal range' }
  }
];

/** Weight gain against the pre-transplant body mass recorded at intake (EBMT VOD/SOS criterion: > 5%). */
function weightGain(patient: Patient, reading: LatestReading | undefined): OrganMetric {
  const base = { key: 'weight_gain', label: 'Weight gain vs baseline', unit: '%', reference: '< 5% (VOD criterion)', pin: [-0.75, 0.2, 0.55] as [number, number, number] };
  const baseline = Number(patient.pretransplant?.recipient_body_mass);
  if (!baseline) return { ...base, value: '—', status: 'missing', note: 'Needs the pre-transplant body mass from intake.' };
  if (!reading) return { ...base, value: '—', status: 'missing', note: `No body weight recorded yet (baseline ${baseline} kg).` };
  const pct = ((reading.value - baseline) / baseline) * 100;
  const status = pct > 5 ? 'alert' : pct > 2.5 ? 'watch' : 'normal';
  const note = pct > 5 ? 'Exceeds the VOD/SOS weight-gain criterion' : pct > 2.5 ? 'Rising: check fluid balance' : 'No significant fluid retention';
  return { ...base, value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}`, status, note: `${note} (${reading.value} kg vs ${baseline} kg, Day +${reading.day}).` };
}

/** The graft is described by the patient's own pre-transplant record, not by lab draws. */
function graftMetrics(patient: Patient): OrganMetric[] {
  const p = patient.pretransplant ?? {};
  const cd34 = Number(p.cd34_dose ?? patient.cell_dose_cd34);
  const cd3 = p.cd3_dose != null ? Number(p.cd3_dose) : NaN;
  const hla = String(p.hla_match ?? patient.hla_match ?? '');
  const missing = (key: string, label: string, reference: string, pin: [number, number, number], unit?: string): OrganMetric =>
    ({ key, label, unit, reference, pin, value: '—', status: 'missing', note: 'Not recorded at intake.' });
  return [
    Number.isFinite(cd34)
      ? {
        key: 'cd34', label: 'CD34+ cell dose', value: cd34.toFixed(2), unit: '×10⁶/kg', reference: '≥ 2 minimum, ≥ 4 optimal', pin: [0.1, 0.95, 0.3],
        status: cd34 < 2 ? 'alert' : cd34 < 4 ? 'watch' : 'normal',
        note: cd34 < 2 ? 'Below the minimum dose: high risk of delayed engraftment' : cd34 < 4 ? 'Adequate, below the optimal dose' : 'Optimal dose: associated with faster neutrophil recovery'
      }
      : missing('cd34', 'CD34+ cell dose', '≥ 2 minimum, ≥ 4 optimal', [0.1, 0.95, 0.3], '×10⁶/kg'),
    Number.isFinite(cd3)
      ? { key: 'cd3', label: 'CD3+ cell dose', value: cd3.toFixed(2), unit: '×10⁸/kg', reference: 'Higher T-cell content raises GvHD risk', pin: [0.85, 0.1, 0.5], status: 'normal', note: 'T-cell content of the graft, from the collection report.' }
      : missing('cd3', 'CD3+ cell dose', 'Higher T-cell content raises GvHD risk', [0.85, 0.1, 0.5], '×10⁸/kg'),
    hla
      ? {
        key: 'hla', label: 'HLA match', value: hla, reference: '10/10 preferred', pin: [-0.75, -0.35, 0.55],
        status: hla === '10/10' ? 'normal' : 'watch',
        note: hla === '10/10' ? 'Fully matched at 10 loci' : 'HLA-mismatched donor: higher GvHD and graft-failure risk'
      }
      : missing('hla', 'HLA match', '10/10 preferred', [-0.75, -0.35, 0.55]),
    {
      key: 'cmv', label: 'CMV serostatus (donor/recipient)', value: patient.cmv_status ?? '—', reference: 'D−/R− lowest risk', pin: [0.15, -0.7, -0.7],
      status: !patient.cmv_status || patient.cmv_status.includes('?') ? 'missing' : patient.cmv_status.includes('R+') ? 'watch' : 'normal',
      note: patient.cmv_status?.includes('R+') ? 'Seropositive recipient: CMV reactivation surveillance' : 'Standard CMV monitoring'
    }
  ];
}

export function organProfile(organ: OrganType, patient: Patient, observations: ClinicalObservation[]): OrganProfile {
  const latest = latestReadings(observations);
  switch (organ) {
    case 'heart':
      return {
        organ, title: 'Cardiac toxicity surveillance',
        rationale: 'High-dose cyclophosphamide and prior anthracyclines can cause acute cardiotoxicity in the first weeks after conditioning.',
        metrics: HEART.map(s => fromReading(s, latest[s.key]))
      };
    case 'liver':
      return {
        organ, title: 'Hepatic VOD/SOS & liver GvHD',
        rationale: 'Sinusoidal obstruction syndrome (EBMT criteria: bilirubin ≥ 2 mg/dL plus weight gain, painful hepatomegaly or ascites) and liver GvHD are leading early causes of transplant mortality.',
        metrics: [...LIVER.map(s => fromReading(s, latest[s.key])), weightGain(patient, latest.weight)]
      };
    case 'stem':
      return {
        organ, title: 'Stem-cell graft',
        rationale: 'CD34+ cell dose and HLA compatibility are the strongest pre-transplant predictors of timely engraftment; in the UCI cohort, log CD34+ dose correlates with recovery day at r = −0.49.',
        metrics: graftMetrics(patient)
      };
    case 'marrow':
    default:
      return {
        organ: 'marrow', title: 'Marrow recovery & engraftment',
        rationale: 'Neutrophil engraftment (ANC ≥ 500/µL for 3 consecutive days) ends the highest-risk window for bacterial and fungal sepsis.',
        metrics: MARROW.map(s => fromReading(s, latest[s.key]))
      };
  }
}

export const ORGANS: OrganType[] = ['marrow', 'stem', 'heart', 'liver'];

/** Out-of-range lab readings across monitored organs, for alerts and triage. Graft characteristics
 *  (dose, HLA) are fixed at Day 0 and shown on the organ view rather than raised as alerts. */
export function abnormalMetrics(patient: Patient, observations: ClinicalObservation[]) {
  return ORGANS.filter(o => o !== 'stem').flatMap(o => organProfile(o, patient, observations).metrics
    .filter(m => m.status === 'watch' || m.status === 'alert')
    .map(m => ({ organ: o, ...m })));
}
