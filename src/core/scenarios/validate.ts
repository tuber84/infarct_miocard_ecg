import { CORONARY_CASES } from '../content/coronaryCases';
import { GUIDELINE_SOURCES } from './catalog';
import type { ClinicalScenario, SourceReference } from './types';

/** Проверка связности авторских типизированных данных; не парсер произвольного JSON. */
export function validateScenario(scenario: ClinicalScenario): string[] {
  const errors: string[] = [];
  const check = (ok: boolean, message: string) => { if (!ok) errors.push(message); };
  const refs = (items: SourceReference[], context: string) => {
    check(items.length > 0, `${context}: отсутствуют источники`);
    for (const ref of items) {
      check(ref.guidelineId in GUIDELINE_SOURCES, `${context}: неизвестный источник`);
      check(ref.sections.some(s => s.trim().length > 0) && !!ref.scope.trim(), `${context}: не указан раздел или область подтверждения`);
    }
  };
  check(scenario.schemaVersion === 1, 'Неизвестная версия схемы');
  check(!!scenario.id.trim() && !!scenario.title.trim(), 'Отсутствует идентификатор или заголовок');
  check(Number.isInteger(scenario.revision) && scenario.revision > 0, 'Некорректная редакция');
  check(scenario.learningObjectives.some(s => !!s.trim()), 'Отсутствуют учебные цели');
  refs(scenario.references, 'Сценарий');
  if (scenario.kind === 'atlas') {
    check(scenario.profileId in CORONARY_CASES, 'Неизвестный профиль ЭКГ');
    check(scenario.assumptions.some(s => !!s.trim()), 'Не указаны условия примера');
    return errors;
  }
  check(scenario.steps.length > 0, 'Отсутствуют этапы');
  check(Number.isFinite(scenario.patient.ageYears) && scenario.patient.ageYears >= 0, 'Некорректный возраст');
  check(Number.isFinite(scenario.patient.heartRate) && scenario.patient.heartRate > 0, 'Некорректная ЧСС пациента');
  check(!!scenario.patient.complaint.trim(), 'Отсутствуют жалобы');
  const stepIds = new Set<string>();
  const questionIds = new Set<string>();
  for (const step of scenario.steps) {
    check(!!step.id.trim() && !stepIds.has(step.id), 'Пустой или повторный идентификатор этапа');
    stepIds.add(step.id);
    if (step.kind === 'ecg') {
      check(step.profileId in CORONARY_CASES, 'Неизвестный профиль ЭКГ');
      check(Number.isFinite(step.timeline) && step.timeline >= 0 && step.timeline <= 1, 'Этап ЭКГ вне диапазона');
      check(Number.isFinite(step.heartRate) && step.heartRate >= 40 && step.heartRate <= 150, 'ЧСС ЭКГ вне диапазона генератора');
    }
    if (step.kind === 'result') refs(step.references, step.id);
    if (step.question) {
      const q = step.question;
      check(!!q.id.trim() && !questionIds.has(q.id), 'Пустой или повторный идентификатор вопроса');
      questionIds.add(q.id);
      const ids = new Set(q.choices.map(c => c.id));
      check(q.choices.length >= 2 && ids.size === q.choices.length && q.choices.every(c => !!c.id.trim() && !!c.text.trim()), 'Некорректные варианты ответа');
      check(q.acceptedChoiceIds.length > 0 && q.acceptedChoiceIds.every(id => ids.has(id)), 'Ответ ссылается на отсутствующий вариант');
      check(!!q.prompt.trim() && !!q.explanation.trim(), 'Отсутствует вопрос или объяснение');
      refs(q.references, q.id);
    }
  }
  refs(scenario.debrief.references, 'Разбор');
  check(!!scenario.debrief.diagnosis.trim() && !!scenario.debrief.explanation.trim(), 'Разбор не заполнен');
  return errors;
}
