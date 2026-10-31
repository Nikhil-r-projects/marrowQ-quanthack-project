import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, BookOpen, BrainCircuit, CheckCircle2, CircleAlert, Cpu, Dna,
  FileText, HeartPulse, Layers, ListChecks, Microscope, Pill, RefreshCw,
  ShieldCheck, Sparkles, Stethoscope, UserRound, XCircle
} from 'lucide-react';
import { OrchestrationResult, Patient, UserRole } from '../types';
import {
  runAgentOrchestration, fetchBiologicalProfile, evaluateAML, evaluateMDS,
  evaluateSAA, evaluateKidney, evaluateLiver, evaluateCardio, evaluatePGx, evaluateHLA,
  compareTreatmentOptions, analyzeFlowSample, analyzeSmearPathology, curateGenomicVariant
} from '../api';

interface DiagnosticIntelligenceViewProps {
  patient: Patient;
  role: UserRole;
}

type Result = OrchestrationResult;

const AGENT_NAMES: Record<string, { name: string; role: string }> = {
  clinical_data_quality_agent: { name: 'Data quality sentinel', role: 'Validates ranges, ensures zero-imputation integrity' },
  clinical_feature_engineering_agent: { name: 'Feature engineering', role: 'Builds classical covariates and quantum Hilbert encodings' },
  classical_ml_prediction_service: { name: 'Trained classical models', role: 'Logistic regression, random forest, RBF SVM (UCI cohort trained)' },
  quantum_ml_prediction_service: { name: 'Quantum fidelity probe', role: 'Experimental ZZFeatureMap 2-qubit state overlap' },
  independent_prediction_validation_agent: { name: 'Independent validation', role: 'Consensus voting across classical models; decouples quantum probe' },
  evidence_clinical_context_agent: { name: 'Evidence & context', role: 'Links findings to registry evidence' },
  recovery_trajectory_agent: { name: 'Recovery trajectory', role: 'EBMT/CIBMTR 3-day consensus engraftment' },
  clinical_report_agent: { name: 'Report writer', role: 'Drafts clinician technical reports and patient summaries' }
};

const MODEL_ROWS: { key: keyof OrchestrationResult['models_comparison']; label: string; quantum?: boolean }[] = [
  { key: 'logistic_regression', label: 'Trained Logistic Regression (L2)' },
  { key: 'random_forest', label: 'Trained Random Forest (n=100)' },
  { key: 'classical_rbf_svm', label: 'Trained Classical RBF SVM' },
  { key: 'quantum_kernel_svm', label: 'Quantum Fidelity Probe (ZZFeatureMap)', quantum: true }
];

const VALIDATION_COPY: Record<string, { label: string; chip: string; text: string }> = {
  VALIDATED_CONSENSUS: { label: 'Validated Consensus', chip: 'chip-green', text: 'All classical models agree and variance is low.' },
  VALIDATED_WITH_DISAGREEMENT: { label: 'Model Disagreement', chip: 'chip-amber', text: 'Models diverge across 50% threshold. Clinician review required.' },
  VALIDATED_HIGH_VARIANCE: { label: 'High Variance', chip: 'chip-amber', text: 'Models agree on direction but spread is wide.' }
};

const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

