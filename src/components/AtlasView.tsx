import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  GitBranch,
  Heart,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  CORONARY_CASES,
  resolveCaseForDominance,
} from '../core/content/coronaryCases';
import {
  buildManualFallbackLeads,
  computeStageModifiers,
} from '../core/ecg/ecgEngine';
import { localizeFromManualLeads } from '../core/ecg/localizer';
import { getAtlasScenario } from '../core/scenarios/catalog';
import {
  CaseId,
  Dominance,
  LeadId,
  LeadShiftProfile,
  ManualLeadState,
} from '../core/types';
import { AhaBullseye } from './AhaBullseye';
import { ClinicalInsights } from './ClinicalInsights';
import { EcgPaper } from './EcgPaper';
import { Heart3D } from './Heart3D';
import { LeadCardsPanel } from './LeadCardsPanel';
import { LiveMonitor } from './LiveMonitor';
import { TimelineBar } from './TimelineBar';

const STEMI_CASES: CaseId[] = [
  'lad_prox',
  'lad_mid',
  'lad_wrap',
  'd1',
  'rca_prox',
  'rca_dist',
  'pda',
  'lcx',
  'posterior',
];

const NSTEMI_CASES: CaseId[] = [
  'nstemi_antlat',
  'nstemi_inf',
  'nstemi_tinv',
  'wellens_a',
  'wellens_b',
  'de_winter',
  'lmca',
];

const CHIP_LABELS: Partial<Record<CaseId, string>> = {
  lad_prox: 'ПМЖВ прокс.',
  lad_mid: 'ПМЖВ сред.',
  lad_wrap: 'ПМЖВ дист.',
  d1: 'ДВ1 (D1)',
  rca_prox: 'ПКА прокс.',
  rca_dist: 'ПКА дист.',
  pda: 'ЗМЖВ (PDA)',
  lcx: 'ОВ / ВТК',
  posterior: 'Задний ИМ',
  nstemi_antlat: 'ИМбпST передн.',
  nstemi_inf: 'ИМбпST нижн.',
  nstemi_tinv: 'ИМбпST (T↓)',
  wellens_a: 'Велленс A',
  wellens_b: 'Велленс B',
  de_winter: 'де Винтер',
  lmca: 'Ствол ЛКА',
  normal: 'Норма',
};

