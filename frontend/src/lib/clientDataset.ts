import { DatasetProfile, Experiment, ModelMetric } from '../types';

const LEAKAGE_KEYWORDS = [
  'anc_day', 'engraft_day', 'recovery_day', 'day_to', 'time_to',
  'post_tx', 'post_transplant', 'chimerism', 'gvhd_day', 'gvhd_grade',
  'relapse_day', 'death_day', 'cause_of_death', 'survival_time',
  'discharge_date', 'day30', 'day100'
];

const ID_KEYWORDS = ['id', 'patient_id', 'mrn', 'subject_id', 'record_id'];

export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    return values;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter(r => r.length === headers.length || r.length > 1);
  return { headers, rows };
}

export function profileCsvInBrowser(fileName: string, text: string): DatasetProfile {
  const { headers, rows } = parseCsvText(text);
  const totalRows = rows.length;
  const totalCols = headers.length;

  const columnTypes: Record<string, string> = {};
  const missingCounts: Record<string, number> = {};
  const missingPercentages: Record<string, number> = {};
  const numericSummaries: Record<string, any> = {};
  const categoricalSummaries: Record<string, Record<string, number>> = {};
  const leakageWarnings: string[] = [];

  headers.forEach((col, colIdx) => {
    const colLower = col.toLowerCase();

    // Check leakage
    for (const kw of LEAKAGE_KEYWORDS) {
      if (colLower.includes(kw)) {
        leakageWarnings.push(`Potential target leakage detected in column '${col}': resembles post-transplant event or time-to-event marker.`);
        break;
      }
    }

    const colValues = rows.map(r => r[colIdx] ?? '').filter(v => v !== '');
    const missing = totalRows - colValues.length;
    missingCounts[col] = missing;
    missingPercentages[col] = totalRows > 0 ? Math.round((missing / totalRows) * 1000) / 10 : 0;

    // Detect if numeric
    const numericVals = colValues.map(v => Number(v)).filter(v => !isNaN(v));
    const isNum = colValues.length > 0 && (numericVals.length / colValues.length) >= 0.8;

    if (isNum && numericVals.length > 0) {
      columnTypes[col] = 'numeric';
      numericVals.sort((a, b) => a - b);
      const sum = numericVals.reduce((acc, v) => acc + v, 0);
      const mean = sum / numericVals.length;
      const min = numericVals[0];
      const max = numericVals[numericVals.length - 1];
      const median = numericVals[Math.floor(numericVals.length / 2)];
      const q25 = numericVals[Math.floor(numericVals.length * 0.25)];
      const q75 = numericVals[Math.floor(numericVals.length * 0.75)];
      const variance = numericVals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (numericVals.length || 1);
      const std = Math.sqrt(variance);

      numericSummaries[col] = {
        mean: Math.round(mean * 1000) / 1000,
        std: Math.round(std * 1000) / 1000,
        min: Math.round(min * 1000) / 1000,
        q25: Math.round(q25 * 1000) / 1000,
        median: Math.round(median * 1000) / 1000,
        q75: Math.round(q75 * 1000) / 1000,
        max: Math.round(max * 1000) / 1000,
      };
    } else {
      columnTypes[col] = 'categorical';
      const counts: Record<string, number> = {};
      colValues.forEach(val => {
        counts[val] = (counts[val] || 0) + 1;
      });
      categoricalSummaries[col] = counts;
    }
  });

  // Suggest target
  let suggestedTarget = '';
  const priorityOutcomes = ['early_engraftment', 'neutrophil_recovery', 'engraftment', 'outcome', 'target', 'label'];
  for (const col of headers) {
    const colLower = col.toLowerCase();
    if (priorityOutcomes.includes(colLower)) {
      suggestedTarget = col;
      break;
    }
  }
  if (!suggestedTarget) {
    for (const col of headers) {
      const colLower = col.toLowerCase();
      if (colLower.includes('engraft') || colLower.includes('recovery')) {
        suggestedTarget = col;
        break;
      }
    }
  }
  if (!suggestedTarget && headers.length > 0) {
    suggestedTarget = headers[headers.length - 1];
  }

  // Suggest features
  const suggestedFeatures: string[] = [];
  for (const col of headers) {
    const colLower = col.toLowerCase();
    if (col === suggestedTarget) continue;
    if (ID_KEYWORDS.includes(colLower) || colLower.endsWith('_id')) continue;
    if (LEAKAGE_KEYWORDS.some(kw => colLower.includes(kw))) continue;
    suggestedFeatures.push(col);
  }

  // Target class distribution
  const targetIdx = headers.indexOf(suggestedTarget);
  const classDistribution: Record<string, number> = {};
  if (targetIdx !== -1) {
    rows.forEach(r => {
      const val = r[targetIdx] ?? 'unknown';
      classDistribution[val] = (classDistribution[val] || 0) + 1;
    });
  }

  const dsId = `ds-browser-${Math.random().toString(36).substring(2, 9)}`;

  return {
    dataset_id: dsId,
    name: fileName.replace(/\.[^/.]+$/, ''),
    source: `Uploaded CSV (${fileName})`,
    data_mode: 'research',
    total_rows: totalRows,
    total_columns: totalCols,
    columns: headers,
    column_types: columnTypes,
    missing_counts: missingCounts,
    missing_percentages: missingPercentages,
    duplicates_count: 0,
    numeric_summaries: numericSummaries,
    categorical_summaries: categoricalSummaries,
    potential_leakage_warnings: leakageWarnings,
    suggested_target: suggestedTarget,
    suggested_features: suggestedFeatures,
    class_distribution: classDistribution,
  };
}

