import * as THREE from 'three';

export interface CArmAngles {
  /** Положительные значения = LAO (влево), отрицательные = RAO (вправо) */
  laoDeg: number;
  /** Положительные значения = CRA (краниально), отрицательные = CAU (каудально) */
  cranDeg: number;
  /** Находится ли камера в задней полусфере (z < -0.15) */
  isPosterior?: boolean;
}

export interface FormattedCArmAngles {
  horiz: string;
  vert: string;
  full: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Переводит углы С-дуги (LAO/RAO, CRA/CAU) в 3D-позицию детектора/камеры
 * В системе координат heart.fbx: +X = левый бок (LAO), -X = правый (RAO), +Y = голова (CRA), +Z = грудина (AP)
 */
export function cArmAnglesToPosition(
  laoDeg: number,
  cranDeg: number,
  radius = 4.4
): [number, number, number] {
  const az = degToRad(laoDeg);
  const el = degToRad(clamp(cranDeg, -85, 85));

  const x = radius * Math.cos(el) * Math.sin(az);
  const y = radius * Math.sin(el);
  const z = radius * Math.cos(el) * Math.cos(az);

  return [x, y, z];
}

/**
 * Вычисляет текущие углы С-дуги по 3D-позиции камеры
 */
export function positionToCArmAngles(pos: THREE.Vector3): CArmAngles {
  const r = Math.max(0.001, pos.length());
  const cranDeg = Math.round(radToDeg(Math.asin(clamp(pos.y / r, -1, 1))));
  const laoDeg = Math.round(radToDeg(Math.atan2(pos.x, pos.z)));
  const isPosterior = pos.z < -0.15;

  return { laoDeg, cranDeg, isPosterior };
}

/**
 * Форматирует углы С-дуги в привычный ангиографический формат (AP / LAO / RAO + CRA / CAU)
 */
export function formatCArmAngles(angles: CArmAngles): FormattedCArmAngles {
  const absLao = Math.abs(angles.laoDeg);
  const absCran = Math.abs(angles.cranDeg);

  let horiz: string;
  if (absLao <= 2) {
    horiz = 'AP 0°';
  } else if (angles.laoDeg > 2) {
    horiz = `LAO ${absLao}°`;
  } else {
    horiz = `RAO ${absLao}°`;
  }

  if (absLao > 105 || angles.isPosterior) {
    horiz += ' (задн.)';
  }

  let vert: string;
  if (absCran <= 2) {
    vert = '0°';
  } else if (angles.cranDeg > 2) {
    vert = `CRA ${absCran}°`;
  } else {
    vert = `CAU ${absCran}°`;
  }

  const full = vert === '0°' ? horiz : `${horiz} · ${vert}`;
  return { horiz, vert, full };
}

/**
 * Находит ближайшую стандартную проекцию КАГ в радиусе 18° по евклидовой норме углов
 */
export function findNearestProjection<T extends { laoDeg: number; cranDeg: number }>(
  angles: CArmAngles,
  projections: T[]
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;

  for (const proj of projections) {
    const dLao = angles.laoDeg - proj.laoDeg;
    const dCran = angles.cranDeg - proj.cranDeg;
    const dist = Math.sqrt(dLao * dLao + dCran * dCran);
    if (dist <= 18 && dist < bestDist) {
      bestDist = dist;
      best = proj;
    }
  }

  return best;
}
