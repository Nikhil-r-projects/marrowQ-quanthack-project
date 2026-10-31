import React, { useState } from 'react';
import { Database, RefreshCw, ServerOff, UserPlus, Users } from 'lucide-react';
import { admitExamplePatients } from '../api';
import { Patient } from '../types';

/** Shown instead of data when the MarrowQ server cannot be reached; nothing is invented in its place. */
export const ServerOffline: React.FC<{ onRetry: () => void; retrying: boolean }> = ({ onRetry, retrying }) => (
  <div className="card empty-state">
    <ServerOff size={34} />
    <h3>The MarrowQ server is not reachable</h3>
    <p>
      Patient records, models and simulations live on the server. Start it inside WSL with{' '}
      <code>python -m uvicorn app.main:app --app-dir backend</code> and the compute worker with{' '}
      <code>python -m app.worker</code>, then retry. The Quantum lab still works offline with an exact in-browser simulator.
    </p>
    <button className="btn btn-primary" onClick={onRetry} disabled={retrying}>
      <RefreshCw size={15} className={retrying ? 'spin' : undefined} /> {retrying ? 'Checking…' : 'Retry connection'}
    </button>
  </div>
);

/** First run: no ward patients yet. Offers real intake, or examples copied from UCI cohort records. */
export const EmptyWard: React.FC<{ onAdmit: () => void; onExamplesLoaded: (patients: Patient[]) => void }> = ({ onAdmit, onExamplesLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExamples = async () => {
    setLoading(true);
    setError(null);
    try {
      onExamplesLoaded(await admitExamplePatients(4));
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="card empty-state">
      <Users size={34} />
      <h3>No patients on the ward yet</h3>
      <p>
        Admit a transplant recipient with their pre-transplant data, or load example patients whose data is copied
        from real records in the UCI paediatric transplant cohort. Examples are labelled as such everywhere, and their
        recorded outcomes are kept out of the clinical views.
      </p>
      <div className="row" style={{ marginTop: '0.4rem' }}>
        <button className="btn btn-primary" onClick={onAdmit}><UserPlus size={15} /> Admit patient</button>
        <button className="btn btn-secondary" onClick={loadExamples} disabled={loading}>
          <Database size={15} /> {loading ? 'Loading…' : 'Load 4 example patients'}
        </button>
      </div>
      {error && <p className="small" style={{ color: 'var(--red-text)' }}>{error}</p>}
    </div>
  );
};
