import React, { useEffect, useRef, useState } from 'react';
import { Activity, Pause, Play } from 'lucide-react';
import { STANDARD_LEADS } from '../core/content/coronaryCases';
import { sampleEcgAtTimeMv, getEffectiveHeartRate } from '../core/ecg/ecgEngine';
import {
  EcgRenderOptions,
  LeadId,
  LeadShiftProfile,
  RhythmDisorder,
  StageModifiers,
} from '../core/types';

interface LiveMonitorProps {
  leadProfiles: Partial<Record<LeadId, LeadShiftProfile>>;
  stageMods: StageModifiers;
  heartRate: number;
  reperfused: boolean;
  options: EcgRenderOptions;
  onToggleAivr: () => void;
  onChangeRhythmDisorder?: (next: RhythmDisorder) => void;
  defaultLead?: LeadId;
}

const LiveMonitorComponent: React.FC<LiveMonitorProps> = ({
  leadProfiles,
  stageMods,
  heartRate,
  reperfused,
  options,
  onToggleAivr,
  onChangeRhythmDisorder,
  defaultLead = 'V2',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [paused, setPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [channels, setChannels] = useState<1 | 3>(1);
  const [selectedLead, setSelectedLead] = useState<LeadId>(defaultLead);
  const [size, setSize] = useState({ width: 600, height: 132 });

  // Кольцевые буферы сохраняются между паузами и выходами из зоны видимости
  const simRef = useRef<{
    width: number;
    channels: number;
    buffers: Float32Array[];
    initialized: Uint8Array;
    sweepX: number;
    simTime: number;
  }>({
    width: 0,
    channels: 0,
    buffers: [],
    initialized: new Uint8Array(0),
    sweepX: 0,
    simTime: 0,
  });

  useEffect(() => {
    setSelectedLead(defaultLead);
  }, [defaultLead]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 50) {
        const nextW = Math.round(rect.width);
        const nextH = channels === 1 ? 132 : 186;
        setSize((prev) =>
          prev.width === nextW && prev.height === nextH
            ? prev
            : { width: nextW, height: nextH }
        );
      }
    });
    ro.observe(el);

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        ([entry]) => setIsVisible(entry.isIntersecting),
        { threshold: 0.02 }
      );
      io.observe(el);
    }

    return () => {
      ro.disconnect();
      io?.disconnect();
    };
  }, [channels]);

  // Кэшируем тёмный фон и сетку монитора в offscreen canvas один раз при смене размера
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    let bg = bgCanvasRef.current;
    if (!bg) {
      bg = document.createElement('canvas');
      bgCanvasRef.current = bg;
    }
    bg.width = Math.round(size.width * dpr);
    bg.height = Math.round(size.height * dpr);

    const bctx = bg.getContext('2d');
    if (!bctx) return;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bctx.fillStyle = '#07110d';
    bctx.fillRect(0, 0, size.width, size.height);

    bctx.strokeStyle = 'rgba(34, 197, 94, 0.11)';
    bctx.lineWidth = 1;
    bctx.beginPath();
    for (let gx = 0; gx < size.width; gx += 26) {
      bctx.moveTo(gx, 0);
      bctx.lineTo(gx, size.height);
    }
    for (let gy = 0; gy < size.height; gy += 26) {
      bctx.moveTo(0, gy);
      bctx.lineTo(size.width, gy);
    }
    bctx.stroke();

    // Обновляем буфер при изменении ширины или числа каналов
    if (simRef.current.width !== size.width || simRef.current.channels !== channels) {
      simRef.current = {
        width: size.width,
        channels,
        buffers: Array.from({ length: channels }, () => new Float32Array(size.width)),
        initialized: new Uint8Array(size.width),
        sweepX: 0,
        simTime: 0,
      };
    }
  }, [size, channels]);

  // Актуальные параметры симуляции без перезапуска анимации
  const stateRef = useRef({
    leadProfiles,
    stageMods,
    heartRate,
    options,
    paused,
  });
  stateRef.current = {
    leadProfiles,
    stageMods,
    heartRate,
    options,
    paused,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(size.width * dpr);
    const targetH = Math.round(size.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const activeLeads: LeadId[] =
      channels === 1
        ? [selectedLead]
        : [selectedLead, selectedLead === 'II' ? 'V1' : 'II', selectedLead === 'V5' ? 'V3' : 'V5'];

    const pxPerSec = 105;
    const rowHeight = size.height / activeLeads.length;
    const pxPerMv = channels === 1 ? 30 : 18;
    const gapWidth = 22;

    let lastTimestamp = performance.now();
    let rafId = 0;

    const renderOnce = (advance: boolean, dt: number) => {
      const sim = simRef.current;
      const cur = stateRef.current;

      if (advance && !cur.paused && sim.width === size.width) {
        const effHr = getEffectiveHeartRate(cur.heartRate, cur.options.aivr);
        const beatDuration = 60 / effHr;
        const dx = Math.max(1, Math.round(dt * pxPerSec));

        for (let step = 0; step < dx; step++) {
          sim.simTime += 1 / pxPerSec;
          const xIdx = sim.sweepX % size.width;
          sim.initialized[xIdx] = 1;

          for (let chIdx = 0; chIdx < activeLeads.length; chIdx++) {
            const lid = activeLeads[chIdx];
            let mv = sampleEcgAtTimeMv(
              sim.simTime,
              beatDuration,
              lid,
              cur.leadProfiles[lid],
              cur.stageMods,
              cur.options
            );
            if (cur.options.artifacts) {
              mv +=
                0.025 * Math.sin(sim.simTime * 2.1 + chIdx) +
                0.01 * Math.sin(sim.simTime * 47);
            }
            sim.buffers[chIdx][xIdx] = mv;
          }

          sim.sweepX = (sim.sweepX + 1) % size.width;
        }
      }

      // Быстрая подложка из кэша сетки
      if (bgCanvasRef.current) {
        ctx.drawImage(bgCanvasRef.current, 0, 0, size.width, size.height);
      } else {
        ctx.fillStyle = '#07110d';
        ctx.fillRect(0, 0, size.width, size.height);
      }

      for (let chIdx = 0; chIdx < activeLeads.length; chIdx++) {
        const lid = activeLeads[chIdx];
        const baseY = rowHeight * (chIdx + 0.56);
        const buf = sim.buffers[chIdx];
        if (!buf) continue;

        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText(lid, 8, rowHeight * chIdx + 16);

        // Двухпроходное свечение через Path2D (вместо тормозящего shadowBlur)
        const path = new Path2D();
        let drawing = false;
        for (let x = 0; x < size.width; x++) {
          const distAhead = (x - sim.sweepX + size.width) % size.width;
          const inGap = distAhead < gapWidth;
          if (!sim.initialized[x] || inGap) {
            drawing = false;
            continue;
          }
          const y = baseY - buf[x] * pxPerMv;
          if (!drawing) {
            path.moveTo(x, y);
            drawing = true;
          } else {
            path.lineTo(x, y);
          }
        }

        ctx.strokeStyle = 'rgba(34, 255, 102, 0.22)';
        ctx.lineWidth = 4.5;
        ctx.stroke(path);

        ctx.strokeStyle = '#22ff66';
        ctx.lineWidth = 1.8;
        ctx.stroke(path);

        const headX = (sim.sweepX - 1 + size.width) % size.width;
        if (sim.initialized[headX]) {
          const headY = baseY - buf[headX] * pxPerMv;
          ctx.fillStyle = '#d9ffe6';
          ctx.beginPath();
          ctx.arc(headX, headY, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    if (paused || !isVisible) {
      // На паузе или вне экрана: рисуем актуальный кадр 1 раз и не крутим rAF
      renderOnce(false, 0);
      return;
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
      lastTimestamp = now;
      renderOnce(true, dt);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [size, channels, selectedLead, paused, isVisible]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <span
              className={`h-2 w-2 rounded-full ${
                paused ? 'bg-amber-500' : 'animate-pulse bg-emerald-500'
              }`}
            />
            Монитор реального времени
          </span>

          <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setChannels(1)}
              className={`rounded px-2 py-0.5 font-semibold ${
                channels === 1 ? 'bg-red-700 text-white' : 'text-slate-600'
              }`}
            >
              1 канал
            </button>
            <button
              type="button"
              onClick={() => setChannels(3)}
              className={`rounded px-2 py-0.5 font-semibold ${
                channels === 3 ? 'bg-red-700 text-white' : 'text-slate-600'
              }`}
            >
              3 канала
            </button>
          </div>

          <select
            value={selectedLead}
            onChange={(e) => setSelectedLead(e.target.value as LeadId)}
            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700"
          >
            {STANDARD_LEADS.map((l) => (
              <option key={l} value={l}>
                Отведение {l}
              </option>
            ))}
            <option value="V4R">Отведение V4R</option>
            <option value="V7">Отведение V7</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onChangeRhythmDisorder && (
            <select
              aria-label="Ритм и проводимость"
              value={options.aivr ? 'none' : options.rhythmDisorder ?? 'none'}
              disabled={options.aivr}
              onChange={(e) => onChangeRhythmDisorder(e.target.value as RhythmDisorder)}
              className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                !options.aivr && (options.rhythmDisorder ?? 'none') !== 'none'
                  ? 'border-amber-500 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              } disabled:opacity-50`}
            >
              <option value="none">Синусовый</option>
              <option value="av_block_1">АВ-блок I ст. (PR 248)</option>
              <option value="wenckebach">Мобитц I (Венкебах)</option>
              <option value="pvc">ЖЭС (PVC)</option>
            </select>
          )}

          {reperfused && (
            <button
              type="button"
              onClick={onToggleAivr}
              title="Ускоренный идиовентрикулярный ритм — доброкачественный маркер реперфузии"
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                options.aivr
                  ? 'border-amber-500 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              РИА (AIVR)
            </button>
          )}

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              paused
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-red-700 text-white hover:bg-red-800'
            }`}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? 'Пуск' : 'Стоп-кадр'}
          </button>

          <div className="rounded-md bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
            ЧСС {getEffectiveHeartRate(heartRate, options.aivr)}
          </div>
        </div>
      </div>

      <div ref={containerRef} className="w-full overflow-hidden rounded-b-xl bg-[#07110d]">
        <canvas
          ref={canvasRef}
          style={{ width: size.width, height: size.height }}
          className="block"
        />
      </div>
    </div>
  );
};

export const LiveMonitor = React.memo(LiveMonitorComponent);
