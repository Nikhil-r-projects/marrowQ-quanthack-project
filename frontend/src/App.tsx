import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, MessageSquare, FileText, User, LayoutGrid, Power,
  Phone, Bell, Search, Lock, RotateCcw, Share2, Plus,
  ChevronLeft, ChevronRight, PanelLeft, Building2, Cpu, Users,
  CheckCircle2, X, Mic, MicOff, Volume2, PhoneOff, ArrowRight,
  ExternalLink, Sparkles, AlertCircle
} from 'lucide-react';
import { OverviewView } from './views/OverviewView';
import { PatientProgressView } from './views/PatientProgressView';
import { DiagnosticIntelligenceView } from './views/DiagnosticIntelligenceView';
import { QuantumLabView } from './views/QuantumLabView';
import { HospitalAnalyticsView } from './views/HospitalAnalyticsView';
import { TabId } from './components/Navigation';
import { Patient, UserRole } from './types';
import { fetchHealth, fetchPatients } from './api';

// Representative patient cohort with distinct organ system diagnoses
const COHORT_PATIENTS: Patient[] = [
  {
    patient_id: "PT-9042-BMT",
    name: "Eleanora Vance",
    age: 42,
    gender: "Female",
    disease: "Acute Myeloid Leukemia (AML)",
    transplant_type: "Allogeneic HSCT",
    donor_type: "10/10 MUD",
    transplant_date: "2026-10-14",
    conditioning: "Bu/Cy Myeloablative",
    cell_dose_cd34: 6.4,
    chimerism_donor_pct: 98.4,
    cmv_status: "D+/R- (High Risk)",
    hla_match: "10/10",
    status: "Active Surveillance - Engraftment Impending",
    created_at: "2026-10-14T08:00:00Z",
    primary_organ_type: "heart",
    organ_label: "Heart",
    organ_diagnosis: "Cyclophosphamide Cardiotoxicity Surveillance"
  },
  {
    patient_id: "PT-8104-BMT",
    name: "Marcus Chen",
    age: 58,
    gender: "Male",
    disease: "Myelodysplastic Syndrome (MDS-EB2)",
    transplant_type: "Allogeneic HSCT",
    donor_type: "Haploidentical Related Donor",
    transplant_date: "2026-09-26",
    conditioning: "Fludarabine/Melphalan/TBI (Flu/Mel)",
    cell_dose_cd34: 5.2,
    chimerism_donor_pct: 99.8,
    cmv_status: "D+/R+ (Reactivated, Treated)",
    hla_match: "5/10 Haplo",
    status: "Engrafted - Stable Outpatient",
    created_at: "2026-09-26T08:00:00Z",
    primary_organ_type: "liver",
    organ_label: "Liver",
    organ_diagnosis: "Hepatic VOD/GvHD & Metabolic Clearance"
  },
  {
    patient_id: "PT-4421-BMT",
    name: "Sarah Jenkins",
    age: 29,
    gender: "Female",
    disease: "Acute Lymphoblastic Leukemia (B-ALL, Ph-like)",
    transplant_type: "Allogeneic HSCT",
    donor_type: "Matched Sibling Donor (MSD)",
    transplant_date: "2026-10-23",
    conditioning: "Total Body Irradiation + Cyclophosphamide (TBI/Cy)",
    cell_dose_cd34: 7.1,
    chimerism_donor_pct: 92.0,
    cmv_status: "D-/R- (Low Risk)",
    hla_match: "12/12",
    status: "Aplastic Nadir - Intensive Isolation",
    created_at: "2026-10-23T08:00:00Z",
    primary_organ_type: "marrow",
    organ_label: "Bone Marrow",
    organ_diagnosis: "Hematopoietic Aplasia & Engraftment Kinetics"
  },
  {
    patient_id: "PT-7730-BMT",
    name: "David Morales",
    age: 51,
    gender: "Male",
    disease: "Multiple Myeloma (High Risk IgA)",
    transplant_type: "Autologous PBSCT",
    donor_type: "Autologous Mobilized Harvest",
    transplant_date: "2026-10-26",
    conditioning: "High-Dose Melphalan 200mg/m2",
    cell_dose_cd34: 8.6,
    chimerism_donor_pct: 100.0,
    cmv_status: "D-/R-",
    hla_match: "Self",
    status: "Post-Reinfusion Cellular Kinetic Phase",
    created_at: "2026-10-26T08:00:00Z",
    primary_organ_type: "stem",
    organ_label: "CD34+ Stem Cell",
    organ_diagnosis: "Donor Stem Cell Homing & CXCR4 Chemotaxis"
  }
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [role, setRole] = useState<UserRole>('doctor');
  const [patients, setPatients] = useState<Patient[]>(COHORT_PATIENTS);
  const [selectedPatient, setSelectedPatient] = useState<Patient>(COHORT_PATIENTS[0]);

  // Real Navigation History stack
  const [history, setHistory] = useState<TabId[]>(['overview']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // UI Interactive States
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [showPatientMenu, setShowPatientMenu] = useState<boolean>(false);
  const [showCallModal, setShowCallModal] = useState<boolean>(false);
  const [callMuted, setCallMuted] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(3);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState<boolean>(false);
  const [showGridOverview, setShowGridOverview] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    fetchHealth().catch(console.error);
    fetchPatients()
      .then((pts) => {
        if (pts && pts.length > 0) {
          setPatients(COHORT_PATIENTS);
          setSelectedPatient(COHORT_PATIENTS[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Real navigation handler
  const handleNavigate = (tab: TabId) => {
    if (tab === activeTab) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(tab);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setActiveTab(tab);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setActiveTab(history[prevIdx]);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setActiveTab(history[nextIdx]);
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).catch(() => {});
    triggerToast(`Patient portal link copied: Medizinisch.com/${activeTab}`);
  };

  // Search filter matches
  const searchResults = searchQuery.trim() === '' ? [] : [
    ...patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.disease.toLowerCase().includes(searchQuery.toLowerCase())).map(p => ({
      title: `${p.name} (${p.organ_label})`,
      subtitle: p.disease,
      action: () => {
        setSelectedPatient(p);
        handleNavigate('overview');
        setSearchQuery('');
        setShowSearchResults(false);
      }
    })),
    {
      title: 'Neutrophil Engraftment Trajectory',
      subtitle: 'View ANC Bayesian Forecast in Recovery',
      action: () => {
        handleNavigate('progress');
        setSearchQuery('');
        setShowSearchResults(false);
      }
    },
    {
      title: 'Multi-Agent Consensus (8 Agents)',
      subtitle: 'Check Classical vs Quantum SVM in Diagnose',
      action: () => {
        handleNavigate('diagnostic');
        setSearchQuery('');
        setShowSearchResults(false);
      }
    },
    {
      title: 'IBM Quantum Hardware Bridge (ibm_brisbane)',
      subtitle: 'Open Qiskit ZZFeatureMap in Quantum Lab',
      action: () => {
        handleNavigate('quantum_lab');
        setSearchQuery('');
        setShowSearchResults(false);
      }
    },
    {
      title: 'Transplant Bed Capacity & Readmission Risk',
      subtitle: 'Inspect Positive-Pressure HEPA Isolation in Hospital',
      action: () => {
        handleNavigate('hospital');
        setSearchQuery('');
        setShowSearchResults(false);
      }
    }
  ].filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="spatial-environment">
      <div className="spatial-window">
        {/* ======================================================== */}
        {/* 1. TOP VISIONOS / SAFARI CHROME BAR                      */}
        {/* ======================================================== */}
        <div className="spatial-chrome">
          <div className="chrome-controls">
            {/* Toggle Dock */}
            <button
              className="chrome-btn"
              title="Toggle Left Dock"
              onClick={() => setDockCollapsed(!dockCollapsed)}
            >
              <PanelLeft size={16} />
            </button>

            {/* Back button */}
            <button
              className="chrome-btn"
              title="Back"
              disabled={historyIndex <= 0}
              onClick={handleBack}
              style={{ opacity: historyIndex > 0 ? 1 : 0.4 }}
            >
              <ChevronLeft size={17} />
            </button>

            {/* Forward button */}
            <button
              className="chrome-btn"
              title="Forward"
              disabled={historyIndex >= history.length - 1}
              onClick={handleForward}
              style={{ opacity: historyIndex < history.length - 1 ? 1 : 0.4 }}
            >
              <ChevronRight size={17} />
            </button>
          </div>

          {/* URL Pill Bar */}
          <div className="chrome-url-bar">
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>AA</span>
            <Lock size={12} color="#94a3b8" />
            <span style={{ fontWeight: 500 }}>Medizinisch.com/{activeTab}</span>
            <span
              title="Refresh Telemetry"
              style={{ display: 'inline-flex', cursor: 'pointer' }}
              onClick={() => triggerToast('Syncing real-time organ telemetry...')}
            >
              <RotateCcw size={12} color="#64748b" />
            </span>
          </div>

          <div className="chrome-actions">
            {/* Share */}
            <button className="chrome-btn" title="Share Telemetry Link" onClick={handleShare}>
              <Share2 size={15} />
            </button>

            {/* New Tab / New Patient Intake */}
            <button className="chrome-btn" title="New Patient Admission" onClick={() => setShowNewPatientModal(true)}>
              <Plus size={16} />
            </button>

            {/* Tab Grid Mission Control */}
            <button className="chrome-btn" title="All Sections Grid" onClick={() => setShowGridOverview(true)}>
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. IN-WINDOW SPATIAL NAVIGATION HEADER                   */}
        {/* ======================================================== */}
        <div className="spatial-nav-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Logo Pill "M" */}
            <div
              className="spatial-logo-pill"
              onClick={() => handleNavigate('overview')}
              style={{ cursor: 'pointer' }}
              title="marrowQ 2.0"
            >
              M<span style={{ fontSize: '0.55rem', color: '#2563eb', position: 'relative', top: '-5px', left: '1px' }}>●</span>
            </div>

            {/* Pill Switcher: ONLY ACTIVE TAB SHOWS THE BLUE DOT! */}
            <div className="spatial-pills-group">
              <button
                className={`spatial-pill ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => handleNavigate('overview')}
              >
                {activeTab === 'overview' && <span className="blue-dot" />}
                <span>My Organ</span>
              </button>
              <button
                className={`spatial-pill ${activeTab === 'diagnostic' ? 'active' : ''}`}
                onClick={() => handleNavigate('diagnostic')}
              >
                {activeTab === 'diagnostic' && <span className="blue-dot" />}
                <span>Diagnose</span>
              </button>
              <button
                className={`spatial-pill ${activeTab === 'progress' ? 'active' : ''}`}
                onClick={() => handleNavigate('progress')}
              >
                {activeTab === 'progress' && <span className="blue-dot" />}
                <span>Recovery</span>
              </button>
              <button
                className={`spatial-pill ${activeTab === 'quantum_lab' ? 'active' : ''}`}
                onClick={() => handleNavigate('quantum_lab')}
              >
                {activeTab === 'quantum_lab' && <span className="blue-dot" />}
                <span>Quantum Lab</span>
              </button>
              <button
                className={`spatial-pill ${activeTab === 'hospital' ? 'active' : ''}`}
                onClick={() => handleNavigate('hospital')}
              >
                {activeTab === 'hospital' && <span className="blue-dot" />}
                <span>Hospital</span>
              </button>
            </div>
          </div>

          {/* Center: Patient Quick Switcher + Live Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
            {/* Patient Selector Capsule */}
            <button
              onClick={() => setShowPatientMenu(!showPatientMenu)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '9999px',
                padding: '0.45rem 0.95rem',
                fontSize: '0.78rem',
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Click to switch patient cohort"
            >
              <Users size={14} color="#60a5fa" />
              <span>{selectedPatient.name.split(' ')[0]}</span>
              <span style={{
                color: '#93c5fd',
                fontSize: '0.72rem',
                background: 'rgba(37, 99, 235, 0.25)',
                padding: '0.1rem 0.45rem',
                borderRadius: '9999px'
              }}>
                {selectedPatient.organ_label}
              </span>
            </button>

            {/* Patient Dropdown Menu */}
            {showPatientMenu && (
              <div style={{
                position: 'absolute',
                top: 45,
                left: 0,
                width: 290,
                background: 'rgba(18, 20, 27, 0.96)',
                backdropFilter: 'blur(25px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '16px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)',
                padding: '0.6rem',
                zIndex: 999
              }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '0.4rem 0.6rem 0.5rem', fontWeight: 600 }}>
                  SWITCH PATIENT TO MONITOR TARGET ORGAN:
                </div>
                {patients.map(p => (
                  <div
                    key={p.patient_id}
                    onClick={() => {
                      setSelectedPatient(p);
                      setShowPatientMenu(false);
                      triggerToast(`Loaded ${p.name} (${p.organ_label})`);
                    }}
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderRadius: '10px',
                      background: selectedPatient.patient_id === p.patient_id ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                      border: selectedPatient.patient_id === p.patient_id ? '1px solid #2563eb' : '1px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>{p.name}</span>
                      <span style={{ fontSize: '0.68rem', color: '#60a5fa', fontWeight: 600 }}>● {p.organ_label}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {p.disease.split('(')[0]}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="spatial-search-bar" style={{ width: '220px' }}>
              <Search size={15} color="#64748b" />
              <input
                type="text"
                placeholder="Search telemetry..."
                value={searchQuery}
                onFocus={() => setShowSearchResults(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Live Search Results Dropdown */}
            {showSearchResults && searchQuery.trim() !== '' && (
              <div style={{
                position: 'absolute',
                top: 45,
                right: 0,
                width: 320,
                background: 'rgba(18, 20, 27, 0.96)',
                backdropFilter: 'blur(25px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '16px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)',
                padding: '0.6rem',
                zIndex: 999
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.6rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                  <span>TELEMETRY RESULTS ({searchResults.length})</span>
                  <X size={13} style={{ cursor: 'pointer' }} onClick={() => setShowSearchResults(false)} />
                </div>
                {searchResults.map((res, i) => (
                  <div
                    key={i}
                    onClick={res.action}
                    style={{
                      padding: '0.55rem 0.75rem',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>{res.title}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{res.subtitle}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Action Circle Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
            {/* Electric Blue Call Button -> Opens Telehealth Consultation */}
            <button
              className="spatial-circle-btn blue"
              title="Start Clinical Consultation Call"
              onClick={() => setShowCallModal(true)}
            >
              <Phone size={17} />
            </button>

            {/* Bell Notification Button with Red Badge */}
            <button
              className="spatial-circle-btn"
              title="Notifications"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setUnreadNotifications(0);
              }}
            >
              <Bell size={17} />
              {unreadNotifications > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 7,
                  right: 7,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 8px #ef4444'
                }} />
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: 48,
                right: 48,
                width: 320,
                background: 'rgba(18, 20, 27, 0.96)',
                backdropFilter: 'blur(25px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '16px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
                padding: '0.75rem',
                zIndex: 999
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem 0.6rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>Clinical Alerts</span>
                  <span style={{ fontSize: '0.7rem', color: '#38bdf8', cursor: 'pointer' }} onClick={() => setShowNotifications(false)}>Close</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div style={{ padding: '0.5rem', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#93c5fd' }}>ANC Threshold Impending</div>
                    <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Eleanora Vance is at 420 cells/μL (+140 in past 48h). Engraftment expected Day +15.</div>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#34d399' }}>Quantum Kernel Verified</div>
                    <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>8,192 shots completed with 0.964 statevector fidelity.</div>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ffffff' }}>Dr. Hanzer Jon Available</div>
                    <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Next consultation scheduled for Fri, 24 Mar.</div>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Avatar with Role Switcher Menu */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: '1.5px solid rgba(255, 255, 255, 0.25)',
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)'
              }}
              title={`Logged in as ${role}: Dr. Hanzer Jon`}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
                alt="Profile Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Profile & Role Dropdown */}
            {showProfileMenu && (
              <div style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 240,
                background: 'rgba(18, 20, 27, 0.96)',
                backdropFilter: 'blur(25px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '16px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
                padding: '0.85rem',
                zIndex: 999
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>Dr. Hanzer Jon</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.75rem' }}>Chief Hematology Specialist</div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginBottom: '0.4rem' }}>SWITCH ACTIVE ROLE:</div>
                {(['doctor', 'patient', 'researcher', 'hospital_admin'] as UserRole[]).map(r => (
                  <div
                    key={r}
                    onClick={() => {
                      setRole(r);
                      setShowProfileMenu(false);
                      triggerToast(`Switched view to ${r.toUpperCase()} mode`);
                    }}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '8px',
                      background: role === r ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                      color: role === r ? '#60a5fa' : '#cbd5e1',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: role === r ? 600 : 400
                    }}
                  >
                    {r.toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 3. BODY: LEFT FLOATING DOCK + SPATIAL WORKSPACE          */}
        {/* ======================================================== */}
        <div className="spatial-body-container">
          {/* Left Vertical Dock */}
          {!dockCollapsed && (
            <div className="spatial-dock">
              <div className="dock-icons-stack">
                {/* 1. Pulse: My Organ */}
                <button
                  className={`dock-icon-btn ${activeTab === 'overview' ? 'active' : ''}`}
                  title="My Organ & 3D Telemetry"
                  onClick={() => handleNavigate('overview')}
                >
                  <Activity size={18} />
                </button>

                {/* 2. Chat / Agents: Diagnostic Intelligence */}
                <button
                  className={`dock-icon-btn ${activeTab === 'diagnostic' ? 'active' : ''}`}
                  title="Diagnostic Intelligence & 8 Agents"
                  onClick={() => handleNavigate('diagnostic')}
                >
                  <MessageSquare size={18} />
                </button>

                {/* 3. Trajectory / Chart: Recovery Milestones */}
                <button
                  className={`dock-icon-btn ${activeTab === 'progress' ? 'active' : ''}`}
                  title="Recovery Timeline & Milestones"
                  onClick={() => handleNavigate('progress')}
                >
                  <User size={18} />
                </button>

                {/* 4. Quantum CPU: Quantum Lab */}
                <button
                  className={`dock-icon-btn ${activeTab === 'quantum_lab' ? 'active' : ''}`}
                  title="Quantum Computing Lab & Hardware"
                  onClick={() => handleNavigate('quantum_lab')}
                >
                  <Cpu size={18} />
                </button>

                {/* 5. Building: Hospital Analytics */}
                <button
                  className={`dock-icon-btn ${activeTab === 'hospital' ? 'active' : ''}`}
                  title="Hospital Operations & Cohort"
                  onClick={() => handleNavigate('hospital')}
                >
                  <Building2 size={18} />
                </button>
              </div>

              {/* Bottom Power Status */}
              <button
                className="dock-icon-btn"
                title="System Status"
                onClick={() => handleNavigate('overview')}
              >
                <Power size={18} color="#64748b" />
              </button>
            </div>
          )}

          {/* Spatial Main Workspace */}
          <div className="spatial-main-workspace">
            {activeTab === 'overview' && (
              <OverviewView
                selectedPatient={selectedPatient}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'diagnostic' && (
              <DiagnosticIntelligenceView
                patient={selectedPatient}
              />
            )}

            {activeTab === 'progress' && (
              <PatientProgressView
                patient={selectedPatient}
                onRefresh={() => {
                  fetchPatients().then(setPatients).catch(console.error);
                }}
              />
            )}

            {activeTab === 'quantum_lab' && (
              <QuantumLabView />
            )}

            {activeTab === 'hospital' && (
              <HospitalAnalyticsView
                onSelectPatient={(p) => {
                  setSelectedPatient(p);
                  handleNavigate('overview');
                }}
                onNavigateToProgress={() => handleNavigate('progress')}
              />
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 4. INTERACTIVE MODALS & TOASTS                           */}
        {/* ======================================================== */}

        {/* Toast Notification */}
        {toastMessage && (
          <div style={{
            position: 'fixed',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(18, 20, 27, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid #2563eb',
            borderRadius: '9999px',
            padding: '0.65rem 1.4rem',
            color: '#ffffff',
            fontSize: '0.85rem',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(37, 99, 235, 0.4)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Sparkles size={16} color="#60a5fa" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Telehealth Consultation Modal */}
        {showCallModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1.5rem'
          }}>
            <div className="spatial-card" style={{ maxWidth: '440px', width: '100%', padding: '2rem', textAlign: 'center' }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                margin: '0 auto 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(37, 99, 235, 0.6)'
              }}>
                <Phone size={32} color="#ffffff" />
              </div>

              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.3rem', color: '#ffffff', fontWeight: 700 }}>
                Clinical Telehealth Call
              </h3>
              <div style={{ fontSize: '0.85rem', color: '#93c5fd', marginBottom: '1.5rem' }}>
                Connected to Dr. Hanzer Jon (BMT Specialist)
              </div>

              {/* Audio Waveform Animation */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '50px'
              }}>
                {[14, 28, 42, 18, 36, 48, 22, 38, 16, 32].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: '4px',
                      height: callMuted ? '4px' : `${h}px`,
                      background: '#3b82f6',
                      borderRadius: '2px',
                      transition: 'height 0.2s ease'
                    }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <button
                  onClick={() => setCallMuted(!callMuted)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: callMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title={callMuted ? "Unmute" : "Mute"}
                >
                  {callMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button
                  onClick={() => setShowCallModal(false)}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)'
                  }}
                  title="End Call"
                >
                  <PhoneOff size={22} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Grid Overview Modal */}
        {showGridOverview && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '2rem'
          }}>
            <div className="spatial-card" style={{ maxWidth: '800px', width: '100%', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#ffffff', fontWeight: 700 }}>
                  Mission Control Tab Overview
                </h3>
                <X size={18} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowGridOverview(false)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                  { id: 'overview', title: 'My Organ', desc: '3D WebGL anatomical organ & vitals', icon: <Activity size={22} color="#38bdf8" /> },
                  { id: 'diagnostic', title: 'Diagnose', desc: '8-Agent differential intelligence', icon: <MessageSquare size={22} color="#60a5fa" /> },
                  { id: 'progress', title: 'Recovery', desc: 'Longitudinal ANC & platelet trajectory', icon: <User size={22} color="#34d399" /> },
                  { id: 'quantum_lab', title: 'Quantum Lab', desc: 'Qiskit ZZFeatureMap on IBM QPUs', icon: <Cpu size={22} color="#a78bfa" /> },
                  { id: 'hospital', title: 'Hospital', desc: 'Ward capacity & readmission triage', icon: <Building2 size={22} color="#f472b6" /> }
                ].map(tab => (
                  <div
                    key={tab.id}
                    onClick={() => {
                      handleNavigate(tab.id as TabId);
                      setShowGridOverview(false);
                    }}
                    style={{
                      background: activeTab === tab.id ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      border: activeTab === tab.id ? '1px solid #2563eb' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '1.25rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ marginBottom: '0.75rem' }}>{tab.icon}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', marginBottom: '0.25rem' }}>{tab.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{tab.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* New Patient Admission Modal */}
        {showNewPatientModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1.5rem'
          }}>
            <div className="spatial-card" style={{ maxWidth: '480px', width: '100%', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff', fontWeight: 700 }}>
                  New Patient Clinical Admission
                </h3>
                <X size={18} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowNewPatientModal(false)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Patient Name</label>
                  <input
                    type="text"
                    defaultValue="Kira Nerys"
                    style={{
                      width: '100%',
                      background: 'rgba(10, 14, 23, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '0.65rem 1rem',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Diagnosis</label>
                  <input
                    type="text"
                    defaultValue="Acute Myeloid Leukemia (AML)"
                    style={{
                      width: '100%',
                      background: 'rgba(10, 14, 23, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '0.65rem 1rem',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Primary Organ Target</label>
                  <select
                    style={{
                      width: '100%',
                      background: 'rgba(10, 14, 23, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '0.65rem 1rem',
                      color: '#ffffff',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="heart">Heart (Cardiovascular)</option>
                    <option value="liver">Liver (Hepatic VOD/GvHD)</option>
                    <option value="marrow">Bone Marrow (Engraftment)</option>
                    <option value="stem">CD34+ Stem Cell (Mobilization)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowNewPatientModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '9999px',
                    padding: '0.55rem 1.25rem',
                    color: '#94a3b8',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowNewPatientModal(false);
                    triggerToast('Patient admitted and added to active cohort surveillance');
                  }}
                  className="spatial-cta-btn"
                  style={{ padding: '0.55rem 1.4rem' }}
                >
                  Admit Patient
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
