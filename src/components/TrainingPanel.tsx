import { useMemo, useRef, useState } from 'react';
import { FIRST_CLINICAL_CASE as scenario } from '../core/scenarios/firstCase';
import { createAttempt, answerQuestion, advanceAttempt, getTrainingView, type TrainingAttempt } from '../core/scenarios/training';
import { GUIDELINE_SOURCES } from '../core/scenarios/catalog';
import type { SourceReference } from '../core/scenarios/types';
import type { CaseId } from '../core/types';
import { resolveCaseForDominance } from '../core/content/coronaryCases';
import { computeStageModifiers } from '../core/ecg/ecgEngine';
import { loadAttempts, saveAttempts } from '../platform/trainingStorage';
import { EcgPaper } from './EcgPaper';

function References({ items }: { items: SourceReference[] }) {
  return <ul className="mt-3 space-y-1 text-xs text-slate-600">{items.map((ref, i) => <li key={i}>
    <a className="underline" href={GUIDELINE_SOURCES[ref.guidelineId].url} target="_blank" rel="noreferrer">{GUIDELINE_SOURCES[ref.guidelineId].title}</a>
    {' · '}{ref.sections.join(', ')}. {ref.scope}
  </li>)}</ul>;
}

const buttonClass = 'min-h-[44px] rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40';
const noop = () => {};

export type TrainingSubPanel = 'patient' | 'data' | 'answer';

interface TrainingPanelProps {
  onOpenAtlas: (id: CaseId) => void;
  panel?: TrainingSubPanel;
  onPanelChange?: (next: TrainingSubPanel, historyMode: 'push' | 'replace') => void;
}

