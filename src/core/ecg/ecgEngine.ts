import {
  EcgRenderOptions,
  LeadId,
  LeadShiftProfile,
  ManualLeadState,
  MiStageId,
  StageModifiers,
  StagePreset,
} from '../types';

export const STAGE_PRESETS: StagePreset[] = [
  {
    id: 'hyperacute',
    label: 'Острейшая',
    timeRange: '5–20 мин',
    timelineValue: 0.12,
    summary:
      'Высокие широкие симметричные («гиперострые») зубцы T; точка J только начинает подниматься над изолинией. Зубца Q ещё нет.',
    reperfusionSummary:
      'Учебный вариант ранней успешной реперфузии: ограничение повреждения миокарда. Конкретный результат зависит от времени ишемии и восстановления перфузии.',
  },
  {
    id: 'acute',
    label: 'Острая',
    timeRange: '20 мин – 6 ч',
    timelineValue: 0.35,
    summary:
      'Классический выпуклый подъём сегмента ST («спинка кошки» / надгробие) и яркая реципрокная депрессия. Зубец R пока сохранён.',
    reperfusionSummary:
      'В этом примере после ранней успешной реперфузии ST снижается и R лучше сохранён. Такая динамика не гарантируется самим фактом ЧКВ.',
  },
  {
    id: 'evolving',
    label: 'Эволюция',
    timeRange: '6–24 ч',
    timelineValue: 0.58,
    summary:
      'Нарастает патологический зубец Q (потеря R), сегмент ST начинает снижаться, формируется терминальная инверсия зубца T.',
    reperfusionSummary:
      'После реканализации ST быстро уходит к изолинии, формируются глубокие симметричные реперфузионные зубцы T.',
  },
  {
    id: 'subacute',
    label: 'Подострая',
    timeRange: '2–7 сут',
    timelineValue: 0.8,
    summary:
      'Сегмент ST возвращается к изолинии; глубокий симметричный отрицательный «коронарный» зубец T и сформированный зубец Q.',
    reperfusionSummary:
      'Реперфузионная динамика: изолиния ST, неглубокий или сглаженный Q, положительная динамика реперфузионных зубцов T.',
  },
  {
    id: 'chronic',
    label: 'Рубец',
    timeRange: '> 1 мес',
    timelineValue: 1.0,
    summary:
      'Учебный вариант поздних изменений: Q / QS, ST на изолинии, частичная нормализация T. Сохраняющийся ST↑ требует оценки причин и визуализации; сам по себе он не подтверждает аневризму.',
    reperfusionSummary:
      'Вариант исхода после ранней успешной реперфузии: меньшая потеря R и нормализация ST–T. Размер рубца оценивают по дополнительным данным.',
  },
];

export const NSTEMI_STAGE_SUMMARIES: Record<
  MiStageId,
  { summary: string; reperfusionSummary: string }
> = {
  hyperacute: {
    summary:
      'В данном примере нарастают депрессия ST или изменения T. Q отсутствует как условие сценария; для ИМбпST это не обязательное правило.',
    reperfusionSummary:
      'В данном примере раннее восстановление перфузии ограничивает повреждение. Глубину некроза по одной ЭКГ не определяют.',
  },
  acute: {
    summary:
      'Выраженные изменения выбранного паттерна: депрессия ST или изменения T. В этом примере R сохранён. Морфологию оценивают вместе с клиникой и динамикой.',
    reperfusionSummary:
      'После стентирования критического стеноза / субокклюзии сегмент ST быстро уходит на изолинию, формируются постишемические зубцы T.',
  },
  evolving: {
    summary:
      'В данном варианте депрессия ST уменьшается, возможна инверсия T. Велленс A/B не являются обязательными последовательными стадиями; ИМбпST может протекать с Q.',
    reperfusionSummary:
      'В данном варианте после ранней успешной реперфузии ST приближается к изолинии и R сохраняется. Это условие учебного примера.',
  },
  subacute: {
    summary:
      'В данном примере ST приближается к изолинии, сохраняются отрицательные T. Их наличие само по себе не определяет глубину повреждения.',
    reperfusionSummary:
      'Учебный вариант регресса постишемической инверсии T без формирования Q.',
  },
  chronic: {
    summary:
      'В этом примере ST на изолинии, T частично нормализуется, Q отсутствует. Возможны другие исходы; классификация по ST не тождественна наличию или отсутствию Q.',
    reperfusionSummary:
      'Вариант восстановления ST–T после ранней успешной реперфузии. Нормализация ЭКГ сама по себе не доказывает отсутствие остаточного повреждения.',
  },
};

