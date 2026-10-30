import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, ChevronDown, Link2, Menu, Monitor, Moon, Search, Sun, UserPlus, UserRound, Users } from 'lucide-react';
import { Patient, UserRole } from '../types';
import { ROLE_LABELS, Section, TabId } from '../navigation';
import { ThemePreference, useDismiss, useTheme } from '../hooks';
import { daysPostTransplant } from '../data/observations';
import { avatarTone, initials } from '../lib/format';

export interface ClinicalAlert {
  id: string;
  tone: 'red' | 'amber' | 'blue' | 'green';
  title: string;
  body: string;
  patientId?: string;
  tab?: TabId;
}

interface TopbarProps {
  section: Section;
  sections: Section[];
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (patientId: string) => void;
  onNavigate: (tab: TabId, patientId?: string) => void;
  alerts: ClinicalAlert[];
  unreadAlerts: number;
  onAlertsSeen: () => void;
  onOpenMobileNav: () => void;
  onShare: () => void;
  onNewPatient: () => void;
}

const THEME_OPTIONS: { id: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'Auto', Icon: Monitor }
];

export const Topbar: React.FC<TopbarProps> = ({
  section,
  sections,
  role,
  onRoleChange,
  patients,
  selectedPatient,
  onSelectPatient,
  onNavigate,
  alerts,
  unreadAlerts,
  onAlertsSeen,
  onOpenMobileNav,
  onShare,
  onNewPatient
}) => {
  const [open, setOpen] = useState<'patients' | 'search' | 'alerts' | 'user' | null>(null);
  const [theme, setTheme] = useTheme();
  const close = useCallback(() => setOpen(null), []);

  const patientRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useDismiss(patientRef, open === 'patients', close);
  useDismiss(searchRef, open === 'search', close);
  useDismiss(alertsRef, open === 'alerts', close);
  useDismiss(userRef, open === 'user', close);

  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const isPatientRole = role === 'patient';
  const showPatientSwitch = section.patientScoped && selectedPatient != null;

  // "/" or Ctrl/Cmd+K focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        searchInput.current?.focus();
        setOpen('search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const sectionHits = sections
      .filter(s => `${s.label} ${s.description} ${s.group}`.toLowerCase().includes(q))
      .map(s => ({ key: `s-${s.id}`, title: s.label, sub: s.description, icon: s.icon, run: () => onNavigate(s.id) }));
    const patientHits = isPatientRole ? [] : patients
      .filter(p => `${p.name} ${p.patient_id} ${p.disease} ${p.source_record ?? ''}`.toLowerCase().includes(q))
      .map(p => ({ key: `p-${p.patient_id}`, title: p.name, sub: `${p.patient_id} · ${p.disease}`, icon: Users, run: () => onNavigate(section.patientScoped ? section.id : 'overview', p.patient_id) }));
    return [...patientHits, ...sectionHits].slice(0, 8);
  }, [query, sections, patients, isPatientRole, onNavigate, section]);

  const runResult = (i: number) => {
    const r = results[i];
    if (!r) return;
    r.run();
    setQuery('');
    setOpen(null);
    searchInput.current?.blur();
  };

  const day = selectedPatient ? daysPostTransplant(selectedPatient) : 0;

  return (
    <header className="topbar">
      <button className="icon-btn ghost mobile-only" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu size={18} />
      </button>

      <div className="topbar-title">
        <span className="crumb">{section.group}</span>
        <h1>{section.label}</h1>
      </div>

      <div className="topbar-spacer" />

      {showPatientSwitch && selectedPatient && (
        <div className="popover-anchor" ref={patientRef}>
          <button
            className="patient-switch"
            onClick={() => setOpen(o => (o === 'patients' ? null : 'patients'))}
            disabled={isPatientRole}
            aria-haspopup="listbox"
            aria-expanded={open === 'patients'}
            title={isPatientRole ? 'Your record' : 'Switch patient'}
          >
            <span className={`avatar ${avatarTone(selectedPatient.patient_id)}`}>{initials(selectedPatient.name)}</span>
            <span className="who">
              <strong>{selectedPatient.name}</strong>
              <span>{selectedPatient.patient_id} · Day {day >= 0 ? `+${day}` : day}</span>
            </span>
            {!isPatientRole && <ChevronDown size={14} className="faint" />}
          </button>
          {open === 'patients' && (
            <div className="popover" style={{ width: 340 }} role="listbox" aria-label="Patients">
              <div className="popover-header">
                <span>Transplant cohort · {patients.length}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => { close(); onNewPatient(); }}>
                  <UserPlus size={13} /> Admit
                </button>
              </div>
              {patients.map(p => {
                const selected = p.patient_id === selectedPatient.patient_id;
                const d = daysPostTransplant(p);
                return (
                  <button
                    key={p.patient_id}
                    role="option"
                    aria-selected={selected}
                    className={`menu-item ${selected ? 'selected' : ''}`}
                    onClick={() => { onSelectPatient(p.patient_id); close(); }}
                  >
                    <span className={`avatar ${avatarTone(p.patient_id)}`}>{initials(p.name)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="row between">
                        <span className="mi-title">{p.name}</span>
                        <span className="tiny faint">Day {d >= 0 ? `+${d}` : d}</span>
                      </span>
                      <span className="mi-sub" style={{ display: 'block' }}>{p.patient_id} · {p.disease}{p.source === 'example' ? ' · example' : ''}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="popover-anchor desktop-only" ref={searchRef}>
        <label className="search-box">
          <Search size={15} />
          <span className="sr-only">Search patients and sections</span>
          <input
            ref={searchInput}
            type="search"
            placeholder={isPatientRole ? 'Search sections' : 'Search patients, sections'}
            value={query}
            onFocus={() => setOpen('search')}
            onChange={e => { setQuery(e.target.value); setHighlight(0); setOpen('search'); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); runResult(highlight); }
              else if (e.key === 'Escape') { setQuery(''); close(); searchInput.current?.blur(); }
            }}
            aria-autocomplete="list"
            aria-expanded={open === 'search' && results.length > 0}
          />
          {!query && <span className="kbd">/</span>}
        </label>
        {open === 'search' && query.trim() && (
          <div className="popover" style={{ width: 340 }}>
            {results.length === 0 ? (
              <div className="menu-empty">No matches for “{query}”</div>
            ) : results.map((r, i) => {
              const Icon = r.icon;
              return (
                <button key={r.key} className={`menu-item ${i === highlight ? 'highlighted' : ''}`} onMouseEnter={() => setHighlight(i)} onClick={() => runResult(i)}>
                  <Icon size={16} className="mi-icon" />
                  <span style={{ minWidth: 0 }}>
                    <span className="mi-title" style={{ display: 'block' }}>{r.title}</span>
                    <span className="mi-sub">{r.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="topbar-actions">
        <button className="icon-btn desktop-only" onClick={onShare} title="Copy link to this view" aria-label="Copy link to this view">
          <Link2 size={16} />
        </button>

        <div className="popover-anchor" ref={alertsRef}>
          <button
            className={`icon-btn ${open === 'alerts' ? 'active' : ''}`}
            onClick={() => { setOpen(o => (o === 'alerts' ? null : 'alerts')); onAlertsSeen(); }}
            aria-label={`Clinical alerts${unreadAlerts ? `, ${unreadAlerts} unread` : ''}`}
            aria-expanded={open === 'alerts'}
          >
            <Bell size={16} />
            {unreadAlerts > 0 && <span className="badge-dot" />}
          </button>
          {open === 'alerts' && (
            <div className="popover" style={{ width: 360 }}>
              <div className="popover-header"><span>Clinical alerts</span><span className="tiny">{alerts.length}</span></div>
              {alerts.length === 0 && <div className="menu-empty">No active alerts</div>}
              {alerts.map(a => (
                <button
                  key={a.id}
                  className="menu-item"
                  onClick={() => { if (a.tab) onNavigate(a.tab, a.patientId); close(); }}
                >
                  <span className={`alert-dot ${a.tone}`} />
                  <span style={{ minWidth: 0 }}>
                    <span className="mi-title" style={{ display: 'block' }}>{a.title}</span>
                    <span className="mi-sub">{a.body}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="popover-anchor" ref={userRef}>
          <button
            className="icon-btn"
            style={{ padding: 0, borderRadius: '50%', overflow: 'hidden' }}
            onClick={() => setOpen(o => (o === 'user' ? null : 'user'))}
            aria-label="Account and role"
            aria-expanded={open === 'user'}
          >
            <span className="avatar" style={{ width: '100%', height: '100%' }}><UserRound size={16} /></span>
          </button>
          {open === 'user' && (
            <div className="popover" style={{ width: 280 }}>
              <div className="row" style={{ padding: '0.5rem 0.6rem 0.75rem' }}>
                <span className="avatar lg"><UserRound size={18} /></span>
                <div>
                  <div style={{ fontWeight: 600 }}>{ROLE_LABELS[role]}</div>
                  <div className="small muted">{isPatientRole && selectedPatient ? `Record of ${selectedPatient.name}` : 'Local workstation · no sign-in'}</div>
                </div>
              </div>
              <div className="menu-sep" />
              <div className="popover-header"><span>Appearance</span></div>
              <div className="menu-section">
                <div className="seg" role="radiogroup" aria-label="Theme">
                  {THEME_OPTIONS.map(({ id, label, Icon }) => (
                    <button key={id} role="radio" aria-checked={theme === id} className={`seg-btn ${theme === id ? 'active' : ''}`} onClick={() => setTheme(id)}>
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu-sep" />
              <div className="popover-header"><span>View as</span></div>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                <button key={r} className={`menu-item ${role === r ? 'selected' : ''}`} onClick={() => { onRoleChange(r); close(); }}>
                  <span className="mi-title" style={{ flex: 1 }}>{ROLE_LABELS[r]}</span>
                  {role === r && <Check size={15} className="mi-icon" />}
                </button>
              ))}
              {!isPatientRole && (
                <>
                  <div className="menu-sep" />
                  <button className="menu-item" onClick={() => { close(); onNewPatient(); }}>
                    <UserPlus size={16} className="mi-icon" />
                    <span className="mi-title">Admit new patient</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
