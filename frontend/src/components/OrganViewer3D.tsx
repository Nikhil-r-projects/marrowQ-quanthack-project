import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Box, Info, Maximize2, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { OrganType } from '../types';
import { OrganMetric } from '../data/organs';

interface ModelCredit {
  title: string;
  author: string;
  url: string;
  license: string;
}

interface ModelSpec {
  url: string;
  credit?: ModelCredit;
  /** Sketchfab model shown through the official embed until a local .glb is added. */
  sketchfabId?: string;
  /** Per-model material adjustments applied to the cloned scene. */
  tune?: (root: THREE.Object3D) => void;
}

// Drop new .glb files into /public/models with these names and they are picked up automatically.
const MODELS: Record<OrganType, ModelSpec> = {
  heart: {
    url: '/models/heart.glb',
    credit: { title: 'Realistic Human Heart', author: 'neshallads', url: 'https://sketchfab.com/neshallads', license: 'CC BY 4.0' }
  },
  liver: {
    url: '/models/liver.glb',
    sketchfabId: 'a20686a3e4a54792bfede17ad32f4b1a',
    credit: { title: '3D Human Liver Anatomy', author: '3D4SCI', url: 'https://sketchfab.com/3d-models/3d-human-liver-anatomy-a20686a3e4a54792bfede17ad32f4b1a', license: 'See Sketchfab page' }
  },
  marrow: {
    url: '/models/marrow.glb',
    sketchfabId: 'f237e781b9934197a6f2f0f1da22e894',
    credit: { title: 'Bone Marrow', author: 'Coffee Hangover Studio', url: 'https://sketchfab.com/3d-models/bone-marrow-f237e781b9934197a6f2f0f1da22e894', license: 'See Sketchfab page' }
  },
  stem: {
    url: '/models/stem_cell.glb',
    // The membrane is opaque in the source file; make it glassy so the nucleus shows through.
    tune: root => {
      root.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.name === 'Membrane') {
          mat.transparent = true;
          mat.opacity = 0.32;
          mat.depthWrite = false;
          mat.roughness = 0.12;
          mat.color.set('#e6ecf0');
          mesh.renderOrder = 2;
        } else if (mat.name === 'Nucleus') {
          mat.roughness = 0.35;
          mat.emissive = new THREE.Color('#5b0b2e');
          mat.emissiveIntensity = 0.35;
        }
      });
    }
  }
};

// Hide Sketchfab's chrome that duplicates ours; animation_autoplay=0 keeps models whole (the liver
// otherwise plays an exploded-vessel animation); dnt=1 keeps the embed from tracking viewers.
const sketchfabEmbedUrl = (id: string) =>
  `https://sketchfab.com/models/${id}/embed?autostart=1&preload=1&autospin=0.2&animation_autoplay=0&transparent=1&ui_theme=dark&dnt=1` +
  '&ui_infos=0&ui_inspector=0&ui_settings=0&ui_vr=0&ui_ar=0&ui_help=0&ui_annotations=0&ui_stop=0&ui_hint=2';

const TARGET_SIZE = 2.2;
const CAMERA_DISTANCE = 5;

const gltfLoader = new GLTFLoader();
const modelCache = new Map<string, Promise<GLTF>>();

function loadModel(url: string, onProgress: (pct: number) => void): Promise<GLTF> {
  let pending = modelCache.get(url);
  if (!pending) {
    pending = new Promise<GLTF>((resolve, reject) => {
      gltfLoader.load(
        url,
        resolve,
        e => { if (e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
        reject
      );
    });
    // Allow a retry after a failed load (e.g. model not added yet).
    pending.catch(() => modelCache.delete(url));
    modelCache.set(url, pending);
  }
  return pending;
}

/** Clone the cached scene with its own materials so per-view tweaks (wireframe, tune) never leak into the cache. */
function instantiate(gltf: GLTF, spec: ModelSpec): THREE.Object3D {
  const root = gltf.scene.clone(true);
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
  });
  spec.tune?.(root);
  return root;
}