export const DE_WINTER_STAGE_SUMMARIES: Record<
  MiStageId,
  { summary: string; reperfusionSummary: string }
> = {
  hyperacute: {
    summary:
      'Косовосходящая депрессия точки J в V1–V6 с формированием высоких узких симметричных зубцов T (без классического подъёма ST в грудных отведениях); возможен небольшой подъём ST в aVR.',
    reperfusionSummary:
      'Учебный вариант сравнения с ранней успешной реперфузией: ограничение повреждения при раннем восстановлении кровотока; сам факт ЧКВ не гарантирует конкретный исход.',
  },
  acute: {
    summary:
      'Выраженная косовосходящая депрессия точки J (1–3 мм) в грудных отведениях, переходящая в высокие симметричные T; паттерн указывает на подозрение на острое окклюзирующее поражение ПМЖВ (LAD) без классической элевации ST.',
    reperfusionSummary:
      'Учебный вариант сравнения с ранней успешной реперфузией: быстрый регресс депрессии J и высоты зубцов T, меньшая потеря амплитуды R, появление постишемической инверсии T; исход не гарантируется самим фактом ЧКВ.',
  },
  evolving: {
    summary:
      'Учебный вариант динамики паттерна де Винтера: уменьшение депрессии J и высоты T, возможна инверсия T, снижение амплитуды R и формирование зубца Q при задержке реперфузии.',
    reperfusionSummary:
      'Учебный вариант сравнения с ранней успешной реперфузией: приближение точки J к изолинии, меньшая потеря R и появление постишемической инверсии зубца T.',
  },
  subacute: {
    summary:
      'Учебный вариант подострой фазы: приближение точки J к изолинии, отрицательные зубцы T и снижение R или формирование Q в передних отведениях.',
    reperfusionSummary:
      'Учебный вариант сравнения с ранней успешной реперфузией: точка J на изолинии, более сохранный R и регресс постишемической инверсии зубца T.',
  },
  chronic: {
    summary:
      'Учебный вариант поздних изменений: точка J на изолинии, частичная нормализация T, возможны остаточные изменения комплекса QRS; объём рубца уточняют методами визуализации.',
    reperfusionSummary:
      'Учебный вариант сравнения с ранней успешной реперфузией: меньшая потеря R и стабилизация ST–T; сам факт ЧКВ не исключает остаточного рубцового изменения.',
  },
};

interface NormalLeadShape {
  p: number;
  q: number;
  r: number;
  s: number;
  t: number;
}

