import React from 'react';
import { CArmAngles, formatCArmAngles } from '../utils/cArmMath';

interface CArmDiagramProps {
  angles: CArmAngles;
  dark?: boolean;
  compact?: boolean;
}

const CArmDiagramComponent: React.FC<CArmDiagramProps> = ({
  angles,
  dark = false,
  compact = false,
}) => {
  const formatted = formatCArmAngles(angles);
  // Для аксиальной схемы ограничиваем визуальный поворот в пределах ±175°, чтобы не дёргалось
  const axialRot = angles.laoDeg;
  // Для сагиттальной схемы: Голова слева, Ноги справа -> CRA (+cranDeg) поворачивает детектор влево (-cranDeg)
  const sagRot = -angles.cranDeg;

  const textMain = dark ? 'text-slate-100' : 'text-slate-800';
  const textMuted = dark ? 'text-slate-400' : 'text-slate-500';
  const bodyStroke = dark ? '#64748b' : '#94a3b8';
  const bodyFill = dark ? '#1e293b' : '#e2e8f0';
  const cArmStroke = dark ? '#94a3b8' : '#475569';
  const detectorFill = '#38bdf8';
  const tubeFill = '#f59e0b';

  return (
    <div
      className={`select-none rounded-lg border p-2 ${
        dark
          ? 'border-slate-600/80 bg-slate-900/95 text-slate-100 shadow-lg'
          : 'border-slate-200 bg-white/95 text-slate-800 shadow-sm'
      } ${compact ? 'w-[228px]' : 'w-[252px]'}`}
    >
      <div className="mb-1 flex items-center justify-between gap-1 text-[10px]">
        <span className={`font-bold uppercase tracking-wider ${textMuted}`}>
          С-дуга (ЭОП)
        </span>
        <span className={`font-mono font-bold ${dark ? 'text-sky-300' : 'text-red-700'}`}>
          {formatted.full}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {/* Вид 1: Аксиальный (LAO / RAO) */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 100 92" className="h-[78px] w-full">
            {/* Координатные линии */}
            <line
              x1="50"
              y1="6"
              x2="50"
              y2="86"
              stroke={dark ? '#334155' : '#e2e8f0'}
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <line
              x1="8"
              y1="46"
              x2="92"
              y2="46"
              stroke={dark ? '#334155' : '#e2e8f0'}
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />

            {/* Стол ангиографа */}
            <rect x="24" y="55" width="52" height="4" rx="1.5" fill={bodyStroke} />

            {/* Овал грудной клетки пациента (вид со стороны ног: П слева, Л справа) */}
            <ellipse
              cx="50"
              cy="46"
              rx="20"
              ry="10"
              fill={bodyFill}
              stroke={bodyStroke}
              strokeWidth="1.2"
            />
            {/* Сердце (слегка смещено влево пациента = +X вправо на рисунке) */}
            <circle cx="53" cy="45" r="3" fill="#ef4444" />

            {/* Подписи сторон пациента */}
            <text x="6" y="49" fontSize="8" fontWeight="700" fill={dark ? '#fbbf24' : '#b45309'}>
              П
            </text>
            <text
              x="94"
              y="49"
              textAnchor="end"
              fontSize="8"
              fontWeight="700"
              fill={dark ? '#38bdf8' : '#0369a1'}
            >
              Л
            </text>

            {/* Вращающаяся С-дуга */}
            <g transform={`rotate(${axialRot} 50 46)`}>
              {/* Конус рентгеновского пучка от трубки к детектору */}
              <polygon
                points="46,74 54,74 60,18 40,18"
                fill="rgba(56, 189, 248, 0.16)"
              />
              {/* С-арка (полукруглая рама сбоку) */}
              <path
                d="M 50 16 A 30 30 0 0 1 50 76"
                fill="none"
                stroke={cArmStroke}
                strokeWidth="2.4"
              />
              {/* Плоскопанельный детектор (сверху) */}
              <rect
                x="39"
                y="12"
                width="22"
                height="6"
                rx="1.5"
                fill={detectorFill}
                stroke="#0284c7"
                strokeWidth="0.8"
              />
              {/* Рентген-трубка (снизу) */}
              <rect
                x="44"
                y="73"
                width="12"
                height="7"
                rx="1.5"
                fill={tubeFill}
                stroke="#b45309"
                strokeWidth="0.8"
              />
            </g>
          </svg>
          <span className={`text-[9.5px] font-semibold ${textMain}`}>
            {formatted.horiz}
          </span>
          <span className={`text-[8.5px] ${textMuted}`}>Вид с ног (LAO/RAO)</span>
        </div>

        {/* Вид 2: Сагиттальный (CRA / CAU) */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 100 92" className="h-[78px] w-full">
            <line
              x1="50"
              y1="6"
              x2="50"
              y2="86"
              stroke={dark ? '#334155' : '#e2e8f0'}
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <line
              x1="8"
              y1="46"
              x2="92"
              y2="46"
              stroke={dark ? '#334155' : '#e2e8f0'}
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />

            {/* Стол */}
            <rect x="14" y="54" width="72" height="4" rx="1.5" fill={bodyStroke} />

            {/* Профиль пациента: голова слева, туловище/ноги справа */}
            <circle
              cx="23"
              cy="46"
              r="5.5"
              fill={bodyFill}
              stroke={bodyStroke}
              strokeWidth="1.2"
            />
            <rect
              x="30"
              y="40"
              width="48"
              height="12"
              rx="5"
              fill={bodyFill}
              stroke={bodyStroke}
              strokeWidth="1.2"
            />
            {/* Сердце */}
            <circle cx="48" cy="46" r="3" fill="#ef4444" />

            <text x="6" y="37" fontSize="7.5" fontWeight="700" fill={dark ? '#93c5fd' : '#1d4ed8'}>
              Гол.
            </text>
            <text
              x="94"
              y="37"
              textAnchor="end"
              fontSize="7.5"
              fontWeight="700"
              fill={dark ? '#fda4af' : '#be123c'}
            >
              Ноги
            </text>

            {/* Наклоняющаяся С-дуга */}
            <g transform={`rotate(${sagRot} 50 46)`}>
              <polygon
                points="46,74 54,74 60,18 40,18"
                fill="rgba(56, 189, 248, 0.16)"
              />
              <path
                d="M 50 16 A 30 30 0 0 0 50 76"
                fill="none"
                stroke={cArmStroke}
                strokeWidth="2.4"
              />
              <rect
                x="39"
                y="12"
                width="22"
                height="6"
                rx="1.5"
                fill={detectorFill}
                stroke="#0284c7"
                strokeWidth="0.8"
              />
              <rect
                x="44"
                y="73"
                width="12"
                height="7"
                rx="1.5"
                fill={tubeFill}
                stroke="#b45309"
                strokeWidth="0.8"
              />
            </g>
          </svg>
          <span className={`text-[9.5px] font-semibold ${textMain}`}>
            {formatted.vert === '0°' ? '0° (без наклона)' : formatted.vert}
          </span>
          <span className={`text-[8.5px] ${textMuted}`}>Сбоку (CRA/CAU)</span>
        </div>
      </div>

      {/* Легенда детектор / трубка */}
      <div className={`mt-1 flex items-center justify-center gap-3 border-t pt-1 text-[9px] ${dark ? 'border-slate-700/80' : 'border-slate-100'} ${textMuted}`}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-sky-400" />
          Детектор (ЭОП)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2.5 rounded-sm bg-amber-500" />
          Трубка
        </span>
      </div>
    </div>
  );
};

export const CArmDiagram = React.memo(CArmDiagramComponent);
