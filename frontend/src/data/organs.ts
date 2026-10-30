import { OrganType, Patient, PatientProgress } from '../types';

export type MetricStatus = 'normal' | 'watch' | 'alert';

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

const fmt = (n: number) => n.toLocaleString('en-US');

function heart(patient: Patient): OrganProfile {
  // Patient-specific demo values: Vance is on cardiotoxicity watch after Bu/Cy.
  const watch = patient.patient_id === 'PT-9042-BMT';
  return {
    organ: 'heart',
    title: 'Cardiac toxicity surveillance',
    rationale: 'High-dose cyclophosphamide and prior anthracyclines can cause acute cardiotoxicity in the first weeks after conditioning.',
    metrics: [
      {
        key: 'lvef', label: 'LV ejection fraction', value: watch ? '53' : '61', unit: '%', reference: '≥ 55%',
        status: watch ? 'watch' : 'normal',
        note: watch ? 'Down from 62% at pre-transplant echo' : 'Stable versus pre-transplant echo',
        pin: [0.5, 0.05, 0.85]
      },
      {
        key: 'troponin', label: 'hs-Troponin T', value: watch ? '18' : '9', unit: 'ng/L', reference: '< 14 ng/L',
        status: watch ? 'watch' : 'normal',
        note: watch ? 'Mild rise, repeat in 24 h' : 'No myocardial injury signal',
        pin: [-0.35, -0.75, 0.6]
      },
      {
        key: 'bnp', label: 'NT-proBNP', value: watch ? '410' : '98', unit: 'pg/mL', reference: '< 125 pg/mL',
        status: watch ? 'watch' : 'normal',
        note: watch ? 'Consistent with fluid load, trend daily' : 'No ventricular strain',
        pin: [-0.2, 0.9, 0.35]
      },
      {
        key: 'qtc', label: 'QTc interval', value: watch ? '452' : '428', unit: 'ms', reference: patient.gender === 'Female' ? '< 470 ms' : '< 450 ms',
        status: 'normal',
        note: 'Relevant with azole antifungal prophylaxis',
        pin: [0.7, -0.4, -0.5]
      }
    ]
  };
}

function liver(patient: Patient): OrganProfile {
  // Chen: haplo + reduced intensity, now Day +34 with rising bilirubin and ALT.
  const watch = patient.patient_id === 'PT-8104-BMT';
  return {
    organ: 'liver',
    title: 'Hepatic VOD/SOS & liver GvHD',
    rationale: 'Sinusoidal obstruction syndrome (EBMT criteria: bilirubin ≥ 2 mg/dL plus weight gain, painful hepatomegaly or ascites) and liver GvHD are leading early causes of transplant mortality.',
    metrics: [
      {
        key: 'bilirubin', label: 'Total bilirubin', value: watch ? '1.9' : '0.8', unit: 'mg/dL', reference: '< 1.2 mg/dL (VOD ≥ 2.0)',
        status: watch ? 'watch' : 'normal',
        note: watch ? 'Rising for 3 days, just below VOD threshold' : 'Within normal range',
        pin: [0.55, 0.35, 0.75]
      },
      {
        key: 'weight', label: 'Weight gain vs baseline', value: watch ? '+3.1' : '+1.2', unit: '%', reference: '< 5%',
        status: 'normal',
        note: 'No fluid retention signal',
        pin: [-0.75, 0.2, 0.55]
      },
      {
        key: 'alt', label: 'ALT', value: watch ? '88' : '32', unit: 'U/L', reference: '< 40 U/L',
        status: watch ? 'watch' : 'normal',
        note: watch ? 'Pattern compatible with early liver GvHD' : 'Enzymes stable',
        pin: [0.1, -0.6, 0.8]
      },
      {
        key: 'portal', label: 'Portal vein flow (Doppler)', value: 'Antegrade', reference: 'Antegrade',
        status: 'normal',
        note: 'No hepatofugal flow or ascites',
        pin: [-0.1, -0.3, -0.95]
      }
    ]
  };
}

