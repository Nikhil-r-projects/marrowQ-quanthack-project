import React, { useState, useEffect } from 'react';
import { FileText, Download, Copy, Check, AlertCircle } from 'lucide-react';
import { Experiment } from '../types';
import { fetchReport } from '../api';

interface ReportViewProps {
  currentExperiment: Experiment | null;
}

export const ReportView: React.FC<ReportViewProps> = ({ currentExperiment }) => {
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!currentExperiment || currentExperiment.status !== 'completed') return;

    setIsLoading(true);
    fetchReport(currentExperiment.experiment_id)
      .then((data) => {
        setReportMarkdown(data.markdown_report);
      })
      .catch((err) => console.error('Failed to load report', err))
      .finally(() => setIsLoading(false));
  }, [currentExperiment]);

  if (!currentExperiment || currentExperiment.status !== 'completed') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
        <FileText size={38} style={{ margin: '0 auto 0.75rem', color: '#94a3b8' }} />
        <h3>No Completed Experiment for Reporting</h3>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Execute an experiment to auto-generate a comprehensive, cited scientific research report.
        </p>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MarrowQ_Report_${currentExperiment.experiment_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <FileText size={18} /> Scientific Research & Validation Report
            </div>
            <div className="card-subtitle">
              Experiment: <code>{currentExperiment.experiment_id}</code> | Cohort: {currentExperiment.dataset_name}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={handleCopy} disabled={!reportMarkdown}>
              {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Markdown'}
            </button>
            <button className="btn btn-primary" onClick={handleDownload} disabled={!reportMarkdown}>
              <Download size={14} /> Download .MD
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>Formatting research synthesis...</div>
        ) : (
          <div className="markdown-view" style={{ whiteSpace: 'pre-wrap', fontFamily: 'system-ui, sans-serif' }}>
            {reportMarkdown}
          </div>
        )}
      </div>
    </div>
  );
};
