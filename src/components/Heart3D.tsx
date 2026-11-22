import { HEART_LANDMARKS } from '../presentation/heartLandmarks';
import React, {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Play,
  Radiation,
  RotateCcw,
  Table2,
} from 'lucide-react';
import {
  ANGIO_PROJECTIONS,
  AngioProjection,
  AngioProjectionId,
  AngioSystem,
  getOptimalProjectionForCase,
  PROJECTION_COMPARE_TABLES,
  PROJECTION_MAP,
} from '../data/angiographyProjections';
import {
  CASE_ORDER,
  CORONARY_CASES,
  resolveCaseForDominance,
} from '../core/content/coronaryCases';
import { computeStageModifiers } from '../core/ecg/ecgEngine';
import { CaseId, Dominance } from '../core/types';
import {
  CArmAngles,
  cArmAnglesToPosition,
  findNearestProjection,
  formatCArmAngles,
  positionToCArmAngles,
} from '../utils/cArmMath';
import { CArmDiagram } from './CArmDiagram';

interface Heart3DProps {
  activeCaseId: CaseId;
  onSelectCase: (id: CaseId) => void;
  timeline: number;
  reperfused: boolean;
  dominance: Dominance;
}

type ViewMode = 'anatomy' | 'angio';
type LabelMode = 'active' | 'off' | 'all';

const INITIAL_CAMERA_POS = cArmAnglesToPosition(0, 0, 4.4);
const ZERO_VEC = new THREE.Vector3(0, 0, 0);
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const MAX_PAN_RADIUS = 2.1;
const BADGE_SCALE_STYLE: React.CSSProperties = {
  transformOrigin: '0 50%',
  willChange: 'transform',
};

const VEIN_NAMES = ['AI_MiCorazon_0', 'CS_MiCorazon_0', 'MCV_MiCorazon_0', 'SCV_MiCorazon_0'];
const ARTERY_NAMES = ['LCA_MiCorazon_0', 'CA_MiCorazon_0'];
const MYOCARDIUM_NAMES = ['HS_1_MiCorazon_0', 'HS_2_Difumina_0'];
const INNER_CHAMBER_NAMES = [
  'LV_MiCorazon_0',
  'RV_MiCorazon_0',
  'AV_MiCorazon_0',
  'MV_MiCorazon_0',
  'PV_MiCorazon_0',
  'TC_MiCorazon_0',
  'PM_MiCorazon_0',
];

// Локальный центр ЛЖ и длинная ось «основание -> верхушка» в координатах геометрии FBX
const LV_CENTER = new THREE.Vector3(1971, -1981, 329);
const LV_APEX_AXIS = new THREE.Vector3(0.2, -0.78, 0.59).normalize();
const LV_ANTERIOR_REF = new THREE.Vector3(0.18, 0.56, 0.81).normalize();
const LV_SIDE_REF = new THREE.Vector3().crossVectors(LV_APEX_AXIS, LV_ANTERIOR_REF).normalize();

// Устья коронарных артерий в сырых локальных координатах FBX для расчёта волны контраста
const LMCA_OSTIUM = new THREE.Vector3(1438, 1902, -140);
const LCX_PROX_REF = new THREE.Vector3(2955, 816, 698);
const RCA_OSTIUM = new THREE.Vector3(-1800, 1750, 1000);

const LCA_CASE_SET = new Set<CaseId>([
  'lmca',
  'lad_prox',
  'lad_mid',
  'lad_wrap',
  'd1',
  'lcx',
  'posterior',
  'nstemi_antlat',
  'nstemi_tinv',
  'wellens_a',
  'wellens_b',
  'de_winter',
]);

/**
 * Определяет, относится ли вершина артериального меша к дистальному руслу выбранного поражения
 */
function isVertexDistalToOcclusion(
  meshName: string,
  vx: number,
  vy: number,
  vz: number,
  caseId: CaseId,
  dominance: Dominance
): boolean {
  if (caseId === 'normal') return false;
  const isLca = meshName === 'LCA_MiCorazon_0';
  const isCa = meshName === 'CA_MiCorazon_0';

  switch (caseId) {
    case 'lmca':
      return isLca || (isCa && vx > 1500);
    case 'lad_prox':
    case 'de_winter':
    case 'wellens_a':
    case 'wellens_b':
      return isLca && vy < 750 && vz > 1400;
    case 'lad_mid':
    case 'nstemi_antlat':
    case 'nstemi_tinv':
      return isLca && vy < -1500 && vx < 3000;
    case 'lad_wrap':
      return isLca && vy < -3250;
    case 'd1':
      return isLca && vx > 2650 && vy < -300;
    case 'lcx':
      return isCa && vx > 1650;
    case 'posterior':
      return isCa && vx > 400 && vz < 900 && vy < -2400;
    case 'rca_prox':
      return isCa && vx < 1400 && vy < 900;
    case 'nstemi_inf':
      if (dominance === 'left') {
        return isCa && vx > 1650;
      }
      return isCa && vx < 1350 && vy < -2500;
    case 'rca_dist':
      return isCa && vx < 1350 && vy < -2500;
    default:
      return false;
  }
}

/**
 * Вычисление нормированной дистанции [0..1] от устья для анимации болюса контраста
 */
function computeNormalizedOstiumDist(
  meshName: string,
  vx: number,
  vy: number,
  vz: number
): number {
  if (meshName === 'LCA_MiCorazon_0') {
    const d = Math.hypot(vx - LMCA_OSTIUM.x, vy - LMCA_OSTIUM.y, vz - LMCA_OSTIUM.z);
    return Math.min(1, d / 8600);
  }
  if (meshName === 'CA_MiCorazon_0') {
    if (vx > 1500) {
      const d = Math.hypot(vx - LCX_PROX_REF.x, vy - LCX_PROX_REF.y, vz - LCX_PROX_REF.z);
      return Math.min(1, 0.16 + d / 7200);
    }
    const d = Math.hypot(vx - RCA_OSTIUM.x, vy - RCA_OSTIUM.y, vz - RCA_OSTIUM.z);
    return Math.min(1, d / 8400);
  }
  return 0;
}

/**
 * Однократная оценка принадлежности вершины миокарда (HS_1 / HS_2) к AHA-сегменту (1..17) или ПЖ
 */