const NORMAL_LEAD_BASE: Record<LeadId, NormalLeadShape> = {
  I: { p: 0.1, q: -0.06, r: 0.65, s: -0.1, t: 0.22 },
  II: { p: 0.14, q: -0.05, r: 0.95, s: -0.12, t: 0.28 },
  III: { p: 0.05, q: -0.04, r: 0.42, s: -0.15, t: 0.1 },
  aVR: { p: -0.12, q: 0, r: 0.12, s: -0.82, t: -0.22 },
  aVL: { p: 0.05, q: -0.06, r: 0.42, s: -0.08, t: 0.14 },
  aVF: { p: 0.1, q: -0.05, r: 0.68, s: -0.12, t: 0.18 },
  V1: { p: 0.05, q: 0, r: 0.22, s: -0.92, t: -0.06 },
  V2: { p: 0.07, q: 0, r: 0.48, s: -1.12, t: 0.26 },
  V3: { p: 0.08, q: 0, r: 0.78, s: -0.68, t: 0.32 },
  V4: { p: 0.09, q: -0.04, r: 1.25, s: -0.32, t: 0.34 },
  V5: { p: 0.1, q: -0.08, r: 1.42, s: -0.16, t: 0.3 },
  V6: { p: 0.09, q: -0.08, r: 1.15, s: -0.08, t: 0.25 },
  V3R: { p: 0.04, q: 0, r: 0.16, s: -0.62, t: -0.06 },
  V4R: { p: 0.03, q: 0, r: 0.12, s: -0.48, t: -0.05 },
  V7: { p: 0.07, q: -0.06, r: 0.85, s: -0.08, t: 0.2 },
  V8: { p: 0.06, q: -0.05, r: 0.72, s: -0.06, t: 0.18 },
  V9: { p: 0.05, q: -0.05, r: 0.58, s: -0.06, t: 0.15 },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian(t: number, center: number, sigma: number): number {
  const z = (t - center) / sigma;
  return Math.exp(-0.5 * z * z);
}

interface Keyframe {
  t: number;
  m: StageModifiers;
}

const NATURAL_KEYFRAMES: Keyframe[] = [
  {
    t: 0.0,
    m: {
      stFactor: 0.18,
      hyperacuteTFactor: 0.55,
      qFactor: 0,
      rLossFactor: 0,
      tInversionFactor: 0,
      reciprocalFactor: 0.15,
      convexity: 0.2,
      subendoStFactor: 0.45,
      primaryTFactor: 0.4,
      biphasicTFactor: 0.65,
      deWinterFactor: 0.65,
    },
  },
  {
    t: 0.12,
    m: {
      stFactor: 0.42,
      hyperacuteTFactor: 1.0,
      qFactor: 0,
      rLossFactor: 0.05,
      tInversionFactor: 0,
      reciprocalFactor: 0.4,
      convexity: 0.35,
      subendoStFactor: 0.78,
      primaryTFactor: 0.72,
      biphasicTFactor: 0.95,
      deWinterFactor: 0.95,
    },
  },
  {
    t: 0.35,
    m: {
      stFactor: 1.0,
      hyperacuteTFactor: 0.35,
      qFactor: 0.2,
      rLossFactor: 0.25,
      tInversionFactor: 0.05,
      reciprocalFactor: 1.0,
      convexity: 0.95,
      subendoStFactor: 1.0,
      primaryTFactor: 1.0,
      biphasicTFactor: 1.0,
      deWinterFactor: 1.0,
    },
  },
  {
    t: 0.58,
    m: {
      stFactor: 0.55,
      hyperacuteTFactor: 0,
      qFactor: 0.72,
      rLossFactor: 0.65,
      tInversionFactor: 0.55,
      reciprocalFactor: 0.55,
      convexity: 0.7,
      subendoStFactor: 0.62,
      primaryTFactor: 1.0,
      biphasicTFactor: 0.38,
      deWinterFactor: 0.45,
    },
  },
  {
    t: 0.8,
    m: {
      stFactor: 0.12,
      hyperacuteTFactor: 0,
      qFactor: 0.95,
      rLossFactor: 0.85,
      tInversionFactor: 1.0,
      reciprocalFactor: 0.12,
      convexity: 0.3,
      subendoStFactor: 0.22,
      primaryTFactor: 0.85,
      biphasicTFactor: 0.05,
      deWinterFactor: 0.1,
    },
  },
  {
    t: 1.0,
    m: {
      stFactor: 0.04,
      hyperacuteTFactor: 0,
      qFactor: 1.0,
      rLossFactor: 0.9,
      tInversionFactor: 0.25,
      reciprocalFactor: 0.03,
      convexity: 0.15,
      subendoStFactor: 0.05,
      primaryTFactor: 0.25,
      biphasicTFactor: 0.0,
      deWinterFactor: 0.02,
    },
  },
];

const REPERFUSED_KEYFRAMES: Keyframe[] = [
  {
    t: 0.0,
    m: {
      stFactor: 0.18,
      hyperacuteTFactor: 0.55,
      qFactor: 0,
      rLossFactor: 0,
      tInversionFactor: 0,
      reciprocalFactor: 0.15,
      convexity: 0.2,
      subendoStFactor: 0.45,
      primaryTFactor: 0.4,
      biphasicTFactor: 0.65,
      deWinterFactor: 0.65,
    },
  },
  {
    t: 0.12,
    m: {
      stFactor: 0.38,
      hyperacuteTFactor: 0.9,
      qFactor: 0,
      rLossFactor: 0.04,
      tInversionFactor: 0,
      reciprocalFactor: 0.35,
      convexity: 0.3,
      subendoStFactor: 0.72,
      primaryTFactor: 0.68,
      biphasicTFactor: 0.9,
      deWinterFactor: 0.85,
    },
  },
  {
    t: 0.35,
    // После своевременного ЧКВ быстрая резолюция ST (>65%), ранняя инверсия T и сохранённый R
    m: {
      stFactor: 0.28,
      hyperacuteTFactor: 0.05,
      qFactor: 0.08,
      rLossFactor: 0.12,
      tInversionFactor: 0.55,
      reciprocalFactor: 0.25,
      convexity: 0.35,
      subendoStFactor: 0.22,
      primaryTFactor: 0.82,
      biphasicTFactor: 0.55,
      deWinterFactor: 0.22,
    },
  },
  {
    t: 0.58,
    m: {
      stFactor: 0.1,
      hyperacuteTFactor: 0,
      qFactor: 0.2,
      rLossFactor: 0.18,
      tInversionFactor: 0.95,
      reciprocalFactor: 0.08,
      convexity: 0.15,
      subendoStFactor: 0.08,
      primaryTFactor: 0.55,
      biphasicTFactor: 0.15,
      deWinterFactor: 0.05,
    },
  },
  {
    t: 0.8,
    m: {
      stFactor: 0.03,
      hyperacuteTFactor: 0,
      qFactor: 0.22,
      rLossFactor: 0.2,
      tInversionFactor: 0.72,
      reciprocalFactor: 0.03,
      convexity: 0.1,
      subendoStFactor: 0.02,
      primaryTFactor: 0.28,
      biphasicTFactor: 0.0,
      deWinterFactor: 0.0,
    },
  },
  {
    t: 1.0,
    m: {
      stFactor: 0.0,
      hyperacuteTFactor: 0,
      qFactor: 0.2,
      rLossFactor: 0.15,
      tInversionFactor: 0.1,
      reciprocalFactor: 0.0,
      convexity: 0.0,
      subendoStFactor: 0.0,
      primaryTFactor: 0.08,
      biphasicTFactor: 0.0,
      deWinterFactor: 0.0,
    },
  },
];

export function computeStageModifiers(
  timeline: number,
  reperfused: boolean
): StageModifiers {
  const clamped = clamp(timeline, 0, 1);
  const frames = reperfused ? REPERFUSED_KEYFRAMES : NATURAL_KEYFRAMES;

  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const localT = (clamped - a.t) / (b.t - a.t || 1);
      return {
        stFactor: lerp(a.m.stFactor, b.m.stFactor, localT),
        hyperacuteTFactor: lerp(a.m.hyperacuteTFactor, b.m.hyperacuteTFactor, localT),
        qFactor: lerp(a.m.qFactor, b.m.qFactor, localT),
        rLossFactor: lerp(a.m.rLossFactor, b.m.rLossFactor, localT),
        tInversionFactor: lerp(a.m.tInversionFactor, b.m.tInversionFactor, localT),
        reciprocalFactor: lerp(a.m.reciprocalFactor, b.m.reciprocalFactor, localT),
        convexity: lerp(a.m.convexity, b.m.convexity, localT),
        subendoStFactor: lerp(a.m.subendoStFactor, b.m.subendoStFactor, localT),
        primaryTFactor: lerp(a.m.primaryTFactor, b.m.primaryTFactor, localT),
        biphasicTFactor: lerp(a.m.biphasicTFactor, b.m.biphasicTFactor, localT),
        deWinterFactor: lerp(a.m.deWinterFactor, b.m.deWinterFactor, localT),
      };
    }
  }
  return frames[frames.length - 1].m;
}

