import { restoreAttempt, type TrainingAttempt } from '../core/scenarios/training';
import type { ClinicalCaseScenario } from '../core/scenarios/types';

const KEY = 'cardioatlas.training.v1';
export interface AttemptStore { attempts: TrainingAttempt[]; error: string | null }

export function loadAttempts(scenario: ClinicalCaseScenario): AttemptStore {
  try {
    const text = localStorage.getItem(KEY);
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

export function saveAttempts(attempts: TrainingAttempt[]): string | null {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, attempts }));
    return null;
  } catch {
    return 'Не удалось сохранить попытку на устройстве. Текущий результат остаётся доступен до закрытия приложения.';
  }
}
