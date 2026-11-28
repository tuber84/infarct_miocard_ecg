import type { ClinicalCaseScenario, SourceReference } from './types';

const references: SourceReference[] = [
  { guidelineId: 'ru-stemi-2024', sections: ['§2.4'], scope: 'Регистрация дополнительных отведений при подозрении на поражение задней стенки ЛЖ.' },
  { guidelineId: 'ru-nste-2024', sections: ['Приложение А3'], scope: 'Зеркальная депрессия ST в V1–V3 и прямые признаки в V7–V9.' },
];

const ecg = {
  kind: 'ecg', profileId: 'posterior', dominance: 'right', timeline: 0.32,
  reperfused: false, heartRate: 73,
} as const;

export const POSTERIOR_CLINICAL_CASE: ClinicalCaseScenario = {
  schemaVersion: 1, revision: 1, kind: 'clinical-case', id: 'clinical:chest-pain-002',
  title: 'Дежурство №2 · Первая ЭКГ',
  learningObjectives: [
    'Распознать зеркальные изменения в стандартных отведениях.',
    'Выбрать дополнительные отведения и оценить прямые изменения.',
    'Найти место обрыва контраста, меняя проекцию С-дуги.',
  ],
  references,
  review: {
    status: 'draft',
    note: 'Синтетический случай. Признаки ЭКГ сверены с КР РФ 2024. Пациент, анатомия и результат КАГ заданы авторами и ожидают независимой врачебной рецензии.',
  },
  patient: {
    ageYears: 58, sex: 'female', symptomOnsetMinutesAgo: 65,
    bloodPressure: { systolic: 128, diastolic: 78 }, heartRate: 73,
    complaint: 'Давящая боль за грудиной и тошнота сохраняются 65 минут.',
    history: 'Артериальная гипертензия. ЭКГ записана при продолжающейся боли в приёмном отделении центра с круглосуточным ЧКВ.',
  },
  steps: [
    {
      ...ecg, id: 'initial-ecg', title: 'Первичная ЭКГ', markLeads: true,
      question: {
        id: 'posterior-pattern',
        prompt: 'Какая гипотеза лучше всего объясняет изменения на первой ЭКГ?',
        choices: [
          { id: 'diffuse', text: 'Распространённая субэндокардиальная ишемия' },
          { id: 'posterior', text: 'Острое поражение задней стенки ЛЖ' },
          { id: 'inferior', text: 'Острый нижний инфаркт с подъёмом ST в II, III, aVF' },
          { id: 'normal', text: 'ЭКГ без ишемических изменений' },
        ],
        acceptedChoiceIds: ['posterior'], references,
        explanation: 'Горизонтальная депрессия ST наиболее заметна в V1–V3. Высокий R в V1–V2 дополняет картину. При сохраняющейся боли эта комбинация заставляет искать прямые признаки поражения задней стенки ЛЖ.',
      },
    },
    {
      kind: 'information', id: 'choose-leads', title: 'Выбор дополнительной записи',
      text: 'Боль сохраняется. Дополнительную запись выполняют параллельно с организацией КАГ.',
      question: {
        id: 'posterior-leads', prompt: 'Какую запись заказать для проверки рабочей гипотезы?',
        choices: [
          { id: 'right', text: 'V3R–V4R' },
          { id: 'repeat', text: 'Только повтор II, III и aVF' },
          { id: 'posterior', text: 'V7–V9' },
        ],
        acceptedChoiceIds: ['posterior'], references,
        explanation: 'V7–V9 регистрируют у заднебоковой поверхности грудной клетки и ищут прямой подъём ST.',
      },
    },
    {
      ...ecg, id: 'additional-ecg', title: 'ЭКГ с дополнительными отведениями',
      showExtraLeads: true, extraLeads: ['V7', 'V8', 'V9'],
      question: {
        id: 'posterior-confirmation', prompt: 'Как изменилась рабочая гипотеза после дополнительной записи?',
        choices: [
          { id: 'supports', text: 'Подъём ST в V7–V9 поддерживает поражение задней стенки ЛЖ' },
          { id: 'rules-out', text: 'В задних отведениях есть только депрессия ST' },
          { id: 'identifies-artery', text: 'Подъём ST в V7–V9 устанавливает конкретный сегмент окклюзии' },
        ],
        acceptedChoiceIds: ['supports'], references,
        explanation: 'В V7–V9 появился прямой подъём ST. В учебном сигнале он превышает 0,5 мм при усилении 10 мм/мВ. Место и бассейн окклюзии уточняют по КАГ.',
      },
    },
    {
      kind: 'angiography', id: 'c-arm', title: 'Коронарография', profileId: 'posterior',
      dominance: 'right', targets: ['rca_prox', 'pda', 'posterior'],
      question: {
        id: 'culprit', prompt: 'В какой точке обрывается заполнение контрастом?',
        choices: [
          { id: 'rca_prox', text: 'Точка 1' },
          { id: 'pda', text: 'Точка 2' },
          { id: 'posterior', text: 'Точка 3' },
        ],
        acceptedChoiceIds: ['posterior'], references,
        explanation: 'Контраст проходит по ПКА (RCA) и заполняет ЗМЖВ (PDA). Обрыв виден у начала заднебоковой ветви ПКА (ЗБВ / PLB). Если ветви перекрываются, оцените их в дополнительной проекции.',
      },
    },
  ],
  debrief: {
    diagnosis: 'Острый задний инфаркт миокарда',
    explanation: 'В V1–V3 видны зеркальные изменения, а V7–V9 показывают прямой подъём ST. На КАГ в этом случае открыт просвет ЗМЖВ (PDA) и моделируется проксимальная окклюзия ЗБВ (PLB) правой коронарной артерии. Совместите эти признаки с сохранённой проекцией С-дуги.',
    references,
  },
};
