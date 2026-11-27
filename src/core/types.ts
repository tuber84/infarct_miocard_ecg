export type StandardLeadId =
  | 'I'
  | 'II'
  | 'III'
  | 'aVR'
  | 'aVL'
  | 'aVF'
  | 'V1'
  | 'V2'
  | 'V3'
  | 'V4'
  | 'V5'
  | 'V6';

export type ExtraLeadId = 'V3R' | 'V4R' | 'V7' | 'V8' | 'V9';

export type LeadId = StandardLeadId | ExtraLeadId;

export type ManualLeadState = 'normal' | 'ste' | 'std' | 'tinv';

export type Dominance = 'right' | 'left';

export type SyndromeCategory = 'stemi' | 'nstemi' | 'mimic' | 'normal';

export type QrsPattern = 'normal' | 'lbbb';

export type LesionType = 'none' | 'occlusion' | 'subocclusion' | 'stenosis';

export type CaseId =
  | 'normal'
  | 'lad_prox'
  | 'lad_mid'
  | 'lad_wrap'
  | 'd1'
  | 'rca_prox'
  | 'rca_dist'
  | 'pda'
  | 'lcx'
  | 'posterior'
  | 'lmca'
  | 'nstemi_antlat'
  | 'nstemi_inf'
  | 'nstemi_tinv'
  | 'wellens_a'
  | 'wellens_b'
  | 'de_winter'
  | 'lbbb_sgarbossa'
  | 'lbbb_benign'
  | 'pericarditis'
  | 'early_repol'
  | 'takotsubo';

export type StShape =
  | 'normal'
  | 'convex'
  | 'tombstone'
  | 'concave'
  | 'horizontal'
  | 'downsloping'
  | 'upsloping';

export type MiStageId =
  | 'hyperacute'
  | 'acute'
  | 'evolving'
  | 'subacute'
  | 'chronic';

export interface LeadShiftProfile {
  /** Амплитуда смещения сегмента ST в точке J (мм; 1 мм = 0.1 мВ) */
  stMm: number;
  /** Форма сегмента ST */
  shape: StShape;
  /** Выраженность гиперострого зубца T в острейшей фазе (0..1.5) */
  hyperacuteT?: number;
  /** Глубина формирования патологического зубца Q / QS (0..1.2) */
  qPotential?: number;
  /** Потеря амплитуды зубца R при некрозе (0..1) */
  rLoss?: number;
  /** Является ли изменение реципрокным (зеркальной депрессией) */
  isReciprocal?: boolean;
  /** Высокий/широкий R в V1-V2 (эквивалент Q задней стенки) */
  tallRPosterior?: boolean;
  /** Первичная симметричная инверсия T без предшествующей элевации ST (мВ, 0.3..0.65) */
  primaryTInversion?: number;
  /** Двухфазный зубец T (+ / −), характерный для синдрома Велленса тип A (0.5..1.2) */
  biphasicT?: number;
  /** Высокий симметричный зубец T паттерна де Винтера на фоне депрессии J-точки (0.5..1.2) */
  deWinterT?: number;
  /** Ветка генератора для учебного варианта субэндокардиальной депрессии без Q */
  isSubendocardial?: boolean;
  /** Постоянное фоновое смещение ST в точке J (мм), не зависящее от стадии (напр. дискордантность БЛНПГ) */
  baseStMm?: number;
  /** Если true, stMm не масштабируется стадиями времени (статический паттерн) */
  fixedSt?: boolean;
  /** Смещение сегмента PR в мм (депрессия при перикардите, подъём в aVR) */
  prShiftMm?: number;
  /** Амплитуда зазубрины перед точкой J (мВ, «крючок» fish-hook при СРРЖ) */
  jNotch?: number;
  /** Фиксированный базовый зубец T для БЛНПГ (мВ) */
  tDiscordant?: number;
  /** Глубина симметричной инверсии T без формирования Q (мВ, синдром Такоцубо) */
  giantTInversion?: number;
}

export interface ClinicalInsightsData {
  ecgCriteria: string[];
  reciprocalAndExtra: string[];
  cathLabRisks: string[];
  mimics: string[];
}

export interface DominanceOverride {
  arteryName?: string;
  segmentLabel?: string;
  description?: string;
  ahaSegments?: number[];
  rvInvolved?: boolean;
  reciprocalSegments?: number[];
  territoryNote?: string;
  leads?: Partial<Record<LeadId, LeadShiftProfile>>;
  replaceLeads?: boolean;
}

export interface CoronaryCase {
  id: CaseId;
  category: SyndromeCategory;
  syndromeBadge: string;
  lesionType: LesionType;
  urgencyLabel: string;
  shortTitle: string;
  arteryName: string;
  segmentLabel: string;
  territoryName: string;
  isPathological: boolean;
  description: string;
  /** Номера сегментов ЛЖ по классификации AHA (1–17) */
  ahaSegments: number[];
  /** Вовлечён ли правый желудочек (серп ПЖ на диаграмме) */
  rvInvolved: boolean;
  /** Сегменты с реципрокными изменениями для отображения на Bullseye */
  reciprocalSegments?: number[];
  leads: Partial<Record<LeadId, LeadShiftProfile>>;
  /** Коррекция при левом типе коронарного кровоснабжения */
  leftDominanceOverride?: DominanceOverride;
  defaultHeartRate: number;
  recommendedExtraLeads: ExtraLeadId[];
  clinicalInsights: ClinicalInsightsData;
  /** Морфология комплекса QRS (стандартный или полная БЛНПГ) */
  qrsPattern?: QrsPattern;
}

export interface StagePreset {
  id: MiStageId;
  label: string;
  timeRange: string;
  timelineValue: number;
  summary: string;
  reperfusionSummary: string;
}

export interface StageModifiers {
  /** Множитель элевации/депрессии ST (STEMI) */
  stFactor: number;
  /** Множитель гиперострого зубца T */
  hyperacuteTFactor: number;
  /** Множитель формирования патологического зубца Q */
  qFactor: number;
  /** Множитель потери амплитуды зубца R */
  rLossFactor: number;
  /** Множитель инверсии зубца T (0..1) */
  tInversionFactor: number;
  /** Множитель реципрокной депрессии ST */
  reciprocalFactor: number;
  /** Выпуклость купола ST (0..1) */
  convexity: number;
  /** Множитель субэндокардиальной депрессии ST (ИМбпST) */
  subendoStFactor: number;
  /** Множитель первичной глубокой инверсии T (Велленс B / не-Q ИМ) */
  primaryTFactor: number;
  /** Множитель двухфазного зубца T (Велленс A) */
  biphasicTFactor: number;
  /** Множитель паттерна де Винтера */
  deWinterFactor: number;
}

export interface EcgRenderOptions {
  artifacts: boolean;
  aivr: boolean;
  qrsPattern?: QrsPattern;
}

export interface LocalizationResult {
  /** Похожий учебный сценарий; null означает недостаточную или противоречивую разметку. */
  primaryCaseId: CaseId | null;
  secondaryCaseId: CaseId | null;
  activeLeadCount: number;
  reasoning: string[];
  recommendedExtraLeads: ExtraLeadId[];
}
