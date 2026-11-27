import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Ruler, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { EXTRA_LEADS } from '../core/content/coronaryCases';
import {
  generateLeadSignal,
  getEcgMeasurements,
  getBeatTiming,
  getEffectiveHeartRate,
  sampleBeatMv,
} from '../core/ecg/ecgEngine';
import {
  CaseId,
  EcgRenderOptions,
  LeadId,
  LeadShiftProfile,
  StageModifiers,
} from '../core/types';

interface EcgPaperProps {
  lockedClinicalSettings?: boolean;
  activeCaseId: CaseId;
  leadProfiles: Partial<Record<LeadId, LeadShiftProfile>>;
  stageMods: StageModifiers;
  heartRate: number;
  onChangeHeartRate: (hr: number) => void;
  options: EcgRenderOptions;
  onToggleArtifacts: () => void;
  showExtraRow: boolean;
  onToggleExtraRow: () => void;
}

const GRID_3X4: LeadId[][] = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
];

const GRID_6X2: LeadId[][] = [
  ['I', 'V1'],
  ['II', 'V2'],
  ['III', 'V3'],
  ['aVR', 'V4'],
  ['aVL', 'V5'],
  ['aVF', 'V6'],
];

interface CaliperBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const EcgPaperComponent: React.FC<EcgPaperProps> = ({
  lockedClinicalSettings = false,
  leadProfiles,
  stageMods,
  heartRate,
  onChangeHeartRate,
  options,
  onToggleArtifacts,
  showExtraRow,
  onToggleExtraRow,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paperViewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [layout, setLayout] = useState<'3x4' | '6x2'>('3x4');
  const [speedMmSec, setSpeedMmSec] = useState<25 | 50>(25);
  const [gainMmMv, setGainMmMv] = useState<10 | 5>(10);
  const [zoom, setZoom] = useState<number>(1);
  const [caliperEnabled, setCaliperEnabled] = useState(false);
  const [caliper, setCaliper] = useState<CaliperBox | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const previousCaliperRef = useRef<CaliperBox | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pendingScrollRef = useRef<number | null>(null);
  const pinchActiveRef = useRef(false);

  const totalPaperMmX = 264;
  const rowsCount = layout === '3x4' ? 4 : 6;
  const rowHeightMm = layout === '3x4' ? 32 : 28;
  const extraHeightMm = showExtraRow ? 32 : 0;
  const totalPaperMmY = 12 + rowsCount * rowHeightMm + extraHeightMm + 10;

  const basePxPerMm = 4.2;
  const pxPerMm = basePxPerMm * zoom;
  const canvasWidth = Math.round(totalPaperMmX * pxPerMm);
  const canvasHeight = Math.round(totalPaperMmY * pxPerMm);

  // Удерживаем под пальцами ту же точку бумаги при изменении ширины canvas.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.style.transform = '';
      stage.style.transformOrigin = '';
      stage.style.willChange = '';
    }
    if (pendingScrollRef.current !== null && paperViewportRef.current) {
      paperViewportRef.current.scrollLeft = pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [zoom]);

  useEffect(() => {
    const viewport = paperViewportRef.current;
    if (!viewport) return;
    let gesture: {
      startDist: number;
      startZoom: number;
      previewZoom: number;
      anchorStageX: number;
      lastCenterX: number;
    } | null = null;
    const measure = (touches: TouchList) => {
      const a = touches[0];
      const b = touches[1];
      return {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        centerX: (a.clientX + b.clientX) / 2,
      };
    };
    const clearStageTransform = () => {
      const stage = stageRef.current;
      if (stage) {
        stage.style.transform = '';
        stage.style.transformOrigin = '';
        stage.style.willChange = '';
      }
    };
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const { distance, centerX } = measure(event.touches);
      if (distance < 1) return;
      pinchActiveRef.current = true;
      if (pointerIdRef.current !== null) {
        const activeId = pointerIdRef.current;
        pointerIdRef.current = null;
        if (canvasRef.current?.hasPointerCapture(activeId)) {
          canvasRef.current.releasePointerCapture(activeId);
        }
        setCaliper(previousCaliperRef.current);
      }
      const rect = viewport.getBoundingClientRect();
      gesture = {
        startDist: distance,
        startZoom: zoomRef.current,
        previewZoom: zoomRef.current,
        anchorStageX: viewport.scrollLeft + (centerX - rect.left),
        lastCenterX: centerX,
      };
      const stage = stageRef.current;
      if (stage) {
        stage.style.transformOrigin = '0 0';
        stage.style.willChange = 'transform';
      }
      event.preventDefault();
    };
    const move = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 2) return;
      event.preventDefault();
      const { distance, centerX } = measure(event.touches);
      const nextZoom = Math.max(
        0.75,
        Math.min(1.6, (gesture.startZoom * distance) / gesture.startDist)
      );
      const scale = nextZoom / gesture.startZoom;
      const rect = viewport.getBoundingClientRect();
      const tx = centerX - rect.left + viewport.scrollLeft - gesture.anchorStageX * scale;
      gesture.previewZoom = nextZoom;
      gesture.lastCenterX = centerX;
      const stage = stageRef.current;
      if (stage) {
        stage.style.transform = `translate3d(${tx.toFixed(2)}px, 0px, 0) scale(${scale.toFixed(4)})`;
      }
    };
    const end = (event: TouchEvent) => {
      if (event.touches.length < 2 && gesture) {
        const finalZoom = gesture.previewZoom;
        const scale = finalZoom / gesture.startZoom;
        const rect = viewport.getBoundingClientRect();
        const targetScroll = Math.max(
          0,
          gesture.anchorStageX * scale - (gesture.lastCenterX - rect.left)
        );
        gesture = null;
        if (Math.abs(finalZoom - zoomRef.current) < 0.001) {
          clearStageTransform();
          viewport.scrollLeft = targetScroll;
        } else {
          pendingScrollRef.current = targetScroll;
          setZoom(finalZoom);
        }
      }
      if (event.touches.length === 0) pinchActiveRef.current = false;
    };
    const cancel = () => {
      gesture = null;
      pinchActiveRef.current = false;
      clearStageTransform();
    };
    const preventSafariGesture = (event: Event) => {
      event.preventDefault();
    };
    viewport.addEventListener('touchstart', start, { passive: false });
    viewport.addEventListener('touchmove', move, { passive: false });
    viewport.addEventListener('touchend', end);
    viewport.addEventListener('touchcancel', cancel);
    viewport.addEventListener('gesturestart', preventSafariGesture, { passive: false });
    viewport.addEventListener('gesturechange', preventSafariGesture, { passive: false });
    return () => {
      viewport.removeEventListener('touchstart', start);
      viewport.removeEventListener('touchmove', move);
      viewport.removeEventListener('touchend', end);
      viewport.removeEventListener('touchcancel', cancel);
      viewport.removeEventListener('gesturestart', preventSafariGesture);
      viewport.removeEventListener('gesturechange', preventSafariGesture);
    };
  }, []);

  // 1. Кэшированная отрисовка миллиметровой сетки и калибровочных импульсов
  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let gridCanvas = gridCanvasRef.current;
    if (!gridCanvas) {
      gridCanvas = document.createElement('canvas');
      gridCanvasRef.current = gridCanvas;
    }
    const targetW = Math.round(canvasWidth * dpr);
    const targetH = Math.round(canvasHeight * dpr);
    if (gridCanvas.width !== targetW || gridCanvas.height !== targetH) {
      gridCanvas.width = targetW;
      gridCanvas.height = targetH;
    }

    const gctx = gridCanvas.getContext('2d');
    if (!gctx) return;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    gctx.fillStyle = '#fff9f9';
    gctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Мелкая сетка 1 мм
    gctx.strokeStyle = '#f8d4d4';
    gctx.lineWidth = 0.7;
    gctx.beginPath();
    for (let mm = 0; mm <= totalPaperMmX; mm += 1) {
      if (mm % 5 === 0) continue;
      const x = mm * pxPerMm;
      gctx.moveTo(x, 0);
      gctx.lineTo(x, canvasHeight);
    }
    for (let mm = 0; mm <= totalPaperMmY; mm += 1) {
      if (mm % 5 === 0) continue;
      const y = mm * pxPerMm;
      gctx.moveTo(0, y);
      gctx.lineTo(canvasWidth, y);
    }
    gctx.stroke();

    // Крупная сетка 5 мм
    gctx.strokeStyle = '#e7a4a4';
    gctx.lineWidth = 1.1;
    gctx.beginPath();
    for (let mm = 0; mm <= totalPaperMmX; mm += 5) {
      const x = mm * pxPerMm;
      gctx.moveTo(x, 0);
      gctx.lineTo(x, canvasHeight);
    }
    for (let mm = 0; mm <= totalPaperMmY; mm += 5) {
      const y = mm * pxPerMm;
      gctx.moveTo(0, y);
      gctx.lineTo(canvasWidth, y);
    }
    gctx.stroke();

    const drawCalibrationPulse = (startXMm: number, baselineMm: number) => {
      const hMm = gainMmMv;
      const x0 = startXMm * pxPerMm;
      const y0 = baselineMm * pxPerMm;
      const yTop = (baselineMm - hMm) * pxPerMm;

      gctx.strokeStyle = '#111827';
      gctx.lineWidth = 1.5;
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
        gctx.lineWidth = 1;
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
        gctx.lineWidth = 1;
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
      gctx.lineWidth = 1;
      gctx.beginPath();
      gctx.moveTo(0, (extraStartY + 1) * pxPerMm);
      gctx.lineTo(canvasWidth, (extraStartY + 1) * pxPerMm);
      gctx.stroke();

      drawCalibrationPulse(leftMarginMm, extraBaseMm);
      const segW = activeWidthMm / EXTRA_LEADS.length;
      gctx.strokeStyle = '#64748b';
      gctx.lineWidth = 1;
      gctx.beginPath();
      for (let idx = 1; idx < EXTRA_LEADS.length; idx++) {
        const xMm = signalStartMm + idx * segW;
        gctx.moveTo(xMm * pxPerMm, (extraBaseMm - 12) * pxPerMm);
        gctx.lineTo(xMm * pxPerMm, (extraBaseMm + 7) * pxPerMm);
      }
      gctx.stroke();
    }
  }, [
    canvasWidth,
    canvasHeight,
    pxPerMm,
    totalPaperMmY,
    layout,
    gainMmMv,
    showExtraRow,
    rowsCount,
    rowHeightMm,
  ]);

  // 2. Быстрая отрисовка сигналов поверх кэшированной миллиметровой бумаги
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(canvasWidth * dpr);
    const targetH = Math.round(canvasHeight * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (gridCanvasRef.current) {
      ctx.drawImage(gridCanvasRef.current, 0, 0, canvasWidth, canvasHeight);
    }

    const drawLeadSegment = (
      leadId: LeadId,
      startXMm: number,
      widthMm: number,
      baselineMm: number,
      timeOffsetSec: number
    ) => {
      const durationSec = widthMm / speedMmSec;
      const sampleRate = 1000;
      const signal = generateLeadSignal(
        leadId,
        leadProfiles[leadId],
        stageMods,
        durationSec,
        sampleRate,
        heartRate,
        options,
        timeOffsetSec
      );

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.25, 1.35 * zoom);
      ctx.lineJoin = 'bevel';
      ctx.beginPath();

      for (let i = 0; i < signal.length; i++) {
        const t = i / sampleRate;
        const x = (startXMm + t * speedMmSec) * pxPerMm;
        const y = (baselineMm - signal[i] * gainMmMv) * pxPerMm;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (caliperEnabled) {
        const rr = 60 / getEffectiveHeartRate(heartRate, options.aivr);
        const timing = getBeatTiming(rr, options.aivr, options.qrsPattern);
        const cycleStart = Math.ceil(timeOffsetSec / rr) * rr;
        const markers: [string, number][] = [
          ...(!options.aivr ? [['P', timing.pOnset] as [string, number]] : []),
          ['QRS', timing.qrsOnset], ['J', timing.j], ['Tк', timing.tEnd],
        ];
        ctx.save();
        ctx.strokeStyle = '#0369a1';
        ctx.fillStyle = '#0369a1';
        ctx.font = `${Math.round(9 * zoom)}px sans-serif`;
        ctx.lineWidth = 0.8;
        for (const [label, phase] of markers) {
          const localTime = cycleStart + phase - timeOffsetSec;
          if (localTime < 0 || localTime > durationSec) continue;
          const x = (startXMm + localTime * speedMmSec) * pxPerMm;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(x, (baselineMm - 6) * pxPerMm);
          ctx.lineTo(x, (baselineMm + 5) * pxPerMm);
          ctx.stroke();
          ctx.fillText(label, x + 2, (baselineMm + (label === 'J' ? 10 : 7)) * pxPerMm);
          if (label === 'J') {
            const mv = sampleBeatMv(phase, rr, leadId, leadProfiles[leadId], stageMods, options);
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(x, (baselineMm - mv * gainMmMv) * pxPerMm, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${Math.round(11 * Math.max(0.85, zoom))}px Inter, sans-serif`;
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
      ctx.font = `600 ${Math.round(9.5 * Math.max(0.85, zoom))}px Inter, sans-serif`;
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
      const segW = activeWidthMm / EXTRA_LEADS.length;
      EXTRA_LEADS.forEach((lid, idx) => {
        const xMm = signalStartMm + idx * segW;
        drawLeadSegment(lid, xMm, segW, extraBaseMm, (idx * segW) / speedMmSec);
      });
    }
  }, [
    canvasWidth,
    canvasHeight,
    pxPerMm,
    zoom,
    layout,
    speedMmSec,
    gainMmMv,
    caliperEnabled,
    leadProfiles,
    stageMods,
    heartRate,
    options,
    showExtraRow,
    rowsCount,
    rowHeightMm,
  ]);

  // Координаты измерений хранятся в миллиметрах бумаги и переживают изменение масштаба.
  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(totalPaperMmX, (e.clientX - rect.left) / rect.width * totalPaperMmX)),
      y: Math.max(0, Math.min(totalPaperMmY, (e.clientY - rect.top) / rect.height * totalPaperMmY)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!caliperEnabled || pinchActiveRef.current || !e.isPrimary || e.button !== 0 || pointerIdRef.current !== null) return;
    const p = getPointerPos(e);
    previousCaliperRef.current = caliper;
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setCaliper({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!caliperEnabled || pointerIdRef.current !== e.pointerId) return;
    const p = getPointerPos(e);
    setCaliper(prev => prev ? { ...prev, x2: p.x, y2: p.y } : null);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    if (e.type === 'pointerup') handlePointerMove(e);
    pointerIdRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Изменение скорости, усиления или раскладки меняет смысл рамки: начинаем измерение заново.
  useEffect(() => { setCaliper(null); pointerIdRef.current = null; }, [speedMmSec, gainMmMv, layout, showExtraRow, leadProfiles, stageMods, heartRate]);

  const caliperStats = (() => {
    if (!caliper) return null;
    const dxMm = Math.abs(caliper.x2 - caliper.x1);
    const dyMm = Math.abs(caliper.y2 - caliper.y1);
    const dtMs = Math.round((dxMm / speedMmSec) * 1000);
    const estBpm = dtMs > 120 ? Math.round(60000 / dtMs) : null;
    const dMv = (dyMm / gainMmMv).toFixed(2);
    return { dxMm: dxMm.toFixed(1), dyMm: dyMm.toFixed(1), dtMs, estBpm, dMv };
  })();

  const measurements = getEcgMeasurements(heartRate, options.aivr, options.qrsPattern);

  return (
    <div className="ecg-paper min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Симуляция 12 отведений
          </span>

          <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setLayout('3x4')}
              className={`rounded px-2 py-0.5 font-semibold ${
                layout === '3x4' ? 'bg-red-700 text-white' : 'text-slate-600'
              }`}
            >
              3×4 + ритм
            </button>
            <button
              type="button"
              onClick={() => setLayout('6x2')}
              className={`rounded px-2 py-0.5 font-semibold ${
                layout === '6x2' ? 'bg-red-700 text-white' : 'text-slate-600'
              }`}
            >
              6×2
            </button>
          </div>

          <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setGainMmMv(10)}
              className={`rounded px-2 py-0.5 font-semibold ${
                gainMmMv === 10 ? 'bg-red-700 text-white' : 'text-slate-600'
              }`}
            >
              10 мм/мВ
            </button>
            <button
              type="button"
              onClick={() => setGainMmMv(5)}
              className={`rounded px-2 py-0.5 font-semibold ${
                gainMmMv === 5 ? 'bg-red-700 text-white' : 'text-slate-600'
              }`}
            >
              5 мм/мВ
            </button>
          </div>

          <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setSpeedMmSec(25)}
              className={`rounded px-2 py-0.5 font-semibold ${
                speedMmSec === 25 ? 'bg-red-700 text-white' : 'text-slate-600'
              }`}
            >
              25 мм/с
            </button>
            <button
              type="button"
              onClick={() => setSpeedMmSec(50)}
              className={`rounded px-2 py-0.5 font-semibold ${
                speedMmSec === 50 ? 'bg-red-700 text-white' : 'text-slate-600'
              }`}
            >
              50 мм/с
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {!lockedClinicalSettings && <button
            type="button"
            onClick={onToggleExtraRow}
            className={`rounded-md border px-2 py-1 font-semibold transition ${
              showExtraRow
                ? 'border-amber-400 bg-amber-50 text-amber-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            + V3R/V4R, V7–V9
          </button>}

          {!lockedClinicalSettings && <button
            type="button"
            onClick={onToggleArtifacts}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 font-semibold transition ${
              options.artifacts
                ? 'border-slate-500 bg-slate-700 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            Артефакты
          </button>}

          <button
            type="button"
            onClick={() => {
              setCaliperEnabled((v) => {
                if (v) setCaliper(null);
                return !v;
              });
            }}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 font-semibold transition ${
              caliperEnabled
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Ruler className="h-3 w-3" />
            Калипер
          </button>

          <div className="flex items-center rounded-md border border-slate-200 bg-white px-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
              className="p-1 text-slate-600 hover:text-slate-900"
              title="Уменьшить"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-1.5 font-mono text-[11px] font-semibold text-slate-700"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}
              className="p-1 text-slate-600 hover:text-slate-900"
              title="Увеличить"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b bg-slate-50 px-3 py-2 md:hidden" aria-label="Переход к отведениям">
        {(layout === '3x4' ? ['I–III', 'aVR–aVF', 'V1–V3', 'V4–V6'] : ['I–aVF', 'V1–V6']).map((label, index) =>
          <button key={label} className="rounded border bg-white px-3 py-2 text-xs font-semibold" onClick={() => {
            if (paperViewportRef.current) paperViewportRef.current.scrollLeft = index * 250 / (layout === '3x4' ? 4 : 2) * pxPerMm;
          }}>{label}</button>)}
      </div>
      <p className="px-3 py-2 text-xs text-slate-600 md:hidden">{caliperEnabled ? 'Проведите пальцем по ЭКГ для измерения. Двумя пальцами меняйте масштаб. Для прокрутки выключите калипер.' : 'Листайте ленту по горизонтали. Разведите или сведите два пальца для изменения масштаба.'}</p>
      <div ref={paperViewportRef} data-ecg-viewport className="relative max-w-full overflow-x-auto bg-[#fff9f9]">
        <div ref={stageRef} className="relative inline-block">
          <canvas
            ref={canvasRef}
            aria-label="Лента ЭКГ"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
            style={{ width: canvasWidth, height: canvasHeight, touchAction: caliperEnabled ? 'none' : 'pan-x pan-y' }}
            className={`block ${caliperEnabled ? 'cursor-crosshair' : 'cursor-default'}`}
          />

          {caliperEnabled && caliper && (
            <div
              className="pointer-events-none absolute border-2 border-blue-600 bg-blue-500/15"
              style={{
                left: Math.min(caliper.x1, caliper.x2) * pxPerMm,
                top: Math.min(caliper.y1, caliper.y2) * pxPerMm,
                width: Math.abs(caliper.x2 - caliper.x1) * pxPerMm,
                height: Math.abs(caliper.y2 - caliper.y1) * pxPerMm,
              }}
            />
          )}
        </div>

      </div>
        {caliperEnabled && (
          <div data-caliper-readout role="status" className="m-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-950/90 px-3 py-1 text-xs font-medium text-white shadow-md">
            <Ruler className="h-3.5 w-3.5 text-blue-300" />
            {caliperStats && (Number(caliperStats.dxMm) > 0.2 || Number(caliperStats.dyMm) > 0.2) ? (
              <span className="font-mono">
                Δt = {caliperStats.dtMs} мс ({caliperStats.dxMm} мм)
                {caliperStats.estBpm ? ` · ~${caliperStats.estBpm} уд/мин` : ''} | ΔU ={' '}
                {caliperStats.dyMm} мм ({caliperStats.dMv} мВ)
              </span>
            ) : (
              <span>P / QRS — начала, J — конец QRS, Tк — конец T. Растяните рамку для измерения.</span>
            )}
          </div>
        )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4 font-mono text-[11.5px]">
          <span title="Границы волн заданы генератором; это не автоматическое измерение клинической ЭКГ.">Интервалы модели:</span>
          <span>
            <strong className="text-slate-800">ЧСС:</strong> {measurements.hr} уд/мин
          </span>
          <span>
            <strong className="text-slate-800">PR:</strong>{' '}
            {measurements.prMs > 0 ? `${measurements.prMs} мс` : '— (РИА)'}
          </span>
          <span>
            <strong className="text-slate-800">QRS:</strong> {measurements.qrsMs} мс
          </span>
          <span>
            <strong className="text-slate-800">QT/QTc (Базетт):</strong> {measurements.qtMs}/
            {measurements.qtcMs} мс
          </span>

        </div>

        {!lockedClinicalSettings && <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">ЧСС:</span>
          <input
            type="range"
            min={45}
            max={135}
            step={1}
            value={heartRate}
            onChange={(e) => onChangeHeartRate(Number(e.target.value))}
            className="h-1.5 w-28 cursor-pointer accent-red-700"
          />
          <span className="w-12 font-mono text-[11px] font-bold text-slate-700">
            {heartRate}
          </span>
        </div>}
      </div>
    </div>
  );
};

export const EcgPaper = React.memo(EcgPaperComponent);
