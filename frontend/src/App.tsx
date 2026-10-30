import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldAlert, Sparkles } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Topbar, ClinicalAlert } from './components/Topbar';
import { CallModal, NewPatientModal } from './components/Modals';
import { OverviewView } from './views/OverviewView';
import { DiagnosticIntelligenceView } from './views/DiagnosticIntelligenceView';
import { PatientProgressView } from './views/PatientProgressView';
import { PredictionView } from './views/PredictionView';
import { DatasetView } from './views/DatasetView';
import { SetupView } from './views/SetupView';
import { MonitorView } from './views/MonitorView';
import { ResultsView } from './views/ResultsView';
import { ReportView } from './views/ReportView';
import { QuantumLabView } from './views/QuantumLabView';
import { HospitalAnalyticsView } from './views/HospitalAnalyticsView';
import { ROLE_HOME, ROLE_LABELS, TabId, sectionById, sectionsForRole } from './navigation';
import { useHashRoute, usePersistentState } from './hooks';
import { COHORT_PATIENTS, COHORT_REFERENCE_DATE } from './data/cohort';
import { organProfile } from './data/organs';
import { DatasetProfile, Experiment, Patient, UserRole } from './types';
import { fetchDemoDataset, fetchExperiment, fetchExperimentsList, fetchPatients, isBackendOnline } from './api';

const RESEARCH_TABS: TabId[] = ['dataset', 'setup', 'monitor', 'results', 'report', 'predict'];

