import React, { useState } from 'react';
import { AHA_SEGMENT_NAMES } from '../core/content/coronaryCases';
import { CaseId, Dominance, LesionType } from '../core/types';

interface AhaBullseyeProps {
  ahaSegments: number[];
  rvInvolved: boolean;
  reciprocalSegments?: number[];
  dominance: Dominance;
  reperfused: boolean;
  timeline: number;
  activeCaseId: CaseId;
  lesionType?: LesionType;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeRingSector(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number
): string {
  const p1 = polarToCartesian(cx, cy, rOuter, startDeg);
  const p2 = polarToCartesian(cx, cy, rOuter, endDeg);
  const p3 = polarToCartesian(cx, cy, rInner, endDeg);
  const p4 = polarToCartesian(cx, cy, rInner, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

interface SegmentGeom {
  id: number;
  rIn: number;
  rOut: number;
  startDeg: number;
  endDeg: number;
}

// Стандартная AHA-схема: 0° = 3 часа (боковая), -90° = 12 часов (передняя), +90° = 6 часов (нижняя), 180° = 9 часов (перегородка)
const BULLSEYE_SECTORS: SegmentGeom[] = [
  // Базальное кольцо (1–6)
  { id: 1, rIn: 70, rOut: 98, startDeg: -120, endDeg: -60 },
  { id: 6, rIn: 70, rOut: 98, startDeg: -60, endDeg: 0 },
  { id: 5, rIn: 70, rOut: 98, startDeg: 0, endDeg: 60 },
  { id: 4, rIn: 70, rOut: 98, startDeg: 60, endDeg: 120 },
  { id: 3, rIn: 70, rOut: 98, startDeg: 120, endDeg: 180 },
  { id: 2, rIn: 70, rOut: 98, startDeg: 180, endDeg: 240 },
  // Среднее кольцо (7–12)
  { id: 7, rIn: 43, rOut: 70, startDeg: -120, endDeg: -60 },
  { id: 12, rIn: 43, rOut: 70, startDeg: -60, endDeg: 0 },
  { id: 11, rIn: 43, rOut: 70, startDeg: 0, endDeg: 60 },
  { id: 10, rIn: 43, rOut: 70, startDeg: 60, endDeg: 120 },
  { id: 9, rIn: 43, rOut: 70, startDeg: 120, endDeg: 180 },
  { id: 8, rIn: 43, rOut: 70, startDeg: 180, endDeg: 240 },
  // Апикальное кольцо (13–16)
  { id: 13, rIn: 18, rOut: 43, startDeg: -135, endDeg: -45 },
  { id: 16, rIn: 18, rOut: 43, startDeg: -45, endDeg: 45 },
  { id: 15, rIn: 18, rOut: 43, startDeg: 45, endDeg: 135 },
  { id: 14, rIn: 18, rOut: 43, startDeg: 135, endDeg: 225 },
];

const AhaBullseyeComponent: React.FC<AhaBullseyeProps> = ({
  ahaSegments,
  rvInvolved,
  reciprocalSegments = [],
  dominance,
  reperfused,
  timeline,
  activeCaseId,
  lesionType = 'occlusion',
}) => {
  const [hoveredText, setHoveredText] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const activeText = hoveredText ?? selectedText;
  const toggleSelected = (label: string) =>
    setSelectedText((prev) => (prev === label ? null : label));

  const cx = 148;
  const cy = 112;
  const injuredSet = new Set(ahaSegments);
  const reciprocalSet = new Set(reciprocalSegments);
  const isSubendocardial = lesionType === 'subocclusion' || lesionType === 'stenosis';

  const getSegmentFill = (segId: number) => {
    if (injuredSet.has(segId)) {
      if (activeCaseId === 'lmca') {
        return reperfused && timeline >= 0.35 ? '#fcd34d' : '#f97316';
      }
      if (isSubendocardial) {
        if (reperfused && timeline >= 0.35) return '#fde68a';
        return timeline < 0.55 ? '#f59e0b' : '#fb923c';
      }
      if (reperfused && timeline >= 0.35) {
        return '#fca5a5'; // Спасённый после ЧКВ
      }
      if (timeline < 0.22) return '#fb923c'; // Острейшая
      if (timeline < 0.52) return '#dc2626'; // Острая
      if (timeline < 0.78) return '#991b1b'; // Эволюция
      return '#94a3b8'; // Рубец
    }
    if (reciprocalSet.has(segId)) {
      return '#dbeafe';
    }
    return '#f8fafc';
  };

  const getSegmentTextFill = (segId: number) => {
    if (injuredSet.has(segId)) {
      if (isSubendocardial) {
        if (reperfused && timeline >= 0.35) return '#78350f';
        return '#ffffff';
      }
      if (reperfused && timeline >= 0.35) return '#7f1d1d';
      if (timeline >= 0.78) return '#0f172a';
      return '#ffffff';
    }
    if (reciprocalSet.has(segId)) return '#1e40af';
    return '#475569';
  };

  const rvFill = rvInvolved
    ? reperfused && timeline >= 0.35
      ? '#fca5a5'
      : timeline >= 0.78
        ? '#94a3b8'
        : '#dc2626'
    : '#f1f5f9';

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Сегменты ЛЖ (AHA 17) + ПЖ
        </span>
        <span className="text-[10.5px] font-medium text-slate-500">
          {dominance === 'right' ? 'Правый тип' : 'Левый тип'}
        </span>
      </div>

      <svg viewBox="0 0 264 224" className="mx-auto w-full max-w-[270px] select-none">
        {/* Серп правого желудочка (ПЖ) */}
        <path
          d="M 52 38 C 12 65, 12 159, 52 186 C 36 150, 36 74, 52 38 Z"
          fill={rvFill}
          stroke={rvInvolved ? '#991b1b' : '#cbd5e1'}
          strokeWidth="1.5"
          className="cursor-pointer transition-colors"
          onClick={() => toggleSelected('Правый желудочек (ПЖ)')}
          onMouseEnter={() => setHoveredText('Правый желудочек (ПЖ)')}
          onMouseLeave={() => setHoveredText(null)}
        />
        <text
          x="26"
          y="115"
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill={rvInvolved && !reperfused && timeline < 0.78 ? '#ffffff' : '#475569'}
          pointerEvents="none"
        >
          ПЖ
        </text>

        {/* Сектора 1–16 */}
        {BULLSEYE_SECTORS.map((sec) => {
          const midAngle = (sec.startDeg + sec.endDeg) / 2;
          const midR = (sec.rIn + sec.rOut) / 2;
          const labelPos = polarToCartesian(cx, cy, midR, midAngle);
          const isRecip = reciprocalSet.has(sec.id) && !injuredSet.has(sec.id);

          return (
            <g
              key={sec.id}
              className="cursor-pointer"
              onClick={() => toggleSelected(AHA_SEGMENT_NAMES[sec.id])}
              onMouseEnter={() => setHoveredText(AHA_SEGMENT_NAMES[sec.id])}
              onMouseLeave={() => setHoveredText(null)}
            >
              <path
                d={describeRingSector(cx, cy, sec.rIn, sec.rOut, sec.startDeg, sec.endDeg)}
                fill={getSegmentFill(sec.id)}
                stroke={isRecip ? '#2563eb' : '#cbd5e1'}
                strokeWidth={isRecip ? '1.6' : '1.1'}
                className="transition-colors"
              />
              <text
                x={labelPos.x}
                y={labelPos.y + 3.5}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill={getSegmentTextFill(sec.id)}
                pointerEvents="none"
              >
                {sec.id}
              </text>
            </g>
          );
        })}

        {/* Верхушка 17 */}
        <g
          className="cursor-pointer"
          onClick={() => toggleSelected(AHA_SEGMENT_NAMES[17])}
          onMouseEnter={() => setHoveredText(AHA_SEGMENT_NAMES[17])}
          onMouseLeave={() => setHoveredText(null)}
        >
          <circle
            cx={cx}
            cy={cy}
            r={18}
            fill={getSegmentFill(17)}
            stroke="#cbd5e1"
            strokeWidth="1.2"
            className="transition-colors"
          />
          <text
            x={cx}
            y={cy + 3.5}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill={getSegmentTextFill(17)}
            pointerEvents="none"
          >
            17
          </text>
        </g>

        {/* Пунктирные границы коронарных бассейнов (зависит от правого/левого типа) */}
        <g stroke="#334155" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.55" pointerEvents="none">
          {/* Граница ПМЖВ / ОВ (верх-право) */}
          <line x1={cx} y1={cy} x2={cx + 85} y2={cy - 49} />
          {/* Нижне-перегородочная граница ПМЖВ с ПКА (правый тип) или с доминантной ОВ (левый тип) */}
          <line x1={cx} y1={cy} x2={cx - 85} y2={cy + 49} />
          {/* Граница ПКА / ОВ рисуется только при правом типе; при левом типе вся нижняя стенка ЛЖ относится к ОВ */}
          {dominance === 'right' && (
            <line x1={cx} y1={cy} x2={cx + 49} y2={cy + 85} />
          )}
        </g>

        {/* Подписи сторон света */}
        <text x={cx} y="10" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#64748b">
          Передняя (ПМЖВ)
        </text>
        <text x={cx} y="220" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#64748b">
          Нижняя ({dominance === 'right' ? 'ПКА' : 'ОВ'})
        </text>
        <text x="255" y={cy + 3} textAnchor="end" fontSize="9" fontWeight="600" fill="#64748b">
          Бок. (ОВ)
        </text>
      </svg>

      {/* Легенда + подсказка при наведении / нажатии */}
      <div className="mt-1.5 flex min-h-[20px] items-center justify-between gap-2 border-t border-slate-100 pt-1.5 text-[10.5px]">
        {activeText ? (
          <span className="truncate font-semibold text-slate-800">{activeText}</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 text-slate-600">
            <span className="flex items-center gap-1">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-sm ${
                  isSubendocardial ? 'bg-amber-500' : 'bg-red-600'
                }`}
              />
              {isSubendocardial ? 'Субэндокард. ишемия' : 'Зона ишемии'}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-blue-600 bg-blue-100" />
              Реципрокн.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const AhaBullseye = React.memo(AhaBullseyeComponent);
