import { useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { EXTRA_LEADS, STANDARD_LEADS } from '../core/content/coronaryCases';
import { getJShiftMm } from '../core/ecg/ecgEngine';
import { LeadId } from '../core/types';
import { drawEcgComparison, EcgRecording, EcgSnapshot } from '../utils/ecgPaperRender';

interface EcgStComparisonProps {
  before: EcgSnapshot;
  after: EcgRecording;
  lead: LeadId;
  onChangeLead: (lead: LeadId) => void;
  onReset: () => void;
  sameScenario: boolean;
  speedMmSec: 25 | 50;
  gainMmMv: 10 | 5;
}

const formatMm = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export default function EcgStComparison({
  before, after, lead, onChangeLead, onReset, sameScenario, speedMmSec, gainMmMv,
}: EcgStComparisonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    drawEcgComparison(canvas, lead, before, after, speedMmSec, gainMmMv, dpr);
  }, [lead, before, after, speedMmSec, gainMmMv]);

  const beforeJ = getJShiftMm(before.leadProfiles[lead], before.stageMods);
  const afterJ = getJShiftMm(after.leadProfiles[lead], after.stageMods);
  const reduction = sameScenario && beforeJ >= 1
    ? Math.round((1 - Math.max(0, afterJ) / beforeJ) * 100)
    : 0;
  const toPaperMm = (standardMm: number) => {
    const mm = standardMm * gainMmMv / 10;
    return formatMm.format(Math.abs(mm) < 0.05 ? 0 : mm);
  };

  return (
    <section aria-label="Сравнение ЭКГ «Было / Стало»" className="border-b border-sky-200 bg-sky-50/70 px-3 py-2 text-xs dark:border-sky-900/60 dark:bg-sky-950/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sky-900 dark:text-sky-200">
            {sameScenario ? 'Было / Стало' : 'Сравнение двух сценариев'}
          </p>
          <p className="text-slate-600 dark:text-slate-300">Было · {before.label}</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
            Отведение
            <select
              value={lead}
              onChange={(event) => onChangeLead(event.target.value as LeadId)}
              className="rounded border border-sky-300 bg-white px-2 py-1 dark:border-sky-700 dark:bg-slate-800"
            >
              <optgroup label="Стандартные">
                {STANDARD_LEADS.map(id => <option key={id}>{id}</option>)}
              </optgroup>
              <optgroup label="Дополнительные">
                {EXTRA_LEADS.map(id => <option key={id}>{id}</option>)}
              </optgroup>
            </select>
          </label>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 rounded border border-sky-300 bg-white px-2 py-1 font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-slate-800 dark:text-sky-200 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3 w-3" />
            Сбросить «Было»
          </button>
        </div>
      </div>
      <figure className="mt-2 max-w-md">
        <div className="no-print">
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-sky-600 dark:border-sky-400" />Было</span>
            <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-slate-800 dark:border-slate-200" />Стало</span>
            <span className="ml-auto">{speedMmSec} мм/с · {gainMmMv} мм/мВ</span>
          </div>
          <canvas ref={canvasRef} role="img" aria-label={`Наложение записей в отведении ${lead}`} className="block h-auto w-full rounded border border-sky-200 dark:border-sky-800" />
        </div>
        <figcaption className="mt-1 font-semibold tabular-nums text-slate-800 dark:text-slate-100" aria-live="polite">
          {lead} · ST в точке J · {toPaperMm(beforeJ)} → {toPaperMm(afterJ)} мм
          {reduction > 0 && <span className="block text-sky-800 dark:text-sky-200">Снижение подъёма ST на {reduction}%</span>}
        </figcaption>
      </figure>
    </section>
  );
}