function marrow(patient: Patient, progress: PatientProgress | null): OrganProfile {
  const s = progress?.clinical_summary;
  const anc = Number(s?.current_anc ?? NaN);
  const plt = Number(s?.current_plt ?? NaN);
  const hb = Number(s?.current_hb ?? NaN);
  const chim = patient.chimerism_donor_pct;
  const isAuto = patient.transplant_type.toLowerCase().includes('auto');

  return {
    organ: 'marrow',
    title: 'Marrow recovery & engraftment',
    rationale: 'Neutrophil engraftment (ANC ≥ 500/µL for 3 consecutive days) ends the highest-risk window for bacterial and fungal sepsis.',
    metrics: [
      {
        key: 'anc', label: 'Neutrophils (ANC)', value: isNaN(anc) ? '—' : fmt(anc), unit: 'cells/µL', reference: '≥ 500 cells/µL',
        status: isNaN(anc) ? 'watch' : anc < 100 ? 'alert' : anc < 500 ? 'watch' : 'normal',
        note: isNaN(anc) ? 'Awaiting lab draw' : anc < 100 ? 'Profound neutropenia, neutropenic precautions' : anc < 500 ? 'Rising toward engraftment threshold' : 'Neutrophil engraftment achieved',
        pin: [0.2, 0.85, 0.5]
      },
      {
        key: 'plt', label: 'Platelets', value: isNaN(plt) ? '—' : fmt(plt), unit: '/µL', reference: '≥ 20,000 /µL unsupported',
        status: isNaN(plt) ? 'watch' : plt < 10000 ? 'alert' : plt < 20000 ? 'watch' : 'normal',
        note: isNaN(plt) ? 'Awaiting lab draw' : plt < 10000 ? 'Below prophylactic transfusion trigger' : plt < 20000 ? 'Transfusion-dependent' : 'Transfusion-independent',
        pin: [-0.6, 0.1, 0.7]
      },
      {
        key: 'hb', label: 'Hemoglobin', value: isNaN(hb) ? '—' : hb.toFixed(1), unit: 'g/dL', reference: '≥ 8.0 g/dL',
        status: isNaN(hb) ? 'watch' : hb < 7 ? 'alert' : hb < 8 ? 'watch' : 'normal',
        note: isNaN(hb) ? 'Awaiting lab draw' : hb < 8 ? 'Consider red cell support' : 'No transfusion needed',
        pin: [0.55, -0.55, 0.55]
      },
      {
        key: 'chimerism', label: 'Donor chimerism', value: isAuto || chim == null ? 'N/A' : String(chim), unit: isAuto || chim == null ? undefined : '%', reference: '≥ 95% full donor',
        status: isAuto || chim == null ? 'normal' : chim < 90 ? 'alert' : chim < 95 ? 'watch' : 'normal',
        note: isAuto ? 'Autologous graft, not applicable' : chim != null && chim < 95 ? 'Mixed chimerism, repeat at Day +30' : 'Full donor hematopoiesis',
        pin: [-0.1, -0.9, -0.4]
      }
    ]
  };
}

function stem(patient: Patient): OrganProfile {
  const dose = patient.cell_dose_cd34;
  return {
    organ: 'stem',
    title: 'Stem cell graft quality',
    rationale: 'CD34+ cell dose, viability and HLA compatibility are the strongest pre-transplant predictors of timely engraftment.',
    metrics: [
      {
        key: 'cd34', label: 'CD34+ cell dose', value: dose != null ? dose.toFixed(1) : '—', unit: '×10⁶/kg', reference: '≥ 2.0 minimum, ≥ 4.0 optimal',
        status: dose == null ? 'watch' : dose < 2 ? 'alert' : dose < 4 ? 'watch' : 'normal',
        note: dose != null && dose >= 4 ? 'Optimal dose, supports early engraftment' : 'Low dose, higher risk of delayed engraftment',
        pin: [0.1, 0.95, 0.3]
      },
      {
        key: 'viability', label: 'Graft viability (7-AAD)', value: '97.8', unit: '%', reference: '≥ 70%',
        status: 'normal',
        note: 'Post-thaw viability check passed',
        pin: [0.85, 0.1, 0.5]
      },
      {
        key: 'hla', label: 'HLA match', value: patient.hla_match ?? '—', reference: '10/10 preferred',
        status: (patient.hla_match ?? '').toLowerCase().includes('haplo') ? 'watch' : 'normal',
        note: (patient.hla_match ?? '').toLowerCase().includes('haplo') ? 'Haploidentical, PTCy GvHD prophylaxis' : 'Fully matched or autologous',
        pin: [-0.75, -0.35, 0.55]
      },
      {
        key: 'cmv', label: 'CMV serostatus', value: (patient.cmv_status ?? '—').split(' (')[0], reference: 'D-/R- lowest risk',
        status: (patient.cmv_status ?? '').includes('High') ? 'watch' : 'normal',
        note: (patient.cmv_status ?? '').includes('High') ? 'Letermovir prophylaxis and weekly PCR' : 'Standard CMV monitoring',
        pin: [0.15, -0.7, -0.7]
      }
    ]
  };
}

export function organProfile(organ: OrganType, patient: Patient, progress: PatientProgress | null): OrganProfile {
  switch (organ) {
    case 'heart': return heart(patient);
    case 'liver': return liver(patient);
    case 'stem': return stem(patient);
    case 'marrow':
    default: return marrow(patient, progress);
  }
}

export const STATUS_LABEL: Record<MetricStatus, string> = {
  normal: 'In range',
  watch: 'Watch',
  alert: 'Act now'
};
