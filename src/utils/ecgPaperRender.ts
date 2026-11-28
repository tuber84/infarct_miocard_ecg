import { EXTRA_LEADS, STANDARD_LEADS } from '../core/content/coronaryCases';
import {
  generateLeadSignal,
  getBeatTiming,
  getEcgMeasurements,
  getEffectiveHeartRate,
  getJShiftMm,
  sampleBeatMv,
} from '../core/ecg/ecgEngine';
import {
  CaseId,
  EcgRenderOptions,
  ExtraLeadId,
  LeadId,
  LeadShiftProfile,
  StageModifiers,
} from '../core/types';

export const GRID_3X4: LeadId[][] = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
];

export const GRID_6X2: LeadId[][] = [
  ['I', 'V1'],
  ['II', 'V2'],
  ['III', 'V3'],
  ['aVR', 'V4'],
  ['aVL', 'V5'],
  ['aVF', 'V6'],
];

export interface EcgRecording {
  leadProfiles: Partial<Record<LeadId, LeadShiftProfile>>;
  stageMods: StageModifiers;
  heartRate: number;
  options: EcgRenderOptions;
}

export interface EcgSnapshot extends EcgRecording {
  label: string;
  caseId: CaseId;
  comparisonContext?: string;
}

export interface EcgExportMeta {
  title: string;
  subtitle: string;
  arteryName: string;
  criteria: string[];
}

export function getInitialComparisonLead({ leadProfiles, stageMods }: EcgRecording): LeadId {
  let lead: LeadId = 'II';
  let largestShift = 0;
  for (const id of STANDARD_LEADS) {
    const shift = getJShiftMm(leadProfiles[id], stageMods);
    // При отсутствии подъёма выбираем наиболее выраженную депрессию.
    if (shift > Math.max(0, largestShift) || (largestShift <= 0 && shift < largestShift)) {
      lead = id;
      largestShift = shift;
    }
  }
  return lead;
}

export interface GridDrawParams {
  canvasWidth: number;
  canvasHeight: number;
  pxPerMm: number;
  totalPaperMmX: number;
  totalPaperMmY: number;
  layout: '3x4' | '6x2';
  rowsCount: number;
  rowHeightMm: number;
  gainMmMv: 10 | 5;
  showExtraRow: boolean;
  extraLeads?: readonly ExtraLeadId[];
}

export function drawEcgPaperGrid(
  gctx: CanvasRenderingContext2D,
  { canvasWidth, canvasHeight, pxPerMm, totalPaperMmX, totalPaperMmY }: Pick<
    GridDrawParams, 'canvasWidth' | 'canvasHeight' | 'pxPerMm' | 'totalPaperMmX' | 'totalPaperMmY'
  >
) {
  gctx.fillStyle = '#fff9f9';
  gctx.fillRect(0, 0, canvasWidth, canvasHeight);

  for (const step of [1, 5]) {
    gctx.strokeStyle = step === 1 ? '#f8d4d4' : '#e7a4a4';
    gctx.lineWidth = step === 1 ? Math.max(0.7, pxPerMm * 0.16) : Math.max(1.1, pxPerMm * 0.25);
    gctx.beginPath();
    for (let mm = 0; mm <= totalPaperMmX; mm += step) {
      if (step === 1 && mm % 5 === 0) continue;
      const x = mm * pxPerMm;
      gctx.moveTo(x, 0);
      gctx.lineTo(x, canvasHeight);
    }
    for (let mm = 0; mm <= totalPaperMmY; mm += step) {
      if (step === 1 && mm % 5 === 0) continue;
      const y = mm * pxPerMm;
      gctx.moveTo(0, y);
      gctx.lineTo(canvasWidth, y);
    }
    gctx.stroke();
  }
}

