import React, { useState } from 'react';
import { Upload, Database, AlertTriangle, CheckCircle, RefreshCw, FileText } from 'lucide-react';
import { DatasetProfile } from '../types';
import { uploadDatasetFile } from '../api';

interface DatasetViewProps {
  dataset: DatasetProfile | null;
  onDatasetLoaded: (ds: DatasetProfile) => void;
  onLoadDemo: () => void;
  isLoadingDemo: boolean;
}

export const DatasetView: React.FC<DatasetViewProps> = ({
  dataset,
  onDatasetLoaded,
  onLoadDemo,
  isLoadingDemo,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const profile = await uploadDatasetFile(file);
      onDatasetLoaded(profile);
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      {/* Upload and Generation Action Bar */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Database size={18} /> Ingest Research Cohort or Synthetic Benchmark
            </div>
            <div className="card-subtitle">
              Upload an authorized de-identified research extract or generate a CIBMTR-grounded synthetic cohort
            </div>
          </div>
          <button className="btn btn-primary" onClick={onLoadDemo} disabled={isLoadingDemo}>
            <RefreshCw size={14} className={isLoadingDemo ? 'spin' : ''} />
            {isLoadingDemo ? 'Generating...' : 'Load Synthetic Cohort (N=500)'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
          {/* File Upload Box */}
          <div
            style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '8px',
              padding: '1.75rem',
              textAlign: 'center',
              background: '#f8fafc',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <Upload size={32} style={{ margin: '0 auto 0.5rem', color: '#6366f1' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Upload Research Dataset (.csv)</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
              Maximum file size: 20MB. Immutable working copy will be validated.
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
              disabled={isUploading}
            />
            {isUploading && <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6366f1' }}>Uploading and profiling...</div>}
          </div>

          {/* Guidelines Box */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.5rem' }}>
              Clinical Research Data Requirements
            </div>
            <ul style={{ fontSize: '0.8rem', color: '#475569', lineHeight: '1.6', paddingLeft: '1.2rem' }}>
              <li><strong>Pre-transplant Features Only:</strong> Exclude post-transplant complications to prevent leakage.</li>
              <li><strong>Binary Target:</strong> Suggested target is <code>neutrophil_recovery_day28</code> (1 = timely, 0 = delayed).</li>
              <li><strong>CIBMTR Compliance:</strong> De-identified research extracts only; no direct identifiers.</li>
            </ul>
          </div>
        </div>

        {uploadError && (
          <div className="alert-banner alert-error" style={{ marginTop: '1rem' }}>
            <AlertTriangle size={16} />
            <div>{uploadError}</div>
          </div>
        )}
      </div>

      {/* Dataset Profile Details */}
      {dataset ? (
        <div>
          {/* Provenance and Warning Bar */}
          <div className={`alert-banner ${dataset.data_mode === 'synthetic' ? 'alert-synthetic' : 'alert-info'}`}>
            <FileText size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Active Dataset:</strong> {dataset.name} ({dataset.source})
              <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                Mode: <strong>{dataset.data_mode.toUpperCase()}</strong> | Total Rows: <strong>{dataset.total_rows}</strong> | Covariates: <strong>{dataset.total_columns}</strong> | Duplicates: <strong>{dataset.duplicates_count}</strong>
              </div>
            </div>
          </div>

          {/* Potential Leakage Alerts */}
          {dataset.potential_leakage_warnings.length > 0 && (
            <div className="card" style={{ borderColor: '#fca5a5', background: '#fff1f2' }}>
              <div className="card-title" style={{ color: '#9f1239', fontSize: '0.95rem' }}>
                <AlertTriangle size={18} color="#e11d48" /> Target Leakage Detection Warnings ({dataset.potential_leakage_warnings.length})
              </div>
              <p style={{ fontSize: '0.825rem', color: '#881337', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                The automated profiler identified variables that resemble post-transplant events or longitudinal time points. These must be excluded from pre-transplant prediction:
              </p>
              <ul style={{ paddingLeft: '1.5rem', fontSize: '0.825rem', color: '#9f1239' }}>
                {dataset.potential_leakage_warnings.map((w, idx) => (
                  <li key={idx} style={{ marginBottom: '0.25rem' }}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Class Balance & Suggested Target */}
          <div className="grid-2">
            <div className="card">
              <div className="card-title" style={{ fontSize: '0.95rem' }}>
                <CheckCircle size={16} color="#059669" /> Target Variable Profile
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                <div><strong>Inferred Target Column:</strong> <code>{dataset.suggested_target}</code></div>
                {dataset.class_distribution && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                      Class Balance (Held Cohort)
                    </div>
                    {Object.entries(dataset.class_distribution).map(([cls, count]) => {
                      const pct = ((count / dataset.total_rows) * 100).toFixed(1);
                      const label = cls === '1' ? 'Prompt Recovery (ANC >= 500 by Day 28)' : 'Delayed Recovery / Graft Failure';
                      return (
                        <div key={cls} style={{ marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                            <span>Class {cls}: {label}</span>
                            <span style={{ fontWeight: 700 }}>{count} ({pct}%)</span>
                          </div>
                          <div className="progress-bar-bg" style={{ marginTop: '0.25rem' }}>
                            <div
                              className="progress-bar-fill"
                              style={{
                                width: `${pct}%`,
                                background: cls === '1' ? '#4f46e5' : '#f59e0b'
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ fontSize: '0.95rem' }}>
                Missing Value Analysis
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Features with missing observations will be imputed using training-fitted medians (continuous) or modes (categorical) with strict leakage isolation.
                </p>
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Covariate</th>
                        <th>Missing Count</th>
                        <th>Missing %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dataset.missing_counts).slice(0, 8).map(([col, mCount]) => (
                        <tr key={col}>
                          <td><code>{col}</code></td>
                          <td>{mCount}</td>
                          <td>{dataset.missing_percentages[col]}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* All Covariates Table */}
          <div className="card">
            <div className="card-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
              Covariate Registry & Types ({dataset.columns.length})
            </div>
            <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column Name</th>
                    <th>Inferred Type</th>
                    <th>Missing</th>
                    <th>Summary Distribution / Distinct Values</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.columns.map((col) => {
                    const type = dataset.column_types[col] || 'unknown';
                    const numSum = dataset.numeric_summaries[col];
                    const catSum = dataset.categorical_summaries[col];

                    return (
                      <tr key={col}>
                        <td style={{ fontWeight: 600 }}><code>{col}</code></td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              background: type === 'numeric' ? '#e0e7ff' : '#f1f5f9',
                              color: type === 'numeric' ? '#3730a3' : '#475569'
                            }}
                          >
                            {type}
                          </span>
                        </td>
                        <td>{dataset.missing_percentages[col]}%</td>
                        <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                          {numSum ? (
                            `Mean: ${numSum.mean} | Min: ${numSum.min} | Med: ${numSum.median} | Max: ${numSum.max}`
                          ) : catSum ? (
                            Object.entries(catSum).slice(0, 4).map(([k, v]) => `${k} (${v})`).join(', ')
                          ) : (
                            'N/A'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ color: '#64748b' }}>No dataset selected. Click above to load the CIBMTR Synthetic Demo or upload a CSV.</p>
        </div>
      )}
    </div>
  );
};