export function App() {
  const [role, setRole] = usePersistentState<UserRole>('marrowq.role', 'doctor');
  const [collapsed, setCollapsed] = usePersistentState('marrowq.sidebarCollapsed', false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sections = useMemo(() => sectionsForRole(role), [role]);
  const [route, navigate] = useHashRoute(ROLE_HOME[role]);

  // ---- Patients ---------------------------------------------------------------
  const [apiPatients, setApiPatients] = useState<Patient[]>(COHORT_PATIENTS);
  const [admitted, setAdmitted] = useState<Patient[]>([]);
  const patients = useMemo(
    () => [...apiPatients, ...admitted.filter(a => !apiPatients.some(p => p.patient_id === a.patient_id))],
    [apiPatients, admitted]
  );
  const selectedPatient = patients.find(p => p.patient_id === route.patientId) ?? patients[0];

  // ---- Backend + research state -----------------------------------------------
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [dataset, setDataset] = useState<DatasetProfile | null>(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [currentExperiment, setCurrentExperiment] = useState<Experiment | null>(null);

  // ---- UI state -----------------------------------------------------------------
  const [toast, setToast] = useState<string | null>(null);
  const [showCall, setShowCall] = useState(false);
  const [showAdmit, setShowAdmit] = useState(false);
  const [seenAlerts, setSeenAlerts] = useState<string[]>([]);

  // Keep the route valid for the current role.
  const activeTab: TabId = sections.some(s => s.id === route.tab) ? route.tab : ROLE_HOME[role];
  useEffect(() => {
    if (activeTab !== route.tab) navigate({ tab: activeTab }, true);
  }, [activeTab, route.tab, navigate]);

  useEffect(() => {
    isBackendOnline().then(setBackendOnline);
    fetchPatients().then(setApiPatients);
    fetchExperimentsList()
      .then(list => {
        const latest = list.find((e: Experiment) => e.status === 'completed');
        if (latest) return fetchExperiment(latest.experiment_id);
      })
      .then(exp => { if (exp) setCurrentExperiment(prev => prev ?? exp); })
      .catch(() => undefined);
  }, []);

  const loadDemoDataset = useCallback(async () => {
    setIsLoadingDemo(true);
    try {
      setDataset(await fetchDemoDataset());
    } finally {
      setIsLoadingDemo(false);
    }
  }, []);

  // Research views need a dataset; load the synthetic cohort the first time one is opened.
  useEffect(() => {
    if (RESEARCH_TABS.includes(activeTab) && !dataset && !isLoadingDemo) loadDemoDataset();
  }, [activeTab, dataset, isLoadingDemo, loadDemoDataset]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileNavOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    document.title = `${sectionById(activeTab).label} · MarrowQ`;
    window.scrollTo({ top: 0 });
  }, [activeTab]);

  const go = useCallback((tab: TabId, patientId?: string) => {
    setMobileNavOpen(false);
    navigate(patientId ? { tab, patientId } : { tab });
  }, [navigate]);

  const changeRole = (r: UserRole) => {
    setRole(r);
    navigate({ tab: ROLE_HOME[r] });
    setToast(`Viewing as ${ROLE_LABELS[r].toLowerCase()}`);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast('Link to this view copied');
    } catch {
      setToast('Copy failed. Use the address bar to share this view.');
    }
  };

  // Organ readings outside their reference range become clinical alerts.
  const alerts = useMemo<ClinicalAlert[]>(() => {
    const scope = role === 'patient' ? [selectedPatient] : patients;
    return scope.flatMap(p =>
      organProfile(p.primary_organ_type ?? 'marrow', p, null).metrics
        .filter(m => m.status !== 'normal' && m.value !== '—')
        .map(m => ({
          id: `${p.patient_id}-${m.key}`,
          tone: m.status === 'alert' ? 'red' as const : 'amber' as const,
          title: `${p.name}: ${m.label} ${m.value}${m.unit ? ` ${m.unit}` : ''}`,
          body: m.note,
          patientId: p.patient_id,
          tab: 'overview' as TabId
        }))
    );
  }, [patients, role, selectedPatient]);
  const unread = alerts.filter(a => !seenAlerts.includes(a.id)).length;

  const section = sectionById(activeTab);
  const experimentRunning = currentExperiment?.status === 'running' || currentExperiment?.status === 'created';

  const renderView = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewView patient={selectedPatient} role={role} onNavigate={go} />;
      case 'diagnostic':
        return <DiagnosticIntelligenceView patient={selectedPatient} role={role} />;
      case 'progress':
        return <PatientProgressView patient={selectedPatient} role={role} />;
      case 'predict':
        return <PredictionView currentExperiment={currentExperiment} patient={role === 'researcher' ? null : selectedPatient} />;
      case 'dataset':
        return <DatasetView dataset={dataset} onDatasetLoaded={d => { setDataset(d); setToast(`Loaded ${d.name}`); }} onLoadDemo={loadDemoDataset} isLoadingDemo={isLoadingDemo} onNavigate={go} />;
      case 'setup':
        return <SetupView key={dataset?.dataset_id ?? 'none'} dataset={dataset} onExperimentStarted={exp => { setCurrentExperiment(exp); go('monitor'); }} onNavigate={go} />;
      case 'monitor':
        return <MonitorView currentExperiment={currentExperiment} onExperimentUpdated={setCurrentExperiment} onNavigate={go} />;
      case 'results':
        return <ResultsView key={currentExperiment?.experiment_id ?? 'none'} experiment={currentExperiment} onNavigate={go} />;
      case 'report':
        return <ReportView currentExperiment={currentExperiment} onNavigate={go} />;
      case 'quantum_lab':
        return <QuantumLabView />;
      case 'hospital':
        return <HospitalAnalyticsView patients={patients} onOpenPatient={(id, tab) => go(tab, id)} />;
    }
  };

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        sections={sections}
        activeTab={activeTab}
        onNavigate={tab => go(tab)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(c => !c)}
        mobileOpen={mobileNavOpen}
        backendOnline={backendOnline}
        experimentRunning={experimentRunning}
      />
      {mobileNavOpen && <div className="scrim" onClick={() => setMobileNavOpen(false)} />}

      <div className="main">
        <Topbar
          section={section}
          sections={sections}
          role={role}
          onRoleChange={changeRole}
          patients={patients}
          selectedPatient={selectedPatient}
          onSelectPatient={id => navigate({ patientId: id })}
          onNavigate={go}
          alerts={alerts}
          unreadAlerts={unread}
          onAlertsSeen={() => setSeenAlerts(alerts.map(a => a.id))}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onShare={share}
          onNewPatient={() => setShowAdmit(true)}
          onCall={() => setShowCall(true)}
        />

        <div className="disclaimer-strip" role="note">
          <ShieldAlert size={13} />
          <span>Research prototype using synthetic demonstration data. Not for clinical decision-making.</span>
        </div>

        {/* Patient-scoped views remount per patient so no stale state carries over. */}
        <main className="content" key={section.patientScoped || activeTab === 'predict' ? `${activeTab}:${selectedPatient.patient_id}` : activeTab}>
          {renderView()}
        </main>

        <footer className="app-footer">
          <span>MarrowQ · Quantum-assisted HSCT recovery research platform</span>
          <span>
            Demo cohort as of {new Date(COHORT_REFERENCE_DATE).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
            <a href="https://colab.research.google.com/github/Nikhil-r-projects/marrowQ-quanthack-project/blob/main/notebooks/MarrowQ_Quantum_Benchmark.ipynb" target="_blank" rel="noreferrer">Benchmark notebook</a>
          </span>
        </footer>
      </div>

      {toast && (
        <div className="toast" role="status">
          <Sparkles size={15} />
          <span>{toast}</span>
        </div>
      )}

      {showCall && (
        <CallModal
          onClose={() => setShowCall(false)}
          contactName={role === 'patient' ? 'Dr. Hanzer Jon' : `${selectedPatient.name}`}
          contactRole={role === 'patient' ? 'Transplant hematologist' : `${selectedPatient.patient_id} · ${selectedPatient.disease.split(' (')[0]}`}
        />
      )}

      {showAdmit && (
        <NewPatientModal
          existingIds={patients.map(p => p.patient_id)}
          onClose={() => setShowAdmit(false)}
          onAdmit={p => {
            setAdmitted(a => [...a, p]);
            setShowAdmit(false);
            go(sectionById(activeTab).patientScoped ? activeTab : 'overview', p.patient_id);
            setToast(`${p.name} admitted to the cohort`);
          }}
        />
      )}
    </div>
  );
}

export default App;
