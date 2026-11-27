import { CASE_ORDER, CORONARY_CASES } from '../content/coronaryCases';
import { getClinicalGuidance, RUSSIAN_GUIDELINES } from '../content/clinicalGuidelines';
import type { CaseId } from '../types';
import type { AtlasScenario, GuidelineId } from './types';

export const GUIDELINE_SOURCES = {
  'ru-stemi-2024': { ...RUSSIAN_GUIDELINES.stemi, editionYear: 2024, publicationYear: 2025 },
  'ru-nste-2024': { ...RUSSIAN_GUIDELINES.nste, editionYear: 2024, publicationYear: 2025 },
} satisfies Record<GuidelineId, { title: string; url: string; editionYear: number; publicationYear: number }>;

/** Профили сигнала хранятся один раз; сценарий ссылается на них по стабильному id. */
export const ATLAS_SCENARIOS: AtlasScenario[] = CASE_ORDER.map((profileId) => {
  const profile = CORONARY_CASES[profileId];
  const guidance = getClinicalGuidance(profileId);
  const guidelineId: GuidelineId =
    profile.category === 'stemi' || profile.category === 'mimic' ? 'ru-stemi-2024' : 'ru-nste-2024';
  return {
    schemaVersion: 1,
    id: `atlas:${profileId}`,
    revision: 1,
    kind: 'atlas',
    profileId,
    title: profile.shortTitle,
    learningObjectives: ['Описать изменения ЭКГ и сопоставить их с условиями учебного примера.'],
    assumptions: [guidance.context, 'Динамика и анатомия заданы учебной моделью.'],
    references: [{ guidelineId, sections: [guidance.sections], scope: 'Критерии и клинический контекст; количественная морфология генератора не валидирована этим источником.' }],
    review: {
      status: 'partially-reviewed',
      note: 'Сопоставление с российскими КР выполнено в медицинском аудите; верификация всей морфологии и анатомических признаков не завершена.',
    },
  };
});

export function getAtlasScenario(profileId: CaseId): AtlasScenario {
  const scenario = ATLAS_SCENARIOS.find((item) => item.profileId === profileId);
  if (!scenario) throw new Error(`Не найден сценарий атласа: ${profileId}`);
  return scenario;
}
