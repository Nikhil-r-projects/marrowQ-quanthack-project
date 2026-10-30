import React from 'react';
import { Activity, Cpu, ShieldAlert, Database, User, Search, RefreshCw, ChevronDown } from 'lucide-react';
import { SystemHealth, DatasetProfile, Patient, UserRole } from '../types';

interface HeaderProps {
  health: SystemHealth | null;
  dataset: DatasetProfile | null;
  role: UserRole;
  onRoleChange: (r: UserRole) => void;
  selectedPatient: Patient;
  patients: Patient[];
  onSelectPatient: (p: Patient) => void;
  onQuickInference?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  dataset,
  role,
  onRoleChange,
  selectedPatient,
  patients,
  onSelectPatient,
  onQuickInference
}) => {
  const isSynthetic = !dataset || dataset.data_mode === 'synthetic';

  return (
    <header className="app-header" style={{
      background: 'rgba(11, 19, 41, 0.95)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
      padding: '0.75rem 2rem'
    }}>
      <div className="header-inner" style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        
        {/* Logo and Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#070d18',
            boxShadow: '0 0 16px rgba(14, 165, 233, 0.4)'
          }}>
            <Activity size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                marrowQ 2.0
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontFamily: 'monospace',
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                Q-HSCT
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Quantum-Assisted Clinical Intelligence Platform
            </div>
          </div>
        </div>

        {/* Global Patient Selector & Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Active Patient Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#070d18', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '6px', padding: '0.35rem 0.75rem', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Patient:</span>
            <select
              value={selectedPatient?.patient_id || ''}
              onChange={e => {
                const found = patients.find(p => p.patient_id === e.target.value);
                if (found) onSelectPatient(found);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {patients.map(p => (
                <option key={p.patient_id} value={p.patient_id} style={{ background: '#0b1329', color: '#f8fafc' }}>
                  {p.name} ({p.patient_id})
                </option>
              ))}
            </select>
          </div>

          {/* Role Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#070d18', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '6px', padding: '0.35rem 0.75rem', gap: '0.5rem' }}>
            <User size={13} color="#94a3b8" />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Role:</span>
            <select
              value={role}
              onChange={e => onRoleChange(e.target.value as UserRole)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#10b981',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="doctor" style={{ background: '#0b1329', color: '#f8fafc' }}>Doctor / Hematologist</option>
              <option value="researcher" style={{ background: '#0b1329', color: '#f8fafc' }}>Clinical Researcher</option>
              <option value="patient" style={{ background: '#0b1329', color: '#f8fafc' }}>Patient / Family</option>
              <option value="hospital_admin" style={{ background: '#0b1329', color: '#f8fafc' }}>Hospital Admin</option>
            </select>
          </div>

          {/* Real-time IBM Quantum Telemetry Chip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '6px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.75rem',
            color: '#38bdf8'
          }}>
            <Cpu size={13} />
            <span>Qiskit Runtime: Online</span>
          </div>

          {/* Quick Inference Trigger */}
          {onQuickInference && (
            <button
              onClick={onQuickInference}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                background: '#0ea5e9',
                color: '#070d18',
                fontWeight: 600,
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Activity size={14} />
              Run Predictions
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
