import type { CaseId } from '../core/types';

export interface OcclusionLandmark {
  /** Имя меша в модели сердца */
  mesh: 'LCA_MiCorazon_0' | 'CA_MiCorazon_0';
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
      mesh: 'LCA_MiCorazon_0',
      localPos: [1773, 202, 3686],
      vesselRegion: 'lad_prox',
  },
  lad_mid: {
      mesh: 'LCA_MiCorazon_0',
      localPos: [2054, -1790, 4871],
      vesselRegion: 'lad_mid',
  },
  lad_wrap: {
      mesh: 'LCA_MiCorazon_0',
      localPos: [2602, -4441, 5382],
      vesselRegion: 'lad_wrap',
  },
  d1: {
      mesh: 'LCA_MiCorazon_0',
      localPos: [3368, -1961, 4242],
      vesselRegion: 'd1',
  },
  rca_prox: {
      mesh: 'CA_MiCorazon_0',
      localPos: [-2376, 460, 2697],
      vesselRegion: 'rca_prox',
  },
  rca_dist: {
      mesh: 'CA_MiCorazon_0',
      localPos: [-3311, -3096, 2026],
      vesselRegion: 'rca_dist',
  },
  lcx: {
      mesh: 'CA_MiCorazon_0',
      localPos: [4861, -3200, 973],
      vesselRegion: 'lcx',
  },
  posterior: {
      mesh: 'CA_MiCorazon_0',
      localPos: [2084, -4460, -1261],
      vesselRegion: 'posterior',
  },
  lmca: {
      mesh: 'LCA_MiCorazon_0',
      localPos: [1438, 1902, -140],
      vesselRegion: 'lmca',
  },
  nstemi_antlat: {
      mesh: 'LCA_MiCorazon_0',
      localPos: [2054, -1790, 4871],
      vesselRegion: 'nstemi_antlat',
      replacesBaseMarker: 'lad_mid',
  },
  nstemi_inf: {
      mesh: 'CA_MiCorazon_0',
      localPos: [-3311, -3096, 2026],
      vesselRegion: 'nstemi_inf',
      replacesBaseMarker: 'rca_dist',
  },
  nstemi_tinv: {
      mesh: 'LCA_MiCorazon_0',
      localPos: [2054, -1790, 4871],
      vesselRegion: 'nstemi_tinv',
      replacesBaseMarker: 'lad_mid',
  },
  wellens_a: {
      mesh: 'LCA_MiCorazon_0',
      localPos: [1773, 202, 3686],
      vesselRegion: 'wellens_a',
      replacesBaseMarker: 'lad_prox',
  },
  wellens_b: {
      mesh: 'LCA_MiCorazon_0',
      localPos: [1773, 202, 3686],
      vesselRegion: 'wellens_b',
      replacesBaseMarker: 'lad_prox',
  },
  de_winter: {
      mesh: 'LCA_MiCorazon_0',
      localPos: [1773, 202, 3686],
      vesselRegion: 'de_winter',
      replacesBaseMarker: 'lad_prox',
  },
};
