import React, { useState, useEffect } from 'react';
import {
  Building2, Users, AlertCircle, CheckCircle2, Cpu, ShieldCheck,
  TrendingUp, Clock, FileCheck, Activity, ArrowRight
} from 'lucide-react';
import { HospitalOverview, Patient } from '../types';
import { fetchHospitalOverview, fetchPatients } from '../api';

interface HospitalAnalyticsViewProps {
  onSelectPatient: (p: Patient) => void;
  onNavigateToProgress: () => void;
}

export const HospitalAnalyticsView: React.FC<HospitalAnalyticsViewProps> = ({
  onSelectPatient,
  onNavigateToProgress
}) => {
  const [overview, setOverview] = useState<HospitalOverview | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [oData, pList] = await Promise.all([
          fetchHospitalOverview(),
          fetchPatients()
        ]);
        setOverview(oData);
        setPatients(pList);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* 1. Header Banner */}
      <div className="spatial-card" style={{ padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'rgba(37, 99, 235, 0.15)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa'
              }}>
                <Building2 size={20} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                Hospital Transplant Operations & Cohort Intelligence
              </h2>
              <span style={{
                fontSize: '0.72rem',
                padding: '0.2rem 0.65rem',
                borderRadius: '9999px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontWeight: 600
              }}>
                BMT Positive Pressure Ward Active
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Real-time monitoring of BMT isolation bed occupancy, organ toxicity surveillance, and readmission risk triage.
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Summary Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        
        <div className="spatial-card" style={{ height: '125px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Active Transplant Cohort</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff' }}>24 Patients</div>
          <span style={{ fontSize: '0.72rem', color: '#10b981' }}>18 Engrafted • 6 Surveillance</span>
        </div>

        <div className="spatial-card" style={{ height: '125px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>BMT Isolation Beds</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff' }}>88% Occupancy</div>
          <span style={{ fontSize: '0.72rem', color: '#60a5fa' }}>22 of 25 HEPA beds in use</span>
        </div>

        <div className="spatial-card" style={{ height: '125px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Average Days to ANC Engraft</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff' }}>15.2 Days</div>
          <span style={{ fontSize: '0.72rem', color: '#10b981' }}>1.8 days ahead of national avg</span>
        </div>

        <div className="spatial-card" style={{ height: '125px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Predicted Readmission Risk</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981' }}>4.1% (Low)</div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Zero unexpected ICU transfers</span>
        </div>

      </div>

      {/* 3. Cohort Triage Table */}
      <div className="spatial-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="spatial-section-title" style={{ margin: 0 }}>
          <span className="blue-dot" />
          <span>Patient Cohort Surveillance & Organ Target Status</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Patient Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Diagnosis</th>
                <th style={{ padding: '0.75rem 1rem' }}>Primary Organ Target</th>
                <th style={{ padding: '0.75rem 1rem' }}>Donor / HLA</th>
                <th style={{ padding: '0.75rem 1rem' }}>Transplant Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    color: '#f8fafc',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                    {p.name}
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.patient_id}</div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>{p.disease.split('(')[0]}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      background: 'rgba(37, 99, 235, 0.15)',
                      color: '#93c5fd',
                      border: '1px solid rgba(37, 99, 235, 0.3)',
                      borderRadius: '9999px',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.72rem'
                    }}>
                      {p.organ_label || 'Heart / Marrow'}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>{p.donor_type.split('(')[0]}</td>
                  <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>{p.transplant_date}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '9999px',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.72rem'
                    }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        onSelectPatient(p);
                        onNavigateToProgress();
                      }}
                      className="spatial-cta-btn"
                      style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem', display: 'inline-flex' }}
                    >
                      <span>View Trajectory</span>
                      <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