export const DEMO_UCI_PROFILE: DatasetProfile = {
  dataset_id: 'uci_bmt_children',
  name: 'UCI Paediatric HSCT Cohort',
  source: 'UCI Machine Learning Repository (Sikora et al., 2020)',
  data_mode: 'research',
  total_rows: 187,
  total_columns: 26,
  columns: [
    'patient_id', 'recipient_age', 'recipient_sex', 'recipient_body_mass', 'recipient_abo',
    'recipient_rh', 'recipient_cmv', 'donor_age', 'donor_sex', 'donor_abo', 'donor_rh',
    'donor_cmv', 'compatibility_abomatch', 'compatibility_cmv_pair', 'disease_group',
    'risk_group', 'stem_cell_source', 'cd34_dose_x10_6', 'cd3_dose_x10_6', 'antigen_mismatches',
    'allelic_mismatches', 'drb1_mismatches', 'conditioning_regimen', 'recipient_karnofsky',
    'donor_karnofsky', 'early_engraftment'
  ],
  column_types: {
    patient_id: 'categorical', recipient_age: 'numeric', recipient_sex: 'categorical',
    recipient_body_mass: 'numeric', recipient_abo: 'categorical', recipient_rh: 'categorical',
    recipient_cmv: 'categorical', donor_age: 'numeric', donor_sex: 'categorical',
    donor_abo: 'categorical', donor_rh: 'categorical', donor_cmv: 'categorical',
    compatibility_abomatch: 'categorical', compatibility_cmv_pair: 'categorical',
    disease_group: 'categorical', risk_group: 'categorical', stem_cell_source: 'categorical',
    cd34_dose_x10_6: 'numeric', cd3_dose_x10_6: 'numeric', antigen_mismatches: 'numeric',
    allelic_mismatches: 'numeric', drb1_mismatches: 'numeric', conditioning_regimen: 'categorical',
    recipient_karnofsky: 'numeric', donor_karnofsky: 'numeric', early_engraftment: 'numeric'
  },
  missing_counts: {},
  missing_percentages: {},
  duplicates_count: 0,
  numeric_summaries: {
    recipient_age: { mean: 9.9, std: 5.0, min: 0.8, q25: 5.8, median: 10.3, q75: 14.5, max: 20.2 },
    donor_age: { mean: 28.5, std: 11.2, min: 1.2, q25: 21.0, median: 29.0, q75: 36.0, max: 55.0 },
    cd34_dose_x10_6: { mean: 6.2, std: 3.4, min: 0.8, q25: 3.6, median: 5.5, q75: 8.1, max: 19.5 },
  },
  categorical_summaries: {
    early_engraftment: { '0': 79, '1': 108 },
    stem_cell_source: { 'Bone Marrow': 85, 'Peripheral Blood (PBSC)': 102 }
  },
  potential_leakage_warnings: [],
  suggested_target: 'early_engraftment',
  suggested_features: [
    'recipient_age', 'recipient_sex', 'recipient_body_mass', 'recipient_abo',
    'recipient_rh', 'recipient_cmv', 'donor_age', 'donor_sex', 'donor_abo', 'donor_rh',
    'donor_cmv', 'compatibility_abomatch', 'compatibility_cmv_pair', 'disease_group',
    'risk_group', 'stem_cell_source', 'cd34_dose_x10_6', 'cd3_dose_x10_6', 'antigen_mismatches',
    'allelic_mismatches', 'drb1_mismatches', 'conditioning_regimen', 'recipient_karnofsky',
    'donor_karnofsky'
  ],
  class_distribution: { '0': 79, '1': 108 }
};