/** Centre the object on the origin and scale its largest dimension to TARGET_SIZE. */
function normalize(obj: THREE.Object3D): THREE.Group {
  const pivot = new THREE.Group();
  pivot.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = TARGET_SIZE / Math.max(size.x, size.y, size.z, 1e-6);
  obj.scale.multiplyScalar(scale);
  obj.position.sub(center.multiplyScalar(scale));
  return pivot;
}

function disposeObject(obj: THREE.Object3D, disposeGeometry: boolean) {
  obj.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (disposeGeometry) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(m => m.dispose());
  });
}

function setWireframe(obj: THREE.Object3D, on: boolean) {
  obj.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(m => { if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = on; });
  });
}

interface PinAnchor {
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

/** Cast a ray from outside the model toward its centre along each pin direction and anchor the pin on the first surface hit. */
function anchorPins(model: THREE.Object3D, metrics: OrganMetric[]): Map<string, PinAnchor> {
  const anchors = new Map<string, PinAnchor>();
  const raycaster = new THREE.Raycaster();
  model.updateMatrixWorld(true);
  for (const m of metrics) {
    const dir = new THREE.Vector3(...m.pin).normalize();
    raycaster.set(dir.clone().multiplyScalar(10), dir.clone().negate());
    const hit = raycaster.intersectObject(model, true).find(h => h.face);
    if (hit && hit.face) {
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      anchors.set(m.key, { point: hit.point.clone(), normal });
    } else {
      anchors.set(m.key, { point: dir.clone().multiplyScalar(TARGET_SIZE * 0.42), normal: dir });
    }
  }
  return anchors;
}

type LoadState = { status: 'loading'; progress: number } | { status: 'ready' } | { status: 'fallback' } | { status: 'embed'; ready: boolean };

interface OrganViewer3DProps {
  organType: OrganType;
  metrics: OrganMetric[];
  activeMetricKey: string | null;
  onSelectMetric: (key: string) => void;
  /** Heart rate used for the beating animation. */
  bpm?: number;
  height?: number | string;
}

export const OrganViewer3D: React.FC<OrganViewer3DProps> = ({
  organType,
  metrics,
  activeMetricKey,
  onSelectMetric,
  bpm = 72,
  height = 520
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const pinEls = useRef(new Map<string, HTMLButtonElement>());

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const stageGroupRef = useRef<THREE.Group | null>(null);
  const contentRef = useRef<{ obj: THREE.Object3D; ownsGeometry: boolean } | null>(null);
  const anchorsRef = useRef<Map<string, PinAnchor>>(new Map());
  const animatedRef = useRef(true);
  const bpmRef = useRef(bpm);
  const organRef = useRef(organType);

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [animated, setAnimated] = useState(!reducedMotion);
  const [wireframe, setWireframeState] = useState(false);
  const [load, setLoad] = useState<LoadState>({ status: 'loading', progress: 0 });
  const [showCredit, setShowCredit] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const metricsRef = useRef(metrics);
  const wireframeRef = useRef(wireframe);
  // Mirror the latest props for the render loop; declared before the effects that read them.
  useEffect(() => {
    bpmRef.current = bpm;
    organRef.current = organType;
    metricsRef.current = metrics;
    wireframeRef.current = wireframe;
  });

  // ---- One-time scene setup -------------------------------------------------
  useEffect(() => {
    const host = canvasHostRef.current;
    const stage = stageRef.current;
    if (!host || !stage) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setWebglError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    sceneRef.current = scene;

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 4, 5);
    // Neutral studio lighting so tissue keeps its true colour.
    const rim = new THREE.DirectionalLight(0xf1efe9, 1.4);
    rim.position.set(-4, 2, -4);
    const under = new THREE.DirectionalLight(0xffffff, 0.35);
    under.position.set(0, -4, 2);
    scene.add(key, rim, under, new THREE.AmbientLight(0xffffff, 0.25));

    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
    camera.position.set(0, 0.2, CAMERA_DISTANCE);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 9;
    controls.autoRotateSpeed = 1.1;
    controls.saveState();
    controlsRef.current = controls;

    let resumeTimer: number | undefined;
    const onStart = () => { controls.autoRotate = false; window.clearTimeout(resumeTimer); };
    const onEnd = () => { resumeTimer = window.setTimeout(() => { controls.autoRotate = animatedRef.current; }, 2500); };
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);

    const stageGroup = new THREE.Group();
    scene.add(stageGroup);
    stageGroupRef.current = stageGroup;

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const projected = new THREE.Vector3();
    const toCamera = new THREE.Vector3();

    const renderFrame = (timeMs: number) => {
      const t = timeMs / 1000;
      controls.update();

      if (animatedRef.current) {
        let s = 1;
        if (organRef.current === 'heart') {
          // Lub-dub: two gaussian pulses per cardiac cycle.
          const phase = (t * bpmRef.current / 60) % 1;
          s = 1 + 0.035 * (Math.exp(-(((phase - 0.08) / 0.05) ** 2)) + 0.6 * Math.exp(-(((phase - 0.28) / 0.06) ** 2)));
        } else if (organRef.current === 'stem') {
          s = 1 + 0.015 * Math.sin(t * 1.8);
        } else {
          s = 1 + 0.008 * Math.sin(t * 1.2);
        }
        stageGroup.scale.setScalar(s);
      }

      renderer.render(scene, camera);

      // Project pins into screen space; hide ones on the far side of the model.
      const w = host.clientWidth;
      const h = host.clientHeight;
      pinEls.current.forEach((el, k) => {
        const a = anchorsRef.current.get(k);
        if (!a) { el.dataset.visible = 'false'; return; }
        projected.copy(a.point).project(camera);
        toCamera.copy(camera.position).sub(a.point);
        const facing = a.normal.dot(toCamera) > 0;
        const x = (projected.x * 0.5 + 0.5) * w;
        const y = (-projected.y * 0.5 + 0.5) * h;
        el.style.transform = `translate(${x - 7}px, ${y - 7}px)`;
        el.dataset.visible = String(facing && projected.z <= 1);
        // Open the label toward the centre so it never runs off the viewer edge.
        el.dataset.side = x > w * 0.55 ? 'left' : 'right';
      });
    };

    // Only render while the viewer is on screen and the tab is visible.
    let onScreen = true;
    const sync = () => renderer.setAnimationLoop(onScreen && !document.hidden ? renderFrame : null);
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); });
    io.observe(stage);
    document.addEventListener('visibilitychange', sync);
    sync();

    return () => {
      renderer.setAnimationLoop(null);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', sync);
      window.clearTimeout(resumeTimer);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      controls.dispose();
      if (contentRef.current) disposeObject(contentRef.current.obj, contentRef.current.ownsGeometry);
      contentRef.current = null;
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
    };
  }, []);

  // ---- Load / swap organ model ---------------------------------------------
  useEffect(() => {
    const stageGroup = stageGroupRef.current;
    if (!stageGroup) return;
    let cancelled = false;
    setLoad({ status: 'loading', progress: 0 });
    setShowCredit(false);
    anchorsRef.current = new Map();

    const mount = (obj: THREE.Object3D, ownsGeometry: boolean, state: LoadState) => {
      if (cancelled) { disposeObject(obj, ownsGeometry); return; }
      if (contentRef.current) {
        stageGroup.remove(contentRef.current.obj);
        disposeObject(contentRef.current.obj, contentRef.current.ownsGeometry);
      }
      setWireframe(obj, wireframeRef.current);
      stageGroup.add(obj);
      contentRef.current = { obj, ownsGeometry };
      anchorsRef.current = anchorPins(obj, metricsRef.current);
      controlsRef.current?.reset();
      if (controlsRef.current) controlsRef.current.autoRotate = animatedRef.current;
      setLoad(state);
    };

    const spec = MODELS[organType];
    loadModel(spec.url, pct => { if (!cancelled) setLoad({ status: 'loading', progress: pct }); })
      .then(gltf => mount(normalize(instantiate(gltf, spec)), false, { status: 'ready' }))
      .catch(() => {
        if (cancelled) return;
        if (spec.sketchfabId && navigator.onLine) {
          if (contentRef.current) {
            stageGroup.remove(contentRef.current.obj);
            disposeObject(contentRef.current.obj, contentRef.current.ownsGeometry);
            contentRef.current = null;
          }
          setLoad({ status: 'embed', ready: false });
        } else {
          mount(normalize(buildProceduralOrgan(organType)), true, { status: 'fallback' });
        }
      });

    return () => { cancelled = true; };
  }, [organType]);

  // Re-anchor pins when the pin set changes for the same organ.
  const pinSignature = metrics.map(m => `${m.key}:${m.pin.join(',')}`).join('|');
  useEffect(() => {
    if (contentRef.current) anchorsRef.current = anchorPins(contentRef.current.obj, metrics);
  }, [pinSignature]);

  useEffect(() => {
    if (contentRef.current) setWireframe(contentRef.current.obj, wireframe);
  }, [wireframe]);

  useEffect(() => {
    animatedRef.current = animated;
    if (controlsRef.current) controlsRef.current.autoRotate = animated;
    if (!animated) stageGroupRef.current?.scale.setScalar(1);
  }, [animated]);

  const dolly = (factor: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const dist = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setLength(dist));
    controls.update();
  };

  const toggleFullscreen = () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen?.();
  };

  const isEmbed = load.status === 'embed';
  const spec = MODELS[organType];
  // The Sketchfab embed shows its own title and author, so only local models need our credit.
  const credit = load.status === 'ready' ? spec.credit : undefined;

  return (
    <div ref={stageRef} className="organ-stage" style={{ height }}>
      <div className="organ-floor" />
      <div ref={canvasHostRef} className="organ-canvas" aria-label={`Interactive 3D model: ${organType}`} role="img" />

      {isEmbed && spec.sketchfabId && (
        <iframe
          key={spec.sketchfabId}
          className="organ-embed"
          title={`${spec.credit?.title ?? organType} (3D model on Sketchfab)`}
          src={sketchfabEmbedUrl(spec.sketchfabId)}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
          onLoad={() => setLoad({ status: 'embed', ready: true })}
        />
      )}

      <div className="pin-layer" hidden={isEmbed}>
        {metrics.map(m => (
          <button
            key={m.key}
            ref={el => { if (el) pinEls.current.set(m.key, el); else pinEls.current.delete(m.key); }}
            className={`pin ${m.status} ${activeMetricKey === m.key ? 'active' : ''}`}
            onClick={() => onSelectMetric(m.key)}
            aria-label={`${m.label}: ${m.value}${m.unit ? ' ' + m.unit : ''}`}
            aria-pressed={activeMetricKey === m.key}
          >
            <span className="pin-dot" />
            <span className="pin-label">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="viewer-toolbar" role="toolbar" aria-label="3D viewer controls" hidden={isEmbed}>
        <button onClick={() => setAnimated(a => !a)} aria-pressed={animated} title={animated ? 'Pause motion' : 'Resume motion'} aria-label={animated ? 'Pause motion' : 'Resume motion'}>
          {animated ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button onClick={() => setWireframeState(w => !w)} aria-pressed={wireframe} title="Wireframe" aria-label="Toggle wireframe">
          <Box size={15} />
        </button>
        <button onClick={() => dolly(0.82)} title="Zoom in" aria-label="Zoom in"><ZoomIn size={15} /></button>
        <button onClick={() => dolly(1.2)} title="Zoom out" aria-label="Zoom out"><ZoomOut size={15} /></button>
        <button onClick={() => controlsRef.current?.reset()} title="Reset view" aria-label="Reset view"><RotateCcw size={15} /></button>
        <button onClick={toggleFullscreen} title="Fullscreen" aria-label="Fullscreen"><Maximize2 size={15} /></button>
      </div>

      {(load.status === 'loading' || (isEmbed && !load.ready)) && !webglError && (
        <div className="viewer-status">
          <div className="loader">
            <div className="ring" />
            <span>Loading 3D model</span>
            {load.status === 'loading' && <div className="bar"><span style={{ width: `${load.progress}%` }} /></div>}
          </div>
        </div>
      )}

      {webglError && (
        <div className="viewer-status">
          <div className="loader" style={{ maxWidth: 260, textAlign: 'center' }}>
            <span>3D view needs WebGL, which isn't available in this browser.</span>
          </div>
        </div>
      )}

      {(load.status === 'ready' || load.status === 'fallback') && !webglError && (
        <div className="viewer-hint">Drag to rotate · scroll or pinch to zoom · tap a marker</div>
      )}

      {load.status === 'fallback' && (
        <span className="chip chip-neutral viewer-placeholder" title={`Add ${MODELS[organType].url.replace('/models/', '')} to public/models to show the detailed model`}>
          Placeholder model
        </span>
      )}

      {credit && (
        <div className="viewer-credit">
          <button className="viewer-credit-btn" onClick={() => setShowCredit(s => !s)} aria-expanded={showCredit}>
            <Info size={11} /> Model credit
          </button>
          {showCredit && (
            <div className="viewer-credit-pop">
              “{credit.title}” by{' '}
              <a href={credit.url} target="_blank" rel="noreferrer">{credit.author}</a>{' '}
              on Sketchfab · {credit.license}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrganViewer3D;

// =========================================================================
// Procedural fallback geometry, used until a .glb exists for an organ
// =========================================================================
function buildProceduralOrgan(type: OrganType): THREE.Group {
  const group = new THREE.Group();
  const mat = (color: number, roughness = 0.4, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08, ...extra });

  switch (type) {
    case 'heart': {
      const geo = new THREE.SphereGeometry(1, 48, 48);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < 0) { pos.setX(i, pos.getX(i) * (1 + y * 0.45)); pos.setZ(i, pos.getZ(i) * (1 + y * 0.45)); }
        pos.setX(i, pos.getX(i) + Math.sin(y * 2) * 0.08);
      }
      geo.computeVertexNormals();
      const body = new THREE.Mesh(geo, mat(0x9e1717, 0.38));
      body.scale.set(0.9, 1.15, 0.85);
      const aorta = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.16, 20, 36, Math.PI * 1.15), mat(0xba1a1a, 0.3));
      aorta.position.set(-0.08, 0.9, 0.05);
      aorta.rotation.z = -Math.PI / 6;
      const pulm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.75, 20), mat(0x1d4ed8, 0.3));
      pulm.position.set(0.35, 0.7, 0.3);
      pulm.rotation.set(Math.PI / 7, 0, Math.PI / 4.2);
      group.add(body, aorta, pulm);
      break;
    }
    case 'liver': {
      const tissue = mat(0x7a2a14, 0.35);
      const right = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 32), tissue);
      right.scale.set(1.15, 0.72, 0.82);
      right.position.x = 0.25;
      const left = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 24), tissue);
      left.scale.set(1.2, 0.45, 0.6);
      left.position.set(-0.95, 0.12, 0.1);
      left.rotation.z = -0.25;
      const gall = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 8, 16), mat(0x2f7d4a, 0.3));
      gall.position.set(0.35, -0.55, 0.45);
      gall.rotation.z = 0.6;
      const portal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.7, 16), mat(0x1d4ed8, 0.3));
      portal.position.set(0.0, -0.55, 0.2);
      portal.rotation.x = Math.PI / 6;
      group.add(right, left, gall, portal);
      break;
    }
    case 'marrow': {
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.58, 2.4, 40, 1, true), mat(0xd6d3d1, 0.55, { side: THREE.DoubleSide }));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 24), mat(0xd6d3d1, 0.55));
      head.position.y = 1.35;
      head.scale.set(1, 0.7, 1);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.46, 2.35, 32), mat(0x8b1c1c, 0.45));
      group.add(bone, head, core);
      // Deterministic niche placement so the shape is stable between renders.
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const niche = mat(0xb91c1c, 0.4);
      for (let i = 0; i < 28; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 + rand() * 0.07, 12, 12), niche);
        const theta = rand() * Math.PI * 2;
        const r = 0.5 + rand() * 0.06;
        s.position.set(r * Math.cos(theta), -1 + rand() * 2, r * Math.sin(theta));
        group.add(s);
      }
      break;
    }
    case 'stem': {
      const membrane = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), mat(0xdbeafe, 0.15, { transparent: true, opacity: 0.32, depthWrite: false }));
      const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), mat(0xcc0f65, 0.35));
      group.add(nucleus, membrane);
      break;
    }
  }
  return group;
}