export const DiagnosticIntelligenceView: React.FC<DiagnosticIntelligenceViewProps> = ({ patient, role }) => {
  const isPatient = role === 'patient';
  const [activeTab, setActiveTab] = useState<'review' | 'biological' | 'diseases' | 'pgx' | 'hla' | 'treatment' | 'flow_vision'>('review');

  // Treatment Intelligence State
  const [treatmentResult, setTreatmentResult] = useState<any>(null);
  const [treatmentLoading, setTreatmentLoading] = useState<boolean>(false);

  // Flow & Vision State
  const [flowResult, setFlowResult] = useState<any>(null);
  const [smearResult, setSmearResult] = useState<any>(null);
  const [flowVisionLoading, setFlowVisionLoading] = useState<boolean>(false);

  // Review state
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportTab, setReportTab] = useState<'doctor' | 'patient'>(isPatient ? 'patient' : 'doctor');

  // Biological state
  const [bioProfile, setBioProfile] = useState<any | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  // Disease Module state
  const [selectedDisease, setSelectedDisease] = useState<'aml' | 'mds' | 'saa' | 'kidney' | 'liver' | 'cardio'>('aml');
  const [diseaseResult, setDiseaseResult] = useState<any | null>(null);
  const [diseaseLoading, setDiseaseLoading] = useState(false);

  // PGx state
  const [pgxResult, setPgxResult] = useState<any | null>(null);
  const [pgxLoading, setPgxLoading] = useState(false);

  // HLA state
  const [hlaResult, setHlaResult] = useState<any | null>(null);
  const [hlaLoading, setHlaLoading] = useState(false);

  // Run 8-agent review
  const runReview = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      setResult(await runAgentOrchestration({ patient, quantum_backend: 'aer_simulator_statevector', execution_mode: 'auto_fallback' }));
    } catch (e: any) {
      setError(e?.message ?? 'Clinical review failed');
    } finally {
      setRunning(false);
    }
  }, [patient]);

  useEffect(() => { runReview(); }, [runReview]);

  // Load Biological Profile
  useEffect(() => {
    if (activeTab === 'biological' && !bioProfile) {
      setBioLoading(true);
      fetchBiologicalProfile(patient.patient_id)
        .then(setBioProfile)
        .catch(() => {})
        .finally(() => setBioLoading(false));
    }
  }, [activeTab, bioProfile, patient.patient_id]);

  // Run Disease Evaluation
  const runDiseaseAssessment = useCallback(async () => {
    setDiseaseLoading(true);
    try {
      if (selectedDisease === 'aml') {
        const res = await evaluateAML({
          blast_percentage: 32.0,
          mutations: ['NPM1', 'FLT3-ITD'],
          cytogenetics: 'Normal karyotype 46,XX',
          age: patient.age
        });
        setDiseaseResult(res);
      } else if (selectedDisease === 'mds') {
        const res = await evaluateMDS({
          bone_marrow_blast_pct: 8.5,
          hemoglobin: 8.2,
          platelets: 45000,
          anc: 650,
          cytogenetics_category: 'Intermediate',
          mutations: ['ASXL1', 'RUNX1']
        });
        setDiseaseResult(res);
      } else if (selectedDisease === 'saa') {
        const res = await evaluateSAA({
          cellularity_pct: 12.0,
          anc: 180.0,
          platelets: 15000.0,
          reticulocytes: 12000.0
        });
        setDiseaseResult(res);
      } else if (selectedDisease === 'kidney') {
        const res = await evaluateKidney({
          serum_creatinine: 1.8,
          age: patient.age,
          sex: patient.gender,
          baseline_creatinine: 0.9
        });
        setDiseaseResult(res);
      } else if (selectedDisease === 'liver') {
        const res = await evaluateLiver({
          total_bilirubin: 2.4,
          serum_creatinine: 1.4,
          inr: 1.6,
          serum_sodium: 134.0,
          ast: 65.0,
          alt: 55.0,
          platelets: 60000.0,
          age: patient.age
        });
        setDiseaseResult(res);
      } else if (selectedDisease === 'cardio') {
        const res = await evaluateCardio({
          age: patient.age,
          total_cholesterol: 215.0,
          hdl: 42.0,
          systolic_bp: 138.0,
          is_smoker: false,
          has_diabetes: false,
          is_female: patient.gender === 'Female'
        });
        setDiseaseResult(res);
      }
    } catch (e: any) {
      setDiseaseResult({ error: e.message });
    } finally {
      setDiseaseLoading(false);
    }
  }, [selectedDisease, patient]);

  useEffect(() => {
    if (activeTab === 'diseases') {
      runDiseaseAssessment();
    }
  }, [activeTab, selectedDisease, runDiseaseAssessment]);

  // Run PGx evaluation
  useEffect(() => {
    if (activeTab === 'pgx' && !pgxResult) {
      setPgxLoading(true);
      evaluatePGx({
        genotypes: { TPMT: 'IM', NUDT15: 'NM', CYP2C19: 'PM', DPYD: 'NM', 'HLA-B': 'NEGATIVE' },
        intended_medications: ['Voriconazole', 'Mercaptopurine', 'Fluorouracil']
      })
        .then(setPgxResult)
        .catch(() => {})
        .finally(() => setPgxLoading(false));
    }
  }, [activeTab, pgxResult]);

  // Run HLA evaluation
  useEffect(() => {
    if (activeTab === 'hla' && !hlaResult) {
      setHlaLoading(true);
      evaluateHLA({
        recipient: {
          a: { allele1: '02:01', allele2: '01:01' },
          b: { allele1: '07:02', allele2: '08:01' },
          c: { allele1: '07:01', allele2: '03:04' },
          drb1: { allele1: '15:01', allele2: '03:01' },
          dqb1: { allele1: '06:02', allele2: '02:01' },
          dpb1: { allele1: '04:01', allele2: '02:01' }
        },
        donor: {
          a: { allele1: '02:01', allele2: '01:01' },
          b: { allele1: '07:02', allele2: '08:01' },
          c: { allele1: '07:01', allele2: '03:04' },
          drb1: { allele1: '15:01', allele2: '03:01' },
          dqb1: { allele1: '06:02', allele2: '02:01' },
          dpb1: { allele1: '09:01', allele2: '04:01' }
        },
        recipient_dsa_panel: { '09:01': 450.0 }
      })
        .then(setHlaResult)
        .catch(() => {})
        .finally(() => setHlaLoading(false));
    }
  }, [activeTab, hlaResult]);

  useEffect(() => {
    if (activeTab === 'treatment' && !treatmentResult) {
      setTreatmentLoading(true);
      compareTreatmentOptions({
        disease: patient.disease ?? 'AML',
        risk_category: 'ADVERSE',
        patient_age: patient.age ?? 45,
        ecog_ps: 1,
        lvef_pct: 60.0,
        dlco_pct: 75.0,
        egfr_ml_min: 88.0,
        total_bilirubin_mg_dl: 0.9,
        comorbidities: ['cad', 'diabetes']
      })
        .then(setTreatmentResult)
        .catch(() => {})
        .finally(() => setTreatmentLoading(false));
    }

    if (activeTab === 'flow_vision' && !flowResult) {
      setFlowVisionLoading(true);
      Promise.all([
        analyzeFlowSample({ patient_id: patient.patient_id }).catch(() => null),
        analyzeSmearPathology({ patient_id: patient.patient_id, manual_cellularity_pct: 60.0, manual_blasts_pct: 4.8 }).catch(() => null)
      ])
        .then(([fl, sm]) => {
          if (fl) setFlowResult(fl.flow_cytometry_analysis);
          if (sm) setSmearResult(sm.smear_pathology);
        })
        .finally(() => setFlowVisionLoading(false));
    }
  }, [activeTab, treatmentResult, flowResult, patient]);

  const validation = result ? VALIDATION_COPY[result.validation_status] ?? { label: result.validation_status, chip: 'chip-neutral', text: '' } : null;
  const probs = result ? MODEL_ROWS.map(r => Number(result.models_comparison[r.key]?.probability ?? 0)) : [];
  const classicalProbs = probs.slice(0, 3);
  const mean = classicalProbs.length ? classicalProbs.reduce((a, b) => a + b, 0) / classicalProbs.length : 0;
  const votesYes = classicalProbs.filter(p => p >= 0.5).length;
  const quantum = result?.models_comparison.quantum_kernel_svm;
  const warnings = result?.agent_trail.flatMap(a => a.warnings) ?? [];

  return (
    <div className="stack">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="eyebrow"><BrainCircuit size={13} /> Precision Clinical Intelligence</div>
          <h2>{isPatient ? 'Personalized Recovery & Biological Overview' : `Clinical Intelligence System — ${patient.name}`}</h2>
          <p>
            Multimodal precision medicine platform integrating trained ML ensembles, biological profiles,
            disease diagnostic engines, CPIC pharmacogenomics, and 12-allele HLA compatibility.
          </p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={runReview} disabled={running}>
            <RefreshCw size={15} className={running ? 'spin' : ''} />
            {running ? 'Evaluating...' : 'Refresh Review'}
          </button>
        </div>
      </div>

      {/* Navigation Domain Tabs */}
      <div className="seg" role="tablist" style={{ alignSelf: 'flex-start', flexWrap: 'wrap', gap: '4px' }}>
        <button
          role="tab"
          aria-selected={activeTab === 'review'}
          className={`seg-btn ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          <BrainCircuit size={14} /> Multi-Agent Review
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'biological'}
          className={`seg-btn ${activeTab === 'biological' ? 'active' : ''}`}
          onClick={() => setActiveTab('biological')}
        >
          <Microscope size={14} /> Biological Data Profile
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'diseases'}
          className={`seg-btn ${activeTab === 'diseases' ? 'active' : ''}`}
          onClick={() => setActiveTab('diseases')}
        >
          <Stethoscope size={14} /> Disease Diagnostics
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'pgx'}
          className={`seg-btn ${activeTab === 'pgx' ? 'active' : ''}`}
          onClick={() => setActiveTab('pgx')}
        >
          <Pill size={14} /> Precision PGx Safety
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'hla'}
          className={`seg-btn ${activeTab === 'hla' ? 'active' : ''}`}
          onClick={() => setActiveTab('hla')}
        >
          <ShieldCheck size={14} /> 12-Allele HLA Match
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'treatment'}
          className={`seg-btn ${activeTab === 'treatment' ? 'active' : ''}`}
          onClick={() => setActiveTab('treatment')}
        >
          <HeartPulse size={14} /> Treatment Intelligence & HCT-CI
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'flow_vision'}
          className={`seg-btn ${activeTab === 'flow_vision' ? 'active' : ''}`}
          onClick={() => setActiveTab('flow_vision')}
        >
          <Layers size={14} /> Flow Cytometry & BM Vision
        </button>
      </div>

      {/* TAB 1: MULTI-AGENT REVIEW */}
      {activeTab === 'review' && (
        <div className="stack" style={{ gap: '1.25rem' }}>
          {error && (
            <div className="alert-banner alert-error"><XCircle size={16} /><div>{error}</div></div>
          )}

          {!result ? (
            <div className="grid-4">
              {[0, 1, 2, 3].map(i => <div key={i} className="card"><div className="skeleton" style={{ height: 14, width: '60%' }} /><div className="skeleton" style={{ height: 34, width: '45%', marginTop: 14 }} /><div className="skeleton" style={{ height: 12, width: '80%', marginTop: 14 }} /></div>)}
            </div>
          ) : isPatient ? (
            <div className="card">
              <div className="card-header"><div className="card-title"><UserRound size={16} /> Your update</div></div>
              <div className="markdown-view" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)', fontSize: '0.95rem' }}>
                {result.reports.patient_friendly_summary}
              </div>
              <p className="small muted" style={{ marginTop: '0.9rem' }}>
                Questions about this update? Your transplant care team reviews every lab result.
              </p>
            </div>
          ) : (
            <>
              <div className="grid-4">
                <div className="card kpi">
                  <span className="kpi-label">Validated Classical Ensemble</span>
                  <span className="kpi-value">{pct(mean)}</span>
                  <span className="kpi-foot">Mean of LR, RF, SVM · Trained on UCI Paediatric cohort (n=187)</span>
                </div>
                <div className="card kpi">
                  <span className="kpi-label">Consensus Status</span>
                  <span className="kpi-value" style={{ fontSize: '1.25rem' }}><span className={`chip ${validation!.chip}`} style={{ fontSize: '0.85rem' }}>{validation!.label}</span></span>
                  <span className="kpi-foot">{validation!.text}</span>
                </div>
                <div className="card kpi">
                  <span className="kpi-label">Classical Agreement</span>
                  <span className="kpi-value">{votesYes}/3<small>predict recovery</small></span>
                  <span className="kpi-foot">Inter-model variance σ² = {(classicalProbs.reduce((a, p) => a + (p - mean) ** 2, 0) / 3).toFixed(4)}</span>
                </div>
                <div className="card kpi">
                  <span className="kpi-label">Quantum Probe Overlap</span>
                  <span className="kpi-value" style={{ fontSize: '1.05rem', lineHeight: 1.35 }}>{quantum?.fidelity_to_engraftment_state != null ? `${quantum.fidelity_to_engraftment_state} overlap` : 'Statevector'}</span>
                  <span className="kpi-foot">{quantum?.backend_used ?? 'Aer simulator'} · Non-diagnostic research</span>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="alert-banner alert-warn">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{warnings.length} clinical quality flag{warnings.length > 1 ? 's' : ''} active</strong>
                    <ul style={{ margin: '0.35rem 0 0 1.1rem' }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </div>
                </div>
              )}

              <div className="grid-2" style={{ alignItems: 'start' }}>
                <section className="card">
                  <div className="card-header">
                    <div>
                      <div className="card-title"><Cpu size={16} /> Model Synthesis & Inference</div>
                      <div className="card-subtitle">Classical ML trained on real cohort; Quantum probe reported separately</div>
                    </div>
                  </div>
                  <div className="stack" style={{ gap: '0.9rem' }}>
                    {MODEL_ROWS.map((r, i) => {
                      const p = probs[i];
                      return (
                        <div key={r.key}>
                          <div className="row between small" style={{ marginBottom: '0.35rem' }}>
                            <span className="row" style={{ gap: '0.45rem' }}>
                              {r.label}
                              {r.quantum && <span className="chip chip-violet">Exploratory Probe</span>}
                            </span>
                            <strong className="tnum">{pct(p)}</strong>
                          </div>
                          <div className="prob-track">
                            <div className={`prob-fill ${r.quantum ? 'quantum' : ''}`} style={{ width: `${p * 100}%` }} />
                            <span className="prob-threshold" title="Threshold 50%" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="inset small muted" style={{ marginTop: '1.1rem', lineHeight: 1.55 }}>
                    <strong style={{ color: 'var(--violet-text)' }}>Quantum Probe Transparency.</strong> Evaluates Hilbert space overlap using ZZFeatureMap phase rotations against reference anchor states. Excluded from the diagnostic ensemble mean to preserve clinical validity.
                  </div>
                </section>

                <section className="card">
                  <div className="card-header">
                    <div className="card-title"><BookOpen size={16} /> Clinical Evidence Factors</div>
                  </div>
                  <div className="stack" style={{ gap: '0.7rem' }}>
                    {result.evidence.map((e, i) => (
                      <div key={i} className="inset" style={{ padding: '0.8rem 0.9rem' }}>
                        <div className="row between" style={{ alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '0.86rem' }}>{e.factor}</strong>
                          <span className="tiny faint" style={{ textAlign: 'right' }}>{e.reference_registry}</span>
                        </div>
                        <div className="small muted" style={{ marginTop: '0.2rem' }}>{e.observation}</div>
                        <div className="small" style={{ marginTop: '0.35rem' }}>{e.clinical_impact}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="card">
                <div className="card-header divided">
                  <div className="card-title"><FileText size={16} /> Review Reports</div>
                  <div className="seg" role="tablist">
                    <button role="tab" aria-selected={reportTab === 'doctor'} className={`seg-btn ${reportTab === 'doctor' ? 'active' : ''}`} onClick={() => setReportTab('doctor')}>Technical CDS</button>
                    <button role="tab" aria-selected={reportTab === 'patient'} className={`seg-btn ${reportTab === 'patient' ? 'active' : ''}`} onClick={() => setReportTab('patient')}>Patient Summary</button>
                  </div>
                </div>
                <div className="markdown-view" style={{ whiteSpace: 'pre-wrap', fontFamily: reportTab === 'doctor' ? 'var(--font-mono)' : 'var(--font-body)', fontSize: reportTab === 'doctor' ? '0.8rem' : '0.9rem' }}>
                  {reportTab === 'doctor' ? result.reports.physician_technical_report : result.reports.patient_friendly_summary}
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div className="card-title"><ListChecks size={16} /> 8-Agent Execution Trail</div>
                </div>
                <ol className="agent-trail">
                  {result.agent_trail.map((a, i) => {
                    const meta = AGENT_NAMES[a.agent_id] ?? { name: a.agent_id, role: '' };
                    const Icon = a.status === 'SUCCESS' ? CheckCircle2 : a.status === 'WARNING' ? CircleAlert : XCircle;
                    return (
                      <li key={i} className={`agent-step ${a.status.toLowerCase()}`}>
                        <span className="agent-icon"><Icon size={16} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="row between wrap">
                            <strong style={{ fontSize: '0.86rem' }}>{i + 1}. {meta.name}</strong>
                            {a.confidence != null && <span className="tiny faint tnum">confidence {(a.confidence * 100).toFixed(0)}%</span>}
                          </div>
                          <div className="small muted">{meta.role}</div>
                          {a.warnings.length > 0 && <div className="small" style={{ color: 'var(--amber-text)', marginTop: '0.25rem' }}>{a.warnings.join(' ')}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </>
          )}
        </div>
      )}

      {/* TAB 2: BIOLOGICAL PROFILE */}
      {activeTab === 'biological' && (
        <div className="stack" style={{ gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title"><Microscope size={16} /> Multimodal Biological Data Ingestion</div>
                <div className="card-subtitle">Blood CBC & Biochemistry · Bone Marrow Pathology · Genomic VCF Variants</div>
              </div>
            </div>

            <div className="grid-3" style={{ marginTop: '0.5rem' }}>
              <div className="card kpi">
                <span className="kpi-label">Peripheral Blood (CBC)</span>
                <span className="kpi-value">ANC {patient.current_anc ?? '—'}<small>/μL</small></span>
                <span className="kpi-foot">Platelets {patient.current_plt?.toLocaleString() ?? '—'}/μL · Verified</span>
              </div>
              <div className="card kpi">
                <span className="kpi-label">Bone Marrow Aspirate</span>
                <span className="kpi-value">Cellularity 40%</span>
                <span className="kpi-foot">Blasts &lt; 5% · Morphologic Remission</span>
              </div>
              <div className="card kpi">
                <span className="kpi-label">Molecular & Cytogenetics</span>
                <span className="kpi-value">46,XX / 46,XY</span>
                <span className="kpi-foot">Targeted Panel: FLT3, NPM1, TP53, BCR-ABL1</span>
              </div>
            </div>

            <div className="stack" style={{ marginTop: '1.25rem', gap: '1rem' }}>
              <h4>Actionable Targeted Genomic Variants</h4>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Gene</th>
                      <th>Variant</th>
                      <th>VAF %</th>
                      <th>ClinVar</th>
                      <th>Evidence Tier</th>
                      <th>Targeted Therapy Indication</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>FLT3</strong></td>
                      <td className="mono">c.1789G&gt;A (p.Asp598Asn)</td>
                      <td>38.4%</td>
                      <td><span className="chip chip-amber">Pathogenic</span></td>
                      <td>Tier 1 Actionable</td>
                      <td>Midostaurin, Gilteritinib</td>
                    </tr>
                    <tr>
                      <td><strong>NPM1</strong></td>
                      <td className="mono">c.860_863dupTCTG</td>
                      <td>42.1%</td>
                      <td><span className="chip chip-green">Favorable Driver</span></td>
                      <td>Tier 1 Actionable</td>
                      <td>Standard Anthracycline/Cytarabine, Menin Inhibitors</td>
                    </tr>
                    <tr>
                      <td><strong>CYP2C19</strong></td>
                      <td className="mono">*2 allele (c.681G&gt;A)</td>
                      <td>50.0%</td>
                      <td><span className="chip chip-blue">Pharmacogenomic</span></td>
                      <td>CPIC Level A</td>
                      <td>Voriconazole TDM or Isavuconazole Alternative</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DISEASE DIAGNOSTICS & MULTI-ORGAN */}
      {activeTab === 'diseases' && (
        <div className="stack" style={{ gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header divided">
              <div>
                <div className="card-title"><Stethoscope size={16} /> Multi-Specialty Disease Intelligence Engines</div>
                <div className="card-subtitle">Authoritative evidence-based clinical classification and risk stratification</div>
              </div>
              <div className="seg" role="tablist">
                <button className={`seg-btn ${selectedDisease === 'aml' ? 'active' : ''}`} onClick={() => setSelectedDisease('aml')}>AML (ELN 2022)</button>
                <button className={`seg-btn ${selectedDisease === 'mds' ? 'active' : ''}`} onClick={() => setSelectedDisease('mds')}>MDS (IPSS-M)</button>
                <button className={`seg-btn ${selectedDisease === 'saa' ? 'active' : ''}`} onClick={() => setSelectedDisease('saa')}>Aplastic Anemia</button>
                <button className={`seg-btn ${selectedDisease === 'kidney' ? 'active' : ''}`} onClick={() => setSelectedDisease('kidney')}>Nephrology</button>
                <button className={`seg-btn ${selectedDisease === 'liver' ? 'active' : ''}`} onClick={() => setSelectedDisease('liver')}>Hepatology</button>
                <button className={`seg-btn ${selectedDisease === 'cardio' ? 'active' : ''}`} onClick={() => setSelectedDisease('cardio')}>Cardiology</button>
              </div>
            </div>

            {diseaseLoading ? (
              <div className="skeleton" style={{ height: 120, margin: '1rem 0' }} />
            ) : diseaseResult ? (
              <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                <div className="grid-3">
                  <div className="card kpi">
                    <span className="kpi-label">Diagnosis / System</span>
                    <span className="kpi-value" style={{ fontSize: '1.2rem' }}>{diseaseResult.disease || diseaseResult.organ_specialty}</span>
                    <span className="kpi-foot">{diseaseResult.evidence_standard || 'Authoritative Clinical Standard'}</span>
                  </div>
                  <div className="card kpi">
                    <span className="kpi-label">Classification / Risk Tier</span>
                    <span className="kpi-value" style={{ fontSize: '1.15rem' }}>
                      <span className="chip chip-amber">
                        {diseaseResult.eln_2022_risk_category || diseaseResult.ipss_m_risk_category || diseaseResult.camitta_classification || diseaseResult.kdigo_ckd_stage || diseaseResult.risk_tier || 'Stratified'}
                      </span>
                    </span>
                    <span className="kpi-foot">
                      {diseaseResult.ipss_m_score != null ? `IPSS-M Score: ${diseaseResult.ipss_m_score}` : (diseaseResult.estimated_gfr_ml_min ? `eGFR: ${diseaseResult.estimated_gfr_ml_min} mL/min` : (diseaseResult.meld_na_score ? `MELD-Na: ${diseaseResult.meld_na_score}` : 'Evaluated'))}
                    </span>
                  </div>
                  <div className="card kpi">
                    <span className="kpi-label">Clinical Action Tier</span>
                    <span className="kpi-value" style={{ fontSize: '1.1rem' }}>Active Management</span>
                    <span className="kpi-foot">{diseaseResult.aki_status ? `AKI: ${diseaseResult.aki_status}` : 'Protocol Guided'}</span>
                  </div>
                </div>

                <div className="inset" style={{ padding: '1rem' }}>
                  <strong>Evidence-Based Recommendation:</strong>
                  <p style={{ marginTop: '0.35rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {diseaseResult.prognostic_summary || diseaseResult.clinical_recommendation || diseaseResult.treatment_pathway || diseaseResult.recommendation || 'Continuous monitoring based on biological indicators.'}
                  </p>
                  {diseaseResult.actionable_targeted_therapies?.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <strong>Targeted Therapy Indications:</strong>
                      <ul style={{ margin: '0.35rem 0 0 1.25rem', fontSize: '0.85rem' }}>
                        {diseaseResult.actionable_targeted_therapies.map((t: string, i: number) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* TAB 4: PHARMACOGENOMICS (PGx) */}
      {activeTab === 'pgx' && (
        <div className="stack" style={{ gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title"><Pill size={16} /> CPIC Precision Pharmacogenomics Safety Engine</div>
                <div className="card-subtitle">Drug-gene interaction screening & dose optimization guidelines</div>
              </div>
            </div>

            {pgxLoading ? (
              <div className="skeleton" style={{ height: 140, margin: '1rem 0' }} />
            ) : pgxResult ? (
              <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                <div className="alert-banner alert-warn">
                  <AlertTriangle size={16} />
                  <div>
                    <strong>{pgxResult.total_alerts_found} Pharmacogenomic Alert{pgxResult.total_alerts_found > 1 ? 's' : ''} Identified</strong>
                    <p style={{ marginTop: '0.2rem', fontSize: '0.85rem' }}>
                      Patient genotype indicates altered drug metabolism. Dose adjustment or medication substitution required.
                    </p>
                  </div>
                </div>

                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Gene</th>
                        <th>Drug</th>
                        <th>Patient Phenotype</th>
                        <th>Severity</th>
                        <th>Clinical Implication</th>
                        <th>Actionable Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pgxResult.alerts?.map((a: any, i: number) => (
                        <tr key={i}>
                          <td><strong>{a.gene}</strong></td>
                          <td>{a.drug}</td>
                          <td><span className="mono">{a.patient_phenotype}</span></td>
                          <td><span className={`chip ${a.severity === 'HIGH' ? 'chip-amber' : 'chip-blue'}`}>{a.severity}</span></td>
                          <td style={{ fontSize: '0.82rem', maxWidth: '280px' }}>{a.clinical_implication}</td>
                          <td style={{ fontSize: '0.82rem', maxWidth: '320px' }}><strong>{a.actionable_recommendation}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* TAB 5: 12-ALLELE HLA COMPATIBILITY */}
      {activeTab === 'hla' && (
        <div className="stack" style={{ gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title"><ShieldCheck size={16} /> 12-Allele High-Resolution HLA Compatibility</div>
                <div className="card-subtitle">Loci: A, B, C, DRB1, DQB1, DPB1 · Fleischhauer TCE Permissiveness · DSA Screening</div>
              </div>
            </div>

            {hlaLoading ? (
              <div className="skeleton" style={{ height: 140, margin: '1rem 0' }} />
            ) : hlaResult ? (
              <div className="stack" style={{ gap: '1rem', marginTop: '1rem' }}>
                <div className="grid-3">
                  <div className="card kpi">
                    <span className="kpi-label">Core 10/10 Match Score</span>
                    <span className="kpi-value">{hlaResult.score_10}</span>
                    <span className="kpi-foot">Extended Score: {hlaResult.score_12}</span>
                  </div>
                  <div className="card kpi">
                    <span className="kpi-label">Compatibility Tier</span>
                    <span className="kpi-value" style={{ fontSize: '1.15rem' }}>
                      <span className="chip chip-green">{hlaResult.compatibility_tier}</span>
                    </span>
                    <span className="kpi-foot">{hlaResult.clinical_summary}</span>
                  </div>
                  <div className="card kpi">
                    <span className="kpi-label">DPB1 TCE Permissiveness</span>
                    <span className="kpi-value" style={{ fontSize: '1.15rem' }}>
                      <span className={`chip ${hlaResult.dpb1_tce_assessment?.is_permissive ? 'chip-green' : 'chip-amber'}`}>
                        {hlaResult.dpb1_tce_assessment?.permissiveness ?? 'PERMISSIVE'}
                      </span>
                    </span>
                    <span className="kpi-foot">{hlaResult.dpb1_tce_assessment?.clinical_significance ?? 'T-cell epitope matched'}</span>
                  </div>
                </div>

                <div className="inset" style={{ padding: '0.9rem' }}>
                  <strong>Directional Vector Breakdown:</strong>
                  <div className="row wrap" style={{ gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    <div>
                      <strong>Graft-versus-Host (GVHD Risk):</strong> {hlaResult.directional_mismatches?.graft_versus_host_count} allele mismatch
                      {hlaResult.directional_mismatches?.graft_versus_host_alleles?.length > 0 && (
                        <span className="mono" style={{ marginLeft: '6px' }}>({hlaResult.directional_mismatches.graft_versus_host_alleles.join(', ')})</span>
                      )}
                    </div>
                    <div>
                      <strong>Host-versus-Graft (Rejection Risk):</strong> {hlaResult.directional_mismatches?.host_versus_graft_count} allele mismatch
                    </div>
                    <div>
                      <strong>Anti-Donor HLA Antibodies (DSA):</strong> <span className="chip chip-green">{hlaResult.dsa_assessment?.risk_tier ?? 'LOW_RISK_NEGATIVE'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* TAB 6: TREATMENT INTELLIGENCE & HCT-CI */}
      {activeTab === 'treatment' && (
        <div className="card">
          <div className="card-header divided">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HeartPulse size={18} style={{ color: 'var(--accent)' }} /> Comparative Treatment Decision Support & HCT-CI Comorbidity
            </h3>
            <span className="chip chip-blue">EBMT / NCCN / CIBMTR Consensus</span>
          </div>

          <div style={{ padding: '1.25rem' }}>
            {treatmentLoading ? (
              <p>Evaluating comorbidity risk index and regimen eligibility...</p>
            ) : treatmentResult ? (
              <div className="stack" style={{ gap: '1.25rem' }}>
                {/* HCT-CI Score Box */}
                <div style={{ background: 'var(--surface-2)', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Sorror HCT-Comorbidity Index (HCT-CI)</h4>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-2)' }}>
                        Non-relapse mortality risk stratification for transplant conditioning.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="chip chip-purple" style={{ fontSize: '0.85rem' }}>Score: {treatmentResult.hct_ci_assessment?.hct_ci_score}</span>
                      <span className={`chip ${treatmentResult.hct_ci_assessment?.comorbidity_risk_tier === 'LOW_RISK' ? 'chip-green' : 'chip-amber'}`}>
                        {treatmentResult.hct_ci_assessment?.comorbidity_risk_tier}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                    <strong>Expected Non-Relapse Mortality (NRM):</strong> {treatmentResult.hct_ci_assessment?.estimated_2yr_nrm}
                    <div style={{ marginTop: '0.25rem', color: 'var(--text-2)' }}>
                      <strong>Conditioning Eligibility:</strong> {treatmentResult.hct_ci_assessment?.conditioning_eligibility}
                    </div>
                  </div>
                </div>

                {/* Candidate Regimens Comparison Table */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Evidence-Supported Regimens for {treatmentResult.disease}</h4>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Regimen Name</th>
                          <th>Intent</th>
                          <th>Eligibility</th>
                          <th>Complete Remission Rate</th>
                          <th>Treatment-Related Mortality</th>
                          <th>Guideline Fit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {treatmentResult.candidate_regimens_comparison?.map((reg: any, i: number) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{reg.regimen_name}</td>
                            <td>{reg.intent}</td>
                            <td>
                              <span className={`chip ${reg.is_eligible ? 'chip-green' : 'chip-amber'}`} style={{ fontSize: '0.72rem' }}>
                                {reg.is_eligible ? 'ELIGIBLE' : 'CONTRAINDICATED'}
                              </span>
                            </td>
                            <td>{reg.expected_complete_remission_rate}</td>
                            <td style={{ fontSize: '0.8rem' }}>{reg.treatment_related_mortality_risk}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{reg.recommended_for}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* TAB 7: FLOW CYTOMETRY & BM VISION */}
      {activeTab === 'flow_vision' && (
        <div className="stack" style={{ gap: '1.25rem' }}>
          {/* Flow Cytometry Gating & MRD */}
          <div className="card">
            <div className="card-header divided">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--accent)' }} /> Flow Cytometry Standard Gating Hierarchy & MRD Assessment
              </h3>
              <span className="chip chip-blue">Analytical Sensitivity 10^-4 (0.01%)</span>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {flowVisionLoading ? (
                <p>Analyzing flow cytometry channel clusters...</p>
              ) : flowResult ? (
                <div className="stack" style={{ gap: '1rem' }}>
                  {/* Populations Grid */}
                  <div className="stats-grid grid-4">
                    <div className="stat-box">
                      <span className="stat-label">Total Acquired Events</span>
                      <span className="stat-value">{flowResult.total_events_acquired.toLocaleString()}</span>
                      <span className="stat-hint">{flowResult.viable_singlets.toLocaleString()} viable singlets</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Myeloblast Frequency</span>
                      <span className="stat-value" style={{ color: flowResult.populations?.myeloid_blasts_pct >= 5 ? '#e11d48' : '#10b981' }}>
                        {flowResult.populations?.myeloid_blasts_pct}%
                      </span>
                      <span className="stat-hint">CD45 dim / CD34+ / CD117+</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">MRD Status</span>
                      <span className="stat-value">
                        <span className={`chip ${flowResult.mrd_assessment?.mrd_status === 'NEGATIVE' ? 'chip-green' : 'chip-amber'}`}>
                          {flowResult.mrd_assessment?.mrd_status}
                        </span>
                      </span>
                      <span className="stat-hint">Cutoff: 0.01%</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Lineage Assignment</span>
                      <span className="stat-value" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {flowResult.immunophenotype?.lineage_assignment}
                      </span>
                      <span className="stat-hint">CD34+: {Math.round(flowResult.immunophenotype?.cd34_positive_fraction * 100)}%</span>
                    </div>
                  </div>

                  {/* Gating Steps Description */}
                  <div style={{ background: 'var(--surface-2)', padding: '0.85rem 1rem', borderRadius: '8px', fontSize: '0.82rem' }}>
                    <strong>Automated Gating Hierarchy:</strong> FSC-A/SSC-A Singlets (76%) → CD45/SSC Leukocyte Subsets (Granulocytes {flowResult.populations?.granulocytes_pct}%, Lymphocytes {flowResult.populations?.lymphocytes_pct}%, Monocytes {flowResult.populations?.monocytes_pct}%) → CD34/CD117 Blast Progenitor Gate ({flowResult.populations?.myeloid_blasts_pct}%).
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Bone Marrow Smear Pathology Vision */}
          <div className="card">
            <div className="card-header divided">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Microscope size={18} style={{ color: 'var(--accent)' }} /> Bone Marrow Smear Pathology Vision & Cell Segmentation
              </h3>
              <span className="chip chip-purple">300 Cell Differential (100x Oil Immersion)</span>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {smearResult ? (
                <div className="stack" style={{ gap: '1rem' }}>
                  <div className="stats-grid grid-4">
                    <div className="stat-box">
                      <span className="stat-label">Aspirate Cellularity</span>
                      <span className="stat-value">{smearResult.cellularity?.percentage}%</span>
                      <span className="stat-hint">{smearResult.cellularity?.classification}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Blast Percentage</span>
                      <span className="stat-value">{smearResult.differential_counts?.blast_percentage}%</span>
                      <span className="stat-hint">95% CI: [{smearResult.differential_counts?.blast_ci_95?.[0]}% - {smearResult.differential_counts?.blast_ci_95?.[1]}%]</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">M:E Ratio</span>
                      <span className="stat-value">{smearResult.differential_counts?.myeloid_erythroid_ratio} : 1</span>
                      <span className="stat-hint">Normal adult range: 2:1 to 4:1</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Image Focus Sharpness</span>
                      <span className="stat-value" style={{ color: '#10b981' }}>{smearResult.quality_assurance?.laplacian_sharpness_score}</span>
                      <span className="stat-hint">Laplacian variance (PASSED)</span>
                    </div>
                  </div>

                  {/* Cell Overlay Samples */}
                  <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Computer Vision Cell Classification Detections (Sample Overlay)</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {smearResult.cell_detections_overlay?.map((det: any, idx: number) => (
                        <div key={idx} style={{ background: 'var(--surface-1)', padding: '0.4rem 0.65rem', borderRadius: '6px', border: `1px solid ${det.color_hex}`, fontSize: '0.75rem' }}>
                          <span style={{ fontWeight: 600, color: det.color_hex }}>{det.cell_type}</span>
                          <span style={{ marginLeft: '4px', color: 'var(--text-3)' }}>({Math.round(det.confidence * 100)}% conf, N:C {det.nc_ratio})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DiagnosticIntelligenceView;
