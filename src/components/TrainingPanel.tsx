import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { FIRST_CLINICAL_CASE } from '../core/scenarios/firstCase';
import { POSTERIOR_CLINICAL_CASE } from '../core/scenarios/posteriorCase';
import { createAttempt, answerQuestion, advanceAttempt, getTrainingView, type TrainingAttempt } from '../core/scenarios/training';
import { GUIDELINE_SOURCES } from '../core/scenarios/catalog';
import type { ClinicalCaseScenario, ClinicalStep, SourceReference, TrainingAngiographyView } from '../core/scenarios/types';
import type { CaseId, StandardLeadId } from '../core/types';
import { resolveCaseForDominance } from '../core/content/coronaryCases';
import { computeStageModifiers } from '../core/ecg/ecgEngine';
import { loadAttempts, loadTrainingCaseId, saveAttempts, saveTrainingCaseId } from '../platform/trainingStorage';
import { EcgPaper } from './EcgPaper';

function References({ items }: { items: SourceReference[] }) {
  return <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">{items.map((ref, i) => <li key={i}>
    <a className="underline hover:text-slate-900 dark:hover:text-slate-200" href={GUIDELINE_SOURCES[ref.guidelineId].url} target="_blank" rel="noreferrer">{GUIDELINE_SOURCES[ref.guidelineId].title}</a>
    {' · '}{ref.sections.join(', ')}. {ref.scope}
  </li>)}</ul>;
}

const buttonClass = 'min-h-[44px] rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40';
const noop = () => {};
const cases = [FIRST_CLINICAL_CASE, POSTERIOR_CLINICAL_CASE];
const Heart3D = lazy(() => import('./Heart3D').then(module => ({ default: module.Heart3D })));
const loadingAngiography = <p role="status" className="p-4 text-sm">Загрузка С-дуги…</p>;
const ageForms = new Intl.PluralRules('ru');
const ageUnits = { one: 'год', few: 'года', many: 'лет', other: 'лет', zero: 'лет', two: 'года' };
const basinLabels = { LCA: 'ЛКА', RCA: 'ПКА', BOTH: 'ЛКА и ПКА' };

function describeAngiography(view: TrainingAngiographyView): string {
  const horizontal = view.laoDeg ? `${view.laoDeg > 0 ? 'LAO' : 'RAO'} ${Math.abs(view.laoDeg)}°` : 'AP 0°';
  const vertical = view.cranDeg > 0 ? ` · CRA ${view.cranDeg}°` : view.cranDeg < 0 ? ` · CAU ${-view.cranDeg}°` : '';
  return `${basinLabels[view.system]} · ${horizontal}${vertical}`;
}

function TrainingEcg({ step, leadMarking }: {
  step: Extract<ClinicalStep, { kind: 'ecg' }>;
  leadMarking?: { marked: readonly StandardLeadId[]; onToggle?: (lead: StandardLeadId) => void };
}) {
  const ecg = useMemo(() => resolveCaseForDominance(step.profileId, step.dominance), [step.profileId, step.dominance]);
  const stageMods = useMemo(() => computeStageModifiers(step.timeline, step.reperfused), [step.timeline, step.reperfused]);
  const options = useMemo(() => ({ aivr: false, artifacts: false, qrsPattern: ecg.caseData.qrsPattern }), [ecg]);
  return <EcgPaper lockedClinicalSettings activeCaseId={step.profileId} leadProfiles={ecg.leads} stageMods={stageMods}
    heartRate={step.heartRate} onChangeHeartRate={noop} options={options} onToggleArtifacts={noop}
    showExtraRow={step.showExtraLeads ?? false} extraLeads={step.extraLeads} onToggleExtraRow={noop} leadMarking={leadMarking} />;
}

export type TrainingSubPanel = 'patient' | 'data' | 'answer';

interface TrainingPanelProps {
  onOpenAtlas: (id: CaseId) => void;
  panel?: TrainingSubPanel;
  onPanelChange?: (next: TrainingSubPanel, historyMode: 'push' | 'replace') => void;
  isDark?: boolean;
}

export function TrainingPanel(props: TrainingPanelProps) {
  const [scenario, setScenario] = useState(() => {
    const id = loadTrainingCaseId();
    return cases.find(item => item.id === id) ?? FIRST_CLINICAL_CASE;
  });
  return <TrainingCase key={scenario.id} {...props} scenario={scenario} onSelectScenario={next => {
    saveTrainingCaseId(next.id);
    setScenario(next);
    props.onPanelChange?.('patient', 'replace');
  }} />;
}

