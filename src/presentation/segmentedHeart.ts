import type { CaseId, Dominance } from '../core/types';
import { HEART_SEGMENT_GEOMETRY, getHeartSegmentGeometry } from './heartSegmentGeometry';

export type ArterySegment = keyof typeof HEART_SEGMENT_GEOMETRY;
export const ARTERY_SEGMENTS = Object.keys(HEART_SEGMENT_GEOMETRY) as ArterySegment[];
export const isLeftCoronarySegment = (name: string) =>
  ['LMCA', 'LAD_prox', 'LAD_mid', 'LAD_dist', 'D1', 'D2', 'LCx', 'OM1'].includes(name);

/** Поражение начинается у входа в именованный сегмент. Ветки модели имеют фиксированную топологию. */
export function affectedArterySegments(caseId: CaseId, dominance: Dominance): readonly ArterySegment[] {
  switch (caseId) {
    case 'lmca': return ['LMCA', 'LAD_prox', 'LAD_mid', 'LAD_dist', 'D1', 'D2', 'LCx', 'OM1', ...(dominance === 'left' ? ['PDA', 'PLB'] as const : [])];
    case 'lad_prox': case 'de_winter': case 'wellens_a': case 'wellens_b':
      return ['LAD_prox', 'LAD_mid', 'LAD_dist', 'D1', 'D2'];
    case 'lad_mid': case 'nstemi_antlat': case 'nstemi_tinv': return ['LAD_mid', 'LAD_dist', 'D2'];
    case 'lad_wrap': return ['LAD_dist'];
    case 'd1': return ['D1'];
    case 'lcx': return dominance === 'left' ? ['LCx', 'OM1', 'PDA', 'PLB'] : ['LCx', 'OM1'];
    case 'posterior': return ['PLB'];
    case 'nstemi_inf': return dominance === 'left' ? ['LCx', 'OM1', 'PDA', 'PLB'] : ['RCA_dist', 'PDA', 'PLB'];
    case 'rca_prox': return dominance === 'left' ? ['RCA_prox', 'RCA_mid', 'RCA_dist'] : ['RCA_prox', 'RCA_mid', 'RCA_dist', 'PDA', 'PLB'];
    case 'rca_dist': return dominance === 'left' ? ['RCA_dist'] : ['RCA_dist', 'PDA', 'PLB'];
    default: return [];
  }
}

/** Иллюстративное продвижение контраста по сегментам, не измерение времени кровотока. */
export function segmentContrastDistance(name: ArterySegment, x: number, y: number, z: number, dominance: Dominance): number {
  const { entry, end } = getHeartSegmentGeometry(dominance)[name];
  const dx = end[0] - entry[0], dy = end[1] - entry[1], dz = end[2] - entry[2];
  const t = Math.max(0, Math.min(1, ((x-entry[0])*dx + (y-entry[1])*dy + (z-entry[2])*dz) / (dx*dx+dy*dy+dz*dz)));
  const start: Record<ArterySegment, number> = { LMCA: 0, LAD_prox: .12, LAD_mid: .4, LAD_dist: .65,
    D1: .3, D2: .5, LCx: .12, OM1: .4, RCA_prox: 0, RCA_mid: .22, RCA_dist: .5, PDA: .7, PLB: .7 };
  const width = name === 'LMCA' ? .12 : name === 'LCx' ? .55 : .3;
  const offset = dominance === 'left' && (name === 'PDA' || name === 'PLB') ? .62 : start[name];
  return Math.min(1, offset + t * width);
}