export function getNearestStagePreset(timeline: number): StagePreset {
  let best = STAGE_PRESETS[0];
  let bestDist = Infinity;
  for (const preset of STAGE_PRESETS) {
    const dist = Math.abs(preset.timelineValue - timeline);
    if (dist < bestDist) {
      bestDist = dist;
      best = preset;
    }
  }
  return best;
}

export function getStagePresetById(id: MiStageId): StagePreset {
  return STAGE_PRESETS.find((s) => s.id === id) ?? STAGE_PRESETS[1];
}

/**
 * Построение профиля сдвигов для произвольного ручного выбора отведений пользователем
 */
export function buildManualFallbackLeads(
  manualStates: Partial<Record<LeadId, ManualLeadState>>
): Partial<Record<LeadId, LeadShiftProfile>> {
  const result: Partial<Record<LeadId, LeadShiftProfile>> = {};
  (Object.keys(manualStates) as LeadId[]).forEach((lead) => {
    const st = manualStates[lead];
    if (st === 'ste') {
      result[lead] = {
        stMm: 2.5,
        shape: 'convex',
        hyperacuteT: 0.7,
        qPotential: 0.75,
        rLoss: 0.55,
      };
    } else if (st === 'std') {
      result[lead] = {
        stMm: -2.0,
        shape: 'horizontal',
        isSubendocardial: true,
      };
    } else if (st === 'tinv') {
      result[lead] = {
        stMm: 0,
        shape: 'normal',
        primaryTInversion: 0.5,
      };
    }
  });
  return result;
}

