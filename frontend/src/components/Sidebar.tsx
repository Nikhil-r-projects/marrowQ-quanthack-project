import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Section, TabId } from '../navigation';

interface SidebarProps {
  sections: Section[];
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  backendOnline: boolean | null;
  experimentRunning: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sections,
  activeTab,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  backendOnline,
  experimentRunning
}) => {
  const groups = sections.reduce<Record<string, Section[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
      <button className="sidebar-brand" onClick={() => onNavigate(sections[0]?.id ?? 'overview')} title="MarrowQ home">
        <div className="brand-mark" aria-hidden="true">
          {/* A marrow cell: membrane with an off-centre nucleus. */}
          <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" /><circle cx="13.6" cy="10.4" r="3.1" fill="currentColor" /></svg>
        </div>
        <div className="brand-text">
          <div className="brand-name">Marrow<span>Q</span></div>
          <div className="brand-sub">HSCT recovery intelligence</div>
        </div>
      </button>

      <nav className="sidebar-nav">
        {Object.entries(groups).map(([group, items]) => (
          <div className="nav-group" key={group}>
            <div className="nav-group-label">{group}</div>
            {items.map(item => {
              const Icon = item.icon;
              const active = item.id === activeTab;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${active ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : item.description}
                >
                  <Icon size={18} />
                  <span className="nav-label">{item.label}</span>
                  {item.id === 'monitor' && experimentRunning && <span className="nav-badge">Running</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="status-line" title={backendOnline ? 'Connected to the MarrowQ API' : 'API unreachable, computing locally in the browser'}>
          <span className={`status-dot ${backendOnline === false ? 'offline' : ''}`} />
          <span className="status-text">
            {backendOnline === null ? 'Checking backend…' : backendOnline ? 'Backend connected' : 'Offline mode · local compute'}
          </span>
        </div>
        <button className="nav-item desktop-only" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span className="nav-label">Collapse</span>
        </button>
      </div>
    </aside>
  );
};