function classifyMyocardiumVertex(
  vx: number,
  vy: number,
  vz: number
): { aha: number; isRv: boolean } {
  if (vx < 250 && vz > 750 && vy < 1200 && vy > -5900) {
    return { aha: 0, isRv: true };
  }

  const relX = vx - LV_CENTER.x;
  const relY = vy - LV_CENTER.y;
  const relZ = vz - LV_CENTER.z;

  const longProj =
    relX * LV_APEX_AXIS.x + relY * LV_APEX_AXIS.y + relZ * LV_APEX_AXIS.z;
  const normLong = (longProj + 3400) / 7600;

  if (normLong < -0.08 || normLong > 1.15) {
    return { aha: 0, isRv: false };
  }

  const antProj =
    relX * LV_ANTERIOR_REF.x + relY * LV_ANTERIOR_REF.y + relZ * LV_ANTERIOR_REF.z;
  const sideProj =
    relX * LV_SIDE_REF.x + relY * LV_SIDE_REF.y + relZ * LV_SIDE_REF.z;

  let angleDeg = (Math.atan2(sideProj, antProj) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  if (normLong > 0.85) {
    return { aha: 17, isRv: false };
  }

  if (normLong > 0.6) {
    if (angleDeg >= 315 || angleDeg < 45) return { aha: 13, isRv: false };
    if (angleDeg >= 45 && angleDeg < 135) return { aha: 16, isRv: false };
    if (angleDeg >= 135 && angleDeg < 225) return { aha: 15, isRv: false };
    return { aha: 14, isRv: false };
  }

  const isMid = normLong >= 0.28;
  const offset = isMid ? 6 : 0;

  if (angleDeg >= 330 || angleDeg < 30) return { aha: 1 + offset, isRv: false };
  if (angleDeg >= 30 && angleDeg < 90) return { aha: 6 + offset, isRv: false };
  if (angleDeg >= 90 && angleDeg < 150) return { aha: 5 + offset, isRv: false };
  if (angleDeg >= 150 && angleDeg < 210) return { aha: 4 + offset, isRv: false };
  if (angleDeg >= 210 && angleDeg < 270) return { aha: 3 + offset, isRv: false };
  return { aha: 2 + offset, isRv: false };
}

interface LandmarkWorldPos {
  caseId: CaseId;
  worldPos: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface MyocardiumVertexCache {
  ahaIds: Uint8Array;
  isRvFlags: Uint8Array;
}

class CanvasErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-slate-900 p-6 text-center text-slate-200">
          <p className="text-sm font-semibold text-red-400">
            Не удалось инициализировать 3D-рендер WebGL
          </p>
          <p className="mt-1 text-xs text-slate-400">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function VisibilityInvalidator({ isVisible }: { isVisible: boolean }) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (isVisible) {
      invalidate();
    }
  }, [isVisible, invalidate]);
  return null;
}

interface ArteryLabelProps {
  worldPos: THREE.Vector3;
  text: string;
  className: string;
}

/**
 * 3D-подпись артерии с мягким ограниченным масштабированием по дистанции камеры (0.7×–1.25×).
 * Не использует distanceFactor из drei, чтобы подпись не раздувалась в 2–5× и не залипала при зуме в центр.
 */
const ArteryLabel: React.FC<ArteryLabelProps> = React.memo(({ worldPos, text, className }) => {
  const badgeRef = useRef<HTMLDivElement>(null);
  const lastScaleRef = useRef(-1);

  useFrame(({ camera }) => {
    const node = badgeRef.current;
    if (!node) return;
    const dist = camera.position.distanceTo(worldPos);
    const raw = 1 - 0.42 * Math.log(Math.max(1.2, dist) / 3.7);
    const nextScale = Math.max(0.7, Math.min(1.25, raw));
    if (Math.abs(nextScale - lastScaleRef.current) > 0.004 || !node.style.transform) {
      lastScaleRef.current = nextScale;
      node.style.transform = `scale(${nextScale.toFixed(3)})`;
    }
  });

  return (
    <Html zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div className="translate-x-2.5 -translate-y-1/2">
        <div ref={badgeRef} style={BADGE_SCALE_STYLE} className={className}>
          {text}
        </div>
      </div>
    </Html>
  );
});

interface CameraRigProps {
  targetAngles: CArmAngles;
  commandNonce: number;
  recenterNonce: number;
  instantMove: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onAnglesLiveChange: (angles: CArmAngles) => void;
  viewMode: ViewMode;
}

function CameraRig({
  targetAngles,
  commandNonce,
  recenterNonce,
  instantMove,
  controlsRef,
  onAnglesLiveChange,
  viewMode,
}: CameraRigProps) {
  const { camera, scene, invalidate } = useThree();
  const targetVecRef = useRef(
    new THREE.Vector3(...cArmAnglesToPosition(targetAngles.laoDeg, targetAngles.cranDeg, 4.4))
  );
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  const offsetVecRef = useRef(new THREE.Vector3());
  const panClampDeltaRef = useRef(new THREE.Vector3());
  const recenterNonceRef = useRef(0);
  const animatingRef = useRef(false);
  const lastReportedRef = useRef<CArmAngles>({ laoDeg: 999, cranDeg: 999 });
  const onAnglesLiveChangeRef = useRef(onAnglesLiveChange);
  onAnglesLiveChangeRef.current = onAnglesLiveChange;

  useEffect(() => {
    scene.background = viewMode === 'angio' ? new THREE.Color('#d2dae2') : null;
    invalidate();
  }, [viewMode, scene, invalidate]);

  useEffect(() => {
    const ctrl = controlsRef.current;
    const curTarget = ctrl ? ctrl.target : ZERO_VEC;
    const distToTarget = camera.position.distanceTo(curTarget);
    const currentRadius = Math.max(2.2, Math.min(7.4, distToTarget || 4.4));
    const [ox, oy, oz] = cArmAnglesToPosition(
      targetAngles.laoDeg,
      targetAngles.cranDeg,
      currentRadius
    );

    if (instantMove) {
      targetLookAtRef.current.copy(curTarget);
      targetVecRef.current.set(curTarget.x + ox, curTarget.y + oy, curTarget.z + oz);
      camera.position.copy(targetVecRef.current);
      if (ctrl) {
        ctrl.update();
      }
      animatingRef.current = false;
      invalidate();
    } else {
      // Пресеты проекций и «AP 0°» плавно возвращают сердце в центр (0,0,0)
      targetLookAtRef.current.copy(ZERO_VEC);
      targetVecRef.current.set(ox, oy, oz);
      animatingRef.current = true;
      invalidate();
    }
  }, [
    targetAngles.laoDeg,
    targetAngles.cranDeg,
    commandNonce,
    instantMove,
    camera,
    controlsRef,
    invalidate,
  ]);

  useEffect(() => {
    if (recenterNonce === 0 || recenterNonce === recenterNonceRef.current) return;
    recenterNonceRef.current = recenterNonce;
    const ctrl = controlsRef.current;
    const curTarget = ctrl ? ctrl.target : ZERO_VEC;
    offsetVecRef.current.copy(camera.position).sub(curTarget);
    targetLookAtRef.current.copy(ZERO_VEC);
    targetVecRef.current.copy(offsetVecRef.current);
    animatingRef.current = true;
    invalidate();
  }, [recenterNonce, camera, controlsRef, invalidate]);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const handleStart = () => {
      animatingRef.current = false;
    };
    ctrl.addEventListener('start', handleStart);
    return () => {
      ctrl.removeEventListener('start', handleStart);
    };
  }, [controlsRef]);

  useFrame((_, delta) => {
    const ctrl = controlsRef.current;
    if (animatingRef.current) {
      const step = Math.min(1, delta * 6.5);
      camera.position.lerp(targetVecRef.current, step);
      if (ctrl) {
        ctrl.target.lerp(targetLookAtRef.current, step);
        ctrl.update();
      }
      const camDone = camera.position.distanceTo(targetVecRef.current) < 0.025;
      const targetDone = !ctrl || ctrl.target.distanceTo(targetLookAtRef.current) < 0.015;
      if (camDone && targetDone) {
        camera.position.copy(targetVecRef.current);
        if (ctrl) {
          ctrl.target.copy(targetLookAtRef.current);
          ctrl.update();
        }
        animatingRef.current = false;
      }
    }

    if (ctrl) {
      const panLen = ctrl.target.length();
      if (panLen > MAX_PAN_RADIUS) {
        panClampDeltaRef.current.copy(ctrl.target);
        ctrl.target.setLength(MAX_PAN_RADIUS);
        camera.position.add(ctrl.target).sub(panClampDeltaRef.current);
      }
    }

    const offset = offsetVecRef.current.copy(camera.position);
    if (ctrl) {
      offset.sub(ctrl.target);
    }
    const currentAngles = positionToCArmAngles(offset);
    const prev = lastReportedRef.current;
    if (
      currentAngles.laoDeg !== prev.laoDeg ||
      currentAngles.cranDeg !== prev.cranDeg ||
      Boolean(currentAngles.isPosterior) !== Boolean(prev.isPosterior)
    ) {
      lastReportedRef.current = currentAngles;
      onAnglesLiveChangeRef.current(currentAngles);
    }
  });

  return null;
}

