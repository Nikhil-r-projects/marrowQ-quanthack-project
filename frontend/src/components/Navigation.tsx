import React from 'react';
import {
  LayoutDashboard, UserCheck, Activity, BarChart3, Cpu, Database,
  Building2, FileText, Sliders
} from 'lucide-react';
import { UserRole } from '../types';

export type TabId =
  | 'overview'
  | 'progress'
  | 'diagnostic'
  | 'models'
  | 'results'
  | 'quantum_lab'
  | 'dataset'
  | 'hospital'
  | 'report'
  | 'setup';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  role: UserRole;
  isExperimentRunning?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  role,
  isExperimentRunning
}) => {
  const allTabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['doctor', 'researcher', 'patient', 'hospital_admin'] },
    { id: 'progress', label: 'Patient Progress', icon: UserCheck, roles: ['doctor', 'patient', 'hospital_admin'], badge: 'Impending' },
    { id: 'diagnostic', label: 'Diagnostic Intelligence', icon: Activity, roles: ['doctor', 'researcher', 'hospital_admin'] },
    { id: 'models', label: 'Model Comparison', icon: BarChart3, roles: ['doctor', 'researcher'] },
    { id: 'quantum_lab', label: 'Quantum Lab', icon: Cpu, roles: ['researcher', 'doctor'] },
    { id: 'dataset', label: 'Research Dataset', icon: Database, roles: ['researcher'] },
    { id: 'hospital', label: 'Hospital Analytics', icon: Building2, roles: ['hospital_admin', 'doctor'] },
    { id: 'setup', label: 'Training & Experiments', icon: Sliders, roles: ['researcher'], badge: isExperimentRunning ? 'Active' : undefined },
    { id: 'report', label: 'Reports & Audit', icon: FileText, roles: ['doctor', 'researcher', 'patient', 'hospital_admin'] }
  ];

  const visibleTabs = allTabs.filter(t => t.roles.includes(role));

  return (
    <nav className="app-nav" style={{
      background: '#0b1329',
      borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
      padding: '0 2rem'
    }}>
      <div className="nav-inner" style={{
        maxWidth: '1440px',
        margin: '0 auto',
        display: 'flex',
        gap: '0.25rem',
        overflowX: 'auto'
      }}>
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id as TabId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.85rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: isActive ? '#38bdf8' : '#94a3b8',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: tab.badge === 'Active' ? '#0ea5e9' : 'rgba(16, 185, 129, 0.15)',
                    color: tab.badge === 'Active' ? '#070d18' : '#10b981',
                    fontWeight: 700
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
