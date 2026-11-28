import React from 'react';
import { FrontalVectorAnalysis } from '../core/ecg/ecgEngine';

interface CabreraCircleProps {
  analysis: FrontalVectorAnalysis;
  isDark?: boolean;
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = toRad(deg);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildSectorPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const p1 = polar(cx, cy, r, startDeg);
  const p2 = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`;
}

function renderArrow(
  cx: number,
  cy: number,
  angleDeg: number,
  length: number,
  color: string,
  strokeWidth: number
) {
  const tip = polar(cx, cy, length, angleDeg);
  const baseLeft = polar(tip.x, tip.y, 7, angleDeg + 152);
  const baseRight = polar(tip.x, tip.y, 7, angleDeg - 152);
  const shaftEnd = polar(cx, cy, Math.max(4, length - 4), angleDeg);
  return (
    <g>
      <line
        x1={cx}
        y1={cy}
        x2={shaftEnd.x}
        y2={shaftEnd.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <polygon
        points={`${tip.x.toFixed(1)},${tip.y.toFixed(1)} ${baseLeft.x.toFixed(1)},${baseLeft.y.toFixed(1)} ${baseRight.x.toFixed(1)},${baseRight.y.toFixed(1)}`}
        fill={color}
      />
    </g>
  );
}

const CABRERA_DISPLAY_AXES: {
  label: string;
  angleDeg: number;
  getVal: (st: FrontalVectorAnalysis['cabreraStMm']) => number;
}[] = [
  { label: 'aVL', angleDeg: -30, getVal: (st) => st.aVL },
  { label: 'I', angleDeg: 0, getVal: (st) => st.I },
  { label: '−aVR', angleDeg: 30, getVal: (st) => -st.aVR },
  { label: 'II', angleDeg: 60, getVal: (st) => st.II },
  { label: 'aVF', angleDeg: 90, getVal: (st) => st.aVF },
  { label: 'III', angleDeg: 120, getVal: (st) => st.III },
  { label: 'aVR', angleDeg: -150, getVal: (st) => st.aVR },
];

const formatDeg = (deg: number) => (deg > 0 ? `+${deg}°` : `${deg}°`);

const CabreraCircleComponent: React.FC<CabreraCircleProps> = ({ analysis, isDark = false }) => {
  const cx = 120;
  const cy = 108;
  const r = 64;
  const stArrowLen = Math.min(r - 4, Math.max(24, 18 + analysis.stMagnitudeMm * 14));

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Круг Кабрера (фронтальная плоскость)
        </span>
        <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">ЭОС и вектор ST</span>
      </div>

      <svg viewBox="0 0 240 216" className="mx-auto w-full max-w-[248px] select-none">
        {/* Зелёный сектор нормальной ЭОС (-30° .. +90°) */}
        <path
          d={buildSectorPath(cx, cy, r, -30, 90)}
          fill={isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)'}
        />

        {/* Окружность */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark ? '#475569' : '#cbd5e1'} strokeWidth="1.2" />
        <circle
          cx={cx}
          cy={cy}
          r={r * 0.5}
          fill="none"
          stroke={isDark ? '#334155' : '#e2e8f0'}
          strokeWidth="0.8"
          strokeDasharray="2 2"
        />

        {/* Проекционные оси */}
        {[0, 30, 60, 90, 120, -30].map((deg) => {
          const pPos = polar(cx, cy, r, deg);
          const pNeg = polar(cx, cy, r, deg + 180);
          return (
            <line
              key={deg}
              x1={pNeg.x}
              y1={pNeg.y}
              x2={pPos.x}
              y2={pPos.y}
              stroke={isDark ? '#334155' : '#cbd5e1'}
              strokeWidth="0.9"
              strokeDasharray="3 2"
            />
          );
        })}

        {/* Метки осей с подсветкой ST↑ / ST↓ */}
        {CABRERA_DISPLAY_AXES.map((ax) => {
          const pos = polar(cx, cy, r + 18, ax.angleDeg);
          const val = ax.getVal(analysis.cabreraStMm);
          const isSte = val >= 0.45;
          const isStd = val <= -0.45;
          const bgFill = isDark
            ? isSte
              ? '#450a0a'
              : isStd
                ? '#172554'
                : 'transparent'
            : isSte
              ? '#fee2e2'
              : isStd
                ? '#dbeafe'
                : 'transparent';
          const borderStroke = isDark
            ? isSte
              ? '#ef4444'
              : isStd
                ? '#3b82f6'
                : 'none'
            : isSte
              ? '#dc2626'
              : isStd
                ? '#2563eb'
                : 'none';
          const textFill = isDark
            ? isSte
              ? '#fca5a5'
              : isStd
                ? '#93c5fd'
                : '#cbd5e1'
            : isSte
              ? '#991b1b'
              : isStd
                ? '#1e40af'
                : '#475569';

          return (
            <g key={ax.label}>
              {(isSte || isStd) && (
                <rect
                  x={pos.x - 16}
                  y={pos.y - 8}
                  width="32"
                  height="16"
                  rx="4"
                  fill={bgFill}
                  stroke={borderStroke}
                  strokeWidth="1"
                />
              )}
              <text
                x={pos.x}
                y={pos.y + 3.5}
                textAnchor="middle"
                fontSize="10"
                fontWeight={isSte || isStd ? '700' : '600'}
                fill={textFill}
              >
                {ax.label}
              </text>
            </g>
          );
        })}

        {/* Вектор ЭОС (QRS) */}
        {renderArrow(cx, cy, analysis.qrsAxisDeg, r - 12, isDark ? '#10b981' : '#059669', 2.2)}

        {/* Вектор повреждения ST */}
        {analysis.stAxisDeg !== null &&
          renderArrow(cx, cy, analysis.stAxisDeg, stArrowLen, isDark ? '#ef4444' : '#dc2626', 2.6)}

        <circle cx={cx} cy={cy} r="3" fill={isDark ? '#e2e8f0' : '#0f172a'} />
      </svg>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-1.5 text-[11px] dark:border-slate-800">
        <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-500" />
          <span>
            ЭОС: <strong className="font-mono">{formatDeg(analysis.qrsAxisDeg)}</strong> ({analysis.qrsAxisLabel})
          </span>
        </span>
        <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600 dark:bg-red-500" />
          <span>
            Вектор ST:{' '}
            {analysis.stAxisDeg !== null ? (
              <strong className="font-mono text-red-700 dark:text-red-400">
                {formatDeg(analysis.stAxisDeg)} ({analysis.stMagnitudeMm.toFixed(1)} мм)
              </strong>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">ST на изолинии</span>
            )}
          </span>
        </span>
      </div>
    </div>
  );
};

export const CabreraCircle = React.memo(CabreraCircleComponent);
