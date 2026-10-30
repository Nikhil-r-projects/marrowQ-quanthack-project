import type { LucideIcon } from 'lucide-react';
import {
  HeartPulse, BrainCircuit, ChartLine, Target, Database, SlidersHorizontal,
  Gauge, BarChart3, FileText, Atom, Hospital
} from 'lucide-react';
import { UserRole } from './types';

export type TabId =
  | 'overview'
  | 'diagnostic'
  | 'progress'
  | 'predict'
  | 'dataset'
  | 'setup'
  | 'monitor'
  | 'results'
  | 'report'
  | 'quantum_lab'
  | 'hospital';

export interface Section {
  id: TabId;
  label: string;
  description: string;
  group: 'Clinical care' | 'Pre-transplant' | 'Research' | 'Quantum' | 'Operations';
  icon: LucideIcon;
  roles: UserRole[];
  /** Section content depends on the selected patient. */
  patientScoped?: boolean;
}

export const SECTIONS: Section[] = [
  { id: 'overview', label: 'Patient Overview', description: '3D organ view and organ-specific monitoring', group: 'Clinical care', icon: HeartPulse, roles: ['doctor', 'patient', 'hospital_admin'], patientScoped: true },
  { id: 'diagnostic', label: 'Clinical Review', description: '8-agent model consensus and evidence', group: 'Clinical care', icon: BrainCircuit, roles: ['doctor', 'patient', 'hospital_admin'], patientScoped: true },
  { id: 'progress', label: 'Recovery Tracker', description: 'ANC and platelet trajectory with milestones', group: 'Clinical care', icon: ChartLine, roles: ['doctor', 'patient', 'hospital_admin'], patientScoped: true },
  { id: 'predict', label: 'Engraftment Predictor', description: 'Compare donor and graft options before transplant', group: 'Pre-transplant', icon: Target, roles: ['doctor', 'researcher'] },
  { id: 'dataset', label: 'Datasets', description: 'Cohort upload, profiling and leakage audit', group: 'Research', icon: Database, roles: ['researcher'] },
  { id: 'setup', label: 'Run Benchmark', description: 'Configure classical vs quantum experiment', group: 'Research', icon: SlidersHorizontal, roles: ['researcher'] },
  { id: 'monitor', label: 'Run Monitor', description: 'Live experiment stages and logs', group: 'Research', icon: Gauge, roles: ['researcher'] },
  { id: 'results', label: 'Results', description: 'Metrics, confusion matrix and runtime', group: 'Research', icon: BarChart3, roles: ['researcher', 'doctor'] },
  { id: 'report', label: 'Research Report', description: 'Exportable Markdown study report', group: 'Research', icon: FileText, roles: ['researcher', 'doctor'] },
  { id: 'quantum_lab', label: 'Quantum Lab', description: '156-qubit QPU circuits, backends and hardware telemetry', group: 'Quantum', icon: Atom, roles: ['doctor', 'researcher', 'patient', 'hospital_admin'] },
  { id: 'hospital', label: 'Ward & Cohort', description: 'Cohort triage and service health', group: 'Operations', icon: Hospital, roles: ['hospital_admin', 'doctor'] }
];

export const ROLE_LABELS: Record<UserRole, string> = {
  doctor: 'Transplant physician',
  researcher: 'Clinical researcher',
  patient: 'Patient / family',
  hospital_admin: 'Hospital operations'
};

export const ROLE_HOME: Record<UserRole, TabId> = {
  doctor: 'overview',
  researcher: 'dataset',
  patient: 'overview',
  hospital_admin: 'hospital'
};

export function sectionsForRole(role: UserRole): Section[] {
  return SECTIONS.filter(s => s.roles.includes(role));
}

export function sectionById(id: TabId): Section {
  return SECTIONS.find(s => s.id === id) ?? SECTIONS[0];
}

export function isTabId(value: string): value is TabId {
  return SECTIONS.some(s => s.id === value);
}
