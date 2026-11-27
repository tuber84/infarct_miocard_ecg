import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, GitCompare, Printer, RotateCcw, Ruler, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { getEcgMeasurements } from '../core/ecg/ecgEngine';
import {
  CaseId,
  EcgRenderOptions,
  LeadId,
  LeadShiftProfile,
  StageModifiers,
} from '../core/types';
import {
  drawEcgGrid,
  drawEcgWaveforms,
  type EcgExportMeta,
  type EcgSnapshot,
  exportEcgToPng,
  getMaxStandardStMm,
} from '../utils/ecgPaperRender';

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
  snapshotLabel?: string;
  exportMeta?: EcgExportMeta;
}

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
  snapshotLabel,
  exportMeta,
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
  const [snapshot, setSnapshot] = useState<EcgSnapshot | null>(null);
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

    drawEcgGrid(gctx, {
      canvasWidth,
      canvasHeight,
      pxPerMm,
      totalPaperMmX,
      totalPaperMmY,
      layout,
      rowsCount,
      rowHeightMm,
      gainMmMv,
      showExtraRow,
    });
  }, [
    canvasWidth,
    canvasHeight,
    pxPerMm,
    totalPaperMmX,
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

    drawEcgWaveforms(ctx, {
      pxPerMm,
      scaleRatio: zoom,
      layout,
      rowsCount,
      rowHeightMm,
      speedMmSec,
      gainMmMv,
      showExtraRow,
      caliperEnabled,
      leadProfiles,
      stageMods,
      heartRate,
      options,
      snapshot,
    });
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
    snapshot,
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

  const measurements = getEcgMeasurements(
    heartRate,
    options.aivr,
    options.qrsPattern,
    options.rhythmDisorder
  );
  const currentMaxStMm = getMaxStandardStMm(leadProfiles, stageMods);
  const resolutionPct =
    snapshot && snapshot.maxStMm >= 1.0
      ? Math.round(((snapshot.maxStMm - currentMaxStMm) / snapshot.maxStMm) * 100)
      : null;

  const captureSnapshot = () => {
    setSnapshot({
      label: snapshotLabel ?? 'Зафиксированная кривая',
      leadProfiles,
      stageMods,
      heartRate,
      options,
      maxStMm: currentMaxStMm,
    });
  };

  const handleExportPng = (mode: 'clean' | 'annotated') => {
    exportEcgToPng({
      mode,
      totalPaperMmX,
      totalPaperMmY,
      layout,
      rowsCount,
      rowHeightMm,
      speedMmSec,
      gainMmMv,
      showExtraRow,
      leadProfiles,
      stageMods,
      heartRate,
      options,
      snapshot,
      exportMeta,
    });
  };

  return (
    <div className="ecg-paper min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
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

          {!lockedClinicalSettings && (
            <>
              <button
                type="button"
                onClick={captureSnapshot}
                title="Зафиксировать текущую кривую как синий пунктирный контур «Было» для сравнения динамики"
                className={`flex items-center gap-1 rounded-md border px-2 py-1 font-semibold transition ${
                  snapshot
                    ? 'border-sky-500 bg-sky-50 text-sky-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <GitCompare className="h-3 w-3" />
                {snapshot ? 'Обновить «Было»' : 'Зафиксировать «Было»'}
              </button>

              <button
                type="button"
                onClick={() => handleExportPng('clean')}
                title="Скачать PNG-плёнку высокого разрешения без диагноза (раздатка для обучения)"
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3 w-3" />
                PNG (чистая)
              </button>

              <button
                type="button"
                onClick={() => handleExportPng('annotated')}
                title="Скачать PNG-плёнку с названием сценария, артерией и критериями ЭКГ"
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3 w-3" />
                PNG (разбор)
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                title="Распечатать ленту на лист А4 (альбомная ориентация)"
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-3 w-3" />
                Печать
              </button>
            </>
          )}

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

      {snapshot && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200 bg-sky-50/70 px-3 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 font-semibold text-sky-900">
              <span className="inline-block w-4 border-t-2 border-dashed border-sky-600" />
              Эталон «Было»: {snapshot.label}
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-700">
              Макс. ST↑: {snapshot.maxStMm.toFixed(1)} → {currentMaxStMm.toFixed(1)} мм
            </span>
            {resolutionPct !== null && (
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                  resolutionPct >= 50
                    ? 'bg-emerald-600 text-white'
                    : resolutionPct > 0
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-200 text-slate-700'
                }`}
              >
                {resolutionPct >= 50
                  ? `Резолюция ST ≥ 50% (−${resolutionPct}%)`
                  : resolutionPct > 0
                    ? `Снижение ST на ${resolutionPct}%`
                    : `Без снижения ST (${resolutionPct}%)`}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSnapshot(null)}
            className="no-print flex items-center gap-1 rounded border border-sky-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
          >
            <RotateCcw className="h-3 w-3" />
            Сбросить «Было»
          </button>
        </div>
      )}

      <div className="no-print flex flex-wrap gap-2 border-b bg-slate-50 px-3 py-2 md:hidden" aria-label="Переход к отведениям">
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
            {options.aivr
              ? '— (РИА)'
              : options.rhythmDisorder === 'wenckebach'
                ? '162→268 мс (Мобитц I)'
                : options.rhythmDisorder === 'av_block_1'
                  ? '248 мс (АВ-блок I ст.)'
                  : `${measurements.prMs} мс`}
          </span>
          <span>
            <strong className="text-slate-800">QRS:</strong> {measurements.qrsMs} мс
          </span>
          <span>
            <strong className="text-slate-800">QT/QTc (Базетт):</strong> {measurements.qtMs}/
            {measurements.qtcMs} мс
          </span>
          {!options.aivr && options.rhythmDisorder === 'pvc' && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-900">
              + ЖЭС (PVC)
            </span>
          )}

        </div>

        {!lockedClinicalSettings && <div className="no-print flex items-center gap-2">
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