export function drawEcgGrid(gctx: CanvasRenderingContext2D, p: GridDrawParams) {
  const {
    canvasWidth,
    pxPerMm,
    layout,
    rowsCount,
    rowHeightMm,
    gainMmMv,
    showExtraRow,
    extraLeads = EXTRA_LEADS,
  } = p;

  drawEcgPaperGrid(gctx, p);

  const drawCalibrationPulse = (startXMm: number, baselineMm: number) => {
    const hMm = gainMmMv;
    const x0 = startXMm * pxPerMm;
    const y0 = baselineMm * pxPerMm;
    const yTop = (baselineMm - hMm) * pxPerMm;

    gctx.strokeStyle = '#111827';
    gctx.lineWidth = Math.max(1.5, pxPerMm * 0.34);
    gctx.beginPath();
    gctx.moveTo(x0, y0);
    gctx.lineTo(x0 + 1.5 * pxPerMm, y0);
    gctx.lineTo(x0 + 1.5 * pxPerMm, yTop);
    gctx.lineTo(x0 + 6.5 * pxPerMm, yTop);
    gctx.lineTo(x0 + 6.5 * pxPerMm, y0);
    gctx.lineTo(x0 + 8 * pxPerMm, y0);
    gctx.stroke();
  };

  const leftMarginMm = 4;
  const signalStartMm = 14;
  const activeWidthMm = 250;

  if (layout === '3x4') {
    const colWidthMm = activeWidthMm / 4;
    for (let rIdx = 0; rIdx < 3; rIdx++) {
      const baselineMm = 12 + rIdx * rowHeightMm + rowHeightMm * 0.6;
      drawCalibrationPulse(leftMarginMm, baselineMm);
      gctx.strokeStyle = '#64748b';
      gctx.lineWidth = Math.max(1, pxPerMm * 0.22);
      gctx.beginPath();
      for (let cIdx = 1; cIdx < 4; cIdx++) {
        const xMm = signalStartMm + cIdx * colWidthMm;
        gctx.moveTo(xMm * pxPerMm, (baselineMm - 13) * pxPerMm);
        gctx.lineTo(xMm * pxPerMm, (baselineMm + 8) * pxPerMm);
      }
      gctx.stroke();
    }
    const rhythmBaseMm = 12 + 3 * rowHeightMm + rowHeightMm * 0.6;
    drawCalibrationPulse(leftMarginMm, rhythmBaseMm);
  } else {
    const colWidthMm = activeWidthMm / 2;
    for (let rIdx = 0; rIdx < 6; rIdx++) {
      const baselineMm = 12 + rIdx * rowHeightMm + rowHeightMm * 0.6;
      drawCalibrationPulse(leftMarginMm, baselineMm);
      const xMm = signalStartMm + colWidthMm;
      gctx.strokeStyle = '#64748b';
      gctx.lineWidth = Math.max(1, pxPerMm * 0.22);
      gctx.beginPath();
      gctx.moveTo(xMm * pxPerMm, (baselineMm - 12) * pxPerMm);
      gctx.lineTo(xMm * pxPerMm, (baselineMm + 8) * pxPerMm);
      gctx.stroke();
    }
  }

  if (showExtraRow) {
    const extraStartY = 12 + rowsCount * rowHeightMm;
    const extraBaseMm = extraStartY + 20;
    gctx.strokeStyle = '#cbd5e1';
    gctx.lineWidth = Math.max(1, pxPerMm * 0.22);
    gctx.beginPath();
    gctx.moveTo(0, (extraStartY + 1) * pxPerMm);
    gctx.lineTo(canvasWidth, (extraStartY + 1) * pxPerMm);
    gctx.stroke();

    drawCalibrationPulse(leftMarginMm, extraBaseMm);
    const segW = activeWidthMm / extraLeads.length;
    gctx.strokeStyle = '#64748b';
    gctx.lineWidth = Math.max(1, pxPerMm * 0.22);
    gctx.beginPath();
    for (let idx = 1; idx < extraLeads.length; idx++) {
      const xMm = signalStartMm + idx * segW;
      gctx.moveTo(xMm * pxPerMm, (extraBaseMm - 12) * pxPerMm);
      gctx.lineTo(xMm * pxPerMm, (extraBaseMm + 7) * pxPerMm);
    }
    gctx.stroke();
  }
}

export interface WaveDrawParams {
  pxPerMm: number;
  scaleRatio: number;
  layout: '3x4' | '6x2';
  rowsCount: number;
  rowHeightMm: number;
  speedMmSec: 25 | 50;
  gainMmMv: 10 | 5;
  showExtraRow: boolean;
  extraLeads?: readonly ExtraLeadId[];
  caliperEnabled: boolean;
  leadProfiles: Partial<Record<LeadId, LeadShiftProfile>>;
  stageMods: StageModifiers;
  heartRate: number;
  options: EcgRenderOptions;
  snapshot?: EcgSnapshot | null;
}

const SAMPLE_RATE = 1000;