/** Единые реперы в секундах; это параметры синтетического цикла, а не автоматическая диагностика. */
export function getBeatTiming(beatDurationSec: number, aivr = false) {
  const rateScale = clamp(Math.pow(beatDurationSec / (60 / 72), 0.35), 0.78, 1.12);
  const pOnset = 0.02;
  const pEnd = 0.12;
  const qrsOnset = pOnset + 0.162;
  const j = qrsOnset + (aivr ? 0.144 : 0.088);
  const tEnd = qrsOnset + 0.375 * rateScale;
  const tOnset = j + 0.060 * rateScale;
  const tPeak = tOnset + (tEnd - tOnset) * 0.55;
  return { pOnset, pEnd, qrsOnset, j, tOnset, tPeak, tEnd, rateScale };
}

export function getEffectiveHeartRate(heartRate: number, aivr: boolean): number {
  return aivr ? clamp(heartRate, 60, 95) : clamp(heartRate, 40, 150);
}

/** Смещение итоговой кривой в J относительно нулевой изолинии, в мм при 10 мм/мВ. */
export function getJShiftMm(profile: LeadShiftProfile | undefined, stage: StageModifiers): number {
  if (!profile) return 0;
  const factor = profile.deWinterT ? stage.deWinterFactor
    : profile.isSubendocardial ? stage.subendoStFactor
      : profile.isReciprocal ? stage.reciprocalFactor : stage.stFactor;
  return profile.stMm * factor;
}

/** Ограниченная волна с точными началом и концом, без гауссовых хвостов. */
function pulse(t: number, start: number, end: number): number {
  if (t <= start || t >= end) return 0;
  return Math.sin(Math.PI * (t - start) / (end - start)) ** 2;
}

/** Периодический сигнал: окончание T не обрезается границей RR при высокой ЧСС. */
export function sampleBeatMv(
  phaseSec: number, beatDurationSec: number, leadId: LeadId,
  shiftProfile: LeadShiftProfile | undefined, stageMods: StageModifiers, options: EcgRenderOptions
): number {
  const phase = ((phaseSec % beatDurationSec) + beatDurationSec) % beatDurationSec;
  return sampleSingleBeatMv(phase, beatDurationSec, leadId, shiftProfile, stageMods, options)
    + sampleSingleBeatMv(phase + beatDurationSec, beatDurationSec, leadId, shiftProfile, stageMods, options);
}

/**
 * Расчёт мгновенного потенциала ЭКГ (в мВ) для одного кардиоцикла
 */
