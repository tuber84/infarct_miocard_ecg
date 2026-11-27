import { HEART_SEGMENT_GEOMETRY, HEART_SEGMENT_GEOMETRY_LEFT } from './heartSegmentGeometry';
import type { ArterySegment } from './segmentedHeart';
import type { CaseId, Dominance } from '../core/types';

export interface OcclusionLandmark {
  /** Имя меша в модели сердца */
  mesh: ArterySegment;
  /** Локальные координаты точки поражения */
  localPos: [number, number, number];
  /** Идентификатор сосудистого бассейна для раскраски дистального русла */
  vesselRegion: CaseId;
  /** Идентификатор базового STEMI-маркера, который скрывается при активности этого сценария (без дублирующих сфер) */
  replacesBaseMarker?: CaseId;
}

type SegmentGeometryMap = typeof HEART_SEGMENT_GEOMETRY | typeof HEART_SEGMENT_GEOMETRY_LEFT;

function buildHeartLandmarks(geom: SegmentGeometryMap): Partial<Record<CaseId, OcclusionLandmark>> {
  return {
    lad_prox: {
      mesh: 'LAD_prox',
      localPos: [...geom.LAD_prox.marker],
      vesselRegion: 'lad_prox',
    },
    lad_mid: {
      mesh: 'LAD_mid',
      localPos: [...geom.LAD_mid.marker],
      vesselRegion: 'lad_mid',
    },
    lad_wrap: {
      mesh: 'LAD_dist',
      localPos: [...geom.LAD_dist.marker],
      vesselRegion: 'lad_wrap',
    },
    d1: {
      mesh: 'D1',
      localPos: [...geom.D1.marker],
      vesselRegion: 'd1',
    },
    rca_prox: {
      mesh: 'RCA_prox',
      localPos: [...geom.RCA_prox.marker],
      vesselRegion: 'rca_prox',
    },
    rca_dist: {
      mesh: 'RCA_dist',
      localPos: [...geom.RCA_dist.marker],
      vesselRegion: 'rca_dist',
    },
    pda: {
      mesh: 'PDA',
      localPos: [...geom.PDA.marker],
      vesselRegion: 'pda',
    },
    lcx: {
      mesh: 'LCx',
      localPos: [...geom.LCx.marker],
      vesselRegion: 'lcx',
    },
    posterior: {
      mesh: 'PLB',
      localPos: [...geom.PLB.marker],
      vesselRegion: 'posterior',
    },
    lmca: {
      mesh: 'LMCA',
      localPos: [...geom.LMCA.marker],
      vesselRegion: 'lmca',
    },
    nstemi_antlat: {
      mesh: 'LAD_mid',
      localPos: [...geom.LAD_mid.marker],
      vesselRegion: 'nstemi_antlat',
      replacesBaseMarker: 'lad_mid',
    },
    nstemi_inf: {
      mesh: 'RCA_dist',
      localPos: [...geom.RCA_dist.marker],
      vesselRegion: 'nstemi_inf',
      replacesBaseMarker: 'rca_dist',
    },
    nstemi_tinv: {
      mesh: 'LAD_mid',
      localPos: [...geom.LAD_mid.marker],
      vesselRegion: 'nstemi_tinv',
      replacesBaseMarker: 'lad_mid',
    },
    wellens_a: {
      mesh: 'LAD_prox',
      localPos: [...geom.LAD_prox.marker],
      vesselRegion: 'wellens_a',
      replacesBaseMarker: 'lad_prox',
    },
    wellens_b: {
      mesh: 'LAD_prox',
      localPos: [...geom.LAD_prox.marker],
      vesselRegion: 'wellens_b',
      replacesBaseMarker: 'lad_prox',
    },
    de_winter: {
      mesh: 'LAD_prox',
      localPos: [...geom.LAD_prox.marker],
      vesselRegion: 'de_winter',
      replacesBaseMarker: 'lad_prox',
    },
    lbbb_sgarbossa: {
      mesh: 'LAD_prox',
      localPos: [...geom.LAD_prox.marker],
      vesselRegion: 'lbbb_sgarbossa',
      replacesBaseMarker: 'lad_prox',
    },
  };
}

/** Привязки к конкретной геометрии сердца; не входят в медицинское ядро. */
export const HEART_LANDMARKS = buildHeartLandmarks(HEART_SEGMENT_GEOMETRY);
export const HEART_LANDMARKS_LEFT = buildHeartLandmarks(HEART_SEGMENT_GEOMETRY_LEFT);

export function getHeartLandmarks(dominance: Dominance): Partial<Record<CaseId, OcclusionLandmark>> {
  return dominance === 'left' ? HEART_LANDMARKS_LEFT : HEART_LANDMARKS;
}
