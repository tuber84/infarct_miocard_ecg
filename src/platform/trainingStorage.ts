import { restoreAttempt, type TrainingAttempt } from '../core/scenarios/training';
import type { ClinicalCaseScenario } from '../core/scenarios/types';
import { FIRST_CLINICAL_CASE } from '../core/scenarios/firstCase';

const KEY = 'cardioatlas.training.v1';
const ACTIVE_CASE_KEY = 'cardioatlas.training.active-case.v1';
const attemptKey = (scenarioId: string) => scenarioId === FIRST_CLINICAL_CASE.id ? KEY : `${KEY}.${scenarioId}`;
export interface AttemptStore { attempts: TrainingAttempt[]; error: string | null }

export function loadAttempts(scenario: ClinicalCaseScenario): AttemptStore {
  try {
    const text = localStorage.getItem(attemptKey(scenario.id));
    if (!text) return { attempts: [], error: null };
    const raw = JSON.parse(text);
    if (raw.version !== 1 || !Array.isArray(raw.attempts)) throw new Error();
    const attempts = raw.attempts.map((a: unknown) => restoreAttempt(scenario, a));
    if (attempts.some((a: TrainingAttempt | null) => !a)) throw new Error();
    return { attempts, error: null };
  } catch {
    return { attempts: [], error: 'Сохранённые попытки недоступны или несовместимы с этой редакцией. Исходная запись сохранена; текущая попытка будет доступна только до закрытия приложения.' };
  }
}

export function saveAttempts(attempts: TrainingAttempt[], scenarioId = FIRST_CLINICAL_CASE.id): string | null {
  try {
    localStorage.setItem(attemptKey(scenarioId), JSON.stringify({ version: 1, attempts }));
    return null;
  } catch {
    return 'Не удалось сохранить попытку на устройстве. Текущий результат остаётся доступен до закрытия приложения.';
  }
}

export function loadTrainingCaseId(): string | null {
  try { return localStorage.getItem(ACTIVE_CASE_KEY); } catch { return null; }
}

export function saveTrainingCaseId(id: string): void {
  try { localStorage.setItem(ACTIVE_CASE_KEY, id); } catch { /* Выбор остаётся доступен в текущем сеансе. */ }
}