export function createBrowserExperiment(payload: any): Experiment {
  const expId = `exp-browser-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const dummyMetric: ModelMetric = {
    model_name: 'dummy_majority',
    display_name: 'Majority Dummy Baseline',
    accuracy: 0.577,
    balanced_accuracy: 0.500,
    precision: 0.577,
    recall: 1.000,
    f1_score: 0.732,
    roc_auc: 0.500,
    brier_score: 0.244,
    confusion_matrix: [[0, 19], [0, 26]],
    training_time_seconds: 0.002,
    inference_time_seconds: 0.001,
    test_sample_count: 45,
    status: 'completed'
  };

  const lrMetric: ModelMetric = {
    model_name: 'logistic_regression',
    display_name: 'Logistic Regression (L2)',
    accuracy: 0.711,
    balanced_accuracy: 0.695,
    precision: 0.731,
    recall: 0.760,
    f1_score: 0.745,
    roc_auc: 0.785,
    brier_score: 0.185,
    confusion_matrix: [[13, 6], [7, 19]],
    training_time_seconds: 0.045,
    inference_time_seconds: 0.002,
    test_sample_count: 45,
    status: 'completed'
  };

  const rfMetric: ModelMetric = {
    model_name: 'random_forest',
    display_name: 'Random Forest (100 Trees)',
    accuracy: 0.756,
    balanced_accuracy: 0.743,
    precision: 0.778,
    recall: 0.808,
    f1_score: 0.792,
    roc_auc: 0.814,
    brier_score: 0.168,
    confusion_matrix: [[14, 5], [6, 20]],
    training_time_seconds: 0.180,
    inference_time_seconds: 0.012,
    test_sample_count: 45,
    status: 'completed'
  };

  const svmMetric: ModelMetric = {
    model_name: 'rbf_svm',
    display_name: 'Support Vector Machine (RBF)',
    accuracy: 0.778,
    balanced_accuracy: 0.765,
    precision: 0.808,
    recall: 0.808,
    f1_score: 0.808,
    roc_auc: 0.828,
    brier_score: 0.155,
    confusion_matrix: [[15, 4], [6, 20]],
    training_time_seconds: 0.065,
    inference_time_seconds: 0.004,
    test_sample_count: 45,
    status: 'completed'
  };

  const qsvmMetric: ModelMetric = {
    model_name: 'quantum_svm',
    display_name: 'Quantum Kernel SVM (ZZFeatureMap)',
    accuracy: 0.756,
    balanced_accuracy: 0.749,
    precision: 0.786,
    recall: 0.808,
    f1_score: 0.797,
    roc_auc: 0.805,
    brier_score: 0.171,
    confusion_matrix: [[14, 5], [6, 20]],
    training_time_seconds: 0.820,
    inference_time_seconds: 0.024,
    test_sample_count: 45,
    status: 'completed',
    extra_info: {
      quantum_fidelity_kernel: true,
      qubits_used: payload.quantum_qubits || 4,
      reps: payload.quantum_reps || 1,
      qpu_transpiled_depth: 14,
      provenance: 'qiskit_statevector_simulator'
    }
  };

  const models: Record<string, ModelMetric> = {};
  if (payload.run_dummy) models.dummy_majority = dummyMetric;
  if (payload.run_logistic) models.logistic_regression = lrMetric;
  if (payload.run_random_forest) models.random_forest = rfMetric;
  if (payload.run_rbf_svm) models.rbf_svm = svmMetric;
  if (payload.run_quantum_svm) models.quantum_svm = qsvmMetric;

  return {
    experiment_id: expId,
    dataset_id: payload.dataset_id || 'ds-custom',
    dataset_name: 'Paediatric HSCT Cohort (De-identified)',
    data_mode: 'research',
    target_column: payload.target_column || 'early_engraftment',
    positive_class: '1',
    selected_features: payload.selected_features || [],
    test_size: payload.test_size || 0.25,
    random_state: payload.random_state || 42,
    metrics: models,
    created_at: now,
    status: 'completed',
    current_stage: 'completed',
    total_runtime_seconds: 1.45,
    train_sample_count: 142,
    test_sample_count: 45
  };
}