function sampleSingleBeatMv(
  phaseSec: number,
  beatDurationSec: number,
  leadId: LeadId,
  shiftProfile: LeadShiftProfile | undefined,
  stageMods: StageModifiers,
  options: EcgRenderOptions
): number {
  const base = NORMAL_LEAD_BASE[leadId];
  const timing = getBeatTiming(beatDurationSec, options.aivr);
  const { rateScale, qrsOnset, j: tJ, tOnset, tPeak: tT, tEnd } = timing;
  const t = phaseSec;
  if (t < timing.pOnset || t > tEnd) return 0;
  const qrsDuration = tJ - qrsOnset;
  const tWindow = smoothstep(tOnset, tOnset + 0.020 * rateScale, t)
    * (1 - smoothstep(tEnd - 0.030 * rateScale, tEnd, t));

  if (options.aivr) {
    // Учебный РИА: отсутствие P и широкий комплекс с точными границами 144 мс.
    const polarity = ['aVR', 'V1', 'V3R', 'V4R'].includes(leadId) ? -1 : 1;
    const qrs = polarity * (1.15 * pulse(t, qrsOnset, qrsOnset + qrsDuration * 0.72)
      - 0.45 * pulse(t, qrsOnset + qrsDuration * 0.5, tJ));
    return qrs - polarity * 0.38 * gaussian(t, tT, 0.035 * rateScale) * tWindow;
  }

  const pWave = base.p * pulse(t, timing.pOnset, timing.pEnd);

  // Патологический зубец Q и потеря зубца R (STEMI и поздняя эволюция паттерна де Винтера)
  const qPot = shiftProfile?.qPotential ?? 0;
  const rLoss = shiftProfile?.rLoss ?? 0;
  const isPositiveInf = (shiftProfile?.stMm ?? 0) > 0.35;
  const canFormQ = isPositiveInf || Boolean(shiftProfile?.deWinterT);

  let qAmp = base.q;
  let rAmp = base.r;
  let sAmp = base.s;

  if (canFormQ && qPot > 0) {
    // При глубокой эволюции/рубце зубец Q углубляется пропорционально базовой амплитуде комплекса
    const scaleRef = Math.max(0.65, Math.abs(base.r) + Math.abs(base.s) * 0.4);
    qAmp = base.q - qPot * stageMods.qFactor * scaleRef * 0.58;
    rAmp = base.r * (1 - rLoss * stageMods.rLossFactor * 0.88);
    // При глубоком QS уменьшаем амплитуду R ещё сильнее и сглаживаем S
    if (rAmp < 0.12 && base.r > 0) {
      sAmp = base.s * (1 - 0.5 * stageMods.qFactor);
    }
  }

  // Зеркальный высокий зубец R в V1-V2 при заднем ИМ
  if (shiftProfile?.tallRPosterior) {
    rAmp += 0.72 * Math.max(0.25, stageMods.qFactor + stageMods.stFactor * 0.5);
    sAmp *= 0.45;
  }

  const qWave = qAmp * pulse(t, qrsOnset, qrsOnset + qrsDuration * (0.32 + 0.13 * (canFormQ ? stageMods.qFactor : 0)));
  const rWave = rAmp * pulse(t, qrsOnset + qrsDuration * 0.20, qrsOnset + qrsDuration * 0.70);
  const sWave = sAmp * pulse(t, qrsOnset + qrsDuration * 0.50, tJ);

  // Все QRS-компоненты равны нулю в J; T начинается позже. В J остаётся ровно stMv.
  const rawStMm = shiftProfile?.stMm ?? 0;
  const stMv = getJShiftMm(shiftProfile, stageMods) * 0.1;
  const stStart = smoothstep(qrsOnset + qrsDuration * 0.75, tJ, t);
  const elevatedDome = stMv > 0 && ['convex', 'tombstone', 'concave'].includes(shiftProfile?.shape ?? '');
  // При элевации дуга ST продолжается к T, без искусственного провала между двумя вершинами.
  const stEnd = elevatedDome
    ? 1 - smoothstep(tT - 0.02 * rateScale, tEnd, t)
    : 1 - smoothstep(tOnset, tT, t);
  const u = clamp((t - tJ) / ((elevatedDome ? tT : tOnset) - tJ), 0, 1);
  let stLevel = stMv;
  switch (shiftProfile?.shape) {
    case 'tombstone': stLevel *= 1 + 0.38 * Math.sin(Math.PI * u); break;
    case 'convex': stLevel *= 1 + 0.34 * stageMods.convexity * Math.sin(Math.PI * u); break;
    case 'concave': stLevel *= 1 + 0.42 * u ** 1.4; break;
    // Знак наклона относится к потенциалу, а не к модулю отрицательной амплитуды.
    case 'downsloping': stLevel -= Math.abs(stMv) * 0.35 * u; break;
    case 'upsloping': stLevel += Math.abs(stMv) * u; break;
  }
  const stComponent = stLevel * stStart * stEnd;

  // Зубец T: STEMI-эволюция, паттерн де Винтера, двухфазный Велленс A, первичная инверсия T и ИМбпST
  let tAmp = base.t;
  let tSigmaLeft = 0.042 * rateScale;
  let tSigmaRight = 0.032 * rateScale;
  let extraTWave = 0;

  if (shiftProfile?.deWinterT) {
    const dwStrength = shiftProfile.deWinterT * stageMods.deWinterFactor;
    tAmp = base.t + dwStrength * 0.62;
    tSigmaLeft = lerp(0.036 * rateScale, 0.03 * rateScale, stageMods.deWinterFactor);
    tSigmaRight = lerp(0.034 * rateScale, 0.028 * rateScale, stageMods.deWinterFactor);
    if (stageMods.tInversionFactor > 0.15 && stageMods.deWinterFactor < 0.5) {
      const invMix = smoothstep(0.15, 0.75, stageMods.tInversionFactor);
      tAmp = lerp(tAmp, -Math.max(0.3, shiftProfile.deWinterT * 0.42), invMix);
    }
  } else if (shiftProfile?.biphasicT) {
    const bp = shiftProfile.biphasicT * stageMods.biphasicTFactor;
    const invWeight = stageMods.tInversionFactor;
    tAmp = base.t * clamp(1 - bp * 0.9 - invWeight * 0.9, 0, 1);
    const tPos = tT - 0.036 * rateScale;
    const tNeg = tT + 0.034 * rateScale;
    const posComp = 0.3 * bp * gaussian(t, tPos, 0.022 * rateScale);
    const negComp = -0.52 * bp * gaussian(t, tNeg, 0.028 * rateScale);
    const evolvedInv =
      invWeight > 0.08
        ? -0.52 *
          invWeight *
          (1 - 0.65 * stageMods.biphasicTFactor) *
          gaussian(t, tT, 0.034 * rateScale)
        : 0;
    extraTWave = posComp + negComp + evolvedInv;
  } else if (shiftProfile?.primaryTInversion) {
    const pFactor = stageMods.primaryTFactor;
    tAmp = lerp(base.t, -shiftProfile.primaryTInversion, pFactor);
    tSigmaLeft = lerp(tSigmaLeft, 0.034 * rateScale, pFactor);
    tSigmaRight = lerp(tSigmaRight, 0.034 * rateScale, pFactor);
  } else if (isPositiveInf) {
    const hyperBoost = (shiftProfile?.hyperacuteT ?? 0.4) * stageMods.hyperacuteTFactor * 0.48;
    const inversionStrength = stageMods.tInversionFactor;
    if (hyperBoost > 0.02) {
      tAmp += hyperBoost;
      tSigmaLeft *= 1 + 0.25 * stageMods.hyperacuteTFactor;
      tSigmaRight *= 1 + 0.32 * stageMods.hyperacuteTFactor;
    }
    if (inversionStrength > 0.02) {
      const targetNegT = -Math.max(0.28, Math.min(0.65, Math.abs(rawStMm) * 0.14));
      tAmp = lerp(tAmp, targetNegT, inversionStrength);
      // Коронарный T более симметричный
      tSigmaLeft = lerp(tSigmaLeft, 0.036 * rateScale, inversionStrength);
      tSigmaRight = lerp(tSigmaRight, 0.036 * rateScale, inversionStrength);
    }
  } else if (shiftProfile?.isSubendocardial && rawStMm < -0.5) {
    tAmp = base.t * (1 - 0.55 * stageMods.subendoStFactor);
    if (stageMods.tInversionFactor > 0.1) {
      tAmp = lerp(tAmp, -0.24, stageMods.tInversionFactor * 0.75);
      tSigmaLeft = lerp(tSigmaLeft, 0.035 * rateScale, stageMods.tInversionFactor * 0.6);
      tSigmaRight = lerp(tSigmaRight, 0.035 * rateScale, stageMods.tInversionFactor * 0.6);
    }
  } else if (rawStMm < -0.5) {
    // При выраженной реципрокной депрессии ST конец T немного уплощается/сдвигается
    tAmp = base.t * (1 - 0.45 * stageMods.reciprocalFactor);
  }

  const tSigma = t < tT ? tSigmaLeft : tSigmaRight;
  const tWave = (tAmp * gaussian(t, tT, tSigma) + extraTWave) * tWindow;

  return pWave + qWave + rWave + sWave + stComponent + tWave;
}