interface HeartSceneProps extends Heart3DProps {
  viewMode: ViewMode;
  angioSystem: AngioSystem;
  showDistalGhost: boolean;
  bolusNonce: number;
  labelMode: LabelMode;
  showVeins: boolean;
  onLoaded: () => void;
}

function HeartSceneContent({
  activeCaseId,
  onSelectCase,
  timeline,
  reperfused,
  dominance,
  viewMode,
  angioSystem,
  showDistalGhost,
  bolusNonce,
  labelMode,
  showVeins,
  onLoaded,
}: HeartSceneProps) {
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);
  const [landmarks, setLandmarks] = useState<LandmarkWorldPos[]>([]);
  const [hoveredCase, setHoveredCase] = useState<CaseId | null>(null);
  const thrombusRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const meshMapRef = useRef<Record<string, THREE.Mesh>>({});
  const arteryDistRef = useRef<Record<string, Float32Array>>({});
  const arteryInLcaRef = useRef<Record<string, Uint8Array>>({});
  const myoCacheRef = useRef<Record<string, MyocardiumVertexCache>>({});

  // Стабилизируем колбэк, чтобы загрузка FBX никогда не перезапускалась при ререндерах
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const bolusProgressRef = useRef<number>(1.2);
  const bolusAnimatingRef = useRef<boolean>(false);

  // Загрузка оптимизированного GLB и WebP-текстуры строго 1 раз + полный dispose при размонтировании
  useEffect(() => {
    let cancelled = false;
    let loadedMeshMap: Record<string, THREE.Mesh> | null = null;

    const assetBase = import.meta.env.BASE_URL;
    const texLoader = new THREE.TextureLoader();
    const diffuseTex = texLoader.load(`${assetBase}models/heart/heart_diffuse.webp`);
    diffuseTex.colorSpace = THREE.SRGBColorSpace;
    diffuseTex.flipY = false; // Обязательно для UV в стандарте glTF 2.0
    diffuseTex.needsUpdate = true;

    const loader = new GLTFLoader();
    loader.load(
      `${assetBase}models/heart/heart_optimized.glb`,
      (gltf) => {
        const rootScene = gltf.scene;
        if (cancelled) {
          rootScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              (child as THREE.Mesh).geometry.dispose();
            }
          });
          return;
        }

        const meshMap: Record<string, THREE.Mesh> = {};
        const distMap: Record<string, Float32Array> = {};
        const inLcaMap: Record<string, Uint8Array> = {};
        const myoCacheMap: Record<string, MyocardiumVertexCache> = {};

        rootScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const meshName = mesh.name || mesh.parent?.name || '';
            mesh.name = meshName;
            meshMap[meshName] = mesh;

            const isArtery = ARTERY_NAMES.includes(meshName);
            const isMyo = MYOCARDIUM_NAMES.includes(meshName);
            const isVein = VEIN_NAMES.includes(meshName);
            const isInner = INNER_CHAMBER_NAMES.includes(meshName);

            let anatMat: THREE.Material;
            let angioMat: THREE.Material;

            if (isArtery) {
              anatMat = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.32,
                metalness: 0.08,
                transparent: false,
              });
              angioMat = new THREE.MeshBasicMaterial({
                vertexColors: true,
                transparent: true,
                depthWrite: false,
              });

              const posAttr = mesh.geometry.attributes.position;
              const colors = new Float32Array(posAttr.count * 4).fill(1);
              mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

              const dists = new Float32Array(posAttr.count);
              const inLcaFlags = new Uint8Array(posAttr.count);
              const isLcaMesh = meshName === 'LCA_MiCorazon_0';

              for (let i = 0; i < posAttr.count; i++) {
                const vx = posAttr.getX(i);
                const vy = posAttr.getY(i);
                const vz = posAttr.getZ(i);
                dists[i] = computeNormalizedOstiumDist(meshName, vx, vy, vz);
                inLcaFlags[i] = isLcaMesh || vx > 1500 ? 1 : 0;
              }
              distMap[meshName] = dists;
              inLcaMap[meshName] = inLcaFlags;
            } else if (isMyo) {
              anatMat = new THREE.MeshStandardMaterial({
                map: diffuseTex,
                vertexColors: true,
                roughness: 0.52,
                metalness: 0.04,
                transparent: false,
                opacity: 1,
              });
              angioMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color('#5a6573'),
                transparent: true,
                opacity: 0.13,
                depthWrite: false,
              });

              const posAttr = mesh.geometry.attributes.position;
              const colors = new Float32Array(posAttr.count * 3).fill(1);
              mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

              // Однократный предрасчёт AHA-сегментов и принадлежности к ПЖ
              const ahaIds = new Uint8Array(posAttr.count);
              const isRvFlags = new Uint8Array(posAttr.count);
              for (let i = 0; i < posAttr.count; i++) {
                const { aha, isRv } = classifyMyocardiumVertex(
                  posAttr.getX(i),
                  posAttr.getY(i),
                  posAttr.getZ(i)
                );
                ahaIds[i] = aha;
                isRvFlags[i] = isRv ? 1 : 0;
              }
              myoCacheMap[meshName] = { ahaIds, isRvFlags };
            } else if (isVein) {
              anatMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color('#3b5ca8'),
                roughness: 0.45,
                metalness: 0.05,
                transparent: true,
                opacity: 0.72,
              });
              angioMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color('#64748b'),
                transparent: true,
                opacity: 0.12,
                depthWrite: false,
              });
            } else {
              anatMat = new THREE.MeshStandardMaterial({
                map: diffuseTex,
                roughness: 0.55,
                metalness: 0.04,
                transparent: false,
                opacity: 1,
              });
              angioMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color('#64748b'),
                transparent: true,
                opacity: isInner ? 0.05 : 0.11,
                depthWrite: false,
              });
            }

            mesh.userData.anatMat = anatMat;
            mesh.userData.angioMat = angioMat;
            mesh.material = anatMat;
          }
        });

        rootScene.updateMatrixWorld(true);
        const coreBox = new THREE.Box3().setFromObject(rootScene);

        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        coreBox.getSize(size);
        coreBox.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const normScale = 3.15 / maxDim;

        const wrapper = new THREE.Group();
        rootScene.scale.multiplyScalar(normScale);
        rootScene.position.set(
          -center.x * normScale,
          -center.y * normScale,
          -center.z * normScale
        );
        wrapper.add(rootScene);
        wrapper.updateMatrixWorld(true);

        const computedLandmarks: LandmarkWorldPos[] = [];
        for (const id of CASE_ORDER) {
          const landmark = HEART_LANDMARKS[id];
          if (!landmark) continue;
          const targetMesh = meshMap[landmark.mesh];
          if (!targetMesh) continue;

          const posAttr = targetMesh.geometry.attributes.position;
          const [tx, ty, tz] = landmark.localPos;
          let bestIdx = 0;
          let bestDistSq = Infinity;
          for (let i = 0; i < posAttr.count; i++) {
            const dx = posAttr.getX(i) - tx;
            const dy = posAttr.getY(i) - ty;
            const dz = posAttr.getZ(i) - tz;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < bestDistSq) {
              bestDistSq = d2;
              bestIdx = i;
            }
          }

          const localPt = new THREE.Vector3(
            posAttr.getX(bestIdx),
            posAttr.getY(bestIdx),
            posAttr.getZ(bestIdx)
          );
          const worldPos = targetMesh.localToWorld(localPt.clone());

          const neighborLocal = new THREE.Vector3(tx, ty - 250, tz);
          const neighborWorld = targetMesh.localToWorld(neighborLocal);
          const tangent = neighborWorld.sub(worldPos).normalize();
          if (tangent.lengthSq() < 0.01) tangent.set(0, -1, 0);

          const quaternion = new THREE.Quaternion().setFromUnitVectors(UP_AXIS, tangent);

          computedLandmarks.push({
            caseId: id,
            worldPos,
            quaternion,
          });
        }

        loadedMeshMap = meshMap;
        meshMapRef.current = meshMap;
        arteryDistRef.current = distMap;
        arteryInLcaRef.current = inLcaMap;
        myoCacheRef.current = myoCacheMap;
        setLandmarks(computedLandmarks);
        setModelGroup(wrapper);
        onLoadedRef.current();
      },
      undefined,
      (err) => {
        console.error('Ошибка загрузки GLB модели сердца:', err);
      }
    );

    return () => {
      cancelled = true;
      diffuseTex.dispose();
      if (loadedMeshMap) {
        Object.values(loadedMeshMap).forEach((mesh) => {
          mesh.geometry.dispose();
          const anatMat = mesh.userData.anatMat as THREE.Material | undefined;
          const angioMat = mesh.userData.angioMat as THREE.Material | undefined;
          anatMat?.dispose();
          angioMat?.dispose();
        });
      }
    };
  }, []);

  // Переключение материалов и видимости слоёв при смене режима (Анатомия <-> КАГ)
  useEffect(() => {
    if (!modelGroup) return;
    const meshes = meshMapRef.current;

    Object.entries(meshes).forEach(([name, mesh]) => {
      const targetMat =
        viewMode === 'angio' ? mesh.userData.angioMat : mesh.userData.anatMat;
      if (targetMat && mesh.material !== targetMat) {
        mesh.material = targetMat;
      }

      if (ARTERY_NAMES.includes(name)) {
        mesh.renderOrder = viewMode === 'angio' ? 5 : 0;
      } else {
        mesh.renderOrder = viewMode === 'angio' ? 1 : 0;
      }

      if (VEIN_NAMES.includes(name)) {
        mesh.visible = viewMode === 'anatomy' && showVeins;
      }
    });
  }, [modelGroup, viewMode, showVeins]);

  const resolved = useMemo(
    () => resolveCaseForDominance(activeCaseId, dominance),
    [activeCaseId, dominance]
  );
  const stageMods = useMemo(
    () => computeStageModifiers(timeline, reperfused),
    [timeline, reperfused]
  );
  const lesionType = resolved.caseData.lesionType;

  // Обновление вертексных цветов артерий
  const applyArteryColors = useCallback(
    (bolusWave: number) => {
      const meshes = meshMapRef.current;
      const distMap = arteryDistRef.current;
      const inLcaMap = arteryInLcaRef.current;

      for (const artName of ARTERY_NAMES) {
        const mesh = meshes[artName];
        if (!mesh) continue;
        const posAttr = mesh.geometry.attributes.position;
        const colAttr = mesh.geometry.attributes.color as THREE.BufferAttribute;
        const dists = distMap[artName];
        const inLcaFlags = inLcaMap[artName];

        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vy = posAttr.getY(i);
          const vz = posAttr.getZ(i);

          const distal = isVertexDistalToOcclusion(
            artName,
            vx,
            vy,
            vz,
            activeCaseId,
            dominance
          );

          if (viewMode === 'anatomy') {
            if (!distal) {
              colAttr.setXYZW(i, 0.88, 0.14, 0.14, 1);
            } else if (reperfused) {
              colAttr.setXYZW(i, 0.96, 0.28, 0.22, 1);
            } else if (lesionType === 'subocclusion') {
              colAttr.setXYZW(i, 0.58, 0.24, 0.18, 1);
            } else if (lesionType === 'stenosis') {
              colAttr.setXYZW(i, 0.74, 0.22, 0.2, 1);
            } else {
              colAttr.setXYZW(i, 0.2, 0.19, 0.44, 1);
            }
          } else {
            const inLca = inLcaFlags ? inLcaFlags[i] === 1 : true;
            const selectedSystem =
              angioSystem === 'BOTH' ||
              (angioSystem === 'LCA' && inLca) ||
              (angioSystem === 'RCA' && !inLca);

            if (!selectedSystem) {
              colAttr.setXYZW(i, 0.35, 0.38, 0.42, 0.03);
              continue;
            }

            const dNorm = dists ? dists[i] : 0;
            const flowSpeed =
              distal && !reperfused
                ? lesionType === 'subocclusion'
                  ? 0.65
                  : lesionType === 'stenosis'
                    ? 0.85
                    : 1.0
                : 1.0;
            const reachedByBolus = dNorm <= bolusWave * flowSpeed;

            if (distal && !reperfused) {
              if (lesionType === 'subocclusion') {
                colAttr.setXYZW(
                  i,
                  0.22,
                  0.24,
                  0.28,
                  reachedByBolus ? 0.42 : showDistalGhost ? 0.14 : 0.05
                );
              } else if (lesionType === 'stenosis') {
                colAttr.setXYZW(i, 0.1, 0.12, 0.16, reachedByBolus ? 0.78 : 0.08);
              } else {
                colAttr.setXYZW(i, 0.28, 0.3, 0.36, showDistalGhost ? 0.14 : 0.0);
              }
            } else if (!reachedByBolus) {
              colAttr.setXYZW(i, 0.32, 0.35, 0.4, 0.07);
            } else {
              colAttr.setXYZW(i, 0.06, 0.07, 0.1, 0.94);
            }
          }
        }
        colAttr.needsUpdate = true;
      }
    },
    [activeCaseId, dominance, reperfused, lesionType, viewMode, angioSystem, showDistalGhost]
  );

  useEffect(() => {
    if (bolusNonce === 0) return;
    bolusProgressRef.current = 0;
    bolusAnimatingRef.current = true;
  }, [bolusNonce]);

  // Перекраска артерий и миокарда (миокард использует предрасчитанные Uint8Array без тригонометрии!)
  useEffect(() => {
    if (!modelGroup) return;

    applyArteryColors(bolusAnimatingRef.current ? bolusProgressRef.current : 1.2);

    if (viewMode === 'anatomy') {
      const meshes = meshMapRef.current;
      const myoCache = myoCacheRef.current;
      const activeSet = new Set(resolved.ahaSegments);
      let tr = 1;
      let tg = 1;
      let tb = 1;

      if (activeCaseId !== 'normal') {
        if (reperfused && timeline >= 0.32) {
          tr = 1.0;
          tg = 0.65;
          tb = 0.55;
        } else if (lesionType === 'subocclusion' || lesionType === 'stenosis') {
          // Мягкий янтарно-оранжевый оттенок субэндокардиальной ишемии без трансмурального серого рубца
          if (timeline < 0.55) {
            tr = 1.15;
            tg = 0.54;
            tb = 0.24;
          } else {
            tr = 1.04;
            tg = 0.68;
            tb = 0.46;
          }
        } else if (timeline < 0.22) {
          tr = 1.18;
          tg = 0.45;
          tb = 0.22;
        } else if (timeline < 0.5) {
          tr = 1.15;
          tg = 0.28;
          tb = 0.22;
        } else if (timeline < 0.78) {
          tr = 0.68;
          tg = 0.22;
          tb = 0.28;
        } else {
          tr = 0.88;
          tg = 0.86;
          tb = 0.92;
        }
      }

      const tintIntensity =
        activeCaseId === 'normal'
          ? 0
          : activeCaseId === 'lmca'
            ? 0.42
            : reperfused && timeline >= 0.32
              ? 0.35
              : lesionType === 'subocclusion'
                ? 0.45
                : lesionType === 'stenosis'
                  ? 0.32
                  : 0.72;

      const injR = 1 + (tr - 1) * tintIntensity;
      const injG = 1 + (tg - 1) * tintIntensity;
      const injB = 1 + (tb - 1) * tintIntensity;

      for (const myoName of MYOCARDIUM_NAMES) {
        const mesh = meshes[myoName];
        const cache = myoCache[myoName];
        if (!mesh || !cache) continue;
        const colAttr = mesh.geometry.attributes.color as THREE.BufferAttribute;
        const { ahaIds, isRvFlags } = cache;

        for (let i = 0; i < ahaIds.length; i++) {
          const aha = ahaIds[i];
          const isRv = isRvFlags[i] === 1;
          const isInjured =
            (aha > 0 && activeSet.has(aha)) || (isRv && resolved.rvInvolved);

          if (isInjured && tintIntensity > 0) {
            colAttr.setXYZ(i, injR, injG, injB);
          } else {
            colAttr.setXYZ(i, 1, 1, 1);
          }
        }
        colAttr.needsUpdate = true;
      }
    }
  }, [
    modelGroup,
    activeCaseId,
    resolved,
    stageMods,
    timeline,
    reperfused,
    viewMode,
    applyArteryColors,
  ]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (thrombusRef.current) {
      const s = 1 + 0.16 * Math.sin(t * 4.5);
      thrombusRef.current.scale.set(s, s, s);
    }
    if (ringRef.current) {
      const pulse = (t * 1.1) % 1;
      const rs = 1 + pulse * 1.6;
      ringRef.current.scale.set(rs, rs, rs);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - pulse) * 0.75;
    }

    if (bolusAnimatingRef.current && viewMode === 'angio' && modelGroup) {
      bolusProgressRef.current += delta * 0.65;
      applyArteryColors(bolusProgressRef.current);
      if (bolusProgressRef.current >= 1.15) {
        bolusAnimatingRef.current = false;
        applyArteryColors(1.2);
      }
    }
  });

  if (!modelGroup) return null;

  const isLeftDominantNstemiInf =
    activeCaseId === 'nstemi_inf' && dominance === 'left';
  const replacedBaseMarkerId = isLeftDominantNstemiInf
    ? 'lcx'
    : HEART_LANDMARKS[activeCaseId]?.replacesBaseMarker;
  const lcxLandmark = isLeftDominantNstemiInf
    ? landmarks.find((item) => item.caseId === 'lcx')
    : undefined;

  return (
    <group>
      <primitive object={modelGroup} />

      {landmarks.map((lm) => {
        const isActive = lm.caseId === activeCaseId;
        const isHovered = lm.caseId === hoveredCase;
        const caseInfo = CORONARY_CASES[lm.caseId];
        // Не дублируем маркеры, лежащие на том же участке сосуда, что и базовые STEMI-точки
        if (HEART_LANDMARKS[lm.caseId]?.replacesBaseMarker && !isActive) return null;
        if (replacedBaseMarkerId && lm.caseId === replacedBaseMarkerId && !isActive) return null;

        const isLmcaOrLad =
          LCA_CASE_SET.has(lm.caseId) ||
          (lm.caseId === 'nstemi_inf' && dominance === 'left');
        const visibleInAngio =
          angioSystem === 'BOTH' ||
          (angioSystem === 'LCA' && isLmcaOrLad) ||
          (angioSystem === 'RCA' && !isLmcaOrLad) ||
          isActive;

        if (viewMode === 'angio' && !visibleInAngio) return null;

        const effectiveWorldPos =
          isActive && isLeftDominantNstemiInf && lcxLandmark
            ? lcxLandmark.worldPos
            : lm.worldPos;
        const effectiveQuaternion =
          isActive && isLeftDominantNstemiInf && lcxLandmark
            ? lcxLandmark.quaternion
            : lm.quaternion;

        const isNonOcclusiveActive =
          isActive && (lesionType === 'subocclusion' || lesionType === 'stenosis');
        const angioStatusSuffix =
          viewMode === 'angio' && isActive && !reperfused
            ? lesionType === 'occlusion'
              ? ' · TIMI 0'
              : lesionType === 'subocclusion'
                ? ' · TIMI 1–2'
                : ' · стеноз'
            : '';

        return (
          <group key={lm.caseId} position={effectiveWorldPos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onSelectCase(lm.caseId);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
                setHoveredCase(lm.caseId);
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
                setHoveredCase((prev) => (prev === lm.caseId ? null : prev));
              }}
            >
              <sphereGeometry
                args={[
                  viewMode === 'angio'
                    ? isActive
                      ? 0.036
                      : 0.028
                    : isActive
                      ? 0.055
                      : 0.042,
                  16,
                  16,
                ]}
              />
              <meshStandardMaterial
                color={
                  isActive
                    ? reperfused
                      ? '#10b981'
                      : isNonOcclusiveActive
                        ? '#f59e0b'
                        : '#ef4444'
                    : isHovered
                      ? '#f59e0b'
                      : viewMode === 'angio'
                        ? '#64748b'
                        : '#ffffff'
                }
                emissive={
                  isActive
                    ? reperfused
                      ? '#059669'
                      : isNonOcclusiveActive
                        ? '#d97706'
                        : '#dc2626'
                    : isHovered
                      ? '#ca8a04'
                      : '#475569'
                }
                emissiveIntensity={isActive ? 1.2 : 0.45}
                roughness={0.25}
                transparent={viewMode === 'angio' && !isActive}
                opacity={viewMode === 'angio' && !isActive ? 0.45 : 1}
              />
            </mesh>

            {isActive && !reperfused && (
              <>
                {viewMode === 'anatomy' && (
                  <mesh ref={thrombusRef}>
                    <sphereGeometry args={[isNonOcclusiveActive ? 0.068 : 0.075, 20, 20]} />
                    <meshStandardMaterial
                      color={isNonOcclusiveActive ? '#92400e' : '#7f1d1d'}
                      emissive={isNonOcclusiveActive ? '#f59e0b' : '#ef4444'}
                      emissiveIntensity={isNonOcclusiveActive ? 0.7 : 0.9}
                      transparent
                      opacity={isNonOcclusiveActive ? 0.58 : 0.78}
                    />
                  </mesh>
                )}
                <mesh ref={ringRef}>
                  <torusGeometry
                    args={[viewMode === 'angio' ? 0.075 : 0.095, 0.011, 12, 32]}
                  />
                  <meshBasicMaterial
                    color={
                      isNonOcclusiveActive
                        ? '#f59e0b'
                        : viewMode === 'angio'
                          ? '#dc2626'
                          : '#fbbf24'
                    }
                    transparent
                    opacity={0.75}
                  />
                </mesh>
              </>
            )}

            {isActive && reperfused && (
              <mesh quaternion={effectiveQuaternion}>
                <cylinderGeometry args={[0.062, 0.062, 0.22, 14, 4, true]} />
                <meshStandardMaterial
                  color={viewMode === 'angio' ? '#1e293b' : '#e2e8f0'}
                  emissive={viewMode === 'angio' ? '#0f172a' : '#10b981'}
                  emissiveIntensity={viewMode === 'angio' ? 0.2 : 0.55}
                  metalness={0.85}
                  roughness={0.2}
                  wireframe
                />
              </mesh>
            )}

            {(labelMode === 'all' ||
              (labelMode === 'active' && (isActive || isHovered))) && (
              <ArteryLabel
                worldPos={effectiveWorldPos}
                text={`${caseInfo.shortTitle.split('(')[0].trim()}${angioStatusSuffix}`}
                className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold shadow-md transition-colors ${
                  isActive
                    ? reperfused
                      ? 'border border-emerald-400 bg-emerald-950/95 text-emerald-100'
                      : isNonOcclusiveActive
                        ? 'border border-amber-400 bg-amber-950/95 text-amber-100'
                        : 'border border-red-400 bg-red-950/95 text-amber-100'
                    : viewMode === 'angio'
                      ? 'border border-slate-600 bg-slate-900/92 text-slate-100'
                      : 'border border-slate-300 bg-white/95 text-slate-800'
                }`}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

interface HeartCanvasViewportProps extends HeartSceneProps {
  isVisible: boolean;
  targetAngles: CArmAngles;
  commandNonce: number;
  recenterNonce: number;
  instantMove: boolean;
  onAnglesLiveChange: (angles: CArmAngles) => void;
}

/**
 * Изолированный WebGL-вьюпорт: НЕ получает liveAngles, поэтому поворот камеры и движение HUD
 * не вызывают ререндеры Canvas и 3D-дерева.
 */
const HeartCanvasViewport: React.FC<HeartCanvasViewportProps> = React.memo(
  ({
    isVisible,
    targetAngles,
    commandNonce,
    recenterNonce,
    instantMove,
    onAnglesLiveChange,
    ...sceneProps
  }) => {
    const controlsRef = useRef<OrbitControlsImpl | null>(null);

    return (
      <CanvasErrorBoundary>
        <Canvas
          frameloop={isVisible ? 'always' : 'demand'}
          camera={{ position: INITIAL_CAMERA_POS, fov: 38, near: 0.1, far: 50 }}
          dpr={[1, 1.5]}
        >
          <ambientLight intensity={sceneProps.viewMode === 'angio' ? 1.0 : 0.78} />
          <directionalLight position={[4, 6, 5]} intensity={1.1} />
          <directionalLight position={[-4, -2, -4]} intensity={0.5} />
          <pointLight position={[0, -3, 3]} intensity={0.4} color="#ffd8d8" />

          <VisibilityInvalidator isVisible={isVisible} />

          <Suspense fallback={null}>
            <HeartSceneContent {...sceneProps} />
          </Suspense>

          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            screenSpacePanning={true}
            panSpeed={0.85}
            minDistance={2.2}
            maxDistance={7.4}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI - 0.25}
          />
          <CameraRig
            targetAngles={targetAngles}
            commandNonce={commandNonce}
            recenterNonce={recenterNonce}
            instantMove={instantMove}
            controlsRef={controlsRef}
            onAnglesLiveChange={onAnglesLiveChange}
            viewMode={sceneProps.viewMode}
          />
        </Canvas>
      </CanvasErrorBoundary>
    );
  }
);

const Heart3DComponent: React.FC<Heart3DProps> = (props) => {
  const [viewMode, setViewMode] = useState<ViewMode>('anatomy');
  const [angioSystem, setAngioSystem] = useState<AngioSystem>('LCA');
  const [showDistalGhost, setShowDistalGhost] = useState(false);
  const [bolusNonce, setBolusNonce] = useState(0);

  const [selectedProjectionId, setSelectedProjectionId] = useState<AngioProjectionId>('ap');
  const [targetAngles, setTargetAngles] = useState<CArmAngles>({ laoDeg: 0, cranDeg: 0 });
  const [liveAngles, setLiveAngles] = useState<CArmAngles>({ laoDeg: 0, cranDeg: 0 });
  const [commandNonce, setCommandNonce] = useState(0);
  const [recenterNonce, setRecenterNonce] = useState(0);
  const [instantMove, setInstantMove] = useState(false);

  const [labelMode, setLabelMode] = useState<LabelMode>('active');
  const cycleLabelMode = useCallback(() => {
    setLabelMode((prev) =>
      prev === 'active' ? 'off' : prev === 'off' ? 'all' : 'active'
    );
  }, []);
  const [showVeins, setShowVeins] = useState(true);
  const [showCArmHud, setShowCArmHud] = useState(true);
  const [showGuideCard, setShowGuideCard] = useState(false);
  const [showCompareTable, setShowCompareTable] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Отключаем постоянный рендер WebGL, когда 3D-окно прокручено за пределы экрана
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.02 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleLoaded = useCallback(() => setLoaded(true), []);
  const handleAnglesLiveChange = useCallback((angles: CArmAngles) => {
    setLiveAngles(angles);
  }, []);

  const lcaProjections = useMemo(
    () => ANGIO_PROJECTIONS.filter((p) => p.system === 'LCA'),
    []
  );
  const rcaProjections = useMemo(
    () => ANGIO_PROJECTIONS.filter((p) => p.system === 'RCA'),
    []
  );

  const selectProjection = useCallback((proj: AngioProjection) => {
    setSelectedProjectionId(proj.id);
    setInstantMove(false);
    setTargetAngles({ laoDeg: proj.laoDeg, cranDeg: proj.cranDeg });
    setCommandNonce((n) => n + 1);
    if (proj.system === 'LCA' || proj.system === 'RCA') {
      setAngioSystem(proj.system);
    } else {
      setAngioSystem('BOTH');
    }
  }, []);

  const handleSwitchMode = (nextMode: ViewMode) => {
    setViewMode(nextMode);
    if (nextMode === 'angio') {
      setShowCArmHud(true);
      setShowGuideCard(true);
      const opt = getOptimalProjectionForCase(props.activeCaseId, props.dominance);
      const proj = PROJECTION_MAP[opt.projectionId];
      setAngioSystem(opt.system);
      setSelectedProjectionId(proj.id);
      setInstantMove(false);
      setTargetAngles({ laoDeg: proj.laoDeg, cranDeg: proj.cranDeg });
      setCommandNonce((n) => n + 1);
      setBolusNonce((n) => n + 1);
    }
  };

  useEffect(() => {
    if (viewMode === 'angio') {
      const opt = getOptimalProjectionForCase(props.activeCaseId, props.dominance);
      setAngioSystem(opt.system);
    }
  }, [props.activeCaseId, props.dominance, viewMode]);

  const handleSliderChange = (next: Partial<CArmAngles>) => {
    setInstantMove(true);
    setTargetAngles({
      laoDeg: next.laoDeg ?? liveAngles.laoDeg,
      cranDeg: next.cranDeg ?? liveAngles.cranDeg,
    });
    setCommandNonce((n) => n + 1);
  };

  const handleOptimalForCase = () => {
    const opt = getOptimalProjectionForCase(props.activeCaseId, props.dominance);
    const proj = PROJECTION_MAP[opt.projectionId];
    selectProjection(proj);
    setAngioSystem(opt.system);
    if (viewMode === 'angio') {
      setBolusNonce((n) => n + 1);
    }
  };

  const nearestProj = useMemo(
    () => findNearestProjection(liveAngles, ANGIO_PROJECTIONS),
    [liveAngles]
  );
  const activeProjInfo = nearestProj ?? PROJECTION_MAP[selectedProjectionId];
  const formattedLive = formatCArmAngles(liveAngles);
  const optimalInfo = getOptimalProjectionForCase(props.activeCaseId, props.dominance);
  const optimalProjTitle = PROJECTION_MAP[optimalInfo.projectionId].shortLabel;

  const activeLesionType = CORONARY_CASES[props.activeCaseId].lesionType;

  const compareTable = activeProjInfo.compareGroup
    ? PROJECTION_COMPARE_TABLES[activeProjInfo.compareGroup]
    : PROJECTION_COMPARE_TABLES.lca_caudal;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Шапка 3D-окна */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleSwitchMode('anatomy')}
              className={`rounded-md px-2.5 py-1 font-bold transition ${
                viewMode === 'anatomy'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Анатомия 3D
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('angio')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-bold transition ${
                viewMode === 'angio'
                  ? 'bg-slate-900 text-sky-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radiation className="h-3.5 w-3.5" />
              КАГ (С-дуга)
            </button>
          </div>

          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              activeLesionType === 'none' || props.reperfused
                ? 'bg-emerald-50 text-emerald-700'
                : activeLesionType === 'occlusion'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-800'
            }`}
          >
            {activeLesionType === 'none'
              ? 'Норма TIMI 3'
              : props.reperfused
                ? 'ЧКВ · Стент · TIMI 3'
                : activeLesionType === 'occlusion'
                  ? 'Окклюзия · TIMI 0'
                  : activeLesionType === 'subocclusion'
                    ? 'Субокклюзия · TIMI 1–2'
                    : 'Крит. стеноз · TIMI 2–3'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          {viewMode === 'angio' ? (
            <>
              <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                {(['LCA', 'RCA', 'BOTH'] as AngioSystem[]).map((sys) => (
                  <button
                    key={sys}
                    type="button"
                    onClick={() => setAngioSystem(sys)}
                    className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold transition ${
                      angioSystem === sys
                        ? sys === 'RCA'
                          ? 'bg-amber-600 text-white'
                          : 'bg-sky-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sys === 'LCA' ? 'ЛКА' : sys === 'RCA' ? 'ПКА' : 'Обе'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setBolusNonce((n) => n + 1)}
                title="Анимация заполнения контрастом от устья до зоны окклюзии"
                className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 font-semibold text-white hover:bg-slate-800"
              >
                <Play className="h-3 w-3 text-sky-400" />
                Болюс
              </button>
              <button
                type="button"
                onClick={() => setShowDistalGhost((v) => !v)}
                title="Показать бледный контур сосуда дистальнее тромба"
                className={`rounded-md border px-2 py-0.5 font-medium transition ${
                  showDistalGhost
                    ? 'border-sky-400 bg-sky-50 text-sky-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Контур дист.
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowVeins((v) => !v)}
              className={`rounded-md border px-2 py-0.5 font-medium transition ${
                showVeins
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Вены
            </button>
          )}

          <button
            type="button"
            onClick={cycleLabelMode}
            title={
              labelMode === 'active'
                ? 'Показана подпись активной артерии — нажмите, чтобы выключить подписи'
                : labelMode === 'off'
                  ? 'Подписи артерий выключены — нажмите, чтобы показать все подписи'
                  : 'Показаны все подписи артерий — нажмите, чтобы оставить только активную'
            }
            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium transition ${
              labelMode === 'all'
                ? 'border-red-600 bg-red-600 text-white shadow-sm'
                : labelMode === 'active'
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100/70'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {labelMode === 'off' ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {labelMode === 'active'
              ? 'Подпись'
              : labelMode === 'off'
                ? 'Подписи выкл.'
                : 'Все подписи'}
          </button>

          <button
            type="button"
            onClick={() => setShowCArmHud((v) => !v)}
            title="Показать / скрыть схему положения С-дуги"
            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium transition ${
              showCArmHud
                ? 'border-sky-400 bg-sky-50 text-sky-800'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Compass className="h-3 w-3" />
            С-дуга
          </button>
        </div>
      </div>

      {/* 3D Canvas + Флюороскопический HUD */}
      <div
        ref={canvasContainerRef}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative min-h-[340px] flex-1 overflow-hidden ${
          viewMode === 'angio'
            ? 'bg-[#d2dae2]'
            : 'bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200'
        }`}
      >
        {!loaded && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-100/90">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-red-700 border-t-transparent" />
            <span className="text-xs font-medium text-slate-600">
              Загрузка 3D-модели сердца...
            </span>
          </div>
        )}

        {viewMode === 'angio' && (
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                'radial-gradient(circle at center, transparent 48%, rgba(15, 23, 42, 0.22) 78%, rgba(15, 23, 42, 0.65) 100%)',
            }}
          />
        )}

        {/* HUD слева сверху: живые углы С-дуги (без backdrop-blur для быстрого композитинга) */}
        <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 flex flex-col gap-1">
          <div
            className={`rounded-lg border px-2.5 py-1.5 ${
              viewMode === 'angio'
                ? 'border-slate-600/80 bg-slate-900/92 text-slate-100 shadow-lg'
                : 'border-slate-200 bg-white/95 text-slate-800 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
              <Crosshair className="h-3 w-3 text-sky-500" />
              Положение С-дуги
            </div>
            <div
              className={`font-mono text-sm font-extrabold tracking-tight ${
                viewMode === 'angio' ? 'text-sky-300' : 'text-slate-900'
              }`}
            >
              {formattedLive.full}
            </div>
            <div className="text-[10.5px] font-semibold">
              {nearestProj ? (
                <span className={viewMode === 'angio' ? 'text-emerald-300' : 'text-red-700'}>
                  ≈ {nearestProj.title}
                </span>
              ) : (
                <span className="opacity-70">Произвольный угол</span>
              )}
            </div>
          </div>
        </div>

        {/* HUD справа сверху: двухосевая схема С-дуги */}
        {showCArmHud && (
          <div className="pointer-events-none absolute right-2.5 top-2.5 z-20 hidden sm:block">
            <CArmDiagram
              angles={liveAngles}
              dark={viewMode === 'angio'}
              compact
            />
          </div>
        )}

        <HeartCanvasViewport
          isVisible={isVisible}
          activeCaseId={props.activeCaseId}
          onSelectCase={props.onSelectCase}
          timeline={props.timeline}
          reperfused={props.reperfused}
          dominance={props.dominance}
          viewMode={viewMode}
          angioSystem={angioSystem}
          showDistalGhost={showDistalGhost}
          bolusNonce={bolusNonce}
          labelMode={labelMode}
          showVeins={showVeins}
          onLoaded={handleLoaded}
          targetAngles={targetAngles}
          commandNonce={commandNonce}
          recenterNonce={recenterNonce}
          instantMove={instantMove}
          onAnglesLiveChange={handleAnglesLiveChange}
        />

        <div
          className={`pointer-events-none absolute bottom-2 left-2 z-20 rounded-md px-2 py-0.5 text-[10px] ${
            viewMode === 'angio'
              ? 'bg-slate-900/90 text-slate-200'
              : 'bg-white/94 text-slate-600 shadow-sm'
          }`}
        >
          <span className="hidden sm:inline">
            ЛКМ — вращать · ПКМ — перемещать · Колесо — зум · Клик по точке — окклюзия
          </span>
          <span className="sm:hidden">
            1 палец — вращать · 2 пальца — зум/сдвиг · Тап по точке — поражение
          </span>
        </div>
      </div>

      {/* Нижняя панель управления С-дугой, проекциями и справочником */}
      <div className="space-y-2 border-t border-slate-100 bg-slate-50/90 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="w-16 font-bold text-slate-600">RAO / LAO</span>
              <input
                type="range"
                min={-60}
                max={90}
                step={1}
                value={Math.max(-60, Math.min(90, liveAngles.laoDeg))}
                onChange={(e) => handleSliderChange({ laoDeg: Number(e.target.value) })}
                className="h-1.5 w-24 cursor-pointer accent-sky-600"
              />
              <span className="w-14 font-mono font-bold text-slate-800">
                {formattedLive.horiz.replace(' (задн.)', '')}
              </span>
            </label>

            <label className="flex items-center gap-1.5">
              <span className="w-16 font-bold text-slate-600">CAU / CRA</span>
              <input
                type="range"
                min={-45}
                max={45}
                step={1}
                value={Math.max(-45, Math.min(45, liveAngles.cranDeg))}
                onChange={(e) => handleSliderChange({ cranDeg: Number(e.target.value) })}
                className="h-1.5 w-24 cursor-pointer accent-red-700"
              />
              <span className="w-14 font-mono font-bold text-slate-800">
                {formattedLive.vert}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => selectProjection(PROJECTION_MAP.ap)}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="h-3 w-3" />
              AP 0°
            </button>

            <button
              type="button"
              onClick={() => setRecenterNonce((n) => n + 1)}
              title="Вернуть 3D-модель в центр окна (сохранив углы С-дуги)"
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Crosshair className="h-3 w-3" />
              Центр
            </button>

            <button
              type="button"
              onClick={handleOptimalForCase}
              title={optimalInfo.reason}
              className="rounded-md bg-red-700 px-2 py-0.5 text-[10.5px] font-bold text-white shadow-sm hover:bg-red-800"
            >
              Оптимум для ИСА: {optimalProjTitle}
            </button>
          </div>
        </div>

        {/* Группы стандартных проекций (ЛКА и ПКА) */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-12">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-sky-200/80 bg-sky-50/50 px-2 py-1.5 sm:col-span-8">
            <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-sky-800">
              ЛКА:
            </span>
            {lcaProjections.map((p) => {
              const active = nearestProj?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProjection(p)}
                  title={`${p.fullNameRu}\n${p.cheatSheet}`}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-sky-700 text-white shadow-sm'
                      : 'bg-white text-slate-700 ring-1 ring-sky-200 hover:bg-sky-100/70'
                  }`}
                >
                  {p.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-amber-200/80 bg-amber-50/50 px-2 py-1.5 sm:col-span-4">
            <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
              ПКА:
            </span>
            {rcaProjections.map((p) => {
              const active = nearestProj?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProjection(p)}
                  title={`${p.fullNameRu}\n${p.cheatSheet}`}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 ring-1 ring-amber-200 hover:bg-amber-100/70'
                  }`}
                >
                  {p.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Сворачиваемый справочник активной проекции + сравнительная таблица */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5">
            <button
              type="button"
              onClick={() => setShowGuideCard((v) => !v)}
              className="flex items-center gap-1.5 text-left text-[11.5px] font-bold text-slate-800 hover:text-red-700"
            >
              <BookOpen className="h-3.5 w-3.5 text-sky-600" />
              <span>Справочник проекции: {activeProjInfo.title}</span>
              {showGuideCard ? (
                <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowGuideCard(true);
                setShowCompareTable((v) => !v);
              }}
              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                showCompareTable
                  ? 'border-sky-500 bg-sky-50 text-sky-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Table2 className="h-3 w-3" />
              Сравнение проекций
            </button>
          </div>

          {showGuideCard && (
            <div className="space-y-2 border-t border-slate-100 px-3 py-2 text-xs">
              <div className="text-[11px] text-slate-500">{activeProjInfo.fullNameRu}</div>

              <div className="rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-[11px] font-semibold text-amber-950">
                Шпаргалка: {activeProjInfo.cheatSheet}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Что лучше всего видно
                  </div>
                  <ul className="space-y-0.5 text-[11px] text-slate-700">
                    {activeProjInfo.whatIsVisible.map((line, i) => (
                      <li key={i}>• {line}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Когда применять на столе
                  </div>
                  <ul className="space-y-0.5 text-[11px] text-slate-700">
                    {activeProjInfo.uses.map((u, i) => (
                      <li key={i}>✓ {u}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-600">
                {activeProjInfo.clinicalNote}
              </p>

              {showCompareTable && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 pt-1">
                  <div className="bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-800">
                    {compareTable.title}{' '}
                    <span className="font-normal text-slate-500">
                      (кликните по заголовку столбца для поворота С-дуги)
                    </span>
                  </div>
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-2 py-1 font-semibold text-slate-600">Сегмент / фокус</th>
                        {compareTable.columns.map((col) => {
                          const isColActive = activeProjInfo.id === col.projectionId;
                          return (
                            <th key={col.projectionId} className="px-2 py-1">
                              <button
                                type="button"
                                onClick={() => selectProjection(PROJECTION_MAP[col.projectionId])}
                                className={`rounded px-1.5 py-0.5 font-bold underline-offset-2 hover:underline ${
                                  isColActive
                                    ? 'bg-sky-700 text-white'
                                    : 'text-sky-800 hover:bg-sky-100'
                                }`}
                              >
                                {col.label}
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {compareTable.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-100 last:border-none">
                          {row.map((cell, cIdx) => {
                            const isBest =
                              cell.includes('Лучше всех') ||
                              cell.includes('Отлично') ||
                              cell.includes('Выбор №1');
                            const isWarn =
                              cell.includes('Укорочены') ||
                              cell.includes('Наложение') ||
                              cell.includes('Слабо');
                            return (
                              <td
                                key={cIdx}
                                className={`px-2 py-1 ${
                                  cIdx === 0
                                    ? 'font-semibold text-slate-700'
                                    : isBest
                                      ? 'font-bold text-emerald-700'
                                      : isWarn
                                        ? 'text-amber-700'
                                        : 'text-slate-600'
                                }`}
                              >
                                {cell}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const Heart3D = React.memo(Heart3DComponent);