export function AtlasView({ initialCaseId }: { initialCaseId: CaseId }) {
  const initialCase = CORONARY_CASES[initialCaseId];
  const [activeCaseId, setActiveCaseId] = useState<CaseId>(initialCaseId);
  const [preferredGroup, setPreferredGroup] = useState<'stemi' | 'nstemi'>(
    initialCase.category === 'nstemi' ? 'nstemi' : 'stemi'
  );
  const [dominance, setDominance] = useState<Dominance>('right');
  const [timeline, setTimeline] = useState<number>(0.35);
  const [reperfused, setReperfused] = useState<boolean>(false);

  const [manualMode, setManualMode] = useState<boolean>(false);
  const [manualStates, setManualStates] = useState<Partial<Record<LeadId, ManualLeadState>>>({});

  const [heartRate, setHeartRate] = useState<number>(initialCase.defaultHeartRate);
  const [artifacts, setArtifacts] = useState<boolean>(false);
  const [aivr, setAivr] = useState<boolean>(false);
  const [showExtraRow, setShowExtraRow] = useState<boolean>(
    initialCase.recommendedExtraLeads.length > 0
  );

  // Обратный локализатор в ручном режиме
  const localization = useMemo(
    () => localizeFromManualLeads(manualStates, dominance),
    [manualStates, dominance]
  );

  const effectiveCaseId: CaseId = manualMode
    ? localization.primaryCaseId ?? 'normal'
    : activeCaseId;
  const hasManualHypothesis = !manualMode || localization.primaryCaseId !== null;

  const resolvedCase = useMemo(
    () => resolveCaseForDominance(effectiveCaseId, dominance),
    [effectiveCaseId, dominance]
  );
  const recommendedExtraLeads = manualMode
    ? localization.recommendedExtraLeads
    : resolvedCase.caseData.recommendedExtraLeads;

  const stageMods = useMemo(
    () => computeStageModifiers(timeline, reperfused),
    [timeline, reperfused]
  );

  // Итоговый профиль отведений для ЭКГ: в ручном режиме комбинируем найденный кейс и явные клики пользователя
  const effectiveLeadProfiles: Partial<Record<LeadId, LeadShiftProfile>> = useMemo(() => {
    if (!manualMode) return resolvedCase.leads;
    const manualFallback = buildManualFallbackLeads(manualStates);
    return {
      ...resolvedCase.leads,
      ...manualFallback,
    };
  }, [manualMode, resolvedCase.leads, manualStates]);

  const handleSelectCase = useCallback((id: CaseId) => {
    setManualMode(false);
    setManualStates({});
    setActiveCaseId(id);
    const nextCase = CORONARY_CASES[id];
    if (nextCase.category === 'stemi' || nextCase.category === 'nstemi') {
      setPreferredGroup(nextCase.category);
    }
    setHeartRate(nextCase.defaultHeartRate);
    if (!nextCase.isPathological) {
      setReperfused(false);
      setAivr(false);
    }
    setShowExtraRow(nextCase.recommendedExtraLeads.length > 0);
  }, []);

  const handleToggleLeadManual = useCallback((lead: LeadId) => {
    if (!manualMode) {
      setTimeline(0.35);
      setReperfused(false);
      setAivr(false);
    }
    setManualStates((prev) => {
      const current = prev[lead] ?? 'normal';
      const nextState: ManualLeadState =
        current === 'normal'
          ? 'ste'
          : current === 'ste'
            ? 'std'
            : current === 'std'
              ? 'tinv'
              : 'normal';

      const updated: Partial<Record<LeadId, ManualLeadState>> = { ...prev };
      if (nextState === 'normal') {
        delete updated[lead];
      } else {
        updated[lead] = nextState;
      }

      const hasAny = Object.keys(updated).length > 0;
      setManualMode(hasAny);
      return updated;
    });
  }, [manualMode]);

  const handleResetManual = useCallback(() => {
    setManualMode(false);
    setManualStates({});
  }, []);

  const handleToggleReperfused = useCallback(() => {
    setReperfused((prev) => {
      const next = !prev;
      if (!next) setAivr(false);
      return next;
    });
  }, []);

  const handleToggleAivr = useCallback(() => setAivr((v) => !v), []);
  const handleToggleArtifacts = useCallback(() => setArtifacts((v) => !v), []);
  const handleToggleExtraRow = useCallback(() => setShowExtraRow((v) => !v), []);

  const ecgOptions = useMemo(() => ({ artifacts, aivr }), [artifacts, aivr]);

  // Отведение по умолчанию для монитора реального времени
  const defaultMonitorLead: LeadId = useMemo(() => {
    if (effectiveCaseId === 'rca_prox' || effectiveCaseId === 'rca_dist' || effectiveCaseId === 'pda') return 'III';
    if (effectiveCaseId === 'nstemi_inf') return 'II';
    if (effectiveCaseId === 'lcx' || effectiveCaseId === 'nstemi_antlat') return 'V5';
    if (effectiveCaseId === 'nstemi_tinv') return 'V4';
    if (
      effectiveCaseId === 'wellens_a' ||
      effectiveCaseId === 'wellens_b' ||
      effectiveCaseId === 'de_winter'
    ) {
      return 'V3';
    }
    if (effectiveCaseId === 'd1') return 'aVL';
    if (effectiveCaseId === 'lmca') return 'aVR';
    if (effectiveCaseId === 'normal') return 'II';
    return 'V2';
  }, [effectiveCaseId]);

  const isPathological = resolvedCase.caseData.isPathological;
  const activeTabGroup: 'stemi' | 'nstemi' =
    resolvedCase.caseData.category === 'nstemi'
      ? 'nstemi'
      : resolvedCase.caseData.category === 'stemi'
        ? 'stemi'
        : preferredGroup;
  const groupCases = activeTabGroup === 'nstemi' ? NSTEMI_CASES : STEMI_CASES;

  const isUrgentStemiLike =
    resolvedCase.caseData.category === 'stemi' || effectiveCaseId === 'de_winter';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Верхняя шапка */}
      <header className="z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur md:sticky md:top-0">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-700 text-white shadow-sm">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                КардиоАтлас ЭКГ ·{' '}
                <span className="text-red-700">ОКС: ИМпST / ИМбпST</span>
              </h1>
              <p className="text-[11px] text-slate-500">
                Связь «сосуд ↔ ЭКГ» · Учебная динамика · Клинические рекомендации РФ, 2024
              </p>
            </div>
          </div>

          {/* Выбор клинического сценария и типа кровоснабжения */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={manualMode ? 'custom' : activeCaseId}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== 'custom') handleSelectCase(val as CaseId);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-red-600 focus:outline-none"
            >
              {manualMode && (
                <option value="custom">Ручной подбор по отведениям</option>
              )}
              <optgroup label="ИМ с подъёмом ST (ИМпST / STEMI)">
                {STEMI_CASES.map((id) => (
                  <option key={id} value={id}>
                    {getAtlasScenario(id).title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="ОКСбпST: ИМбпST и особые ЭКГ-паттерны">
                {NSTEMI_CASES.map((id) => (
                  <option key={id} value={id}>
                    {getAtlasScenario(id).title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Без острой патологии">
                <option value="normal">{CORONARY_CASES.normal.shortTitle}</option>
              </optgroup>
            </select>

            {/* Переключатель правого/левого типа кровоснабжения */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <span className="hidden items-center gap-1 pl-2 pr-1 text-[11px] font-semibold text-slate-500 sm:flex">
                <GitBranch className="h-3 w-3" />
                Тип:
              </span>
              <button
                type="button"
                onClick={() => setDominance('right')}
                className={`rounded-md px-2 py-1 text-[11px] font-bold transition ${
                  dominance === 'right'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Правый тип
              </button>
              <button
                type="button"
                onClick={() => setDominance('left')}
                className={`rounded-md px-2 py-1 text-[11px] font-bold transition ${
                  dominance === 'left'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Левый тип
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Основной контейнер */}
      <main className="mx-auto max-w-[1600px] space-y-4 p-3 sm:p-4">
        {/* Компактная панель выбора типа ОКС (ИМпST / ИМбпST) и сценариев */}
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setPreferredGroup('stemi');
                  if (resolvedCase.caseData.category !== 'stemi' || manualMode) {
                    handleSelectCase(STEMI_CASES[0]);
                  }
                }}
                className={`rounded-md px-3 py-1 font-bold transition ${
                  activeTabGroup === 'stemi' && effectiveCaseId !== 'normal'
                    ? 'bg-red-700 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                ИМпST (STEMI)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreferredGroup('nstemi');
                  if (resolvedCase.caseData.category !== 'nstemi' || manualMode) {
                    handleSelectCase(NSTEMI_CASES[0]);
                  }
                }}
                className={`rounded-md px-3 py-1 font-bold transition ${
                  activeTabGroup === 'nstemi' && effectiveCaseId !== 'normal'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                ОКСбпST / паттерны
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {groupCases.map((id) => {
                const isSel = !manualMode && activeCaseId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectCase(id)}
                    className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition ${
                      isSel
                        ? activeTabGroup === 'nstemi'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-red-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {CHIP_LABELS[id] ?? getAtlasScenario(id).title.split('(')[0].trim()}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSelectCase('normal')}
            className={`rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition ${
              !manualMode && activeCaseId === 'normal'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Норма
          </button>
        </section>

        {/* Верхний рабочий блок: Карта отведений | 3D Сердце | Инфаркт-связанная артерия + Bullseye */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Левая панель: Отведения */}
          <div className="lg:col-span-4 xl:col-span-3">
            <LeadCardsPanel
              leadProfiles={effectiveLeadProfiles}
              stageMods={stageMods}
              manualMode={manualMode}
              manualStates={manualStates}
              recommendedExtraLeads={recommendedExtraLeads}
              onToggleLeadManual={handleToggleLeadManual}
              onResetManual={handleResetManual}
            />
          </div>

          {/* Центр: 3D-сердце */}
          <div className="min-h-[430px] lg:col-span-8 xl:col-span-5">
            {manualMode && <p className="mb-2 text-xs text-slate-600">{hasManualHypothesis ? 'Анатомия похожего учебного примера; ИСА и TIMI по разметке не подтверждены.' : 'Анатомия по текущей разметке не определена.'}</p>}
            {hasManualHypothesis ? <Heart3D
              activeCaseId={effectiveCaseId}
              onSelectCase={handleSelectCase}
              timeline={timeline}
              reperfused={reperfused}
              dominance={dominance}
            /> : <div className="flex min-h-[380px] items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Оцените полную ЭКГ и связанные изменения в отведениях. Выберите готовый сценарий сверху, чтобы изучить его анатомию.</div>}
          </div>

          {/* Правая панель: Диагноз ИСА + Бычий глаз AHA */}
          <div className="flex flex-col gap-4 lg:col-span-12 xl:col-span-4">
            {/* Карточка вероятной ИСА */}
            <div
              className={`rounded-xl border p-3.5 shadow-sm ${
                manualMode
                  ? 'border-amber-300 bg-amber-50/60'
                  : !isPathological
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : isUrgentStemiLike
                      ? 'border-red-200 bg-white'
                      : 'border-amber-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10.5px] font-bold ${
                    !isPathological
                      ? 'bg-emerald-100 text-emerald-800'
                      : isUrgentStemiLike
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {manualMode ? (hasManualHypothesis ? 'Учебная гипотеза' : 'Недостаточно данных') : resolvedCase.caseData.syndromeBadge}
                </span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${
                    !isPathological
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : isUrgentStemiLike
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {manualMode ? 'Срочность — по клинике и риску' : resolvedCase.caseData.urgencyLabel}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider ${
                      manualMode
                        ? 'text-amber-800'
                        : !isPathological
                          ? 'text-emerald-700'
                          : isUrgentStemiLike
                            ? 'text-red-700'
                            : 'text-amber-800'
                    }`}
                  >
                    {manualMode ? (
                      <>
                        <Sparkles className="h-3 w-3" />
                        Обратный локализатор по ЭКГ
                      </>
                    ) : (
                      'Инфаркт-связанная артерия (ИСА)'
                    )}
                  </span>
                  <h2 className="mt-0.5 text-base font-extrabold leading-snug text-slate-900">
                    {manualMode ? (hasManualHypothesis ? resolvedCase.caseData.shortTitle : 'Паттерн пока не определён') : resolvedCase.arteryName}
                  </h2>
                  <p
                    className={`text-xs font-semibold ${
                      !isPathological
                        ? 'text-emerald-700'
                        : isUrgentStemiLike
                          ? 'text-red-700'
                          : 'text-amber-800'
                    }`}
                  >
                    {manualMode ? 'Проверьте амплитуды, форму ST/T и динамику.' : resolvedCase.segmentLabel}
                  </p>
                </div>

              </div>

              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {manualMode ? 'Сопоставление с учебными примерами по отмеченным ST↑ / ST↓ / T↓. Цветовые отметки сами по себе не подтверждают диагностические критерии.' : resolvedCase.description}
              </p>

              {/* Обоснование локализатора и рекомендации в ручном режиме */}
              {manualMode && (
                <div className="mt-2.5 space-y-1.5 rounded-lg border border-amber-200 bg-white/80 p-2.5 text-xs">
                  {localization.reasoning.map((line, i) => (
                    <div key={i} className="text-slate-700">
                      • {line}
                    </div>
                  ))}
                  {localization.secondaryCaseId && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-600">
                      <span>
                        Сравнить со сценарием:{' '}
                        <strong>
                          {CORONARY_CASES[localization.secondaryCaseId].shortTitle}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectCase(localization.secondaryCaseId!)}
                        className="font-semibold text-red-700 hover:underline"
                      >
                        Открыть сценарий →
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    {hasManualHypothesis && <button
                      type="button"
                      onClick={() => handleSelectCase(effectiveCaseId)}
                      className="rounded bg-red-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-800"
                    >
                      Открыть полный учебный сценарий
                    </button>}
                    <button
                      type="button"
                      onClick={handleResetManual}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Сбросить выбор
                    </button>
                  </div>
                </div>
              )}

              {/* Рекомендация доп. отведений */}
              {recommendedExtraLeads.length > 0 && (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    Доснять: {recommendedExtraLeads.join(', ')}
                  </span>
                  {!showExtraRow && (
                    <button
                      type="button"
                      onClick={() => setShowExtraRow(true)}
                      className="shrink-0 font-bold text-amber-950 underline"
                    >
                      Показать на ленте
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 17 сегментов ЛЖ + ПЖ */}
            {hasManualHypothesis && <AhaBullseye
              ahaSegments={resolvedCase.ahaSegments}
              rvInvolved={resolvedCase.rvInvolved}
              reciprocalSegments={resolvedCase.reciprocalSegments}
              dominance={dominance}
              reperfused={reperfused}
              timeline={timeline}
              activeCaseId={effectiveCaseId}
              lesionType={resolvedCase.caseData.lesionType}
            />}
          </div>
        </div>

        {/* Шкала эволюции инфаркта во времени + ветка ЧКВ */}
        <TimelineBar
          caseId={effectiveCaseId}
          timeline={timeline}
          onChangeTimeline={setTimeline}
          reperfused={reperfused}
          onToggleReperfused={handleToggleReperfused}
          isPathological={isPathological}
          category={resolvedCase.caseData.category}
          lesionType={resolvedCase.caseData.lesionType}
        />

        {/* Живой кардиомонитор */}
        <LiveMonitor
          leadProfiles={effectiveLeadProfiles}
          stageMods={stageMods}
          heartRate={heartRate}
          reperfused={reperfused}
          options={ecgOptions}
          onToggleAivr={handleToggleAivr}
          defaultLead={defaultMonitorLead}
        />

        {/* 12-канальная ЭКГ-плёнка с миллиметровой бумагой и калипером */}
        <EcgPaper
          activeCaseId={effectiveCaseId}
          leadProfiles={effectiveLeadProfiles}
          stageMods={stageMods}
          heartRate={heartRate}
          onChangeHeartRate={setHeartRate}
          options={ecgOptions}
          onToggleArtifacts={handleToggleArtifacts}
          showExtraRow={showExtraRow}
          onToggleExtraRow={handleToggleExtraRow}
        />

        {/* Клинические подсказки и тактика в рентгеноперационной */}
        {hasManualHypothesis && <ClinicalInsights
          caseId={effectiveCaseId}
          manualMode={manualMode}
          arteryName={resolvedCase.arteryName}
          segmentLabel={resolvedCase.segmentLabel}
          territoryName={resolvedCase.territoryName}
          insights={resolvedCase.caseData.clinicalInsights}
        />}
      </main>
    </div>
  );
}

export default AtlasView;