/**
 * Генерация массива отсчётов ЭКГ заданной длительности (в мВ)
 */
export function generateLeadSignal(
  leadId: LeadId,
  shiftProfile: LeadShiftProfile | undefined,
  stageMods: StageModifiers,
  durationSec: number,
  sampleRate: number,
  heartRate: number,
  options: EcgRenderOptions,
  timeOffsetSec = 0
): Float32Array {
  const numSamples = Math.max(1, Math.floor(durationSec * sampleRate));
  const output = new Float32Array(numSamples);
  const effectiveHr = getEffectiveHeartRate(heartRate, options.aivr);
  const beatDuration = 60 / effectiveHr;

  // Уникальная фаза для лёгких реалистичных артефактов, чтобы отведения отличались естественно
  const leadSeed = leadId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  for (let i = 0; i < numSamples; i++) {
    const absTime = timeOffsetSec + i / sampleRate;
    const phase = ((absTime % beatDuration) + beatDuration) % beatDuration;
    let val = sampleBeatMv(phase, beatDuration, leadId, shiftProfile, stageMods, options);

    if (options.artifacts) {
      const drift =
        0.032 * Math.sin(2 * Math.PI * 0.27 * absTime + leadSeed * 0.4) +
        0.014 * Math.sin(2 * Math.PI * 0.11 * absTime + leadSeed);
      const emg =
        0.011 * Math.sin(2 * Math.PI * 37.3 * absTime + leadSeed) +
        0.008 * Math.cos(2 * Math.PI * 61.7 * absTime + leadSeed * 1.7);
      val += drift + emg;
    }

    output[i] = val;
  }

  return output;
}

