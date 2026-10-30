import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, FileText } from 'lucide-react';
import { Experiment } from '../types';
import { fetchReport } from '../api';
import { TabId } from '../navigation';
import { renderMarkdown } from '../lib/markdown';

interface ReportViewProps {
  currentExperiment: Experiment | null;
  onNavigate: (tab: TabId) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ currentExperiment, onNavigate }) => {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = currentExperiment?.status === 'completed';
  const id = currentExperiment?.experiment_id;

  useEffect(() => {
    if (!ready || !id) return;
    let live = true;
    setLoading(true);
    setError(null);
    fetchReport(id)
      .then(d => { if (live) setMarkdown(d.markdown_report); })
      .catch(() => { if (live) setError('The report could not be generated.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [ready, id]);

  const rendered = useMemo(() => renderMarkdown(markdown), [markdown]);

  if (!ready || !currentExperiment) {
    return (
      <div className="card empty-state">
        <FileText size={34} />
        <h3>No completed experiment</h3>
        <p>A cited research report is generated automatically once a benchmark run finishes.</p>
        <button className="btn btn-primary" onClick={() => onNavigate(currentExperiment ? 'monitor' : 'setup')}>
          {currentExperiment ? 'Open run monitor' : 'Configure benchmark'}
        </button>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed. Use Download instead.');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `MarrowQ_Report_${currentExperiment.experiment_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <div className="eyebrow"><FileText size={13} /> Research report</div>
          <h2>Study report</h2>
          <p>Experiment <code>{currentExperiment.experiment_id}</code> · {currentExperiment.dataset_name}</p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" onClick={copy} disabled={!markdown}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy Markdown'}
          </button>
          <button className="btn btn-primary" onClick={download} disabled={!markdown}>
            <Download size={14} /> Download .md
          </button>
        </div>
      </div>

      {error && <div className="alert-banner alert-error">{error}</div>}

      <article className="card report">
        {loading ? (
          <div className="stack" style={{ gap: '0.7rem' }}>
            {[70, 100, 90, 95, 60].map((w, i) => <div key={i} className="skeleton" style={{ height: 14, width: `${w}%` }} />)}
          </div>
        ) : rendered}
      </article>
    </div>
  );
};
