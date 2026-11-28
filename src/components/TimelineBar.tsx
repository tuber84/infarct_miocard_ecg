import React from 'react';
import { Activity, Clock, HeartPulse } from 'lucide-react';
import {
  DE_WINTER_STAGE_SUMMARIES,
  getNearestStagePreset,
  LBBB_SGARBOSSA_STAGE_SUMMARIES,
  NSTEMI_STAGE_SUMMARIES,
  PERICARDITIS_STAGE_SUMMARIES,
  STAGE_PRESETS,
  TAKOTSUBO_STAGE_SUMMARIES,
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
  const canCompareReperfusion = isPathological && lesionType !== 'none';
  const stageSource =
    caseId === 'de_winter'
      ? DE_WINTER_STAGE_SUMMARIES[nearest.id]
      : caseId === 'pericarditis'
        ? PERICARDITIS_STAGE_SUMMARIES[nearest.id]
        : caseId === 'takotsubo'
          ? TAKOTSUBO_STAGE_SUMMARIES[nearest.id]
          : caseId === 'lbbb_sgarbossa'
            ? LBBB_SGARBOSSA_STAGE_SUMMARIES[nearest.id]
            : category === 'nstemi' && lesionType !== 'occlusion'
              ? NSTEMI_STAGE_SUMMARIES[nearest.id]
              : nearest;
  const stageText = canCompareReperfusion && reperfused
    ? stageSource.reperfusionSummary
    : stageSource.summary;

  const pciButtonLabel =
    isPathological && lesionType === 'none'
      ? 'ЧКВ не показано (КА интактны)'
      : reperfused
        ? 'После ранней успешной реперфузии · TIMI 3'
        : 'Сравнить с ранней успешной реперфузией';

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <Clock className="h-3.5 w-3.5 text-red-700 dark:text-red-400" />
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
                      ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800/70 dark:text-slate-600'
                      : isActive
                        ? 'bg-red-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-bold leading-tight">{stage.label}</div>
                  <div
                    className={`text-[9.5px] leading-tight ${
                      isActive && isPathological ? 'text-red-100' : 'text-slate-500 dark:text-slate-400'
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
          disabled={!canCompareReperfusion}
          onClick={onToggleReperfused}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
            !canCompareReperfusion
              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-600'
              : reperfused
                ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                : 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50'
          }`}
        >
          {reperfused && canCompareReperfusion ? (
            <HeartPulse className="h-4 w-4 animate-pulse" />
          ) : (
            <Activity className="h-4 w-4" />
          )}
          <span>{pciButtonLabel}</span>
        </button>
      </div>

      {/* Плавный слайдер времени */}
      <div className="mt-2.5 flex items-center gap-3">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">0 мин</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          disabled={!isPathological}
          value={timeline}
          onChange={(e) => onChangeTimeline(parseFloat(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-700"
        />
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">&gt;1 мес</span>
      </div>

      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Сравнение учебных историй: переключатель показывает течение после ранней успешной реперфузии.
        Он не означает выполнение ЧКВ в выбранный поздний момент. Сроки этапов ориентировочные;
        по одной ЭКГ нельзя точно определить давность и объём некроза.
      </p>

      {/* Клиническое пояснение фазы */}
      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
        {!isPathological ? (
          caseId === 'lbbb_benign' || caseId === 'early_repol'
            ? 'Статический ЭКГ-паттерн (без инфарктной эволюции ST–T и формирования Q). При появлении ангинозной боли сравнивают с архивной плёнкой.'
            : 'Выберите патологический сценарий (ИМпST, ИМбпST, перикардит или Такоцубо), чтобы изучить эволюцию ЭКГ во времени.'
        ) : (
          <>
            <span className="font-bold text-slate-800 dark:text-slate-100">
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
