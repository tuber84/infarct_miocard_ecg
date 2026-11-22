import React from 'react';
import { Activity, Clock, HeartPulse } from 'lucide-react';
import {
  DE_WINTER_STAGE_SUMMARIES,
  getNearestStagePreset,
  NSTEMI_STAGE_SUMMARIES,
  STAGE_PRESETS,
} from '../core/ecg/ecgEngine';
import { CaseId, LesionType, SyndromeCategory } from '../core/types';

interface TimelineBarProps {
  caseId: CaseId;
  timeline: number;
  onChangeTimeline: (val: number) => void;
  reperfused: boolean;
  onToggleReperfused: () => void;
  isPathological: boolean;
  category: SyndromeCategory;
  lesionType: LesionType;
}

const TimelineBarComponent: React.FC<TimelineBarProps> = ({
  caseId,
  timeline,
  onChangeTimeline,
  reperfused,
  onToggleReperfused,
  isPathological,
  category,
  lesionType,
}) => {
  const nearest = getNearestStagePreset(timeline);
  const stageSource =
    caseId === 'de_winter'
      ? DE_WINTER_STAGE_SUMMARIES[nearest.id]
      : category === 'nstemi' && lesionType !== 'occlusion'
        ? NSTEMI_STAGE_SUMMARIES[nearest.id]
        : nearest;
  const stageText = reperfused
    ? stageSource.reperfusionSummary
    : stageSource.summary;

  const pciButtonLabel = reperfused
    ? 'После ранней успешной реперфузии · TIMI 3'
    : 'Сравнить с ранней успешной реперфузией';

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Clock className="h-3.5 w-3.5 text-red-700" />
            Условные этапы ЭКГ:
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {STAGE_PRESETS.map((stage) => {
              const isActive = stage.id === nearest.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  disabled={!isPathological}
                  onClick={() => onChangeTimeline(stage.timelineValue)}
                  className={`rounded-lg px-2.5 py-1 text-left transition ${
                    !isPathological
                      ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                      : isActive
                        ? 'bg-red-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <div className="text-[11px] font-bold leading-tight">{stage.label}</div>
                  <div
                    className={`text-[9.5px] leading-tight ${
                      isActive && isPathological ? 'text-red-100' : 'text-slate-500'
                    }`}
                  >
                    {stage.timeRange}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Тумблер ЧКВ / Реперфузия */}
        <button
          type="button"
          disabled={!isPathological}
          onClick={onToggleReperfused}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
            !isPathological
              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
              : reperfused
                ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                : 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
          }`}
        >
          {reperfused ? (
            <HeartPulse className="h-4 w-4 animate-pulse" />
          ) : (
            <Activity className="h-4 w-4" />
          )}
          <span>{pciButtonLabel}</span>
        </button>
      </div>

      {/* Плавный слайдер времени */}
      <div className="mt-2.5 flex items-center gap-3">
        <span className="text-[11px] font-semibold text-slate-500">0 мин</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          disabled={!isPathological}
          value={timeline}
          onChange={(e) => onChangeTimeline(parseFloat(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <span className="text-[11px] font-semibold text-slate-500">&gt;1 мес</span>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Сравнение учебных историй: переключатель показывает течение после ранней успешной реперфузии.
        Он не означает выполнение ЧКВ в выбранный поздний момент. Сроки этапов ориентировочные;
        по одной ЭКГ нельзя точно определить давность и объём некроза.
      </p>

      {/* Клиническое пояснение фазы */}
      <p className="mt-1.5 text-xs text-slate-600">
        {!isPathological ? (
          'Выберите патологический сценарий (ИМпST или ИМбпST) на 3D-сердце или в списке, чтобы изучить эволюцию ЭКГ и эффект ЧКВ.'
        ) : (
          <>
            <span className="font-bold text-slate-800">
              {nearest.label} ({nearest.timeRange}):
            </span>{' '}
            {stageText}
          </>
        )}
      </p>
    </div>
  );
};

export const TimelineBar = React.memo(TimelineBarComponent);