export interface EcgMeasurements {
  hr: number;
  prMs: number;
  qrsMs: number;
  qtMs: number;
  qtcMs: number;
}

export function getEcgMeasurements(heartRate: number, aivr: boolean): EcgMeasurements {
  const hr = getEffectiveHeartRate(heartRate, aivr);
  const rrSec = 60 / hr;
  const timing = getBeatTiming(rrSec, aivr);
  const qt = timing.tEnd - timing.qrsOnset;
  return {
    hr,
    prMs: aivr ? 0 : Math.round((timing.qrsOnset - timing.pOnset) * 1000),
    qrsMs: Math.round((timing.j - timing.qrsOnset) * 1000),
    qtMs: Math.round(qt * 1000),
    qtcMs: Math.round(qt / Math.sqrt(rrSec) * 1000),
  };
}

export interface LeadBadgeInfo {
  text: string;
  tone: 'ste' | 'std' | 'hyper' | 'inv' | 'none';
}

export function getLeadBadge(
  profile: LeadShiftProfile | undefined,
  stageMods: StageModifiers,
  leadId?: LeadId
): LeadBadgeInfo {
  if (!profile) return { text: '', tone: 'none' };

  const currentStMm = getJShiftMm(profile, stageMods);

  if (currentStMm >= 0.45) {
    return { text: `ST↑ +${currentStMm.toFixed(1)}`, tone: 'ste' };
  }
  if (profile.deWinterT && currentStMm <= -0.45 && stageMods.deWinterFactor > 0.35) {
    return { text: 'dW T↑', tone: 'hyper' };
  }
  if (currentStMm <= -0.45) {
    return { text: `ST↓ ${currentStMm.toFixed(1)}`, tone: 'std' };
  }
  if (profile.biphasicT && stageMods.biphasicTFactor > 0.35) {
    return { text: 'T +/−', tone: 'inv' };
  }
  // В отведении aVR отрицательный зубец T физиологичен, поэтому вторичные бейджи T↑/T↓ не выводятся.
  if (leadId !== 'aVR') {
    if (
      (profile.primaryTInversion && stageMods.primaryTFactor > 0.35) ||
      (profile.biphasicT && stageMods.tInversionFactor > 0.45) ||
      (profile.isSubendocardial && stageMods.tInversionFactor > 0.45) ||
      (profile.deWinterT && stageMods.tInversionFactor > 0.45)
    ) {
      return { text: 'T↓ кор.', tone: 'inv' };
    }
    if (profile.stMm > 0.5 && stageMods.hyperacuteTFactor > 0.55) {
      return { text: 'T↑ остр.', tone: 'hyper' };
    }
    if (profile.stMm > 0.5 && stageMods.tInversionFactor > 0.45) {
      return { text: 'T↓ кор.', tone: 'inv' };
    }
  }
  if (profile.stMm > 0.5 && stageMods.qFactor > 0.6) {
    return { text: 'Q / QS', tone: 'inv' };
  }
  return { text: '', tone: 'none' };
}