export function TrainingPanel({ onOpenAtlas, panel: controlledPanel, onPanelChange }: TrainingPanelProps) {
  const [initial] = useState(() => loadAttempts(scenario));
  const [attempts, setAttempts] = useState(initial.attempts);
  const [storageError, setStorageError] = useState(initial.error);
  const [selection, setSelection] = useState('');
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
    if (!initial.error) setStorageError(saveAttempts(next));
  };
  const commit = (next: TrainingAttempt) => {
    persist([...attempts.slice(0, -1), next]);
    if (next.stepIndex !== attempt?.stepIndex) showPanel('data', 'replace');
    setSelection('');
    setActionError(null);
  };
  const run = (fn: () => void) => { try { fn(); } catch (e) { setActionError(e instanceof Error ? e.message : 'Не удалось выполнить действие.'); } };
  const start = () => {
    persist([...attempts, createAttempt(scenario, Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join(''), new Date().toISOString())].slice(-20));
    setSelection(''); setActionError(null); setPanel('patient', 'replace');
  };
  const patient = scenario.patient;
  const step = view?.step;
  const ecg = step?.kind === 'ecg' ? resolveCaseForDominance(step.profileId, step.dominance) : null;
  const timeline = step?.kind === 'ecg' ? step.timeline : 0;
  const reperfused = step?.kind === 'ecg' ? step.reperfused : false;
  const stageMods = useMemo(() => computeStageModifiers(timeline, reperfused), [timeline, reperfused]);

  return <main className="mx-auto max-w-[1400px] space-y-5 p-4 pb-12 text-slate-900">
    <header>
      <p className="text-sm font-semibold text-red-700">Клинический тренажёр · КР РФ, 2024</p>
      <h1 className="mt-1 text-2xl font-bold">{scenario.title}</h1>
      <p className="mt-2 text-sm text-slate-600">Синтетический учебный случай. Пациент, ЭКГ, КАГ и лабораторные значения заданы для обучения.</p>
    </header>
    {storageError ? <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{storageError}</p>
      : <p role="status" className="text-xs text-slate-500">{attempt ? 'Попытка сохранена на этом устройстве.' : 'Ответы и этап прохождения сохраняются на этом устройстве.'}</p>}
    {actionError && <p role="alert" className="text-red-700">{actionError}</p>}

    {!attempt && <section className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">От клинической ситуации к решению</h2>
      <p className="my-3 text-sm text-slate-600">Три вопроса, затем результаты исследований и разбор. После фиксации ответ изменить нельзя. Калипер, скорость и усиление доступны на экране ЭКГ.</p>
      <button className={buttonClass} onClick={start}>Начать случай</button>
    </section>}

    {attempt && !view?.completed && <>
      <nav ref={panelNavRef} aria-label="Разделы учебного этапа" className="sticky top-0 z-20 grid grid-cols-3 gap-1 rounded-xl border bg-white p-1 shadow-sm md:hidden">
        {([['patient', 'Условия'], ['data', step?.kind === 'ecg' ? 'ЭКГ' : 'Данные'], ['answer', 'Ответ']] as const).map(([id, label]) =>
          <button key={id} aria-pressed={panel === id} className={`min-h-[44px] rounded-lg px-2 py-2 text-sm font-semibold ${panel === id ? 'bg-red-700 text-white' : 'text-slate-700'}`} onClick={() => showPanel(id)}>{label}</button>)}
      </nav>
      <section className={`${panel === 'patient' ? 'block' : 'hidden'} rounded-xl border bg-white p-5 shadow-sm md:block`}>
        <h2 className="font-bold">Пациент: мужчина, {patient.ageYears} года</h2>
        <p className="mt-2">{patient.complaint}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{patient.history}</p>
        <p className="mt-3 font-semibold">АД {patient.bloodPressure?.systolic}/{patient.bloodPressure?.diastolic} мм рт. ст. · ЧСС {patient.heartRate}/мин</p>
        <button className={`${buttonClass} mt-4 md:hidden`} onClick={() => showPanel('data')}>К данным этапа</button>
      </section>
      <section className="space-y-4" aria-label="Текущий этап">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{step?.title}</h2>
          <span className="text-sm text-slate-500">Этап {attempt.stepIndex + 1} из {scenario.steps.length}</span>
        </div>
        <div className={`${panel === 'data' ? 'block' : 'hidden'} min-w-0 space-y-4 md:block`}>
        {step && 'text' in step && <p className="rounded-xl border bg-white p-5 leading-relaxed">{step.text}</p>}
        {step?.kind === 'ecg' && ecg && <EcgPaper key={step.id} lockedClinicalSettings activeCaseId={step.profileId}
          leadProfiles={ecg.leads} stageMods={stageMods} heartRate={step.heartRate}
          onChangeHeartRate={noop} options={{ aivr: false, artifacts: false }} onToggleArtifacts={noop}
          showExtraRow={step.showExtraLeads ?? false} onToggleExtraRow={noop} />}
        {view?.question && <button className={`${buttonClass} md:hidden`} onClick={() => showPanel('answer')}>К ответу</button>}
        </div>
        {view?.question && <section className={`${panel === 'answer' ? 'block' : 'hidden'} rounded-xl border bg-white p-5 shadow-sm md:block`}>
          <fieldset disabled={!!view.feedback}>
            <legend className="mb-3 text-lg font-bold">{view.question.prompt}</legend>
            <div className="space-y-2">{view.question.choices.map(choice => <label key={choice.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-red-700 has-[:checked]:bg-red-50">
              <input className="mt-1" type="radio" name={view.question!.id} value={choice.id} checked={(view.selectedChoiceId ?? selection) === choice.id} onChange={() => setSelection(choice.id)} />
              <span>{choice.text}</span>
            </label>)}</div>
          </fieldset>
          {!view.feedback && <button className={`${buttonClass} mt-4`} disabled={!selection} onClick={() => run(() => commit(answerQuestion(scenario, attempt, selection, new Date().toISOString())))}>Зафиксировать ответ</button>}
          {view.feedback && <div role="status" className={`mt-4 rounded-lg p-4 ${view.feedback.correct ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <p className="font-bold">{view.feedback.correct ? 'Ответ верный' : 'Ответ требует пересмотра'}</p>
            <p className="mt-2 leading-relaxed">{view.feedback.explanation}</p>
            <References items={view.feedback.references} />
          </div>}
        </section>}
        {step?.kind === 'result' && <div className={`${panel === 'data' ? 'block' : 'hidden'} md:block`}><References items={step.references} /></div>}
        {!view?.question && panel === 'answer' && <p className="text-sm text-slate-600 md:hidden">На этом этапе вопроса нет. Изучите данные и продолжайте.</p>}
        <div className={`${panel === 'answer' || (!view?.question && panel === 'data') ? 'block' : 'hidden'} md:block`}>
        <button className={buttonClass} disabled={!view?.canAdvance} onClick={() => run(() => commit(advanceAttempt(scenario, attempt, new Date().toISOString())))}>
          {attempt.stepIndex === scenario.steps.length - 1 ? 'Завершить и открыть разбор' : 'Далее'}
        </button>
        </div>
      </section>
    </>}

    {view?.completed && view.debrief && <section className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
      <p className="font-semibold text-red-700">Случай завершён · Верно {view.score} из {view.totalQuestions}</p>
      <h2 className="text-2xl font-bold">{view.debrief.diagnosis}</h2>
      <p className="leading-relaxed">{view.debrief.explanation}</p>
      <References items={view.debrief.references} />
      <h3 className="text-lg font-bold">Ваши решения</h3>
      {view.results.map(result => <article key={result.questionId} className={`rounded-lg border p-4 ${result.correct ? 'border-emerald-200' : 'border-amber-300'}`}>
        <p className="font-semibold">{result.correct ? 'Верно' : 'Повторить'} · {result.prompt}</p>
        <p className="mt-1 text-sm">Ваш ответ: {result.choice}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{result.explanation}</p>
      </article>)}
      <p className="text-xs text-slate-500">{scenario.review.note}</p>
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass} onClick={start}>Пройти ещё раз</button>
        <button className="rounded-lg border px-4 py-2 font-semibold" onClick={() => onOpenAtlas('rca_prox')}>Изучить анатомию в атласе</button>
      </div>
    </section>}

    {attempts.some(a => a.completedAt) && <section className="rounded-xl border bg-white p-5">
      <h2 className="font-bold">Завершённые попытки</h2>
      <p className="mb-2 text-xs text-slate-500">Хранятся последние 20 попыток на этом устройстве, включая текущую.</p>
      <ul className="space-y-2 text-sm">{attempts.filter(a => a.completedAt).slice().reverse().map(a => {
        const result = getTrainingView(scenario, a);
        return <li key={a.id}>{new Date(a.completedAt!).toLocaleString('ru-RU')} · Верно {result.score} из {result.totalQuestions}</li>;
      })}</ul>
    </section>}
  </main>;
}
