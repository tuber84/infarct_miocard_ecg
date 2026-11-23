import { HEART_SEGMENT_GEOMETRY } from './heartSegmentGeometry';
import type { ArterySegment } from './segmentedHeart';
import type { CaseId } from '../core/types';

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

/** Привязки к конкретной геометрии сердца; не входят в медицинское ядро. */
export const HEART_LANDMARKS: Partial<Record<CaseId, OcclusionLandmark>> = {
  lad_prox: {
      mesh: 'LAD_prox',
      localPos: [...HEART_SEGMENT_GEOMETRY.LAD_prox.marker],
      vesselRegion: 'lad_prox',
  },
  lad_mid: {
      mesh: 'LAD_mid',
      localPos: [...HEART_SEGMENT_GEOMETRY.LAD_mid.marker],
      vesselRegion: 'lad_mid',
  },
  lad_wrap: {
      mesh: 'LAD_dist',
      localPos: [...HEART_SEGMENT_GEOMETRY.LAD_dist.marker],
      vesselRegion: 'lad_wrap',
  },
  d1: {
      mesh: 'D1',
      localPos: [...HEART_SEGMENT_GEOMETRY.D1.marker],
      vesselRegion: 'd1',
  },
  rca_prox: {
      mesh: 'RCA_prox',
      localPos: [...HEART_SEGMENT_GEOMETRY.RCA_prox.marker],
      vesselRegion: 'rca_prox',
  },
  rca_dist: {
      mesh: 'RCA_dist',
      localPos: [...HEART_SEGMENT_GEOMETRY.RCA_dist.marker],
      vesselRegion: 'rca_dist',
  },
  lcx: {
      mesh: 'LCx',
      localPos: [...HEART_SEGMENT_GEOMETRY.LCx.marker],
      vesselRegion: 'lcx',
  },
  posterior: {
      mesh: 'PLB',
      localPos: [...HEART_SEGMENT_GEOMETRY.PLB.marker],
      vesselRegion: 'posterior',
  },
  lmca: {
      mesh: 'LMCA',
      localPos: [...HEART_SEGMENT_GEOMETRY.LMCA.marker],
      vesselRegion: 'lmca',
  },
  nstemi_antlat: {
      mesh: 'LAD_mid',
      localPos: [...HEART_SEGMENT_GEOMETRY.LAD_mid.marker],
      vesselRegion: 'nstemi_antlat',
      replacesBaseMarker: 'lad_mid',
  },
  nstemi_inf: {
      mesh: 'RCA_dist',
      localPos: [...HEART_SEGMENT_GEOMETRY.RCA_dist.marker],
      vesselRegion: 'nstemi_inf',
      replacesBaseMarker: 'rca_dist',
  },
  nstemi_tinv: {
      mesh: 'LAD_mid',
      localPos: [...HEART_SEGMENT_GEOMETRY.LAD_mid.marker],
      vesselRegion: 'nstemi_tinv',
      replacesBaseMarker: 'lad_mid',
  },
  wellens_a: {
      mesh: 'LAD_prox',
      localPos: [...HEART_SEGMENT_GEOMETRY.LAD_prox.marker],
      vesselRegion: 'wellens_a',
      replacesBaseMarker: 'lad_prox',
  },
  wellens_b: {
      mesh: 'LAD_prox',
      localPos: [...HEART_SEGMENT_GEOMETRY.LAD_prox.marker],
      vesselRegion: 'wellens_b',
      replacesBaseMarker: 'lad_prox',
  },
  de_winter: {
      mesh: 'LAD_prox',
      localPos: [...HEART_SEGMENT_GEOMETRY.LAD_prox.marker],
      vesselRegion: 'de_winter',
      replacesBaseMarker: 'lad_prox',
  },
};
