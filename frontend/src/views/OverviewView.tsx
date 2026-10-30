import React, { useState, useEffect } from 'react';
import {
  Activity, Droplet, Heart, BarChart2, Zap, Calendar, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowRight, User, Phone, CheckCircle2, ShieldCheck, Dna
} from 'lucide-react';
import { Patient } from '../types';
import { TabId } from '../components/Navigation';
import { OrganViewer3D } from '../components/OrganViewer3D';

interface OverviewViewProps {
  selectedPatient: Patient;
  onNavigate: (tab: TabId) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  selectedPatient,
  onNavigate
}) => {
  // Dynamically default to the patient's diagnosed target organ!
  const defaultOrgan = selectedPatient.primary_organ_type || 'heart';
  const [selectedOrgan, setSelectedOrgan] = useState<'heart' | 'marrow' | 'stem' | 'liver'>(defaultOrgan);
  const [activePin, setActivePin] = useState<number | null>(1);

  // Sync with selectedPatient when parent changes
  useEffect(() => {
    if (selectedPatient.primary_organ_type) {
      setSelectedOrgan(selectedPatient.primary_organ_type);
    }
  }, [selectedPatient.patient_id, selectedPatient.primary_organ_type]);

  // Biological systems items matching the screenshot
  const organItems = [
    { id: 'liver', name: 'Liver / Metabolic', label: 'My Liver', img: '/liver_3d.jpg' },
    { id: 'heart', name: 'Cardiac System', label: 'My Heart', img: '/heart_3d.jpg' },
    { id: 'stem', name: 'CD34+ Stem Cell', label: 'My Stem Cells', img: '/stem_cell_3d.jpg' },
    { id: 'marrow', name: 'Bone Marrow', label: 'My Marrow', img: '/marrow_3d.jpg' }
  ];

  // Dynamic telemetry data configured specifically per organ
  const getTelemetryData = () => {
    switch (selectedOrgan) {
      case 'marrow':
        return {
          title: 'My Bone Marrow Engraftment',
          floatIcon: <Activity size={14} color="#2563eb" />,
          floatTitle: 'HSC Engraftment',
          floatValue: '98.4%',
          card1: { title: 'ANC Recovery', value: '420 cells/μL', badge: 'Day +14', sub: 'Target > 500' },
          card2: { title: 'Platelet Kinetics', value: '18,500 /μL', badge: 'Impending', sub: 'Rising velocity' },
          card3: { title: 'Donor Chimerism', value: '98.4%', badge: 'Full Donor', sub: 'Complete engraftment' },
          card4: { title: 'Cellularity Spongiosa', value: '45%', badge: 'Optimal', sub: 'Endosteal niche stable' }
        };
      case 'liver':
        return {
          title: 'My Hepatic Condition',
          floatIcon: <Droplet size={14} color="#2563eb" />,
          floatTitle: 'Total Bilirubin',
          floatValue: '0.8 mg/dL',
          card1: { title: 'Liver Status', value: 'Normal (0.8)', badge: '0.8 mg/dL', sub: 'VOD Clearance' },
          card2: { title: 'Transaminases (ALT/AST)', value: '32 / 28 U/L', badge: 'Grade 0', sub: 'Enzyme stability' },
          card3: { title: 'Portal Flow', value: '26 cm/s', badge: 'Optimal', sub: 'Doppler velocity' },
          card4: { title: 'Serum Albumin', value: '3.9 g/dL', badge: 'Normal', sub: 'Hepatosplenomegaly: None' }
        };
      case 'stem':
        return {
          title: 'My CD34+ Kinetics',
          floatIcon: <Zap size={14} color="#2563eb" />,
          floatTitle: 'CD34+ Viability',
          floatValue: '98.1%',
          card1: { title: 'Cell Dose CD34+', value: `${selectedPatient.cell_dose_cd34 || 6.4} ×10⁶`, badge: 'Dose OK', sub: 'Viability 98.1%' },
          card2: { title: 'CXCR4 Chemokine Homing', value: '94.2%', badge: 'High', sub: 'Bone marrow affinity' },
          card3: { title: 'HLA Match Level', value: selectedPatient.hla_match || '10/10', badge: '10/10', sub: 'Matched donor' },
          card4: { title: 'CMV Serostatus', value: selectedPatient.cmv_status || 'D+/R-', badge: 'Monitored', sub: 'Prophylaxis active' }
        };
      case 'heart':
      default:
        return {
          title: 'My Heart Condition',
          floatIcon: <Heart size={14} fill="#2563eb" color="#2563eb" />,
          floatTitle: 'Heart Rate',
          floatValue: '120 bpm',
          card1: { title: 'Blood Status', value: '116/70', badge: '116 /70', sub: 'Systolic / Diastolic' },
          card2: { title: 'Heart Rate', value: '120 bpm', badge: '120 bpm', sub: 'Sinus rhythm' },
          card3: { title: 'Blood Count', value: '80-90', badge: '80 /90', sub: 'Hematocrit index' },
          card4: { title: 'Glucose Level', value: '230/ml', badge: '230 /ml', sub: 'Post-prandial' }
        };
    }
  };

  const telemetry = getTelemetryData();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1.35fr 0.85fr', gap: '2rem', alignItems: 'start' }}>
      
      {/* ============================================================ */}
      {/* COLUMN 1: LEFT SHOWCASE & INTERACTIVE 3D WEBGL ORGAN         */}
      {/* ============================================================ */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Massive Typography matching reference */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: '-0.035em',
            color: '#ffffff',
            margin: 0
          }}>
            Overview<br />Conditions
          </h1>
          <div style={{
            fontSize: '0.8rem',
            color: '#94a3b8',
            marginTop: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedPatient.name}</span>
            <span>•</span>
            <span>{selectedPatient.disease.split('(')[0]}</span>
            <span>•</span>
            <span style={{
              background: 'rgba(37, 99, 235, 0.2)',
              color: '#93c5fd',
              padding: '0.1rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              border: '1px solid rgba(37, 99, 235, 0.4)'
            }}>
              Primary Organ Target: {selectedPatient.organ_label || 'Heart'}
            </span>
          </div>
        </div>

        {/* 3D WebGL Hologram Stage with Three.js Interactive Viewer */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '460px',
          borderRadius: '24px',
          background: 'radial-gradient(circle at center, rgba(30, 41, 59, 0.25) 0%, transparent 70%)'
        }}>
          {/* Real 3D Interactive Three.js WebGL Model */}
          <OrganViewer3D
            organType={selectedOrgan}
            activePinId={activePin}
            onSelectPin={setActivePin}
            primaryMetricValue={telemetry.floatValue}
            bpm={selectedOrgan === 'heart' ? 120 : 75}
          />

          {/* Floating Frosted Glass Telemetry Card in Front */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            background: 'rgba(25, 28, 38, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '16px',
            padding: '0.85rem 1.15rem',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
            zIndex: 15,
            width: '190px',
            userSelect: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              {telemetry.floatIcon}
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{telemetry.floatTitle}</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
              {telemetry.floatValue}
            </div>
            {/* Live Waveform SVG */}
            <svg width="100%" height="28" viewBox="0 0 140 28" preserveAspectRatio="none">
              <path
                d={selectedOrgan === 'heart'
                  ? "M 0,14 L 30,14 L 40,4 L 50,24 L 60,8 L 70,18 L 80,14 L 140,14"
                  : "M 0,14 Q 25,2 50,18 T 100,10 T 140,14"
                }
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* COLUMN 2: CENTER CONDITION 2X2 GRID + BODY SYSTEMS CAROUSEL */}
      {/* ============================================================ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* Section Title 1 */}
        <div>
          <div className="spatial-section-title">
            <span className="blue-dot" />
            <span>{telemetry.title}</span>
          </div>

          {/* 2x2 Telemetry Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            
            {/* CARD 1: Blood Status / Primary Vital */}
            <div className="spatial-card" style={{ height: '145px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Droplet size={15} color="#94a3b8" />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{telemetry.card1.title}</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>
                {telemetry.card1.value}
              </div>
              {/* Vertical Equalizer bars with pill */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '36px' }}>
                  {[18, 28, 22, 34, 16, 26, 32].map((h, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: '3px',
                        height: `${h}px`,
                        borderRadius: '2px',
                        background: idx === 3 ? '#2563eb' : 'rgba(255, 255, 255, 0.2)'
                      }}
                    />
                  ))}
                </div>
                <div style={{
                  background: 'rgba(37, 99, 235, 0.2)',
                  border: '1px solid #2563eb',
                  borderRadius: '9999px',
                  padding: '0.15rem 0.55rem',
                  fontSize: '0.7rem',
                  color: '#93c5fd',
                  fontWeight: 600
                }}>
                  {telemetry.card1.badge}
                </div>
              </div>
            </div>

            {/* CARD 2: Heart Rate / Kinetics */}
            <div className="spatial-card" style={{ height: '145px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Heart size={15} color="#94a3b8" />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{telemetry.card2.title}</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>
                {telemetry.card2.value}
              </div>
              {/* Dynamic Waveform with Electric Blue Capsule Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <svg width="68%" height="32" viewBox="0 0 100 32" preserveAspectRatio="none">
                  <path
                    d="M 0,16 Q 15,2 25,24 T 50,12 T 75,20 T 100,16"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {/* Solid Electric Blue Pill Badge matching screenshot */}
                <div style={{
                  background: '#2563eb',
                  borderRadius: '12px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.5)',
                  textAlign: 'center'
                }}>
                  {telemetry.card2.badge}
                </div>
              </div>
            </div>

            {/* CARD 3: Blood Count / Engraftment */}
            <div className="spatial-card" style={{ height: '145px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart2 size={15} color="#94a3b8" />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{telemetry.card3.title}</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>
                {telemetry.card3.value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <svg width="70%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none">
                  <path
                    d="M 0,12 Q 25,2 50,18 T 100,10"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth="1.5"
                  />
                </svg>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.05)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                  {telemetry.card3.badge}
                </span>
              </div>
            </div>

            {/* CARD 4: Glucose Level / Viability */}
            <div className="spatial-card" style={{ height: '145px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={15} color="#94a3b8" />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{telemetry.card4.title}</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff' }}>
                {telemetry.card4.value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <svg width="70%" height="24" viewBox="0 0 100 24" preserveAspectRatio="none">
                  <path
                    d="M 0,16 Q 20,6 40,20 T 70,8 T 100,14"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth="1.5"
                  />
                </svg>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.05)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                  {telemetry.card4.badge}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Section Title 2: My Body Condition Carousel */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div className="spatial-section-title" style={{ margin: 0 }}>
              <span className="blue-dot" />
              <span>My Body Condition</span>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', color: '#94a3b8' }}>
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
              <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><ChevronRight size={16} /></button>
            </div>
          </div>

          {/* 4 Organ / Cellular Cards matching screenshot */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {organItems.map(item => {
              const isActive = selectedOrgan === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedOrgan(item.id as any)}
                  style={{
                    height: '115px',
                    background: 'rgba(25, 28, 38, 0.65)',
                    backdropFilter: 'blur(16px)',
                    border: isActive ? '1.5px solid #2563eb' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? '0 0 20px rgba(37, 99, 235, 0.35)' : 'none'
                  }}
                >
                  <img
                    src={item.img}
                    alt={item.name}
                    style={{
                      width: '65px',
                      height: '65px',
                      objectFit: 'contain',
                      mixBlendMode: 'screen'
                    }}
                  />
                  
                  {/* Active Pill Badge matching "My Organ ↗" */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      bottom: 8,
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '9999px',
                      padding: '0.15rem 0.5rem',
                      fontSize: '0.65rem',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}>
                      <span>{item.label}</span>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowUpRight size={8} color="#fff" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* COLUMN 3: RIGHT SCHEDULE & CLINICIAN APPOINTMENTS */}
      {/* ============================================================ */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="spatial-section-title">
          <span className="blue-dot" />
          <span>My Schedule</span>
        </div>

        <div className="spatial-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Next Checkup Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8'
            }}>
              <Calendar size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Next Checkup</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff' }}>Fri, 24 Mar</div>
            </div>
          </div>

          {/* Date Selector Pill Navigator: < 20-March-26 > */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '9999px',
            padding: '0.35rem 0.85rem',
            fontSize: '0.78rem',
            color: '#cbd5e1'
          }}>
            <ChevronLeft size={14} style={{ cursor: 'pointer' }} />
            <span>20-March-26</span>
            <ChevronRight size={14} style={{ cursor: 'pointer' }} />
          </div>

          {/* Clinician Avatars List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {[
              { name: 'Dr. Hanzer Jon', role: 'Chief Hematologist' },
              { name: 'Dr. Steve Alex', role: 'BMT Specialist' },
              { name: 'Dr. Johan Fraz', role: 'Transplant Oncologist' }
            ].map((doc, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                  {doc.name.split(' ')[1][0]}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#f8fafc' }}>
                  {doc.name}
                </div>
              </div>
            ))}
          </div>

          {/* Single Solid Electric Blue CTA Button */}
          <button
            onClick={() => onNavigate('diagnostic')}
            className="spatial-cta-btn"
            style={{ marginTop: '0.5rem' }}
          >
            <span>Consult Now</span>
            <ArrowRight size={15} />
          </button>

        </div>
      </div>

    </div>
  );
};
