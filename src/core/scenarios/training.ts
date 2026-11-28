import { STANDARD_LEADS } from '../content/coronaryCases';
import type { ClinicalCaseScenario, ClinicalStep, TrainingAnswerEvidence } from './types';

export interface TrainingAttempt {
  formatVersion: 1;
  id: string;
  scenarioId: string;
  scenarioRevision: number;
  scenarioSchemaVersion: number;
  startedAt: string;
  updatedAt: string;
  stepIndex: number;
  answers: Record<string, { choiceId: string; answeredAt: string; evidence?: TrainingAnswerEvidence }>;
  completedAt: string | null;
}

export function createAttempt(s: ClinicalCaseScenario, id: string, now: string): TrainingAttempt {
  if (!id || !Number.isFinite(Date.parse(now))) throw new Error('Некорректные параметры новой попытки.');
  return { formatVersion: 1, id, scenarioId: s.id, scenarioRevision: s.revision, scenarioSchemaVersion: s.schemaVersion,
    startedAt: now, updatedAt: now, stepIndex: 0, answers: {}, completedAt: null };
}

function validateEvidence(step: ClinicalStep, evidence?: TrainingAnswerEvidence): boolean {
  if (step.kind === 'ecg' && step.markLeads) {
    const leads = evidence?.markedLeads;
    return Array.isArray(leads) && leads.length > 0 && !evidence?.angiography &&
      new Set(leads).size === leads.length && leads.every(lead => STANDARD_LEADS.includes(lead));
  }
  if (step.kind === 'angiography') {
    const view = evidence?.angiography;
    return !!view && !evidence?.markedLeads &&
      ['LCA', 'RCA', 'BOTH'].includes(view.system) &&
      Number.isInteger(view.laoDeg) && Math.abs(view.laoDeg) <= 180 &&
      Number.isInteger(view.cranDeg) && Math.abs(view.cranDeg) <= 90;
  }
  return evidence === undefined;
}

export function answerQuestion(s: ClinicalCaseScenario, a: TrainingAttempt, choiceId: string, now: string, evidence?: TrainingAnswerEvidence): TrainingAttempt {
  if (!restoreAttempt(s, a)) throw new Error('Попытка несовместима со сценарием.');
  const step = s.steps[a.stepIndex];
  const q = step?.question;
  if (a.completedAt || !q || a.answers[q.id] || !q.choices.some(c => c.id === choiceId)) {
    throw new Error('Этот ответ нельзя принять на текущем этапе.');
  }
  if (!validateEvidence(step, evidence)) throw new Error('Сначала отметьте отведения или выполните контрастирование.');
  return { ...a, updatedAt: now, answers: { ...a.answers, [q.id]: { choiceId, answeredAt: now, ...(evidence && { evidence }) } } };
}

export function advanceAttempt(s: ClinicalCaseScenario, a: TrainingAttempt, now: string): TrainingAttempt {
  if (!restoreAttempt(s, a)) throw new Error('Попытка несовместима со сценарием.');
  const step = s.steps[a.stepIndex];
  if (a.completedAt || !step || (step.question && !a.answers[step.question.id])) throw new Error('Сначала зафиксируйте ответ.');
  const stepIndex = a.stepIndex + 1;
  return { ...a, stepIndex, updatedAt: now, completedAt: stepIndex === s.steps.length ? now : null };
}

/** Экран получает только текущий этап и обратную связь после фиксации ответа. */
export function getTrainingView(s: ClinicalCaseScenario, a: TrainingAttempt) {
  if (!restoreAttempt(s, a)) throw new Error('Попытка несовместима со сценарием.');
  const current = s.steps[a.stepIndex];
  const { question: q, ...step } = current ?? {};
  const answer = q ? a.answers[q.id] : undefined;
  const results = s.steps.flatMap(item => {
    const question = item.question;
    if (!question || !a.answers[question.id]) return [];
    const selected = a.answers[question.id].choiceId;
    return [{ questionId: question.id, prompt: question.prompt, choiceId: selected, choice: question.choices.find(c => c.id === selected)!.text,
      correct: question.acceptedChoiceIds.includes(selected), explanation: question.explanation, references: question.references,
      evidence: a.answers[question.id].evidence }];
  });
  return {
    title: s.title, patient: s.patient, step: current ? step : null,
    question: q ? { id: q.id, prompt: q.prompt, choices: q.choices } : null,
    selectedChoiceId: answer?.choiceId,
    evidence: answer?.evidence,
    feedback: answer && q ? { correct: q.acceptedChoiceIds.includes(answer.choiceId), explanation: q.explanation, references: q.references } : null,
    canAdvance: !!current && (!q || !!answer),
    completed: !!a.completedAt,
    debrief: a.completedAt ? s.debrief : null,
    reviewSteps: a.completedAt && s.steps.some(item => item.kind === 'angiography')
      ? s.steps.filter(item => item.kind === 'ecg' || item.kind === 'angiography')
      : [],
    results: a.completedAt ? results : [],
    score: results.filter(r => r.correct).length,
    totalQuestions: s.steps.filter(item => item.question).length,
  };
}

/** Восстанавливаем только известную редакцию и допустимое последовательное состояние. */
export function restoreAttempt(s: ClinicalCaseScenario, raw: unknown): TrainingAttempt | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as TrainingAttempt;
  const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (a.formatVersion !== 1 || a.scenarioId !== s.id || a.scenarioRevision !== s.revision || a.scenarioSchemaVersion !== s.schemaVersion
    || typeof a.id !== 'string' || !a.id || !date(a.startedAt) || !date(a.updatedAt)
    || !Number.isInteger(a.stepIndex) || a.stepIndex < 0 || a.stepIndex > s.steps.length
    || !a.answers || typeof a.answers !== 'object' || Array.isArray(a.answers)) return null;
  const completed = a.stepIndex === s.steps.length;
  if (completed ? !date(a.completedAt) : a.completedAt !== null) return null;
  const allowed = new Set<string>();
  for (let i = 0; i < s.steps.length; i++) {
    const step = s.steps[i];
    const q = step.question;
    if (!q) continue;
    const answer = a.answers[q.id];
    if (i < a.stepIndex && !answer) return null;
    if (answer) {
      if (i > a.stepIndex || typeof answer !== 'object' || !q.choices.some(c => c.id === answer.choiceId) ||
        !date(answer.answeredAt) || !validateEvidence(step, answer.evidence)) return null;
      allowed.add(q.id);
    }
  }
  if (Object.keys(a.answers).some(id => !allowed.has(id))) return null;
  // Не переносим неизвестные поля и сохранённые вычисленные оценки.
  return { formatVersion: 1, id: a.id, scenarioId: s.id, scenarioRevision: s.revision, scenarioSchemaVersion: s.schemaVersion,
    startedAt: a.startedAt, updatedAt: a.updatedAt, stepIndex: a.stepIndex,
    answers: Object.fromEntries(Object.entries(a.answers).map(([id, v]) => {
      const { angiography, markedLeads } = v.evidence ?? {};
      const evidence = angiography ? { angiography: { system: angiography.system, laoDeg: angiography.laoDeg, cranDeg: angiography.cranDeg } }
        : markedLeads ? { markedLeads: [...markedLeads] } : undefined;
      return [id, { choiceId: v.choiceId, answeredAt: v.answeredAt, ...(evidence && { evidence }) }];
    })), completedAt: a.completedAt };
}
