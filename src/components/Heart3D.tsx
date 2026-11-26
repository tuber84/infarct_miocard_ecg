import { ARTERY_SEGMENTS, affectedArterySegments, isLeftCoronarySegment, segmentContrastDistance, type ArterySegment } from '../presentation/segmentedHeart';
import { getHeartSegmentGeometry } from '../presentation/heartSegmentGeometry';
import { getHeartLandmarks } from '../presentation/heartLandmarks';
import { ARTERY_LABELS } from '../presentation/arteryLabels';
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

const INITIAL_CAMERA_POS = cArmAnglesToPosition(0, 0, 5.2);
const ZERO_VEC = new THREE.Vector3(0, 0, 0);
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const MAX_PAN_RADIUS = 2.1;
const BADGE_SCALE_STYLE: React.CSSProperties = {
  transformOrigin: '0 50%',
  willChange: 'transform',
};

const ARTERY_NAMES: readonly string[] = ARTERY_SEGMENTS;

interface LandmarkWorldPos {
  caseId: CaseId;
  worldPos: THREE.Vector3;
  quaternion: THREE.Quaternion;
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
  onLoaded: () => void;
}

function disposeSceneResources(root: THREE.Object3D) {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material?.dispose());
      (mesh.userData.anatMat as THREE.Material | undefined)?.dispose();
      (mesh.userData.angioMat as THREE.Material | undefined)?.dispose();
    }
  });
}

function setupArteryMesh(mesh: THREE.Mesh, meshName: string, dominance: Dominance) {
  mesh.userData.baseColors = new Float32Array(mesh.geometry.attributes.color.array);
  const importedMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  importedMaterials.forEach((material) => material.dispose());

  const anatMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.08,
    transparent: false,
  });
  const angioMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });

  const posAttr = mesh.geometry.attributes.position;
  const colors = new Float32Array(posAttr.count * 4).fill(1);
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const dists = new Float32Array(posAttr.count);
  const inLcaFlags = new Uint8Array(posAttr.count);
  const isLcaMesh = isLeftCoronarySegment(meshName);

  for (let i = 0; i < posAttr.count; i++) {
    dists[i] = segmentContrastDistance(
      meshName as ArterySegment,
      posAttr.getX(i),
      posAttr.getY(i),
      posAttr.getZ(i),
      dominance
    );
    inLcaFlags[i] = isLcaMesh ? 1 : 0;
  }

  mesh.userData.anatMat = anatMat;
  mesh.userData.angioMat = angioMat;
  mesh.material = anatMat;

  return { dists, inLcaFlags };
}

function computeLandmarksForDominance(
  dominance: Dominance,
  meshMap: Record<string, THREE.Mesh>
): LandmarkWorldPos[] {
  const landmarkDefs = getHeartLandmarks(dominance);
  const segmentGeom = getHeartSegmentGeometry(dominance);
  const computed: LandmarkWorldPos[] = [];

  for (const id of CASE_ORDER) {
    const landmark = landmarkDefs[id];
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

    const neighborLocal = localPt
      .clone()
      .add(new THREE.Vector3(...segmentGeom[landmark.mesh].tangent).multiplyScalar(0.01));
    const neighborWorld = targetMesh.localToWorld(neighborLocal);
    const tangent = neighborWorld.sub(worldPos).normalize();
    if (tangent.lengthSq() < 0.01) tangent.set(0, -1, 0);

    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP_AXIS, tangent);

    computed.push({
      caseId: id,
      worldPos,
      quaternion,
    });
  }

  return computed;
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
  onLoaded,
}: HeartSceneProps) {
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);
  const [landmarksByDominance, setLandmarksByDominance] = useState<Record<Dominance, LandmarkWorldPos[]>>({
    right: [],
    left: [],
  });
  const [hoveredCase, setHoveredCase] = useState<CaseId | null>(null);
  const thrombusRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const bodyMeshRef = useRef<THREE.Mesh | null>(null);
  const arteryMeshesByDominanceRef = useRef<Record<Dominance, Record<string, THREE.Mesh>>>({
    right: {},
    left: {},
  });
  const arteryDistByDominanceRef = useRef<Record<Dominance, Record<string, Float32Array>>>({
    right: {},
    left: {},
  });
  const arteryInLcaByDominanceRef = useRef<Record<Dominance, Record<string, Uint8Array>>>({
    right: {},
    left: {},
  });

  // Стабилизируем колбэк, чтобы загрузка GLB никогда не перезапускалась при ререндерах
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const bolusProgressRef = useRef<number>(1.2);
  const bolusAnimatingRef = useRef<boolean>(false);

  // Загрузка обоих сегментированных GLB (правый + левый типы) строго 1 раз + полный dispose при размонтировании
  useEffect(() => {
    let cancelled = false;
    let loadedWrapper: THREE.Group | null = null;

    const assetBase = import.meta.env.BASE_URL;
    const loader = new GLTFLoader();

    Promise.all([
      loader.loadAsync(`${assetBase}models/heart/heart_segmented.glb`),
      loader.loadAsync(`${assetBase}models/heart/heart_artery_left_type.glb`),
    ])
      .then(([rightGltf, leftGltf]) => {
        const rightScene = rightGltf.scene;
        const leftScene = leftGltf.scene;

        if (cancelled) {
          disposeSceneResources(rightScene);
          disposeSceneResources(leftScene);
          return;
        }

        const rightMeshes: Record<string, THREE.Mesh> = {};
        const rightDists: Record<string, Float32Array> = {};
        const rightInLca: Record<string, Uint8Array> = {};
        let bodyMesh: THREE.Mesh | null = null;

        rightScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const meshName = mesh.name || mesh.parent?.name || '';
            mesh.name = meshName;

            if (ARTERY_NAMES.includes(meshName)) {
              rightMeshes[meshName] = mesh;
              const { dists, inLcaFlags } = setupArteryMesh(mesh, meshName, 'right');
              rightDists[meshName] = dists;
              rightInLca[meshName] = inLcaFlags;
            } else {
              mesh.userData.baseColors = new Float32Array(mesh.geometry.attributes.color.array);
              const importedMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              importedMaterials.forEach((material) => material.dispose());
              const anatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
              const angioMat = new THREE.MeshBasicMaterial({ color: '#64748b', transparent: true, opacity: 0.11, depthWrite: false });
              mesh.userData.anatMat = anatMat;
              mesh.userData.angioMat = angioMat;
              mesh.material = anatMat;
              bodyMesh = mesh;
            }
          }
        });

        const leftMeshes: Record<string, THREE.Mesh> = {};
        const leftDists: Record<string, Float32Array> = {};
        const leftInLca: Record<string, Uint8Array> = {};

        leftScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const meshName = mesh.name || mesh.parent?.name || '';
            mesh.name = meshName;

            if (ARTERY_NAMES.includes(meshName)) {
              leftMeshes[meshName] = mesh;
              const { dists, inLcaFlags } = setupArteryMesh(mesh, meshName, 'left');
              leftDists[meshName] = dists;
              leftInLca[meshName] = inLcaFlags;
              mesh.visible = false;
            } else {
              mesh.visible = false;
            }
          }
        });

        rightScene.updateMatrixWorld(true);
        const coreBox = new THREE.Box3().setFromObject(rightScene);

        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        coreBox.getSize(size);
        coreBox.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const normScale = 3.15 / maxDim;

        const wrapper = new THREE.Group();
        for (const scenePart of [rightScene, leftScene]) {
          scenePart.scale.multiplyScalar(normScale);
          scenePart.position.set(
            -center.x * normScale,
            -center.y * normScale,
            -center.z * normScale
          );
          wrapper.add(scenePart);
        }
        wrapper.updateMatrixWorld(true);

        const rightLandmarks = computeLandmarksForDominance('right', rightMeshes);
        const leftLandmarks = computeLandmarksForDominance('left', leftMeshes);

        loadedWrapper = wrapper;
        bodyMeshRef.current = bodyMesh;
        arteryMeshesByDominanceRef.current = { right: rightMeshes, left: leftMeshes };
        arteryDistByDominanceRef.current = { right: rightDists, left: leftDists };
        arteryInLcaByDominanceRef.current = { right: rightInLca, left: leftInLca };

        setLandmarksByDominance({ right: rightLandmarks, left: leftLandmarks });
        setModelGroup(wrapper);
        onLoadedRef.current();
      })
      .catch((err) => {
        console.error('Ошибка загрузки GLB моделей сердца:', err);
      });

    return () => {
      cancelled = true;
      if (loadedWrapper) {
        disposeSceneResources(loadedWrapper);
      }
    };
  }, []);

  // Переключение материалов и видимости слоёв при смене режима (Анатомия <-> КАГ) и доминирования
  useEffect(() => {
    if (!modelGroup) return;

    const bodyMesh = bodyMeshRef.current;
    if (bodyMesh) {
      const targetMat =
        viewMode === 'angio' ? bodyMesh.userData.angioMat : bodyMesh.userData.anatMat;
      if (targetMat && bodyMesh.material !== targetMat) {
        bodyMesh.material = targetMat;
      }
      bodyMesh.renderOrder = viewMode === 'angio' ? 1 : 0;
    }

    for (const dom of ['right', 'left'] as const) {
      const isVisibleDom = dom === dominance;
      const meshes = arteryMeshesByDominanceRef.current[dom];
      for (const artName of ARTERY_NAMES) {
        const mesh = meshes[artName];
        if (!mesh) continue;
        mesh.visible = isVisibleDom;
        if (isVisibleDom) {
          const targetMat =
            viewMode === 'angio' ? mesh.userData.angioMat : mesh.userData.anatMat;
          if (targetMat && mesh.material !== targetMat) {
            mesh.material = targetMat;
          }
          mesh.renderOrder = viewMode === 'angio' ? 5 : 0;
        }
      }
    }
  }, [modelGroup, viewMode, dominance]);

  const resolved = useMemo(
    () => resolveCaseForDominance(activeCaseId, dominance),
    [activeCaseId, dominance]
  );
  const lesionType = resolved.caseData.lesionType;

  // Обновление вертексных цветов артерий
  const applyArteryColors = useCallback(
    (bolusWave: number) => {
      const meshes = arteryMeshesByDominanceRef.current[dominance];
      const distMap = arteryDistByDominanceRef.current[dominance];
      const inLcaMap = arteryInLcaByDominanceRef.current[dominance];
      const affected = affectedArterySegments(activeCaseId, dominance);

      for (const artName of ARTERY_NAMES) {
        const mesh = meshes[artName];
        if (!mesh) continue;
        const colAttr = mesh.geometry.attributes.color as THREE.BufferAttribute;
        const posAttr = mesh.geometry.attributes.position;
        const dists = distMap[artName];
        const inLcaFlags = inLcaMap[artName];

        for (let i = 0; i < posAttr.count; i++) {

          const distal = affected.includes(artName as ArterySegment);
          if (viewMode === 'anatomy') {
            if (!distal) {
              const base = mesh.userData.baseColors as Float32Array;
              colAttr.setXYZW(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2], 1);
            } else if (reperfused) {
              colAttr.setXYZW(i, 0.96, 0.28, 0.22, 1);
            } else if (lesionType === 'subocclusion') {
              colAttr.setXYZW(i, 0.58, 0.24, 0.18, 1);
            } else if (lesionType === 'stenosis') {
              colAttr.setXYZW(i, 0.74, 0.22, 0.2, 1);
            } else {
              colAttr.setXYZW(i, 0.32, 0.32, 0.32, 1);
            }
          } else {
            const inLca = (artName === 'PDA' || artName === 'PLB') ? dominance === 'left' : inLcaFlags[i] === 1;
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

  // Пересчёт цветов вне кадра; в useFrame допускается только короткая анимация болюса.
  useEffect(() => {
    if (!modelGroup) return;
    applyArteryColors(bolusAnimatingRef.current ? bolusProgressRef.current : 1.2);
  }, [
    modelGroup,
    activeCaseId,
    resolved,
    timeline,
    reperfused,
    viewMode,
    dominance,
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

  const landmarkDefs = getHeartLandmarks(dominance);
  const activeLandmarks = landmarksByDominance[dominance];
  const isLeftDominantNstemiInf =
    activeCaseId === 'nstemi_inf' && dominance === 'left';
  const replacedBaseMarkerId = isLeftDominantNstemiInf
    ? 'lcx'
    : landmarkDefs[activeCaseId]?.replacesBaseMarker;
  const lcxLandmark = isLeftDominantNstemiInf
    ? activeLandmarks.find((item) => item.caseId === 'lcx')
    : undefined;

  return (
    <group>
      <primitive object={modelGroup} />

      {activeLandmarks.map((lm) => {
        const isActive = lm.caseId === activeCaseId;
        const isHovered = lm.caseId === hoveredCase;
        // Не дублируем маркеры, лежащие на том же участке сосуда, что и базовые STEMI-точки
        if (landmarkDefs[lm.caseId]?.replacesBaseMarker && !isActive) return null;
        if (replacedBaseMarkerId && lm.caseId === replacedBaseMarkerId && !isActive) return null;

        const isLmcaOrLad =
          isLeftCoronarySegment(landmarkDefs[lm.caseId]!.mesh) ||
          ((lm.caseId === 'posterior' || lm.caseId === 'pda' || lm.caseId === 'nstemi_inf') &&
            dominance === 'left');
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
                text={`${ARTERY_LABELS[isActive && isLeftDominantNstemiInf ? 'LCx' : landmarkDefs[lm.caseId]!.mesh].shortRu}${angioStatusSuffix}`}
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
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
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
          ) : null}

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

      <p className="px-3 py-2 text-xs text-slate-500">3D показывает поражённые сосуды; зоны миокарда — на схеме AHA.{props.dominance === 'left' ? ' Левый тип показан условно: форма сосудов фиксирована.' : ''}</p>
      {/* 3D Canvas + Флюороскопический HUD */}
      <div
        ref={canvasContainerRef}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative h-[360px] flex-none overflow-hidden sm:h-[460px] ${
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