function drawLeadTrace(
  ctx: CanvasRenderingContext2D,
  signal: Float32Array,
  x: number,
  baseline: number,
  pxPerSample: number,
  pxPerMv: number,
  scaleRatio: number,
  reference = false
) {
  ctx.save();
  ctx.strokeStyle = reference ? 'rgba(2, 132, 199, 0.75)' : '#0f172a';
  ctx.lineWidth = reference ? Math.max(1.15, 1.25 * scaleRatio) : Math.max(1.25, 1.35 * scaleRatio);
  ctx.lineJoin = 'bevel';
  if (reference) ctx.setLineDash([4 * scaleRatio, 3 * scaleRatio]);
  ctx.beginPath();
  ctx.moveTo(x, baseline - signal[0] * pxPerMv);
  for (let i = 1; i < signal.length; i++) {
    ctx.lineTo(x + i * pxPerSample, baseline - signal[i] * pxPerMv);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawEcgComparison(
  canvas: HTMLCanvasElement,
  lead: LeadId,
  before: EcgRecording,
  after: EcgRecording,
  speedMmSec: number,
  gainMmMv: number,
  dpr: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const durationSec = 1;
  const makeSignal = ({ leadProfiles, stageMods, heartRate, options }: EcgRecording) =>
    generateLeadSignal(lead, leadProfiles[lead], stageMods, durationSec, SAMPLE_RATE, heartRate, options);
  const beforeSignal = makeSignal(before);
  const afterSignal = makeSignal(after);
  const upperMm = Math.ceil(Math.max(8, Math.max(...beforeSignal, ...afterSignal) * gainMmMv)) + 2;
  const lowerMm = Math.ceil(Math.max(8, -Math.min(...beforeSignal, ...afterSignal) * gainMmMv)) + 2;
  const totalPaperMmX = speedMmSec * durationSec + 4;
  const totalPaperMmY = upperMm + lowerMm;
  const canvasWidth = 640;
  const pxPerMm = canvasWidth / totalPaperMmX;
  const canvasHeight = Math.ceil(totalPaperMmY * pxPerMm);
  canvas.width = Math.round(canvasWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawEcgPaperGrid(ctx, { canvasWidth, canvasHeight, pxPerMm, totalPaperMmX, totalPaperMmY });

  const x = 2 * pxPerMm;
  const baseline = upperMm * pxPerMm;
  const pxPerSample = speedMmSec * pxPerMm / SAMPLE_RATE;
  const pxPerMv = gainMmMv * pxPerMm;
  drawLeadTrace(ctx, afterSignal, x, baseline, pxPerSample, pxPerMv, 1.8);
  drawLeadTrace(ctx, beforeSignal, x, baseline, pxPerSample, pxPerMv, 1.8, true);
}

export function drawEcgWaveforms(ctx: CanvasRenderingContext2D, p: WaveDrawParams) {
  const {
    pxPerMm,
    scaleRatio,
    layout,
    rowsCount,
    rowHeightMm,
    speedMmSec,
    gainMmMv,
    showExtraRow,
    extraLeads = EXTRA_LEADS,
    caliperEnabled,
    leadProfiles,
    stageMods,
    heartRate,
    options,
    snapshot,
  } = p;

  const drawLeadSegment = (
    leadId: LeadId,
    startXMm: number,
    widthMm: number,
    baselineMm: number,
    timeOffsetSec: number
  ) => {
    const durationSec = widthMm / speedMmSec;
    const x = startXMm * pxPerMm;
    const baseline = baselineMm * pxPerMm;
    const pxPerSample = speedMmSec * pxPerMm / SAMPLE_RATE;
    const pxPerMv = gainMmMv * pxPerMm;

    // 1. Фоновая кривая «Было» (пунктирный синий контур), если зафиксирован эталон
    if (snapshot) {
      const snapSignal = generateLeadSignal(
        leadId,
        snapshot.leadProfiles[leadId],
        snapshot.stageMods,
        durationSec,
        SAMPLE_RATE,
        snapshot.heartRate,
        snapshot.options,
        timeOffsetSec
      );
      drawLeadTrace(ctx, snapSignal, x, baseline, pxPerSample, pxPerMv, scaleRatio, true);
    }

    // 2. Текущая кривая
    const signal = generateLeadSignal(
      leadId,
      leadProfiles[leadId],
      stageMods,
      durationSec,
      SAMPLE_RATE,
      heartRate,
      options,
      timeOffsetSec
    );

    drawLeadTrace(ctx, signal, x, baseline, pxPerSample, pxPerMv, scaleRatio);

    if (caliperEnabled) {
      const rr = 60 / getEffectiveHeartRate(heartRate, options.aivr);
      const prDurationSec = !options.aivr && options.rhythmDisorder === 'av_block_1' ? 0.248 : 0.162;
      const timing = getBeatTiming(rr, options.aivr, options.qrsPattern, prDurationSec);
      const cycleStart = Math.ceil(timeOffsetSec / rr) * rr;
      const markers: [string, number][] = [
        ...(!options.aivr ? [['P', timing.pOnset] as [string, number]] : []),
        ['QRS', timing.qrsOnset],
        ['J', timing.j],
        ['Tк', timing.tEnd],
      ];
      ctx.save();
      ctx.strokeStyle = '#0369a1';
      ctx.fillStyle = '#0369a1';
      ctx.font = `${Math.round(9 * scaleRatio)}px sans-serif`;
      ctx.lineWidth = Math.max(0.8, 0.8 * scaleRatio);
      for (const [label, phase] of markers) {
        const localTime = cycleStart + phase - timeOffsetSec;
        if (localTime < 0 || localTime > durationSec) continue;
        const x = (startXMm + localTime * speedMmSec) * pxPerMm;
        ctx.setLineDash([2 * scaleRatio, 3 * scaleRatio]);
        ctx.beginPath();
        ctx.moveTo(x, (baselineMm - 6) * pxPerMm);
        ctx.lineTo(x, (baselineMm + 5) * pxPerMm);
        ctx.stroke();
        ctx.fillText(label, x + 2, (baselineMm + (label === 'J' ? 10 : 7)) * pxPerMm);
        if (label === 'J') {
          const mv = sampleBeatMv(phase, rr, leadId, leadProfiles[leadId], stageMods, options, prDurationSec);
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(x, (baselineMm - mv * gainMmMv) * pxPerMm, 2.5 * Math.max(1, scaleRatio * 0.8), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.round(11 * Math.max(0.85, scaleRatio))}px Inter, sans-serif`;
    ctx.fillText(leadId, (startXMm + 2) * pxPerMm, (baselineMm - 11) * pxPerMm);
  };

  const signalStartMm = 14;
  const activeWidthMm = 250;

  if (layout === '3x4') {
    const colWidthMm = activeWidthMm / 4;
    GRID_3X4.forEach((rowLeads, rIdx) => {
      const baselineMm = 12 + rIdx * rowHeightMm + rowHeightMm * 0.6;
      rowLeads.forEach((lid, cIdx) => {
        const xMm = signalStartMm + cIdx * colWidthMm;
        const timeOffset = (cIdx * colWidthMm) / speedMmSec;
        drawLeadSegment(lid, xMm, colWidthMm, baselineMm, timeOffset);
      });
    });

    const rhythmBaseMm = 12 + 3 * rowHeightMm + rowHeightMm * 0.6;
    drawLeadSegment('II', signalStartMm, activeWidthMm, rhythmBaseMm, 0);
    ctx.fillStyle = '#b91c1c';
    ctx.font = `600 ${Math.round(9.5 * Math.max(0.85, scaleRatio))}px Inter, sans-serif`;
    ctx.fillText('(ритм)', (signalStartMm + 11) * pxPerMm, (rhythmBaseMm - 11) * pxPerMm);
  } else {
    const colWidthMm = activeWidthMm / 2;
    GRID_6X2.forEach((rowLeads, rIdx) => {
      const baselineMm = 12 + rIdx * rowHeightMm + rowHeightMm * 0.6;
      rowLeads.forEach((lid, cIdx) => {
        const xMm = signalStartMm + cIdx * colWidthMm;
        const timeOffset = (cIdx * colWidthMm) / speedMmSec;
        drawLeadSegment(lid, xMm, colWidthMm, baselineMm, timeOffset);
      });
    });
  }

  if (showExtraRow) {
    const extraStartY = 12 + rowsCount * rowHeightMm;
    const extraBaseMm = extraStartY + 20;
    const segW = activeWidthMm / extraLeads.length;
    extraLeads.forEach((lid, idx) => {
      const xMm = signalStartMm + idx * segW;
      drawLeadSegment(lid, xMm, segW, extraBaseMm, (idx * segW) / speedMmSec);
    });
  }
}

export function exportEcgToPng(params: {
  mode: 'clean' | 'annotated';
  totalPaperMmX: number;
  totalPaperMmY: number;
  layout: '3x4' | '6x2';
  rowsCount: number;
  rowHeightMm: number;
  speedMmSec: 25 | 50;
  gainMmMv: 10 | 5;
  showExtraRow: boolean;
  leadProfiles: Partial<Record<LeadId, LeadShiftProfile>>;
  stageMods: StageModifiers;
  heartRate: number;
  options: EcgRenderOptions;
  snapshot?: EcgSnapshot | null;
  exportMeta?: EcgExportMeta;
}) {
  const pxPerMm = 10;
  const scaleRatio = pxPerMm / 4.2;
  const paperW = Math.round(params.totalPaperMmX * pxPerMm);
  const paperH = Math.round(params.totalPaperMmY * pxPerMm);
  const headerH = params.mode === 'annotated' ? 140 : 72;
  const footerH = params.mode === 'annotated' ? 185 : 54;

  const canvas = document.createElement('canvas');
  canvas.width = paperW;
  canvas.height = headerH + paperH + footerH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const m = getEcgMeasurements(
    params.heartRate,
    params.options.aivr,
    params.options.qrsPattern,
    params.options.rhythmDisorder
  );
  const prText = params.options.aivr
    ? '— (РИА)'
    : params.options.rhythmDisorder === 'wenckebach'
      ? '162→268 мс (Мобитц I)'
      : params.options.rhythmDisorder === 'av_block_1'
        ? '248 мс (АВ-блок I ст.)'
        : `${m.prMs} мс`;

  // Шапка экспорта
  ctx.fillStyle = '#0f172a';
  if (params.mode === 'clean') {
    ctx.font = 'bold 26px Inter, sans-serif';
    ctx.fillText('КардиоАтлас ЭКГ · Учебная 12-канальная плёнка (без разбора)', 36, 45);
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${params.speedMmSec} мм/с · ${params.gainMmMv} мм/мВ · ЧСС ${m.hr} уд/мин`, paperW - 36, 45);
    ctx.textAlign = 'left';
  } else {
    const title = params.exportMeta?.title ?? 'КардиоАтлас ЭКГ';
    const artery = params.exportMeta?.arteryName ?? '';
    const sub = params.exportMeta?.subtitle ?? '';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText(title, 36, 46);
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText(artery, 36, 82);
    ctx.fillStyle = '#475569';
    ctx.font = '19px Inter, sans-serif';
    ctx.fillText(sub, 36, 114);
    ctx.textAlign = 'right';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${params.speedMmSec} мм/с · ${params.gainMmMv} мм/мВ · ЧСС ${m.hr}`, paperW - 36, 46);
    ctx.textAlign = 'left';
  }

  // Поле миллиметровки и сигналов
  ctx.save();
  ctx.translate(0, headerH);
  drawEcgGrid(ctx, {
    canvasWidth: paperW,
    canvasHeight: paperH,
    pxPerMm,
    totalPaperMmX: params.totalPaperMmX,
    totalPaperMmY: params.totalPaperMmY,
    layout: params.layout,
    rowsCount: params.rowsCount,
    rowHeightMm: params.rowHeightMm,
    gainMmMv: params.gainMmMv,
    showExtraRow: params.showExtraRow,
  });
  drawEcgWaveforms(ctx, {
    pxPerMm,
    scaleRatio,
    layout: params.layout,
    rowsCount: params.rowsCount,
    rowHeightMm: params.rowHeightMm,
    speedMmSec: params.speedMmSec,
    gainMmMv: params.gainMmMv,
    showExtraRow: params.showExtraRow,
    caliperEnabled: false,
    leadProfiles: params.leadProfiles,
    stageMods: params.stageMods,
    heartRate: params.heartRate,
    options: params.options,
    snapshot: params.mode === 'annotated' ? params.snapshot : null,
  });
  ctx.restore();

  // Подвал
  const footY = headerH + paperH;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, footY);
  ctx.lineTo(paperW, footY);
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(
    `Интервалы модели · ЧСС: ${m.hr}/мин | PR: ${prText} | QRS: ${m.qrsMs} мс | QT/QTc: ${m.qtMs}/${m.qtcMs} мс`,
    36,
    footY + 34
  );

  if (params.mode === 'annotated' && params.exportMeta?.criteria.length) {
    ctx.fillStyle = '#0f172a';
    ctx.font = '19px Inter, sans-serif';
    params.exportMeta.criteria.slice(0, 3).forEach((line, idx) => {
      const clipped = line.length > 165 ? `${line.slice(0, 162)}…` : line;
      ctx.fillText(`• ${clipped}`, 36, footY + 74 + idx * 34);
    });
  }

  const link = document.createElement('a');
  link.download = params.mode === 'clean' ? 'ecg-clean.png' : 'ecg-annotated.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
