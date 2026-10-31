import React, { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Database, FileSpreadsheet, RefreshCw, ShieldAlert, TriangleAlert, Upload } from 'lucide-react';
import { DatasetProfile } from '../types';
import { uploadDatasetFile } from '../api';
import { TabId } from '../navigation';

interface DatasetViewProps {
  dataset: DatasetProfile | null;
  onDatasetLoaded: (ds: DatasetProfile) => void;
  onLoadDemo: () => void;
  isLoadingDemo: boolean;
  onNavigate: (tab: TabId) => void;
}

const MAX_BYTES = 20 * 1024 * 1024;

export const DatasetView: React.FC<DatasetViewProps> = ({ dataset, onDatasetLoaded, onLoadDemo, isLoadingDemo, onNavigate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setUploadError('Please choose a .csv file.'); return; }
    if (file.size > MAX_BYTES) { setUploadError('File is larger than 20 MB.'); return; }
    setIsUploading(true);
    setUploadError(null);
    try {
      onDatasetLoaded(await uploadDatasetFile(file));
    } catch (err: any) {
      setUploadError(err?.message || 'File upload failed');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const total = dataset?.total_rows ?? 0;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Database size={13} /> Research · step 1 of 4</div>
          <h2>Datasets</h2>
          <p>Load the UCI paediatric transplant cohort (187 real recipients) or upload an approved, de-identified research extract. Every dataset is profiled and screened for post-transplant leakage before modelling.</p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={onLoadDemo} disabled={isLoadingDemo}>
            <RefreshCw size={14} className={isLoadingDemo ? 'spin' : ''} />
            {isLoadingDemo ? 'Loading…' : 'Load UCI cohort (N = 187)'}
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('setup')} disabled={!dataset}>
            Configure benchmark <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid-2">
        <label
          className={`dropzone ${dragOver ? 'over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        >
          <Upload size={28} />
          <strong>{isUploading ? 'Uploading and profiling…' : 'Drop a CSV here or click to browse'}</strong>
          <span className="small muted">Up to 20 MB. The original file is kept immutable; a validated working copy is profiled.</span>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={e => handleFile(e.target.files?.[0])} disabled={isUploading} />
        </label>

        <div className="card">
          <div className="card-title" style={{ marginBottom: '0.6rem' }}><ShieldAlert size={16} /> Data requirements</div>
          <ul className="small muted" style={{ paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <li><strong style={{ color: 'var(--text)' }}>Pre-transplant features only.</strong> Columns recorded after Day 0 (GvHD, chimerism, infections) leak the outcome and are flagged.</li>
            <li><strong style={{ color: 'var(--text)' }}>Binary target.</strong> For the UCI cohort: <code>early_engraftment</code> (1 = ANC &gt; 500 by Day +14; 42% of recipients). Day +28 is not used because 97% of these children engraft by then.</li>
            <li><strong style={{ color: 'var(--text)' }}>De-identified.</strong> No names or direct identifiers; registry data-use terms (e.g. CIBMTR) forbid re-identification attempts.</li>
          </ul>
        </div>
      </div>

      {uploadError && <div className="alert-banner alert-error"><TriangleAlert size={16} /><div>{uploadError}</div></div>}

      {!dataset ? (
        <div className="card empty-state">
          <FileSpreadsheet size={34} />
          <h3>No dataset loaded</h3>
          <p>{isLoadingDemo ? 'Loading the UCI cohort…' : 'Load the UCI cohort or upload a CSV to see its profile.'}</p>
        </div>
      ) : (
        <>
          <div className={`alert-banner ${dataset.data_mode === 'synthetic' ? 'alert-warn' : 'alert-info'}`}>
            <FileSpreadsheet size={16} />
            <div>
              <strong>{dataset.name}</strong> · {dataset.source}
              <div className="small" style={{ marginTop: '0.15rem' }}>
                {dataset.data_mode === 'synthetic' ? 'Synthetic demonstration data, not clinical evidence' : 'Research extract'} · {total.toLocaleString()} rows · {dataset.total_columns} columns · {dataset.duplicates_count} duplicates
              </div>
            </div>
          </div>

          {dataset.potential_leakage_warnings.length > 0 && (
            <div className="alert-banner alert-success">
              <CheckCircle2 size={16} />
              <div>
                <strong>Leakage screen passed · {dataset.potential_leakage_warnings.length} post-transplant column{dataset.potential_leakage_warnings.length > 1 ? 's' : ''} excluded from the features automatically</strong>
                <details style={{ marginTop: '0.3rem' }}>
                  <summary className="small" style={{ cursor: 'pointer' }}>Show excluded columns{dataset.data_quality_notes?.length ? ' and data-quality notes' : ''}</summary>
                  <ul className="small" style={{ margin: '0.3rem 0 0 1.1rem' }}>
                    {dataset.potential_leakage_warnings.map((w, i) => <li key={i}>{w}</li>)}
                    {dataset.data_quality_notes?.map((w, i) => <li key={`q${i}`}>{w}</li>)}
                  </ul>
                </details>
              </div>
            </div>
          )}

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title"><CheckCircle2 size={16} /> Target</div>
                  <div className="card-subtitle"><code>{dataset.suggested_target}</code></div>
                </div>
              </div>
              {dataset.class_distribution ? Object.entries(dataset.class_distribution).map(([cls, count]) => {
                const share = total ? (count / total) * 100 : 0;
                return (
                  <div key={cls} style={{ marginBottom: '0.9rem' }}>
                    <div className="row between small" style={{ marginBottom: '0.3rem' }}>
                      <span>{dataset.suggested_target === 'early_engraftment'
                        ? (cls === '1' ? 'Engrafted by Day +14' : 'Engrafted after Day +14 or not at all')
                        : dataset.suggested_target === 'neutrophil_recovery_day28'
                          ? (cls === '1' ? 'Engrafted by Day +28' : 'Delayed engraftment or graft failure')
                          : `${dataset.suggested_target} = ${cls}`}</span>
                      <strong className="tnum">{count} · {share.toFixed(1)}%</strong>
                    </div>
                    <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${share}%`, background: cls === '1' ? 'var(--accent)' : 'var(--text-3)' }} /></div>
                  </div>
                );
              }) : <p className="small muted">Class balance unavailable for this dataset.</p>}
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Missing values</div>
                  <div className="card-subtitle">Imputed with training-set medians / modes only</div>
                </div>
              </div>
              <div className="table-responsive" style={{ maxHeight: 220 }}>
                <table className="data-table">
                  <thead><tr><th>Column</th><th className="num">Missing</th><th className="num">%</th></tr></thead>
                  <tbody>
                    {Object.entries(dataset.missing_counts).sort((a, b) => b[1] - a[1]).map(([col, n]) => (
                      <tr key={col}><td><code>{col}</code></td><td className="num">{n}</td><td className="num">{dataset.missing_percentages[col]}%</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card flush">
            <div className="card-header divided" style={{ padding: '1.1rem 1.25rem 0.9rem', margin: 0 }}>
              <div className="card-title">Columns · {dataset.columns.length}</div>
            </div>
            <div className="table-responsive" style={{ maxHeight: 380 }}>
              <table className="data-table">
                <thead><tr><th>Column</th><th>Type</th><th className="num">Missing</th><th>Summary</th></tr></thead>
                <tbody>
                  {dataset.columns.map(col => {
                    const type = dataset.column_types[col] || 'unknown';
                    const n = dataset.numeric_summaries[col];
                    const c = dataset.categorical_summaries[col];
                    return (
                      <tr key={col}>
                        <td><code>{col}</code>{col === dataset.suggested_target && <span className="chip chip-blue" style={{ marginLeft: 6 }}>Target</span>}</td>
                        <td><span className={`chip ${type === 'numeric' ? 'chip-blue' : 'chip-neutral'}`}>{type}</span></td>
                        <td className="num">{dataset.missing_percentages[col] ?? 0}%</td>
                        <td className="small muted">
                          {n ? `mean ${n.mean} · median ${n.median} · range ${n.min}–${n.max}`
                            : c ? Object.entries(c).slice(0, 4).map(([k, v]) => `${k.replace(/_/g, ' ')} (${v})`).join(', ')
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