function TrainingCase({ onOpenAtlas, panel: controlledPanel, onPanelChange, isDark, scenario, onSelectScenario }: TrainingPanelProps & {
  scenario: ClinicalCaseScenario;
  onSelectScenario: (scenario: ClinicalCaseScenario) => void;
}) {
  const [initial] = useState(() => loadAttempts(scenario));
  const [attempts, setAttempts] = useState(initial.attempts);
  const [storageError, setStorageError] = useState(initial.error);
  const [selection, setSelection] = useState('');
  const [markedLeads, setMarkedLeads] = useState<StandardLeadId[]>([]);
  const [angiography, setAngiography] = useState<TrainingAngiographyView>();
  const recordAngiography = useCallback((view: TrainingAngiographyView | undefined) => {
    setAngiography(view);
    setSelection('');
  }, []);
  const [reviewAngiographyOpen, setReviewAngiographyOpen] = useState(false);
  const [localPanel, setLocalPanel] = useState<TrainingSubPanel>('patient');
  const panel = controlledPanel ?? localPanel;
  const setPanel = (next: TrainingSubPanel, historyMode: 'push' | 'replace' = 'push') => {
    if (onPanelChange) onPanelChange(next, historyMode);
    else setLocalPanel(next);
  };
  const panelNavRef = useRef<HTMLElement>(null);
  const showPanel = (next: TrainingSubPanel, historyMode: 'push' | 'replace' = 'push') => {
    setPanel(next, historyMode);
    panelNavRef.current?.scrollIntoView({ block: 'start' });
  };
  const [actionError, setActionError] = useState<string | null>(null);
  const attempt = attempts[attempts.length - 1];
  const view = attempt ? getTrainingView(scenario, attempt) : null;
  const persist = (next: TrainingAttempt[]) => {
    setAttempts(next);
    if (!initial.error) setStorageError(saveAttempts(next, scenario.id));
  };
  const commit = (next: TrainingAttempt) => {
    persist([...attempts.slice(0, -1), next]);
    if (next.stepIndex !== attempt?.stepIndex) {
      setMarkedLeads([]);
      setAngiography(undefined);
      showPanel('data', 'replace');
    }
    setSelection('');
    setActionError(null);
  };
  const run = (fn: () => void) => { try { fn(); } catch (e) { setActionError(e instanceof Error ? e.message : 'Не удалось выполнить действие.'); } };
  const start = () => {
    persist([...attempts, createAttempt(scenario, Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join(''), new Date().toISOString())].slice(-20));
    setSelection(''); setMarkedLeads([]); setAngiography(undefined);
    setReviewAngiographyOpen(false);
    setActionError(null); setPanel('patient', 'replace');
  };
  const patient = scenario.patient;
  const step = view?.step;
  const markingRequired = step?.kind === 'ecg' && step.markLeads;
  const angioStep = step?.kind === 'angiography' ? step : null;
  const recordedView = view?.evidence?.angiography ?? angiography;
  const canAnswer = !!selection && (!markingRequired || markedLeads.length > 0) && (!angioStep || !!recordedView);
  const submit = () => {
    if (!attempt || !canAnswer) return;
    const evidence = angioStep ? { angiography: recordedView } : markingRequired ? { markedLeads } : undefined;
    run(() => commit(answerQuestion(scenario, attempt, selection, new Date().toISOString(), evidence)));
  };

  return <main className="mx-auto max-w-[1400px] space-y-5 p-4 pb-12 text-slate-900 dark:text-slate-100">
    <nav aria-label="Клинические случаи" className="flex flex-wrap gap-2">
      {cases.map(item => <button key={item.id} type="button" aria-pressed={scenario.id === item.id}
        onClick={() => onSelectScenario(item)}
        className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold ${scenario.id === item.id
          ? 'border-red-700 bg-red-700 text-white'
          : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{item.title}</button>)}
    </nav>
    <header>
      <p className="text-sm font-semibold text-red-700 dark:text-red-400">Клинический тренажёр · КР РФ, 2024</p>
      <h1 className="mt-1 text-2xl font-bold">{scenario.title}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Синтетический учебный случай.</p>
    </header>
    {storageError ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">{storageError}</p>
      : <p role="status" className="text-xs text-slate-500 dark:text-slate-400">{attempt ? 'Попытка сохранена на этом устройстве.' : 'Ответы и этап прохождения сохраняются на этом устройстве.'}</p>}
    {actionError && <p role="alert" className="text-red-700 dark:text-red-400">{actionError}</p>}

    {!attempt && <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-bold">От клинической ситуации к решению</h2>
      <p className="my-3 text-sm text-slate-600 dark:text-slate-300">{scenario === POSTERIOR_CLINICAL_CASE
        ? 'Изучите первую ЭКГ, выберите дополнительные отведения и найдите место обрыва контраста на С-дуге.'
        : 'Три вопроса, затем результаты исследований и разбор. Калипер, скорость и усиление доступны на экране ЭКГ.'} После фиксации ответ изменить нельзя.</p>
      <button className={buttonClass} onClick={start}>Начать случай</button>
    </section>}

    {attempt && !view?.completed && <>
      <nav ref={panelNavRef} aria-label="Разделы учебного этапа" className="sticky top-0 z-20 grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm md:hidden dark:border-slate-800 dark:bg-slate-900">
        {([['patient', 'Условия'], ['data', step?.kind === 'ecg' ? 'ЭКГ' : angioStep ? 'КАГ' : 'Данные'], ['answer', 'Ответ']] as const).map(([id, label]) =>
          <button key={id} aria-pressed={panel === id} className={`min-h-[44px] rounded-lg px-2 py-2 text-sm font-semibold ${panel === id ? 'bg-red-700 text-white' : 'text-slate-700 dark:text-slate-300'}`} onClick={() => showPanel(id)}>{label}</button>)}
      </nav>
      <section className={`${panel === 'patient' ? 'block' : 'hidden'} rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:block dark:border-slate-800 dark:bg-slate-900`}>
        <h2 className="font-bold">{patient.sex === 'female' ? 'Пациентка' : 'Пациент'} · {patient.ageYears} {ageUnits[ageForms.select(patient.ageYears)]}</h2>
        <p className="mt-2">{patient.complaint}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{patient.history}</p>
        <p className="mt-3 font-semibold">АД {patient.bloodPressure?.systolic}/{patient.bloodPressure?.diastolic} мм рт. ст. · ЧСС {patient.heartRate}/мин</p>
        <button className={`${buttonClass} mt-4 md:hidden`} onClick={() => showPanel('data')}>К данным этапа</button>
      </section>
      <section className="space-y-4" aria-label="Текущий этап">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{step?.title}</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">Этап {attempt.stepIndex + 1} из {scenario.steps.length}</span>
        </div>
        <div className={`${panel === 'data' ? 'block' : 'hidden'} min-w-0 space-y-4 md:block`}>
        {step && 'text' in step && <p className="rounded-xl border border-slate-200 bg-white p-5 leading-relaxed dark:border-slate-800 dark:bg-slate-900">{step.text}</p>}
        {markingRequired && <p className="text-sm">Отметьте на ленте отведения, которые привлекли ваше внимание.</p>}
        {step?.kind === 'ecg' && <TrainingEcg key={step.id} step={step}
          leadMarking={markingRequired ? { marked: view?.evidence?.markedLeads ?? markedLeads,
            onToggle: view?.feedback ? undefined : lead => setMarkedLeads(previous =>
              previous.includes(lead) ? previous.filter(id => id !== lead) : [...previous, lead]) } : undefined} />}
        {angioStep && <Suspense fallback={loadingAngiography}>
          {!view?.feedback && <p className="text-sm">Выберите проекцию и бассейн, нажмите «Болюс», затем укажите место обрыва контраста.</p>}
          <Heart3D key={attempt.id} activeCaseId={angioStep.profileId} dominance={angioStep.dominance} timeline={0} reperfused={false}
            isDark={isDark} onSelectCase={id => setSelection(id)}
            exercise={{ targets: angioStep.targets, selected: (view?.selectedChoiceId ?? selection) as CaseId,
              revealed: !!view?.feedback, recordedView, onAcquire: view?.feedback ? undefined : recordAngiography }} />
        </Suspense>}
        {view?.question && <button className={`${buttonClass} md:hidden`} onClick={() => showPanel('answer')}>К ответу</button>}
        </div>
        {view?.question && <section className={`${panel === 'answer' ? 'block' : 'hidden'} rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:block dark:border-slate-800 dark:bg-slate-900`}>
          <fieldset disabled={!!view.feedback || (!!angioStep && !recordedView)}>
            <legend className="mb-3 text-lg font-bold">{view.question.prompt}</legend>
            <div className="space-y-2">{view.question.choices.map(choice => <label key={choice.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-red-700 has-[:checked]:bg-red-50 dark:border-slate-700 dark:hover:border-slate-600 dark:has-[:checked]:border-red-500 dark:has-[:checked]:bg-red-950/35">
              <input className="mt-1" type="radio" name={view.question!.id} value={choice.id} checked={(view.selectedChoiceId ?? selection) === choice.id} onChange={() => setSelection(choice.id)} />
              <span>{choice.text}</span>
            </label>)}</div>
          </fieldset>
          {markingRequired && <p className="mt-3 text-sm">Отмеченные отведения · {(view.evidence?.markedLeads ?? markedLeads).join(', ') || 'Выберите на ленте'}</p>}
          {!view.feedback && <button className={`${buttonClass} mt-4`} disabled={!canAnswer} onClick={submit}>Зафиксировать ответ</button>}
          {view.feedback && <div role="status" className={`mt-4 rounded-lg p-4 ${view.feedback.correct ? 'bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-100' : 'bg-amber-50 dark:bg-amber-950/40 dark:text-amber-100'}`}>
            <p className="font-bold">{view.feedback.correct ? 'Ответ верный' : 'Ответ требует пересмотра'}</p>
            <p className="mt-2 leading-relaxed">{view.feedback.explanation}</p>
            <References items={view.feedback.references} />
          </div>}
        </section>}
        {step?.kind === 'result' && <div className={`${panel === 'data' ? 'block' : 'hidden'} md:block`}><References items={step.references} /></div>}
        {!view?.question && panel === 'answer' && <p className="text-sm text-slate-600 md:hidden dark:text-slate-400">На этом этапе вопроса нет. Изучите данные и продолжайте.</p>}
        <div className={`${panel === 'answer' || (!view?.question && panel === 'data') ? 'block' : 'hidden'} md:block`}>
        <button className={buttonClass} disabled={!view?.canAdvance} onClick={() => run(() => commit(advanceAttempt(scenario, attempt, new Date().toISOString())))}>
          {attempt.stepIndex === scenario.steps.length - 1 ? 'Завершить и открыть разбор' : 'Далее'}
        </button>
        </div>
      </section>
    </>}

    {view?.completed && view.debrief && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="font-semibold text-red-700 dark:text-red-400">Случай завершён · Верно {view.score} из {view.totalQuestions}</p>
      <h2 className="text-2xl font-bold">{view.debrief.diagnosis}</h2>
      <p className="leading-relaxed text-slate-700 dark:text-slate-300">{view.debrief.explanation}</p>
      <References items={view.debrief.references} />
      <h3 className="text-lg font-bold">Ваши решения</h3>
      {view.results.map(result => <article key={result.questionId} className={`rounded-lg border p-4 ${result.correct ? 'border-emerald-200 dark:border-emerald-800/70 dark:bg-emerald-950/20' : 'border-amber-300 dark:border-amber-800/70 dark:bg-amber-950/20'}`}>
        <p className="font-semibold">{result.correct ? 'Верно' : 'Повторить'} · {result.prompt}</p>
        <p className="mt-1 text-sm">Ваш ответ: {result.choice}</p>
        {result.evidence?.markedLeads && <p className="mt-1 text-sm">Отмеченные отведения · {result.evidence.markedLeads.join(', ')}</p>}
        {result.evidence?.angiography && <p className="mt-1 text-sm">Проекция контрастирования · {describeAngiography(result.evidence.angiography)}</p>}
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{result.explanation}</p>
      </article>)}
      <p className="text-xs text-slate-500 dark:text-slate-400">{scenario.review.note}</p>
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass} onClick={start}>Пройти ещё раз</button>
        <button className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => {
          const firstEcg = scenario.steps.find(item => item.kind === 'ecg');
          if (firstEcg) onOpenAtlas(firstEcg.profileId);
        }}>Изучить анатомию в атласе</button>
      </div>
      {view.reviewSteps.map(item => {
        const result = view.results.find(answer => answer.questionId === item.question?.id);
        if (item.kind === 'ecg') return <details key={item.id} className="min-w-0">
          <summary className="mb-2 cursor-pointer font-semibold">{item.title}</summary>
          <TrainingEcg step={item} leadMarking={result?.evidence?.markedLeads ? { marked: result.evidence.markedLeads } : undefined} />
        </details>;
        if (item.kind === 'angiography') return <details key={item.id} className="min-w-0" onToggle={event => setReviewAngiographyOpen(event.currentTarget.open)}>
          <summary className="mb-2 cursor-pointer font-semibold">КАГ · выбранная проекция</summary>
          {reviewAngiographyOpen && <Suspense fallback={loadingAngiography}>
            <Heart3D activeCaseId={item.profileId} dominance={item.dominance} timeline={0} reperfused={false} isDark={isDark} onSelectCase={noop}
              exercise={{ targets: item.targets, selected: item.targets.find(id => id === result?.choiceId),
                revealed: true, recordedView: result?.evidence?.angiography }} />
          </Suspense>}
        </details>;
        return null;
      })}
    </section>}

    {attempts.some(a => a.completedAt) && <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-bold">Завершённые попытки</h2>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Хранятся последние 20 попыток на этом устройстве, включая текущую.</p>
      <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">{attempts.filter(a => a.completedAt).slice().reverse().map(a => {
        const result = getTrainingView(scenario, a);
        return <li key={a.id}>{new Date(a.completedAt!).toLocaleString('ru-RU')} · Верно {result.score} из {result.totalQuestions}</li>;
      })}</ul>
    </section>}
  </main>;
}
