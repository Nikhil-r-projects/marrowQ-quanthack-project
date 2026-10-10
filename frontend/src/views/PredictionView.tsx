import React, { useState, useEffect } from 'react';
import { UserCheck, ShieldAlert, Cpu, CheckCircle2, AlertTriangle, ArrowRight, Activity, Sparkles } from 'lucide-react';
import { Experiment, PredictionResult, AvailableModel } from '../types';
import { fetchAvailableModels, predictOutcome } from '../api';

interface PredictionViewProps {
  currentExperiment: Experiment | null;
}

export const PredictionView: React.FC<PredictionViewProps> = ({ currentExperiment }) => {
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string>(currentExperiment?.experiment_id || '');
  const [selectedModelKey, setSelectedModelKey] = useState<string>('logistic_regression');

  // Patient covariate form state
  const [formData, setFormData] = useState<Record<string, any>>({
    recipient_age: 48,
    recipient_gender: 'M',
    recipient_kps: 90,
    recipient_cmv: 'Positive',
    comorbidity_index: 1,
    primary_disease: 'AML',
    disease_status: 'CR1',
    conditioning_intensity: 'MAC',
    donor_age: 32,
    donor_gender: 'M',
    donor_cmv: 'Negative',
    donor_type: 'Matched_Sibling',
    graft_source: 'PBSC',
    hla_match_score: 8,
    cd34_dose: 5.5,
    total_nucleated_cells: 4.8,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableModels()
      .then((models) => {
        setAvailableModels(models);
        if (models.length > 0 && !selectedExpId) {
          setSelectedExpId(models[0].experiment_id);
          setSelectedModelKey(models[0].model_key);
        }
      })
      .catch((err) => console.error('Failed to fetch models', err));
  }, [currentExperiment]);

  const handleInputChange = (field: string, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handlePredict = async () => {
    if (!selectedExpId) {
      setError('Please select a completed experiment model.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await predictOutcome({
        experiment_id: selectedExpId,
        model_name: selectedModelKey,
        features: formData,
      });
      setPrediction(result);
    } catch (err: any) {
      setError(err.message || 'Inference error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Mandatory Disclaimer */}
      <div className="alert-banner alert-synthetic">
        <ShieldAlert size={20} style={{ flexShrink: 0 }} />
        <div>
          <strong>CLINICAL DECISION SUPPORT BOUNDARY:</strong>
          <p style={{ marginTop: '0.25rem' }}>
            This interactive demonstration executes inference on a trained model artifact for testing and educational inspection. <strong>Never use for autonomous clinical triage or therapeutic decision making.</strong>
          </p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left Column: Model Selector & Patient Parameters */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <UserCheck size={18} /> Pre-Transplant Patient Profile
              </div>
              <div className="card-subtitle">
                Enter baseline clinical covariates (available on or before Day 0)
              </div>
            </div>
          </div>

          {/* Model Selection */}
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Trained Experiment</label>
              <select
                className="form-select"
                value={selectedExpId}
                onChange={(e) => setSelectedExpId(e.target.value)}
              >
                {availableModels.length === 0 ? (
                  <option value="">No completed models found</option>
                ) : (
                  Array.from(new Set(availableModels.map((m) => m.experiment_id))).map((eid) => (
                    <option key={eid} value={eid}>
                      {eid} ({availableModels.find((m) => m.experiment_id === eid)?.data_mode.toUpperCase()})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Model Architecture</label>
              <select
                className="form-select"
                value={selectedModelKey}
                onChange={(e) => setSelectedModelKey(e.target.value)}
              >
                {availableModels
                  .filter((m) => m.experiment_id === selectedExpId)
                  .map((m) => (
                    <option key={m.model_key} value={m.model_key}>
                      {m.display_name} (Acc: {(m.accuracy * 100).toFixed(1)}%)
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Form Fields */}
          <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Recipient Age</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.recipient_age}
                  onChange={(e) => handleInputChange('recipient_age', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Recipient Sex</label>
                <select
                  className="form-select"
                  value={formData.recipient_gender}
                  onChange={(e) => handleInputChange('recipient_gender', e.target.value)}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Karnofsky Score (KPS)</label>
                <select
                  className="form-select"
                  value={formData.recipient_kps}
                  onChange={(e) => handleInputChange('recipient_kps', parseInt(e.target.value))}
                >
                  <option value={100}>100% (Normal)</option>
                  <option value={90}>90% (Able to carry normal activity)</option>
                  <option value={80}>80% (Normal with effort)</option>
                  <option value={70}>70% (Cares for self)</option>
                  <option value={60}>60% (Requires occasional assistance)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">HCT-CI Comorbidity</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  max="10"
                  value={formData.comorbidity_index}
                  onChange={(e) => handleInputChange('comorbidity_index', parseInt(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Primary Malignancy</label>
                <select
                  className="form-select"
                  value={formData.primary_disease}
                  onChange={(e) => handleInputChange('primary_disease', e.target.value)}
                >
                  <option value="AML">Acute Myeloid Leukemia (AML)</option>
                  <option value="ALL">Acute Lymphoblastic Leukemia (ALL)</option>
                  <option value="MDS">Myelodysplastic Syndrome (MDS)</option>
                  <option value="Lymphoma">Lymphoma</option>
                  <option value="MPN">Myeloproliferative Neoplasm</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Conditioning Regimen</label>
                <select
                  className="form-select"
                  value={formData.conditioning_intensity}
                  onChange={(e) => handleInputChange('conditioning_intensity', e.target.value)}
                >
                  <option value="MAC">Myeloablative (MAC)</option>
                  <option value="RIC">Reduced Intensity (RIC)</option>
                  <option value="NMA">Non-Myeloablative (NMA)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Graft Source</label>
                <select
                  className="form-select"
                  value={formData.graft_source}
                  onChange={(e) => handleInputChange('graft_source', e.target.value)}
                >
                  <option value="PBSC">Peripheral Blood Stem Cells (PBSC)</option>
                  <option value="Bone_Marrow">Bone Marrow (BM)</option>
                  <option value="Cord_Blood">Cord Blood (CBT)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Donor Type</label>
                <select
                  className="form-select"
                  value={formData.donor_type}
                  onChange={(e) => handleInputChange('donor_type', e.target.value)}
                >
                  <option value="Matched_Sibling">Matched Sibling</option>
                  <option value="MUD">Matched Unrelated (MUD)</option>
                  <option value="MMUD">Mismatched Unrelated</option>
                  <option value="Haploidentical">Haploidentical</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">CD34+ Cell Dose (x10^6/kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={formData.cd34_dose}
                  onChange={(e) => handleInputChange('cd34_dose', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">HLA Match (out of 8)</label>
                <select
                  className="form-select"
                  value={formData.hla_match_score}
                  onChange={(e) => handleInputChange('hla_match_score', parseInt(e.target.value))}
                >
                  <option value={8}>8 / 8 Matched</option>
                  <option value={7}>7 / 8 Mismatched</option>
                  <option value={6}>6 / 8 Mismatched</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handlePredict}
              disabled={isLoading || !selectedExpId}
            >
              <Sparkles size={16} />
              {isLoading ? 'Computing Preprocessing & Model Score...' : 'Run Pipeline Inference'}
            </button>
          </div>

          {error && (
            <div className="alert-banner alert-error" style={{ marginTop: '1rem' }}>
              <AlertTriangle size={16} />
              <div>{error}</div>
            </div>
          )}
        </div>

        {/* Right Column: Model Output & Verification */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Activity size={18} /> Model Prediction & Confidence
              </div>
            </div>

            {prediction ? (
              <div style={{ padding: '0.5rem 0' }}>
                <div
                  style={{
                    background: prediction.prediction === 1 ? '#ecfdf5' : '#fffbeb',
                    border: `1px solid ${prediction.prediction === 1 ? '#a7f3d0' : '#fde68a'}`,
                    borderRadius: '8px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700, color: '#64748b' }}>
                    Predicted Day 28 Engraftment Horizon
                  </div>
                  <div
                    style={{
                      fontSize: '1.65rem',
                      fontWeight: 800,
                      marginTop: '0.25rem',
                      color: prediction.prediction === 1 ? '#047857' : '#b45309',
                    }}
                  >
                    {prediction.prediction_label}
                  </div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#334155' }}>
                    {prediction.model_confidence_description}
                  </div>
                </div>

                {prediction.probability !== null && prediction.probability !== undefined && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
                      <span>Model Timely Recovery Score</span>
                      <span style={{ fontWeight: 700 }}>{(prediction.probability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="progress-bar-bg" style={{ height: '10px' }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${prediction.probability * 100}%`,
                          background: prediction.probability >= 0.5 ? '#059669' : '#d97706',
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', fontSize: '0.8rem', color: '#475569', lineHeight: '1.6' }}>
                  <div><strong>Architecture:</strong> {prediction.model_name}</div>
                  <div><strong>Experiment Provenance:</strong> <code>{prediction.experiment_id}</code></div>
                  <div><strong>Data Mode:</strong> {prediction.data_mode.toUpperCase()}</div>
                  <div style={{ marginTop: '0.5rem', color: '#b45309' }}>
                    <strong>Disclaimer:</strong> {prediction.disclaimer}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
                <Activity size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.875rem' }}>Adjust patient parameters and click "Run Pipeline Inference" to execute the fitted model.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
