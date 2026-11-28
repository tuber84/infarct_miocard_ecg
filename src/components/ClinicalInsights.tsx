import React from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Stethoscope,
} from 'lucide-react';
import { CaseId, ClinicalInsightsData } from '../core/types';
import { getClinicalGuidance, RUSSIAN_ECG_CRITERIA, RUSSIAN_GUIDELINES } from '../core/content/clinicalGuidelines';

interface ClinicalInsightsProps {
  caseId: CaseId;
  manualMode: boolean;
  arteryName: string;
  segmentLabel: string;
  territoryName: string;
  insights: ClinicalInsightsData;
}

const ClinicalInsightsComponent: React.FC<ClinicalInsightsProps> = ({
  caseId,
  manualMode,
  arteryName,
  segmentLabel,
  territoryName,
  insights,
}) => {
  const guidance = getClinicalGuidance(caseId);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
            {manualMode ? 'Разбор похожего учебного сценария' : 'Клинический разбор и тактика'}
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {arteryName} — <span className="font-semibold text-slate-700 dark:text-slate-300">{segmentLabel}</span>
          </h3>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Зона: {territoryName}
        </span>
      </div>

      <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
        <p className="font-semibold text-slate-900 dark:text-slate-100">Основа: клинические рекомендации РФ, 2024</p>
        <p className="mt-1">{guidance.context}</p>
        <p className="mt-1">{guidance.timing}</p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          <a href={guidance.source.url} target="_blank" rel="noreferrer" className="underline hover:text-slate-800 dark:hover:text-slate-200">{guidance.source.title}</a>
          {' · '}{guidance.sections}
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200">Пороговые критерии ЭКГ и дополнительные отведения</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {RUSSIAN_ECG_CRITERIA.map((criterion) => <li key={criterion}>{criterion}</li>)}
          </ul>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            <a href={RUSSIAN_GUIDELINES.stemi.url} target="_blank" rel="noreferrer" className="underline hover:text-slate-800 dark:hover:text-slate-200">ИМпST: §1.1, §2.4, §3.5</a>
            {' · '}
            <a href={RUSSIAN_GUIDELINES.nste.url} target="_blank" rel="noreferrer" className="underline hover:text-slate-800 dark:hover:text-slate-200">ОКСбпST: §2.4, приложение А3</a>
          </p>
        </details>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 1. Ключевые критерии ЭКГ */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
            <CheckCircle2 className="h-4 w-4 text-red-600 dark:text-red-400" />
            Ключевые критерии ЭКГ
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {insights.ecgCriteria.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Рентгеноперационная: риски и тактика */}
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900/60 dark:bg-red-950/30">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-900 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            Рентгеноперационная (Cath Lab)
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
            {insights.cathLabRisks.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 dark:bg-red-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Реципрокные изменения и доп. отведения */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-blue-900 dark:text-blue-300">
            <ArrowLeftRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Реципрокность и доп. отведения
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {insights.reciprocalAndExtra.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 dark:bg-blue-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Дифференциальный диагноз */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
            <Stethoscope className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            Дифференциальный диагноз (мимики)
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {insights.mimics.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export const ClinicalInsights = React.memo(ClinicalInsightsComponent);
