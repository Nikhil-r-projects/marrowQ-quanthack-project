import React from 'react';
import { Activity, Cpu, ShieldAlert, Database } from 'lucide-react';
import { SystemHealth, DatasetProfile } from '../types';

interface HeaderProps {
  health: SystemHealth | null;
  dataset: DatasetProfile | null;
}

export const Header: React.FC<HeaderProps> = ({ health, dataset }) => {
  const isSynthetic = !dataset || dataset.data_mode === 'synthetic';

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="logo-section">
          <div className="logo-icon">
            <Activity size={24} />
          </div>
          <div>
            <div className="logo-title">MarrowQ</div>
            <div className="logo-sub">Quantum-Assisted HSCT Recovery Prediction System</div>
          </div>
        </div>

        <div className="header-badges">
          <div className="badge badge-prototype">
            <span className="badge-dot" style={{ background: '#64748b' }}></span>
            Research Prototype
          </div>

          <div className={`badge ${isSynthetic ? 'badge-synthetic' : 'badge-research'}`}>
            <Database size={12} />
            {isSynthetic ? 'Synthetic Demo Mode' : 'Research Cohort Mode'}
          </div>

          <div className="badge badge-health">
            <Cpu size={12} />
            Qiskit: {health?.versions?.qiskit || 'Checking...'}
          </div>

          <div className="badge" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}>
            <ShieldAlert size={12} />
            Not for Clinical Decision Making
          </div>
        </div>
      </div>
    </header>
  );
};
