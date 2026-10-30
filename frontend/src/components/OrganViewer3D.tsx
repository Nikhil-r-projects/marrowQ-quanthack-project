import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Eye, RotateCw, Zap, Play, Pause, ZoomIn, ZoomOut, CheckCircle2 } from 'lucide-react';

export interface MilestonePin3D {
  id: number;
  label: string;
  position: [number, number, number];
  description: string;
  value: string;
}

interface OrganViewer3DProps {
  organType: 'heart' | 'marrow' | 'liver' | 'stem';
  activePinId: number | null;
  onSelectPin: (id: number) => void;
  primaryMetricValue?: string;
  bpm?: number;
}

export const OrganViewer3D: React.FC<OrganViewer3DProps> = ({
  organType,
  activePinId,
  onSelectPin,
  primaryMetricValue = '120 bpm',
  bpm = 120
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [isAnimated, setIsAnimated] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(4.6);

  // References for three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const organGroupRef = useRef<THREE.Group | null>(null);
  const pinsGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Dynamic 3D pins per organ
  const getPinsForOrgan = (type: string): MilestonePin3D[] => {
    switch (type) {
      case 'heart':
        return [
          { id: 1, label: 'Aorta Outflow Arch', position: [-0.1, 0.95, 0.4], description: 'LV Ejection Fraction', value: '62%' },
          { id: 2, label: 'Left Ventricle Wall', position: [0.65, 0.1, 0.6], description: 'Myocardial Wall Thickness', value: '11mm' },
          { id: 3, label: 'Apex Conduction Focus', position: [-0.45, -0.85, 0.4], description: 'Sinus Tachycardia Rate', value: primaryMetricValue },
          { id: 4, label: 'Pericardial Sac', position: [0.45, -0.5, -0.4], description: 'Pericardial Effusion Screen', value: 'Clear (Safe)' }
        ];
      case 'marrow':
        return [
          { id: 1, label: 'Endosteal Stem Niche', position: [0.15, 0.85, 0.4], description: 'HSC Homing Density', value: '98.4%' },
          { id: 2, label: 'Trabecular Spongiosa', position: [-0.5, 0.1, 0.5], description: 'Cellularity Index', value: '45%' },
          { id: 3, label: 'Sinusoidal Microvascular', position: [0.45, -0.65, 0.35], description: 'Marrow Perfusion Index', value: 'Normal' },
          { id: 4, label: 'Cortical Bone Boundary', position: [0.0, -0.95, -0.4], description: 'Osteoblastic Activity', value: 'Preserved' }
        ];
      case 'liver':
        return [
          { id: 1, label: 'Right Hepatic Lobe', position: [0.65, 0.3, 0.4], description: 'Hepatosplenomegaly Ultrasound', value: '14.2cm' },
          { id: 2, label: 'Portal Triad Bifurcation', position: [-0.05, -0.1, 0.65], description: 'Portal Flow Velocity', value: '26 cm/s' },
          { id: 3, label: 'Left Lobe Parenchyma', position: [-0.7, 0.2, 0.25], description: 'VOD / SOS Clearance', value: 'Grade 0' },
          { id: 4, label: 'Biliary System', position: [0.1, -0.7, 0.35], description: 'Total Serum Bilirubin', value: '0.8 mg/dL' }
        ];
      case 'stem':
        return [
          { id: 1, label: 'CD34+ Surface Epitope', position: [0.0, 0.95, 0.2], description: 'Stem Cell Purity Ratio', value: '99.2%' },
          { id: 2, label: 'CXCR4 Chemokine Receptor', position: [0.8, 0.2, 0.4], description: 'Homing Affinity to Stroma', value: 'High' },
          { id: 3, label: 'Lipid Bilayer Membrane', position: [-0.7, -0.45, 0.45], description: 'Viability Membrane Integrity', value: '98.1%' },
          { id: 4, label: 'Nuclear CD38 Negative Core', position: [0.15, -0.75, -0.5], description: 'Pluripotency Status', value: 'Optimal' }
        ];
      default:
        return [];
    }
  };

  const pins = getPinsForOrgan(organType);
  const activePin = pins.find(p => p.id === activePinId) || pins[0];

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 420;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera - position at proper distance so models don't clip
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, zoomLevel);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and alpha
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 4. Studio Multi-Point Lighting for Anatomical Depth
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    const blueRimLight = new THREE.DirectionalLight(0x3b82f6, 2.5);
    blueRimLight.position.set(-5, 3, -4);
    scene.add(blueRimLight);

    const warmFillLight = new THREE.PointLight(0xffedd5, 1.2, 12);
    warmFillLight.position.set(0, -3, 3);
    scene.add(warmFillLight);

    // 5. Organ Group - Scaled appropriately so it fits within the viewport perfectly
    const organGroup = new THREE.Group();
    organGroup.scale.set(0.72, 0.72, 0.72);
    organGroupRef.current = organGroup;
    scene.add(organGroup);

    // Construct refined 3D anatomical geometry
    buildRefinedOrganGeometry(organType, organGroup, isWireframe);

    // 6. Concentric Holographic Orbital Rings
    const ringGroup = new THREE.Group();
    const ringMat1 = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.35 });
    const ringGeo1 = new THREE.RingGeometry(1.7, 1.715, 64);
    const ring1 = new THREE.Line(ringGeo1, ringMat1);
    ring1.rotation.x = Math.PI / 2.3;
    ringGroup.add(ring1);

    const ringMat2 = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    const ringGeo2 = new THREE.RingGeometry(2.1, 2.11, 64);
    const ring2 = new THREE.Line(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI / 4;
    ringGroup.add(ring2);
    scene.add(ringGroup);

    // 7. Interactive 3D Milestone Hotspot Pins
    const pinsGroup = new THREE.Group();
    pinsGroupRef.current = pinsGroup;
    pins.forEach((pin) => {
      const isSelected = activePinId === pin.id;

      // Pin core sphere
      const pinGeo = new THREE.SphereGeometry(0.065, 16, 16);
      const pinMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x2563eb : 0xffffff,
        emissive: isSelected ? 0x3b82f6 : 0xffffff,
        emissiveIntensity: isSelected ? 2.5 : 1.2,
        roughness: 0.2,
        metalness: 0.8
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(...pin.position);
      pinMesh.userData = { pinId: pin.id };

      // Halo ring around pin
      const haloGeo = new THREE.RingGeometry(0.09, 0.12, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0x60a5fa : 0xffffff,
        transparent: true,
        opacity: isSelected ? 0.9 : 0.45,
        side: THREE.DoubleSide
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.set(...pin.position);
      haloMesh.position.z += 0.02;
      haloMesh.userData = { pinId: pin.id };

      pinsGroup.add(pinMesh);
      pinsGroup.add(haloMesh);
    });
    organGroup.add(pinsGroup);

    // 8. Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      if (isAnimated && organGroupRef.current) {
        if (organType === 'heart') {
          // Realistic dual ventricular contraction (systole + diastole)
          const beatFreq = (bpm / 60) * Math.PI * 2;
          const beat = Math.sin(elapsedTime * beatFreq);
          const secondary = Math.sin(elapsedTime * beatFreq * 2 + 0.3) * 0.4;
          const scaleMod = 1.0 + Math.max(0, beat + secondary) * 0.075;
          organGroupRef.current.scale.set(0.72 * scaleMod, 0.72 * scaleMod * 1.02, 0.72 * scaleMod);
        } else if (organType === 'stem') {
          // Dynamic membrane wave
          const wave = Math.sin(elapsedTime * 2.2) * 0.035;
          organGroupRef.current.scale.set(0.72 * (1.0 + wave), 0.72 * (1.0 - wave), 0.72 * (1.0 + wave * 0.5));
        } else {
          // Gentle metabolic breathing cycle
          const breath = Math.sin(elapsedTime * 1.2) * 0.02;
          organGroupRef.current.scale.set(0.72 * (1.0 + breath), 0.72 * (1.0 + breath), 0.72 * (1.0 + breath));
        }

        // Smooth continuous slow rotation when idle
        if (!isDragging) {
          organGroupRef.current.rotation.y += 0.003;
        }
      }

      // Billboard pins to always face the camera
      if (pinsGroupRef.current) {
        pinsGroupRef.current.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry) {
            child.quaternion.copy(camera.quaternion);
          }
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      container.replaceChildren();
    };
  }, [organType, isWireframe, isAnimated, activePinId, zoomLevel]);

  // Interactive mouse drag orbit controls
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const initialRotY = organGroupRef.current?.rotation.y || 0;
    const initialRotX = organGroupRef.current?.rotation.x || 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      if (organGroupRef.current) {
        organGroupRef.current.rotation.y = initialRotY + deltaX * 0.01;
        organGroupRef.current.rotation.x = Math.max(-0.6, Math.min(0.6, initialRotX + deltaY * 0.01));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = Math.max(3.4, Math.min(6.2, zoomLevel + e.deltaY * 0.003));
    setZoomLevel(newZoom);
    if (cameraRef.current) {
      cameraRef.current.position.z = newZoom;
    }
  };

  return (
    <div
      onWheel={handleWheel}
      style={{
        position: 'relative',
        width: '100%',
        height: '460px',
        userSelect: 'none',
        overflow: 'hidden',
        borderRadius: '24px'
      }}
    >
      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        onMouseDown={handleMouseDown}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      />

      {/* Floating 3D Tool Controls */}
      <div style={{
        position: 'absolute',
        top: 14,
        right: 14,
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
        background: 'rgba(18, 20, 27, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '9999px',
        padding: '0.3rem 0.6rem',
        zIndex: 20
      }}>
        {/* Toggle Wireframe Mode */}
        <button
          onClick={() => setIsWireframe(!isWireframe)}
          title="Toggle Wireframe Holo-scan"
          style={{
            background: isWireframe ? '#2563eb' : 'transparent',
            border: 'none',
            color: '#f8fafc',
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Zap size={13} />
        </button>

        {/* Toggle Animation */}
        <button
          onClick={() => setIsAnimated(!isAnimated)}
          title={isAnimated ? 'Pause 3D Dynamics' : 'Resume 3D Dynamics'}
          style={{
            background: isAnimated ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
            border: 'none',
            color: '#f8fafc',
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          {isAnimated ? <Pause size={13} /> : <Play size={13} />}
        </button>

        {/* Zoom In */}
        <button
          onClick={() => {
            const z = Math.max(3.4, zoomLevel - 0.4);
            setZoomLevel(z);
            if (cameraRef.current) cameraRef.current.position.z = z;
          }}
          title="Zoom In"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <ZoomIn size={13} />
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => {
            const z = Math.min(6.2, zoomLevel + 0.4);
            setZoomLevel(z);
            if (cameraRef.current) cameraRef.current.position.z = z;
          }}
          title="Zoom Out"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <ZoomOut size={13} />
        </button>

        {/* Reset 3D Rotation */}
        <button
          onClick={() => {
            if (organGroupRef.current) {
              organGroupRef.current.rotation.set(0, 0, 0);
            }
          }}
          title="Reset 3D Orientation"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            borderRadius: '50%',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <RotateCw size={13} />
        </button>
      </div>

      {/* Top Left Status Badge */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        background: 'rgba(18, 20, 27, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '9999px',
        padding: '0.25rem 0.75rem',
        fontSize: '0.72rem',
        color: '#94a3b8',
        zIndex: 20
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
        <span style={{ fontWeight: 600, color: '#f8fafc' }}>Interactive 3D WebGL</span>
        <span style={{ opacity: 0.6 }}>• Drag to orbit • Scroll to zoom</span>
      </div>

      {/* Active Pin Hotspot Inspector HUD Pill */}
      {activePin && (
        <div style={{
          position: 'absolute',
          top: 55,
          left: 14,
          background: 'rgba(18, 20, 27, 0.92)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(37, 99, 235, 0.4)',
          borderRadius: '12px',
          padding: '0.5rem 0.85rem',
          zIndex: 20,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ffffff' }}>{activePin.label}</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
            {activePin.description}: <strong style={{ color: '#38bdf8' }}>{activePin.value}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// Refined Anatomical 3D Mesh Builders
// =========================================================================
function buildRefinedOrganGeometry(type: string, parentGroup: THREE.Group, wireframe: boolean) {
  while (parentGroup.children.length > 0) {
    parentGroup.remove(parentGroup.children[0]);
  }

  // Refined organic shader materials with soft roughness and specular reflection
  const heartMuscleMat = new THREE.MeshStandardMaterial({
    color: 0x9e1717,
    roughness: 0.38,
    metalness: 0.15,
    wireframe: wireframe
  });

  const aortaRedMat = new THREE.MeshStandardMaterial({
    color: 0xba1a1a,
    roughness: 0.3,
    metalness: 0.2,
    wireframe: wireframe
  });

  const pulmBlueMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.28,
    metalness: 0.25,
    wireframe: wireframe
  });

  const boneCorticalMat = new THREE.MeshStandardMaterial({
    color: 0xd6d3d1,
    roughness: 0.5,
    metalness: 0.05,
    wireframe: wireframe
  });

  const marrowRedMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    roughness: 0.45,
    metalness: 0.15,
    wireframe: wireframe
  });

  const liverTissueMat = new THREE.MeshStandardMaterial({
    color: 0x6e2511,
    roughness: 0.35,
    metalness: 0.12,
    wireframe: wireframe
  });

  const stemMembraneMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.2,
    metalness: 0.3,
    wireframe: wireframe
  });

  switch (type) {
    case 'heart': {
      // 1. Ventricular Body (Sculpted organic heart shape)
      const ventGeo = new THREE.SphereGeometry(1.0, 36, 36);
      const pos = ventGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        // Taper towards the apex at bottom
        if (y < 0) {
          pos.setX(i, x * (1 + y * 0.45));
          pos.setZ(i, z * (1 + y * 0.45));
        }
        // Slightly rotate ventricular groove
        pos.setX(i, pos.getX(i) + Math.sin(y * 2) * 0.08);
      }
      ventGeo.computeVertexNormals();
      const ventricles = new THREE.Mesh(ventGeo, heartMuscleMat);
      ventricles.scale.set(0.9, 1.15, 0.85);
      parentGroup.add(ventricles);

      // 2. Aortic Arch (Curved Torus at top)
      const aortaGeo = new THREE.TorusGeometry(0.42, 0.16, 20, 36, Math.PI * 1.15);
      const aorta = new THREE.Mesh(aortaGeo, aortaRedMat);
      aorta.position.set(-0.08, 0.9, 0.05);
      aorta.rotation.z = -Math.PI / 6;
      parentGroup.add(aorta);

      // 3. Brachiocephalic and Carotid Branches on Aorta Arch
      [-0.2, 0.05, 0.25].forEach((offsetX, idx) => {
        const branchGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 12);
        const branch = new THREE.Mesh(branchGeo, aortaRedMat);
        branch.position.set(offsetX - 0.1, 1.3, 0.08);
        branch.rotation.z = (idx - 1) * 0.15;
        parentGroup.add(branch);
      });

      // 4. Pulmonary Trunk (Blue vessel branching)
      const pulmGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.75, 20);
      const pulm = new THREE.Mesh(pulmGeo, pulmBlueMat);
      pulm.position.set(0.35, 0.7, 0.3);
      pulm.rotation.z = Math.PI / 4.2;
      pulm.rotation.x = Math.PI / 7;
      parentGroup.add(pulm);

      // 5. Superior Vena Cava
      const svcGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.7, 16);
      const svc = new THREE.Mesh(svcGeo, pulmBlueMat);
      svc.position.set(-0.55, 0.75, -0.15);
      parentGroup.add(svc);

      // 6. Coronary Arteries (Vascular curves across myocardium)
      const curve1 = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.05, 0.6, 0.85),
        new THREE.Vector3(0.25, 0.2, 0.88),
        new THREE.Vector3(0.4, -0.3, 0.7),
        new THREE.Vector3(0.2, -0.85, 0.45)
      ]);
      const tubeGeo1 = new THREE.TubeGeometry(curve1, 30, 0.03, 8, false);
      const coronary1 = new THREE.Mesh(tubeGeo1, aortaRedMat);
      parentGroup.add(coronary1);
      break;
    }

    case 'marrow': {
      // Femoral Bone Cross-Section
      // 1. Cortical outer bone shaft
      const outerBoneGeo = new THREE.CylinderGeometry(0.75, 0.7, 2.4, 32, 1, true);
      const outerBone = new THREE.Mesh(outerBoneGeo, boneCorticalMat);
      parentGroup.add(outerBone);

      // 2. Interior medullary cavity with red hematopoietic bone marrow
      const marrowCoreGeo = new THREE.CylinderGeometry(0.6, 0.56, 2.35, 28);
      const marrowCore = new THREE.Mesh(marrowCoreGeo, marrowRedMat);
      parentGroup.add(marrowCore);

      // 3. Spongy cancellous trabecular niches
      const nicheGroup = new THREE.Group();
      for (let i = 0; i < 30; i++) {
        const rad = 0.06 + Math.random() * 0.07;
        const sphereGeo = new THREE.SphereGeometry(rad, 10, 10);
        const sphere = new THREE.Mesh(sphereGeo, marrowRedMat);
        const theta = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.45;
        const y = -1.0 + Math.random() * 2.0;
        sphere.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
        nicheGroup.add(sphere);
      }
      parentGroup.add(nicheGroup);
      break;
    }

    case 'liver': {
      // Hepatic Bi-lobar geometry
      // 1. Right Hepatic Lobe
      const rightLobeGeo = new THREE.SphereGeometry(1.0, 32, 28);
      rightLobeGeo.scale(1.15, 0.75, 0.85);
      const rightLobe = new THREE.Mesh(rightLobeGeo, liverTissueMat);
      rightLobe.position.set(0.25, 0, 0);
      parentGroup.add(rightLobe);

      // 2. Left Lobe (Tapered Cone)
      const leftLobeGeo = new THREE.ConeGeometry(0.85, 1.3, 28);
      leftLobeGeo.scale(0.75, 0.65, 0.55);
      const leftLobe = new THREE.Mesh(leftLobeGeo, liverTissueMat);
      leftLobe.position.set(-0.85, -0.1, 0.1);
      leftLobe.rotation.z = Math.PI / 2.3;
      parentGroup.add(leftLobe);

      // 3. Portal Vein Trunk
      const portalGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.7, 16);
      const portal = new THREE.Mesh(portalGeo, pulmBlueMat);
      portal.position.set(0.1, -0.55, 0.4);
      portal.rotation.x = Math.PI / 6;
      parentGroup.add(portal);
      break;
    }

    case 'stem': {
      // CD34+ Spherical Hematopoietic Stem Cell
      // 1. Central Lipid Membrane Core
      const stemGeo = new THREE.SphereGeometry(0.95, 36, 36);
      const stemMesh = new THREE.Mesh(stemGeo, stemMembraneMat);
      parentGroup.add(stemMesh);

      // 2. Glycoprotein Receptors (CD34, CXCR4) radiating on surface
      const receptorGroup = new THREE.Group();
      const numReceptors = 36;
      for (let i = 0; i < numReceptors; i++) {
        const phi = Math.acos(-1 + (2 * i) / numReceptors);
        const theta = Math.sqrt(numReceptors * Math.PI) * phi;
        const x = Math.cos(theta) * Math.sin(phi);
        const y = Math.sin(theta) * Math.sin(phi);
        const z = Math.cos(phi);

        const isCD34 = i % 2 === 0;
        const stalkGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6);
        const headGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const stalkMat = new THREE.MeshStandardMaterial({ color: isCD34 ? 0x2563eb : 0x10b981 });
        const stalk = new THREE.Mesh(stalkGeo, stalkMat);
        const head = new THREE.Mesh(headGeo, stalkMat);
        head.position.y = 0.12;

        const stud = new THREE.Group();
        stud.add(stalk);
        stud.add(head);

        stud.position.set(x * 0.96, y * 0.96, z * 0.96);
        stud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y, z));
        receptorGroup.add(stud);
      }
      parentGroup.add(receptorGroup);
      break;
    }
  }
}
