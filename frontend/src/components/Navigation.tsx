import React from 'react';
import { LayoutDashboard, Database, Sliders, Activity, BarChart3, UserCheck, FileText } from 'lucide-react';

export type TabId = 'overview' | 'dataset' | 'setup' | 'monitor' | 'results' | 'prediction' | 'report';

interface NavigationProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  hasDataset: boolean;
  hasExperiment: boolean;
  isExperimentRunning: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  hasDataset,
  hasExperiment,
  isExperimentRunning
}) => {
  const tabs = [
    { id: 'overview', label: '1. Overview', icon: LayoutDashboard },
    { id: 'dataset', label: '2. Dataset Explorer', icon: Database },
    { id: 'setup', label: '3. Experiment Setup', icon: Sliders },
    { id: 'monitor', label: '4. Experiment Monitor', icon: Activity, badge: isExperimentRunning ? 'Active' : undefined },
    { id: 'results', label: '5. Results & Validation', icon: BarChart3, badge: hasExperiment ? undefined : 'Pending' },
    { id: 'prediction', label: '6. Patient Demo', icon: UserCheck },
    { id: 'report', label: '7. Research Report', icon: FileText },
  ];

  return (
    <nav className="app-nav">
      <div className="nav-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`nav-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id as TabId)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    background: tab.badge === 'Active' ? '#4f46e5' : '#e2e8f0',
                    color: tab.badge === 'Active' ? '#ffffff' : '#64748b'
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
