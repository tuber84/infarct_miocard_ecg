import {
  CaseId,
  CoronaryCase,
  Dominance,
  ExtraLeadId,
  LeadId,
  LeadShiftProfile,
  StandardLeadId,
} from '../types';

export const STANDARD_LEADS: StandardLeadId[] = [
  'I',
  'II',
  'III',
  'aVR',
  'aVL',
  'aVF',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
];

export const LIMB_LEADS: StandardLeadId[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
export const CHEST_LEADS: StandardLeadId[] = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
export const EXTRA_LEADS: ExtraLeadId[] = ['V3R', 'V4R', 'V7', 'V8', 'V9'];

export const LEAD_ANATOMY_LABEL: Record<LeadId, string> = {
  I: 'Высокая боковая',
  II: 'Нижняя',
  III: 'Нижняя',
  aVR: 'Полость / Базальная',
  aVL: 'Высокая боковая',
  aVF: 'Нижняя',
  V1: 'Перегородочная',
  V2: 'Перегородочная',
  V3: 'Передняя',
  V4: 'Передняя',
  V5: 'Боковая',
  V6: 'Боковая',
  V3R: 'Правая',
  V4R: 'Правый желудочек',
  V7: 'Задняя (баз.)',
  V8: 'Задняя (баз.)',
  V9: 'Задняя (баз.)',
};

export const AHA_SEGMENT_NAMES: Record<number, string> = {
  1: '1. Базальный передний',
  2: '2. Базальный передне-перегородочный',
  3: '3. Базальный нижне-перегородочный',
  4: '4. Базальный нижний',
  5: '5. Базальный нижне-боковой',
  6: '6. Базальный передне-боковой',
  7: '7. Средний передний',
  8: '8. Средний передне-перегородочный',
  9: '9. Средний нижне-перегородочный',
  10: '10. Средний нижний',
  11: '11. Средний нижне-боковой',
  12: '12. Средний передне-боковой',
  13: '13. Апикальный передний',
  14: '14. Апикальный перегородочный',
  15: '15. Апикальный нижний',
  16: '16. Апикальный боковой',
  17: '17. Верхушка ЛЖ',
};

export const CORONARY_CASES: Record<CaseId, CoronaryCase> = {
  normal: {
    id: 'normal',
    category: 'normal',
    syndromeBadge: 'Норма',
    lesionType: 'none',
    urgencyLabel: 'ЭКГ без ишемических изменений',
    shortTitle: 'Норма (без окклюзии)',
    arteryName: 'Нормальный коронарный кровоток (TIMI 3)',
    segmentLabel: 'Нормальное русло задано условиями примера',
    territoryName: 'Миокард без острой ишемии',
    isPathological: false,
    description:
      'Исходная 12-канальная ЭКГ здорового человека: нормальная ось, прогрессия зубца R с V1 по V5, изолиния сегмента ST.',
    ahaSegments: [],
    rvInvolved: false,
    reciprocalSegments: [],
    leads: {},
    defaultHeartRate: 72,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'В данном примере ST на изолинии. Оценка подъёма ST зависит от отведений, пола, возраста и клинического контекста.',
        'Последовательное нарастание зубца R от V1 к V5 с переходной зоной в V3–V4.',
        'В данном примере P, основной комплекс QRS и T в aVR отрицательные. Правильность наложения электродов проверяют по всей записи.',
      ],
      reciprocalAndExtra: [
        'Дополнительные отведения (V3R–V4R, V7–V9) не имеют подъёма или депрессии сегмента ST.',
      ],
      cathLabRisks: [
        'Нормальная первая ЭКГ не исключает ОКС. При сохраняющемся подозрении повторите запись, например, через 15–30 минут в первый час; изменение симптомов требует повторной оценки. Оцените тропонин в динамике.',
      ],
      mimics: [
        'Ранняя реполяризация желудочков (вогнутый ST с зазубриной точки J в V2–V5 у молодых).',
        'Синдром Бругада (сводчатый подъём в V1–V2 без ангинозного статуса).',
      ],
    },
  },

  lad_prox: {
    id: 'lad_prox',
    category: 'stemi',
    syndromeBadge: 'ИМпST (STEMI)',
    lesionType: 'occlusion',
    urgencyLabel: 'Немедленная реперфузионная стратегия',
    shortTitle: 'ПМЖВ прокс. (до S1 и D1)',
    arteryName: 'Передняя межжелудочковая ветвь (ПМЖВ / LAD)',
    segmentLabel: 'Проксимальная ПМЖВ (до отхождения S1 и D1)',
    territoryName: 'Обширный передний, перегородочный и высокий боковой (бассейн D1 + S1)',
    isPathological: true,
    description:
      'Тяжёлая проксимальная окклюзия ПМЖВ до первой септальной (S1) и первой диагональной (D1) ветвей. Обширная зона некроза ЛЖ с высоким риском кардиогенного шока.',
    ahaSegments: [1, 2, 6, 7, 8, 12, 13, 14, 17],
    rvInvolved: false,
    reciprocalSegments: [4, 10],
    leads: {
      V1: { stMm: 2.7, shape: 'convex', hyperacuteT: 0.9, qPotential: 0.9, rLoss: 0.8 },
      V2: { stMm: 4.5, shape: 'tombstone', hyperacuteT: 1.3, qPotential: 1.1, rLoss: 0.9 },
      V3: { stMm: 4.4, shape: 'tombstone', hyperacuteT: 1.3, qPotential: 1.1, rLoss: 0.9 },
      V4: { stMm: 3.6, shape: 'convex', hyperacuteT: 1.1, qPotential: 1.0, rLoss: 0.85 },
      V5: { stMm: 2.0, shape: 'convex', hyperacuteT: 0.7, qPotential: 0.7, rLoss: 0.55 },
      aVL: { stMm: 1.9, shape: 'convex', hyperacuteT: 0.7, qPotential: 0.75, rLoss: 0.5 },
      I: { stMm: 1.2, shape: 'convex', hyperacuteT: 0.5, qPotential: 0.5, rLoss: 0.4 },
      aVR: { stMm: 1.2, shape: 'convex', hyperacuteT: 0.25 },
      II: { stMm: -1.1, shape: 'horizontal', isReciprocal: true },
      III: { stMm: -1.9, shape: 'horizontal', isReciprocal: true },
      aVF: { stMm: -1.5, shape: 'horizontal', isReciprocal: true },
    },
    defaultHeartRate: 92,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'Выраженный подъём ST в V1–V5 (в V2–V4 до 4–5 мм, нередко в виде «надгробия»).',
        'Маркеры проксимального уровня до S1 и D1 (критерии Engelen): ST↑ в V1 > 2.5 мм, ST↑ в aVR, а также вовлечение высокой боковой стенки (ST↑ в aVL и I).',
        'Появление новой полной БПНПГ (питание правой ножки идёт от первой септальной ветви S1) — грозный признак окклюзии выше S1.',
      ],
      reciprocalAndExtra: [
        'Реципрокная депрессия ST в нижних отведениях поддерживает гипотезу высокого передне-бокового поражения. Её отсутствие не исключает проксимальную окклюзию ПМЖВ (LAD).',
        'Если в нижней группе вместо депрессии есть подъём — думайте о длинной ПМЖВ (wrap-around) при дистальной окклюзии или многососудистом поражении.',
      ],
      cathLabRisks: [
        'Высокий риск острой левожелудочковой недостаточности, отёка лёгких и кардиогенного шока при обширном поражении; объём повреждения уточняют методами визуализации.',
        'Немедленная готовность к ФЖ/ЖТ, при необходимости — инотропы / механическая поддержка кровообращения до и во время ЧКВ.',
        'При катетеризации ЛКА следить за бифуркацией S1 и D1, избегать диссекции ствола ЛКА и дистальной эмболизации.',
      ],
      mimics: [
        'Острый миокардит или синдром такоцубо (обычно нет реципрокной депрессии в III/aVF и чёткого сосудистого бассейна).',
        'Тяжёлая гипертрофия ЛЖ (ГЛЖ) со вторичными изменениями ST–T в V1–V3 (конкордность отсутствует, глубокие S в V1–V3).',
      ],
    },
  },

  lad_mid: {
    id: 'lad_mid',
    category: 'stemi',
    syndromeBadge: 'ИМпST (STEMI)',
    lesionType: 'occlusion',
    urgencyLabel: 'Немедленная реперфузионная стратегия',
    shortTitle: 'ПМЖВ сред./дист. (после S1/D1)',
    arteryName: 'Передняя межжелудочковая ветвь (ПМЖВ / LAD)',
    segmentLabel: 'Средняя / дистальная ПМЖВ (дистальнее S1 и D1)',
    territoryName: 'Передняя и передне-верхушечная область ЛЖ',
    isPathological: true,
    description:
      'Окклюзия ПМЖВ дистальнее отхождения первой септальной (S1) и первой диагональной (D1) ветвей. Базальная перегородка и высокая боковая стенка сохранены.',
    ahaSegments: [7, 8, 13, 14, 17],
    rvInvolved: false,
    reciprocalSegments: [],
    leads: {
      V1: { stMm: 0.4, shape: 'concave' },
      V2: { stMm: 3.4, shape: 'convex', hyperacuteT: 1.0, qPotential: 0.9, rLoss: 0.8 },
      V3: { stMm: 3.9, shape: 'convex', hyperacuteT: 1.1, qPotential: 1.0, rLoss: 0.85 },
      V4: { stMm: 3.2, shape: 'convex', hyperacuteT: 1.0, qPotential: 0.95, rLoss: 0.8 },
      V5: { stMm: 2.0, shape: 'convex', hyperacuteT: 0.7, qPotential: 0.7, rLoss: 0.5 },
      V6: { stMm: 0.9, shape: 'concave', hyperacuteT: 0.35 },
      aVR: { stMm: -0.2, shape: 'normal' },
      aVL: { stMm: 0.2, shape: 'normal' },
      III: { stMm: -0.3, shape: 'normal' },
    },
    defaultHeartRate: 84,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'Подъём сегмента ST локализован преимущественно в V2–V5 (максимум в V3–V4).',
        'Отведения V1, aVR и aVL остаются изоэлектричными (или с минимальным сдвигом < 1 мм), так как S1 и D1 открыты.',
        'Потеря прироста R в V2–V4 с формированием комплексов QS при задержке реперфузии.',
      ],
      reciprocalAndExtra: [
        'Реципрокная депрессия в нижних отведениях (II, III, aVF) минимальна или отсутствует, что отличает средний сегмент от проксимальной окклюзии.',
      ],
      cathLabRisks: [
        'Проверьте диаметр ветвей на ангиографии — иногда крупная D1 отходит сразу проксимальнее тромба и подвержена риску смещения бляшки (plaque shift).',
        'Риск развития апикального тромба ЛЖ в подостром периоде при задержке реканализации.',
      ],
      mimics: [
        'Ранняя реполяризация желудочков (J-точка зазубрена, вогнутый ST, нет динамики и нет потери R).',
        'Аневризма передней стенки ЛЖ (стойкий ST↑ на фоне глубоких QS, стабильный на повторных ЭКГ).',
      ],
    },
  },

  lad_wrap: {
    id: 'lad_wrap',
    category: 'stemi',
    syndromeBadge: 'ИМпST (STEMI)',
    lesionType: 'occlusion',
    urgencyLabel: 'Немедленная реперфузионная стратегия',
    shortTitle: 'Длинная ПМЖВ (Wrap-around LAD)',
    arteryName: 'Передняя межжелудочковая ветвь (огибающая верхушку)',
    segmentLabel: 'Дистальная длинная ПМЖВ (кровоснабжает верхушку и нижне-апикальную стенку)',
    territoryName: 'Передне-верхушечный + нижне-апикальный отделы ЛЖ',
    isPathological: true,
    description:
      'Анатомический вариант, при котором дистальная ПМЖВ перегибается через верхушку сердца и переходит в нижнюю межжелудочковую борозду, давая одновременную элевацию ST в передних и нижних отведениях.',
    ahaSegments: [7, 8, 13, 14, 15, 17],
    rvInvolved: false,
    reciprocalSegments: [],
    leads: {
      V2: { stMm: 3.1, shape: 'convex', hyperacuteT: 0.9, qPotential: 0.85, rLoss: 0.75 },
      V3: { stMm: 4.0, shape: 'convex', hyperacuteT: 1.1, qPotential: 1.0, rLoss: 0.8 },
      V4: { stMm: 3.8, shape: 'convex', hyperacuteT: 1.1, qPotential: 1.0, rLoss: 0.8 },
      V5: { stMm: 2.3, shape: 'convex', hyperacuteT: 0.75, qPotential: 0.75, rLoss: 0.6 },
      II: { stMm: 1.6, shape: 'convex', hyperacuteT: 0.6, qPotential: 0.65, rLoss: 0.45 },
      III: { stMm: 1.4, shape: 'convex', hyperacuteT: 0.55, qPotential: 0.6, rLoss: 0.4 },
      aVF: { stMm: 1.7, shape: 'convex', hyperacuteT: 0.6, qPotential: 0.65, rLoss: 0.45 },
      aVR: { stMm: -0.9, shape: 'downsloping', isReciprocal: true },
      aVL: { stMm: -0.5, shape: 'horizontal' },
    },
    defaultHeartRate: 86,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'Одновременный подъём ST в передних (V2–V5) И нижних (II, III, aVF) отведениях — классическая ловушка, имитирующая двойную окклюзию ПМЖВ + ПКА.',
        'Отсутствие реципрокной депрессии в II, III, aVF, а также отсутствие ST↑ в V1 и aVL (окклюзия дистальнее S1 и D1).',
        'ST↓ в aVR (вектор повреждения направлен к верхушке, строго от полости основания).',
      ],
      reciprocalAndExtra: [
        'Для оценки вовлечения ПЖ зарегистрируйте правые грудные отведения. В данном примере длинной ПМЖВ (LAD) V4R на изолинии; окончательную анатомию определяет КАГ.',
      ],
      cathLabRisks: [
        'В ангиографической проекции RAO Cranial / LAO Cranial обязательно проследите дистальное русло ПМЖВ за верхушкой — мелкая на первый взгляд дистальная окклюзия может давать яркую нижне-переднюю картину.',
      ],
      mimics: [
        'Острый перикардит (диффузный вогнутый ST↑ в грудных и нижних отведениях + депрессия PR-сегмента, нет сосудистой привязки).',
        'Одновременная окклюзия ПМЖВ и ПКА / перекрёстный тромбоз.',
      ],
    },
  },

  d1: {
    id: 'd1',
    category: 'stemi',
    syndromeBadge: 'ИМпST (STEMI)',
    lesionType: 'occlusion',
    urgencyLabel: 'Немедленная реперфузионная стратегия',
    shortTitle: 'Первая диагональная D1 («Флаг ЮАР»)',
    arteryName: 'Первая диагональная ветвь ПМЖВ (D1)',
    segmentLabel: 'Изолированная окклюзия D1 (высокий передне-боковой ИМ)',
    territoryName: 'Высокий боковой и передне-боковой отделы ЛЖ',
    isPathological: true,
    description:
      'Изолированная окклюзия крупной первой диагональной ветви (D1). Даёт характерный паттерн «флага ЮАР» (South African flag sign) с подъёмом ST в несмежных на стандартной распечатке отведениях.',
    ahaSegments: [6, 7, 12],
    rvInvolved: false,
    reciprocalSegments: [4, 10],
    leads: {
      aVL: { stMm: 2.5, shape: 'convex', hyperacuteT: 0.9, qPotential: 0.85, rLoss: 0.6 },
      I: { stMm: 1.6, shape: 'convex', hyperacuteT: 0.65, qPotential: 0.6, rLoss: 0.45 },
      V2: { stMm: 2.1, shape: 'convex', hyperacuteT: 0.8, qPotential: 0.65, rLoss: 0.5 },
      V3: { stMm: 0.6, shape: 'concave' },
      V5: { stMm: 0.7, shape: 'concave' },
      III: { stMm: -2.1, shape: 'horizontal', isReciprocal: true },
      aVF: { stMm: -1.3, shape: 'horizontal', isReciprocal: true },
      II: { stMm: -0.7, shape: 'horizontal', isReciprocal: true },
    },
    defaultHeartRate: 80,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'Триада «Флаг ЮАР» на ленте 3×4: подъём ST в I (верх слева), aVL (верх во 2-й колонке) и V2 (центр в 3-й колонке) + выраженная депрессия в III (низ слева) — визуально образует Y-форму флага ЮАР.',
        'Отведения V3–V4 практически не затронуты (главное отличие от проксимальной ПМЖВ).',
        'Часто пропускается автоматической расшифровкой ЭКГ, если подъём есть только в aVL (≥ 1 мм) и V2!',
      ],
      reciprocalAndExtra: [
        'Глубокая реципрокная депрессия в III и aVF нередко заметнее самого подъёма в aVL — всегда проверяйте aVL при необъяснимой депрессии в III.',
      ],
      cathLabRisks: [
        'Часто D1 отходит под острым углом от ПМЖВ — для устьевой окклюзии D1 оптимальна проекция LAO Caudal (Паук) или LAO Cranial.',
        'Риск смещения бляшки в основной ствол ПМЖВ при провизорном стентировании D1.',
      ],
      mimics: [
        'Изолированная окклюзия ветви тупого края (ВТК / OM1) — там чаще вовлечены V5–V6 и V1–V2 показывают депрессию, а не подъём в V2.',
        'Нижний ИМ (если врач смотрит только на депрессию в III/aVF как на первичную ишемию).',
      ],
    },
  },

  rca_prox: {
    id: 'rca_prox',
    category: 'stemi',
    syndromeBadge: 'ИМпST (STEMI)',
    lesionType: 'occlusion',
    urgencyLabel: 'Немедленная реперфузионная стратегия',
    shortTitle: 'ПКА прокс. (Нижний ИМ + ИМ ПЖ)',
    arteryName: 'Правая коронарная артерия (ПКА / RCA)',
    segmentLabel: 'Проксимальная ПКА (до ветви правого желудочка)',
    territoryName: 'Нижняя стенка ЛЖ + передняя/боковая стенка ПЖ',
    isPathological: true,
    description:
      'Проксимальная окклюзия ПКА до отхождения артерии конуса/острого края (ветви ПЖ). Сочетает классический нижний ИМ и инфаркт правого желудочка — критично для инфузионной и нитратной тактики.',
    ahaSegments: [3, 4, 9, 10, 15],
    rvInvolved: true,
    reciprocalSegments: [1, 6, 12],
    leads: {
      III: { stMm: 3.5, shape: 'convex', hyperacuteT: 1.1, qPotential: 1.0, rLoss: 0.7 },
      aVF: { stMm: 2.8, shape: 'convex', hyperacuteT: 0.95, qPotential: 0.9, rLoss: 0.65 },
      II: { stMm: 2.1, shape: 'convex', hyperacuteT: 0.75, qPotential: 0.7, rLoss: 0.5 },
      aVL: { stMm: -2.5, shape: 'horizontal', isReciprocal: true },
      I: { stMm: -1.5, shape: 'horizontal', isReciprocal: true },
      V1: { stMm: 1.1, shape: 'convex', hyperacuteT: 0.35 },
      V2: { stMm: -0.9, shape: 'horizontal', isReciprocal: true },
      V3R: { stMm: 1.6, shape: 'convex', hyperacuteT: 0.5, qPotential: 0.5 },
      V4R: { stMm: 2.3, shape: 'convex', hyperacuteT: 0.7, qPotential: 0.6 },
    },
    leftDominanceOverride: {
      ahaSegments: [3],
      rvInvolved: true,
      territoryNote: 'Преимущественно инфаркт правого желудочка (левый тип кровоснабжения: нижняя стенка ЛЖ питается от ОВ)',
      leads: {
        III: { stMm: 1.0, shape: 'concave' },
        aVF: { stMm: 0.6, shape: 'normal' },
        II: { stMm: 0.3, shape: 'normal' },
        aVL: { stMm: -0.7, shape: 'horizontal', isReciprocal: true },
        I: { stMm: -0.4, shape: 'normal' },
        V1: { stMm: 1.6, shape: 'convex', hyperacuteT: 0.5 },
        V2: { stMm: 0.8, shape: 'concave' },
        V3R: { stMm: 1.9, shape: 'convex', hyperacuteT: 0.6, qPotential: 0.5 },
        V4R: { stMm: 2.5, shape: 'convex', hyperacuteT: 0.8, qPotential: 0.65 },
      },
    },
    defaultHeartRate: 54,
    recommendedExtraLeads: ['V3R', 'V4R'],
    clinicalInsights: {
      ecgCriteria: [
        'Подъём ST в III > II (классический критерий ПКА: вектор направлен вниз и вправо, ближе к +120° оси отведения III).',
        'Выраженная реципрокная депрессия в aVL и I (в aVL почти всегда глубже, чем в I).',
        'Признак проксимальной окклюзии с ИМ правого желудочка: подъём ST в V1 (при депрессии в V2!) и подъём ST в V4R ≥ 1.0 мм.',
      ],
      reciprocalAndExtra: [
        'Обязательно снимите правые грудные отведения (V3R, V4R) в первые часы — элевация в V4R очень чувствительна к окклюзии ПКА до ветви ПЖ, но может быстро регрессировать за 10–12 часов.',
      ],
      cathLabRisks: [
        'При ИМ ПЖ избегайте нитратов, диуретиков и периферических вазодилататоров из-за риска ухудшения гемодинамики. Обезболивание подбирают индивидуально с контролем АД и дыхания; морфин может вызвать гипотонию и задержать действие пероральных антиагрегантов. При гипотонии оцените необходимость осторожного введения 0,9% NaCl и дальнейшей гемодинамической поддержки (КР РФ, ИМпST: §3.2.1, §3.2.4, §3.5).',
        'Высокий риск АВ-блокады II–III ст. и синусовой брадикардии (артерия СА-узла и АВ-узла часто отходят от ПКА) + рефлекс Бецольда–Яриша во время реперфузии.',
        'На ангиографии оценивайте устье и проксимальный сегмент в LAO 30°; старайтесь сохранить или реканализовать крупную ветвь ПЖ.',
      ],
      mimics: [
        'ТЭЛА (может давать подъем или инверсию T в V1–V3/III, но паттерн SI–QIII–TIII и тахикардия, а не брадикардия с ST↑ в II/III/aVF).',
        'Окклюзия ОВ при левом типе (там II ≥ III, I/aVL изоэлектричны или с подъёмом, V4R на изолинии).',
      ],
    },
  },

  rca_dist: {
    id: 'rca_dist',
    category: 'stemi',
    syndromeBadge: 'ИМпST (STEMI)',
    lesionType: 'occlusion',
    urgencyLabel: 'Немедленная реперфузионная стратегия',
    shortTitle: 'ПКА сред./дист. (Изолир. нижний)',
    arteryName: 'Правая коронарная артерия (ПКА / RCA)',
    segmentLabel: 'Средняя / дистальная ПКА (дистальнее ветви ПЖ)',
    territoryName: 'Нижняя и нижне-перегородочная стенки ЛЖ (ПЖ сохранён)',
    isPathological: true,
    description:
      'Окклюзия среднего или дистального сегмента доминантной ПКА ниже отхождения ветви правого желудочка. Классический нижний STEMI без гемодинамически значимого ИМ ПЖ.',
    ahaSegments: [4, 10, 15],
    rvInvolved: false,
    reciprocalSegments: [1, 6, 12],
    leads: {
      III: { stMm: 3.1, shape: 'convex', hyperacuteT: 1.0, qPotential: 0.95, rLoss: 0.65 },
      aVF: { stMm: 2.5, shape: 'convex', hyperacuteT: 0.9, qPotential: 0.85, rLoss: 0.6 },
      II: { stMm: 2.0, shape: 'convex', hyperacuteT: 0.7, qPotential: 0.65, rLoss: 0.45 },
      aVL: { stMm: -2.1, shape: 'horizontal', isReciprocal: true },
      I: { stMm: -1.2, shape: 'horizontal', isReciprocal: true },
      V1: { stMm: -0.4, shape: 'normal' },
      V2: { stMm: -0.7, shape: 'horizontal', isReciprocal: true },
      V4R: { stMm: 0.2, shape: 'normal' },
    },
    leftDominanceOverride: {
      ahaSegments: [15],
      rvInvolved: false,
      territoryNote: 'Малый бассейн дистальной гипопластичной ПКА (левый тип: основную нижнюю стенку кровоснабжает ОВ)',
      leads: {
        III: { stMm: 0.9, shape: 'concave' },
        aVF: { stMm: 0.7, shape: 'concave' },
        II: { stMm: 0.5, shape: 'normal' },
        aVL: { stMm: -0.6, shape: 'horizontal', isReciprocal: true },
      },
    },
    defaultHeartRate: 62,
    recommendedExtraLeads: ['V4R', 'V7', 'V8', 'V9'],
    clinicalInsights: {
      ecgCriteria: [
        'Классический критерий ПКА: ST↑ в III > II и ST↓ в aVL глубже, чем в I.',
        'В отличие от проксимальной окклюзии, отведения V1 и V4R не имеют значимого подъёма ST (ветвь ПЖ кровоснабжается выше тромба).',
        'При наличии депрессии в V1–V3 проверьте задние отведения V7–V9 (вовлечение задне-базальной ветви ПКА).',
      ],
      reciprocalAndExtra: [
        'Реципрокная депрессия в aVL является самым ранним и чувствительным маркером нижнего ИМ — иногда появляется раньше чёткого подъёма в III/aVF.',
      ],
      cathLabRisks: [
        'Контроль бифуркации ЗМЖВ (PDA) и задне-боковой ветви (PLV) в проекциях LAO Cranial и RAO.',
        'Возможны транзиторные АВ-блокады, которые обычно быстро разрешаются после восстановления кровотока TIMI 3.',
      ],
      mimics: [
        'Окклюзия ОВ при правом/левом типе (при ОВ обычно ST↑ в II ≥ III, отсутствует депрессия в I/aVL или есть подъём в I, aVL, V5–V6).',
        'Острая патология ЖКТ / перикардит (нет реципрокной депрессии в aVL).',
      ],
    },
  },

  lcx: {
    id: 'lcx',
    category: 'stemi',
    syndromeBadge: 'ИМпST (STEMI)',
    lesionType: 'occlusion',
    urgencyLabel: 'Немедленная реперфузионная стратегия',
    shortTitle: 'ОВ / ВТК (Нижне-боковой / задне-боковой)',
    arteryName: 'Огибающая ветвь ЛКА (ОВ / LCx) / ВТК (OM1)',
    segmentLabel: 'Проксимальная ОВ или крупная ветвь тупого края (OM1)',
    territoryName: 'Боковая, задняя и (при левом типе) нижняя стенки ЛЖ',
    isPathological: true,
    description:
      'Окклюзия огибающей артерии (или крупной ВТК). Часто является «электрокардиографически немой» или даёт нижне-боковой/задне-боковой паттерн без классической депрессии в aVL.',
    ahaSegments: [5, 6, 11, 12, 16],
    rvInvolved: false,
    reciprocalSegments: [2, 8],
    leads: {
      II: { stMm: 2.2, shape: 'convex', hyperacuteT: 0.75, qPotential: 0.7, rLoss: 0.5 },
      III: { stMm: 1.4, shape: 'convex', hyperacuteT: 0.5, qPotential: 0.55, rLoss: 0.4 },
      aVF: { stMm: 1.8, shape: 'convex', hyperacuteT: 0.65, qPotential: 0.6, rLoss: 0.45 },
      I: { stMm: 1.3, shape: 'convex', hyperacuteT: 0.5, qPotential: 0.45, rLoss: 0.35 },
      aVL: { stMm: 1.5, shape: 'convex', hyperacuteT: 0.55, qPotential: 0.5, rLoss: 0.4 },
      V5: { stMm: 2.1, shape: 'convex', hyperacuteT: 0.7, qPotential: 0.65, rLoss: 0.55 },
      V6: { stMm: 2.3, shape: 'convex', hyperacuteT: 0.8, qPotential: 0.7, rLoss: 0.55 },
      V1: { stMm: -1.7, shape: 'horizontal', isReciprocal: true, tallRPosterior: true },
      V2: { stMm: -2.2, shape: 'horizontal', isReciprocal: true, tallRPosterior: true },
      V3: { stMm: -1.8, shape: 'horizontal', isReciprocal: true },
      V7: { stMm: 2.2, shape: 'convex', hyperacuteT: 0.75, qPotential: 0.7, rLoss: 0.5 },
      V8: { stMm: 2.1, shape: 'convex', hyperacuteT: 0.7, qPotential: 0.65, rLoss: 0.5 },
      V9: { stMm: 1.7, shape: 'convex', hyperacuteT: 0.6, qPotential: 0.55, rLoss: 0.4 },
    },
    leftDominanceOverride: {
      ahaSegments: [4, 5, 6, 10, 11, 12, 15, 16],
      territoryNote: 'Обширный нижне-задне-боковой бассейн ЛЖ (доминантная ОВ при левом типе кровоснабжения)',
      leads: {
        II: { stMm: 3.0, shape: 'convex', hyperacuteT: 1.0, qPotential: 0.9, rLoss: 0.65 },
        III: { stMm: 2.4, shape: 'convex', hyperacuteT: 0.8, qPotential: 0.8, rLoss: 0.55 },
        aVF: { stMm: 2.7, shape: 'convex', hyperacuteT: 0.9, qPotential: 0.85, rLoss: 0.6 },
        I: { stMm: 1.2, shape: 'convex', hyperacuteT: 0.5, qPotential: 0.45 },
        aVL: { stMm: 1.3, shape: 'convex', hyperacuteT: 0.5, qPotential: 0.45 },
        V5: { stMm: 2.5, shape: 'convex', hyperacuteT: 0.85, qPotential: 0.8, rLoss: 0.6 },
        V6: { stMm: 2.7, shape: 'convex', hyperacuteT: 0.9, qPotential: 0.85, rLoss: 0.65 },
        V1: { stMm: -2.0, shape: 'horizontal', isReciprocal: true, tallRPosterior: true },
        V2: { stMm: -2.5, shape: 'horizontal', isReciprocal: true, tallRPosterior: true },
        V3: { stMm: -2.1, shape: 'horizontal', isReciprocal: true },
        V7: { stMm: 2.6, shape: 'convex', hyperacuteT: 0.85, qPotential: 0.8, rLoss: 0.6 },
        V8: { stMm: 2.4, shape: 'convex', hyperacuteT: 0.8, qPotential: 0.75, rLoss: 0.55 },
        V9: { stMm: 2.0, shape: 'convex', hyperacuteT: 0.7, qPotential: 0.65, rLoss: 0.5 },
      },
    },
    defaultHeartRate: 82,
    recommendedExtraLeads: ['V7', 'V8', 'V9'],
    clinicalInsights: {
      ecgCriteria: [
        'Ключ к отличию от ПКА при нижнем подъёме ST: в отведении II элевация ≥ III (вектор уходит влево и вниз, к +60°).',
        'Отведения I и aVL НЕ имеют реципрокной депрессии (изоэлектричны или с подъёмом ST), а V5–V6 показывают элевацию ST.',
        'Депрессия ST в V1–V3 отражает сопутствующий задний (нижне-базальный) компонент.',
      ],
      reciprocalAndExtra: [
        'Обязательна запись V7–V9 по левому краю под углом лопатки: там часто регистрируется подъём ST ≥ 0.5–1.0 мм, даже если стандартные отведения выглядят скромно.',
      ],
      cathLabRisks: [
        'При левом типе кровоснабжения проксимальная окклюзия ОВ ведёт к обширному поражению (задняя + боковая + нижняя стенки) и дисфункции папиллярных мышц с острой митральной регургитацией.',
        'Оптимальные ангиографические проекции для ОВ и ВТК: RAO Caudal (30°/25°) и LAO Caudal (Паук).',
      ],
      mimics: [
        'Дистальная окклюзия ПКА с вовлечением PLV.',
        'Передняя субэндокардиальная ишемия (при депрессии в V1–V3 без проверки V7–V9!).',
      ],
    },
  },

  posterior: {
    id: 'posterior',
    category: 'stemi',
    syndromeBadge: 'STEMI-эквивалент (V7–V9)',
    lesionType: 'occlusion',
    urgencyLabel: 'Немедленная реперфузионная стратегия',
    shortTitle: 'Задний ИМ (ЗБВ ПКА / дист. ОВ)',
    arteryName: 'Задне-базальная / дистальная ОВ или ПКА',
    segmentLabel: 'Изолированная окклюзия задне-боковой ветви (OM2 / PLV)',
    territoryName: 'Задняя (нижне-базальная) стенка ЛЖ',
    isPathological: true,
    description:
      'Изолированный задний (нижне-базальный) ИМ. В классических 12 отведениях нет подъёма ST — видна лишь «зеркальная» горизонтальная депрессия в V1–V3 и высокий R!',
    ahaSegments: [4, 5, 11],
    rvInvolved: false,
    reciprocalSegments: [2, 8],
    leads: {
      V1: { stMm: -2.0, shape: 'horizontal', isReciprocal: true, tallRPosterior: true },
      V2: { stMm: -2.6, shape: 'horizontal', isReciprocal: true, tallRPosterior: true },
      V3: { stMm: -2.1, shape: 'horizontal', isReciprocal: true },
      V7: { stMm: 2.3, shape: 'convex', hyperacuteT: 0.8, qPotential: 0.75, rLoss: 0.55 },
      V8: { stMm: 2.4, shape: 'convex', hyperacuteT: 0.85, qPotential: 0.8, rLoss: 0.6 },
      V9: { stMm: 2.0, shape: 'convex', hyperacuteT: 0.7, qPotential: 0.7, rLoss: 0.5 },
      V6: { stMm: 0.8, shape: 'concave' },
      II: { stMm: 0.6, shape: 'concave' },
    },
    defaultHeartRate: 85,
    recommendedExtraLeads: ['V7', 'V8', 'V9'],
    clinicalInsights: {
      ecgCriteria: [
        'В 12 стандартных отведениях — НЕТ элевации ST! Главный сигнал тревоги: изолированная горизонтальная депрессия ST в V1–V3 (максимум в V2–V3).',
        'Высокий R в V1–V2 может сопровождать задний ИМ. Его отсутствие не исключает поражение: оцените депрессию V1–V3, особенно с положительным T, и запишите V7–V9.',
        'Переверните плёнку обратной стороной на просвет: депрессия V1–V3 превратится в классический куполообразный STEMI.',
      ],
      reciprocalAndExtra: [
        'Запишите V7–V9 для выявления прямых признаков поражения задней стенки: диагностически значимый подъём ST ≥0,5 мм (0,05 мВ), согласно приложению А3 КР РФ по ОКСбпST.',
      ],
      cathLabRisks: [
        'Самая частая причина ложной выписки или задержки КАГ («у пациента просто депрессия ST — лечим консервативно до утра»), хотя в реальности закрыта дистальная ОВ или крупная PLV.',
        'Оцените дистальный бассейн ОВ (RAO Caudal) и PLV ПКА (LAO Cranial) на ангиографии.',
      ],
      mimics: [
        'Не-Q инфаркт / нестабильная стенокардия с передней депрессией (обычно захватывает V4–V6, не только V1–V3).',
        'Гипертрофия правого желудочка или БПНПГ (R в V1 высокий, но ST–T дискордантны и нет динамики в V7–V9).',
      ],
    },
  },

  lmca: {
    id: 'lmca',
    category: 'nstemi',
    syndromeBadge: 'ОКСбпST · Распространённая ишемия',
    lesionType: 'subocclusion',
    urgencyLabel: 'При очень высоком риске — КАГ <2 ч',
    shortTitle: 'Ствол ЛКА (LMCA) / 3-сосуд.',
    arteryName: 'Ствол левой коронарной артерии (LMCA)',
    segmentLabel: 'Субокклюзия ствола ЛКА или эквивалент (многососудистая ишемия)',
    territoryName: 'Диффузная субэндокардиальная ишемия всего ЛЖ',
    isPathological: true,
    description:
      'Угрожающий жизни паттерн критического поражения ствола ЛКА или тяжёлого 3-сосудистого поражения (при полной острой окклюзии ствола пациенты часто не доезжают до клиники или идут с тотальным передне-боковым STEMI).',
    ahaSegments: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    rvInvolved: false,
    reciprocalSegments: [],
    leads: {
      aVR: { stMm: 2.5, shape: 'convex', hyperacuteT: 0.4 },
      V1: { stMm: 1.5, shape: 'convex', hyperacuteT: 0.3 },
      I: { stMm: -1.6, shape: 'downsloping', isSubendocardial: true },
      II: { stMm: -2.0, shape: 'downsloping', isSubendocardial: true },
      aVF: { stMm: -1.6, shape: 'downsloping', isSubendocardial: true },
      V3: { stMm: -1.7, shape: 'horizontal', isSubendocardial: true },
      V4: { stMm: -2.6, shape: 'downsloping', isSubendocardial: true },
      V5: { stMm: -2.8, shape: 'downsloping', isSubendocardial: true },
      V6: { stMm: -2.4, shape: 'downsloping', isSubendocardial: true },
      aVL: { stMm: -0.9, shape: 'horizontal', isSubendocardial: true },
    },
    defaultHeartRate: 108,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'Распространённая депрессия ST ≥1 мм в ≥6 отведениях с aVR↑ и/или V1↑ требует оценки ствола ЛКА (LMCA) и многососудистого поражения. Нестабильная гемодинамика повышает вероятность тяжёлого поражения; сроки КАГ определяют по риску.',
        'Подъём ST в aVR и/или V1 оценивают совместно с распределением депрессии и клиникой. Этот паттерн не устанавливает конкретную анатомию или степень TIMI.',
        'Чем глубже сумма депрессий в V4–V6 и II, тем выше летальность и вероятность стеноза ствола ЛКА.',
      ],
      reciprocalAndExtra: [
        'При полной тромботической окклюзии ствола ЛКА без коллатералей вместо депрессии наблюдается картина массивного передне-бокового STEMI (I, aVL, V1–V6↑) с БПНПГ/БЛНПГ и шоком.',
      ],
      cathLabRisks: [
        'ВЫСОЧАЙШИЙ РИСК ОСТАНОВКИ КРОВООБРАЩЕНИЯ НА СТОЛЕ (дэмпинг давления на катетере в устье ЛКА!). Используйте диагностический катетер с осторожностью, избегайте глубокой интубации и лишних инъекций контраста в устье.',
        'Оптимальные стартовые проекции для устья ствола ЛКА: LAO Caudal (Паук 45°/30°) или прямой AP/LAO без глубокого заклинивания.',
        'Готовность кардиохирургии (Шунтирование vs ЧКВ ствола ЛКА под поддержкой гемодинамики).',
      ],
      mimics: [
        'Тяжёлая тахиаритмия, анемия, гипертонический криз, сепсис (диффузный дисбаланс доставки и потребности кислорода — инфаркт 2 типа).',
        'Дигиталисная интоксикация или выраженная гипокалиемия (корытообразный ST без ангинозной клиники).',
      ],
    },
  },

  nstemi_antlat: {
    id: 'nstemi_antlat',
    category: 'nstemi',
    syndromeBadge: 'ИМбпST (NSTEMI)',
    lesionType: 'subocclusion',
    urgencyLabel: 'КАГ по риску · при высоком — <24 ч',
    shortTitle: 'ИМбпST передне-боковой (депрессия ST)',
    arteryName: 'ПМЖВ (LAD) / ДВ или ВТК (субокклюзия, TIMI 1–2)',
    segmentLabel: 'Субокклюзия ветви ЛКА с субэндокардиальной ишемией',
    territoryName: 'Субэндокард передне-боковой и верхушечной стенок ЛЖ',
    isPathological: true,
    description:
      'Учебный пример ИМбпST с горизонтальной и косонисходящей депрессией ST в V3–V6, I и aVL. В этом случае Q отсутствует; анатомия и подтверждающая динамика тропонина заданы условиями примера.',
    ahaSegments: [6, 7, 12, 13, 16, 17],
    rvInvolved: false,
    reciprocalSegments: [],
    leads: {
      V3: { stMm: -1.4, shape: 'horizontal', isSubendocardial: true },
      V4: { stMm: -2.2, shape: 'horizontal', isSubendocardial: true },
      V5: { stMm: -2.4, shape: 'downsloping', isSubendocardial: true },
      V6: { stMm: -2.0, shape: 'downsloping', isSubendocardial: true },
      I: { stMm: -1.2, shape: 'horizontal', isSubendocardial: true },
      aVL: { stMm: -1.1, shape: 'horizontal', isSubendocardial: true },
      aVR: { stMm: 0.5, shape: 'concave' },
    },
    defaultHeartRate: 88,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'По клиническим рекомендациям РФ 2024: новая горизонтальная или косонисходящая депрессия сегмента ST ≥ 0.5 мм (0.05 мВ) как минимум в двух смежных отведениях (здесь V3–V6, I, aVL).',
        'Распределение депрессии ST само по себе не определяет ИСА. Представленный бассейн ЛКА — анатомия учебного примера; конкретное поражение уточняют на КАГ.',
        'В данном примере Q отсутствует и R сохранён. ИМбпST может протекать с формированием Q; диагноз ИМ требует динамики тропонина в сочетании с признаками ишемии.',
      ],
      reciprocalAndExtra: [
        'В отличие от изолированного заднего STEMI (где депрессия ограничена V1–V3 и в V7–V9 есть подъём), при передне-боковом ИМбпST депрессия максимальна в V4–V6 и захватывает I/aVL.',
        'Если к депрессии V4–V6 присоединяется подъём ST в aVR ≥ 1.0 мм и депрессия в II/aVF — риск стеноза ствола ЛКА (LMCA) резко возрастает.',
      ],
      cathLabRisks: [
        'Сроки КАГ определяют по риску: очень высокий — максимально рано, первые 2 ч после госпитализации; высокий (включая ИМбпST, динамику ST/T, преходящий ST↑, GRACE >140) — ранняя КАГ <24 ч целесообразна, класс IIa A; инвазивная стратегия — в госпитализацию.',
        'На ангиографии оценивают как ПМЖВ с диагональными ветвями, так и ОВ/ВТК — нередко выявляется многососудистое поражение и «виновная» разорванная бляшка с пристеночным тромбом и кровотоком TIMI 1–2.',
      ],
      mimics: [
        'Гипертрофия левого желудочка (ГЛЖ) со вторичной перегрузкой — косонисходящая депрессия ST + асимметричный отрицательный T в V5–V6 на фоне высоких вольтажей R (нет динамики на повторных ЭКГ).',
        'Дигиталисная интоксикация или выраженная гипокалиемия (корытообразное снижение ST + уплощение T и появление волны U).',
      ],
    },
  },

  nstemi_inf: {
    id: 'nstemi_inf',
    category: 'nstemi',
    syndromeBadge: 'ИМбпST (NSTEMI)',
    lesionType: 'subocclusion',
    urgencyLabel: 'КАГ по риску · при высоком — <24 ч',
    shortTitle: 'ИМбпST нижне-боковой (депрессия ST + T↓)',
    arteryName: 'Правая коронарная артерия (ПКА / RCA) или ОВ (LCx) — крит. стеноз',
    segmentLabel: 'Субэндокардиальная ишемия нижней и боковой стенок (TIMI 1–2)',
    territoryName: 'Субэндокард нижней и нижне-боковой стенок ЛЖ',
    isPathological: true,
    description:
      'ИМбпST с преимущественной депрессией ST и последующей инверсией зубца T в нижних (II, III, aVF) и боковых (V5–V6) отведениях при критическом стенозе ПКА или ОВ без полной окклюзии.',
    ahaSegments: [4, 5, 10, 11, 15],
    rvInvolved: false,
    reciprocalSegments: [],
    leads: {
      II: {
        stMm: -1.7,
        shape: 'horizontal',
        isSubendocardial: true,
        primaryTInversion: 0.3,
      },
      III: {
        stMm: -1.9,
        shape: 'downsloping',
        isSubendocardial: true,
        primaryTInversion: 0.32,
      },
      aVF: {
        stMm: -1.8,
        shape: 'horizontal',
        isSubendocardial: true,
        primaryTInversion: 0.3,
      },
      V5: { stMm: -1.2, shape: 'horizontal', isSubendocardial: true },
      V6: { stMm: -1.3, shape: 'horizontal', isSubendocardial: true },
      aVL: { stMm: 0.3, shape: 'normal' },
    },
    leftDominanceOverride: {
      ahaSegments: [4, 5, 10, 11, 12, 15, 16],
      rvInvolved: false,
      territoryNote:
        'Субэндокардиальная ишемия нижне-боковой зоны доминантной ОВ (LCx) при левом типе кровоснабжения',
      leads: {
        II: {
          stMm: -1.8,
          shape: 'horizontal',
          isSubendocardial: true,
          primaryTInversion: 0.32,
        },
        III: {
          stMm: -1.6,
          shape: 'downsloping',
          isSubendocardial: true,
          primaryTInversion: 0.28,
        },
        aVF: {
          stMm: -1.8,
          shape: 'horizontal',
          isSubendocardial: true,
          primaryTInversion: 0.3,
        },
        V5: { stMm: -1.7, shape: 'horizontal', isSubendocardial: true },
        V6: { stMm: -1.9, shape: 'downsloping', isSubendocardial: true },
      },
    },
    defaultHeartRate: 76,
    recommendedExtraLeads: ['V7', 'V8', 'V9'],
    clinicalInsights: {
      ecgCriteria: [
        'Депрессия сегмента ST ≥ 0.5–1.0 мм в II, III, aVF с вовлечением V5–V6 и переходом в отрицательные коронарные зубцы T.',
        'Патологического зубца Q и подъёма ST в II/III/aVF нет — кровоток по ПКА/ОВ частично сохранён (субокклюзия или хорошие коллатерали).',
        'При левом типе кровоснабжения доминирует бассейн ОВ и углубляется депрессия в V5–V6.',
      ],
      reciprocalAndExtra: [
        'Снимите V7–V9: при наличии в них подъёма ST ≥ 0.5 мм случай переквалифицируется в задне-нижний STEMI (экстренное ЧКВ)!',
        'В отличие от передне-высокого STEMI (D1 / ПМЖВ прокс.), где депрессия в II/III/aVF является реципрокной, здесь нет подъёма ST в aVL и I.',
      ],
      cathLabRisks: [
        'При нестабильной бляшке средней/дистальной ПКА или ОВ возможна быстрая трансформация в полную окклюзию — регистрируйте ЭКГ в динамике при каждом возобновлении боли.',
        'Оптимальные стартовые проекции для ПКА: LAO 35° и LAO Cranial (Crux), для ОВ — RAO Caudal.',
      ],
      mimics: [
        'Изолированный высокий боковой STEMI (D1) — даёт глубокую зеркальную депрессию в III и aVF, но обязательно сопровождается подъёмом ST в aVL и V2.',
        'Проксимальная ПМЖВ с реципрокной депрессией в II/III/aVF (всегда проверяйте V1–V4 на элевацию ST).',
      ],
    },
  },

  nstemi_tinv: {
    id: 'nstemi_tinv',
    category: 'nstemi',
    syndromeBadge: 'ИМбпST · Пример с инверсией T',
    lesionType: 'stenosis',
    urgencyLabel: 'КАГ по риску · при высоком — <24 ч',
    shortTitle: 'ИМбпST с глубокой инверсией T',
    arteryName: 'ПМЖВ (LAD) / многососудистый крит. стеноз (TIMI 2–3)',
    segmentLabel: 'Стеноз ПМЖВ (LAD) задан в учебном случае с T↓',
    territoryName: 'Передняя, боковая и верхушечная области ЛЖ в учебном примере',
    isPathological: true,
    description:
      'Вариант ИМбпST без смещения сегмента ST, проявляющийся распространённой глубокой симметричной инверсией зубца T («коронарный T») в передне-боковых и высоких боковых отведениях (V2–V6, I, aVL).',
    ahaSegments: [1, 6, 7, 12, 13, 16, 17],
    rvInvolved: false,
    reciprocalSegments: [],
    leads: {
      V2: { stMm: 0, shape: 'normal', primaryTInversion: 0.36 },
      V3: { stMm: 0, shape: 'normal', primaryTInversion: 0.52 },
      V4: { stMm: 0, shape: 'normal', primaryTInversion: 0.6 },
      V5: { stMm: 0, shape: 'normal', primaryTInversion: 0.54 },
      V6: { stMm: 0, shape: 'normal', primaryTInversion: 0.44 },
      I: { stMm: 0, shape: 'normal', primaryTInversion: 0.34 },
      aVL: { stMm: 0, shape: 'normal', primaryTInversion: 0.38 },
    },
    defaultHeartRate: 78,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'Сегмент ST располагается на изолинии, но формируются глубокие (≥ 2–5 мм), симметричные, остроконечные отрицательные зубцы T в V2–V6, I, aVL.',
        'В этом примере Q отсутствует и R сохранён. По отсутствию Q нельзя установить глубину некроза или исключить ИМ.',
        'Нередко сочетается с умеренным удлинением интервала QTc на фоне пост-ишемического станнинга миокарда.',
      ],
      reciprocalAndExtra: [
        'Велленс B также может распространяться на V5–V6. Для различения оценивают морфологию T, уровень J, недавнюю боль и динамику; одного распределения инверсии недостаточно.',
      ],
      cathLabRisks: [
        'Повышенный тропонин сам по себе не определяет диагноз и сроки КАГ. При подтверждённом ИМбпST оценивают высокий/очень высокий риск; возможное поражение ПМЖВ (LAD) уточняют на КАГ.',
        'На ЭхоКГ перед КАГ возможен гипокинез верхушечных и передне-боковых сегментов без выраженного истончения стенки.',
      ],
      mimics: [
        'Верхушечная гипертрофическая кардиомиопатия (синдром Ямагучи: гигантские отрицательные T > 10 мм в V3–V5 на фоне очень высоких зубцов R).',
        'Изменения T при внутричерепном кровоизлиянии / инсульте; возможно сопутствующее повреждение миокарда. Оценивайте неврологическую клинику, QT и тропонин в контексте.',
        'Острый миокардит / перикардит в стадии разрешения или синдром такоцубо.',
      ],
    },
  },

  wellens_a: {
    id: 'wellens_a',
    category: 'nstemi',
    syndromeBadge: 'ОКСбпST · Паттерн Велленса A',
    lesionType: 'stenosis',
    urgencyLabel: 'КАГ по риску · оценить текущую ишемию',
    shortTitle: 'Синдром Велленса, тип A (двухфазный T +/−)',
    arteryName: 'Проксимальная ПМЖВ (LAD) — критический стеноз (спонтанная реперфузия)',
    segmentLabel: 'Критический проксимальный стеноз ПМЖВ (постишемическая фаза)',
    territoryName: 'Обширный передне-перегородочный и верхушечный бассейн ЛЖ',
    isPathological: true,
    description:
      'Паттерн Велленса A: двухфазные зубцы T (+/−) в V2–V3 при изолинии или минимальном подъёме J. В данном примере запись выполнена после купирования боли; требуется оценка поражения ПМЖВ (LAD) и текущей ишемии.',
    ahaSegments: [1, 2, 7, 8, 13, 14, 17],
    rvInvolved: false,
    reciprocalSegments: [],
    leads: {
      V1: { stMm: 0.2, shape: 'normal', primaryTInversion: 0.22 },
      V2: { stMm: 0.4, shape: 'concave', biphasicT: 1.05 },
      V3: { stMm: 0.3, shape: 'concave', biphasicT: 1.15 },
      V4: { stMm: 0.1, shape: 'normal', biphasicT: 0.65 },
    },
    defaultHeartRate: 74,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'Классические критерии Велленса тип A: двухфазный (+ / −) зубец T преимущественно в V2 и V3 (иногда до V4).',
        'Сегмент ST на изолинии или минимально приподнят (< 1 мм); патологические зубцы Q в V1–V4 ОТСУТСТВУЮТ, прирост зубца R сохранён.',
        'В данном примере изменения T зарегистрированы в безболевой период после ишемического эпизода. Возобновление боли требует повторной ЭКГ и переоценки срочности КАГ; нормализация T не доказывает улучшение.',
      ],
      reciprocalAndExtra: [
        'Сравнивайте последовательные ЭКГ: морфология T может изменяться. Типы A и B не являются обязательными последовательными стадиями каждого случая.',
      ],
      cathLabRisks: [
        'При подозрении на острое ишемическое поражение ПМЖВ (LAD) сначала определяют срочность коронарной оценки. Нагрузочная проба не заменяет эту оценку.',
        'Срок КАГ выбирают по текущей ишемии и риску. При очень высоком риске — первые 2 ч после госпитализации; при высоком целесообразна КАГ <24 ч. Способ реваскуляризации выбирают после оценки анатомии.',
      ],
      mimics: [
        'Ранняя реполяризация или персистирующий ювенильный зубец T в V1–V3 (не бывает отчётливой острой коронарной двухфазности с ангинозным анамнезом).',
        'ТЭЛА (обычно даёт отрицательный T сразу в V1–V4 + III и синусовую тахикардию).',
      ],
    },
  },

  wellens_b: {
    id: 'wellens_b',
    category: 'nstemi',
    syndromeBadge: 'ОКСбпST · Паттерн Велленса B',
    lesionType: 'stenosis',
    urgencyLabel: 'КАГ по риску · оценить текущую ишемию',
    shortTitle: 'Синдром Велленса, тип B (глубокий симметр. T↓)',
    arteryName: 'Проксимальная ПМЖВ (LAD) — критический стеноз (TIMI 2–3)',
    segmentLabel: 'Критический стеноз проксимальной ПМЖВ (выраженная инверсия T)',
    territoryName: 'Передне-перегородочный и верхушечный бассейн ЛЖ',
    isPathological: true,
    description:
      'Паттерн Велленса B: глубокие симметричные отрицательные T в V2–V3, иногда также V1, V4–V6, при изолинии или минимальном подъёме J. Требует оценки окклюзирующего поражения или выраженного стеноза ПМЖВ (LAD).',
    ahaSegments: [1, 2, 7, 8, 13, 14, 17],
    rvInvolved: false,
    reciprocalSegments: [],
    leads: {
      V1: { stMm: 0, shape: 'normal', primaryTInversion: 0.25 },
      V2: { stMm: 0.1, shape: 'normal', primaryTInversion: 0.62 },
      V3: { stMm: 0, shape: 'normal', primaryTInversion: 0.68 },
      V4: { stMm: 0, shape: 'normal', primaryTInversion: 0.56 },
      V5: { stMm: 0, shape: 'normal', primaryTInversion: 0.32 },
    },
    defaultHeartRate: 72,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'Глубокие симметричные отрицательные T в V2–V3 могут распространяться на V1 и V4–V6. J на изолинии или минимально приподнята (<1 мм).',
        'Строго сохранён прирост зубца R от V1 к V4, нет патологических комплексов Q / QS.',
        'Отражает реперфузионный отёк («оглушённый» миокард) после транзиторной окклюзии ПМЖВ — аналогичную картину даёт и успешное стентирование ПМЖВ на стадии эволюции (реперфузионные T).',
      ],
      reciprocalAndExtra: [
        'Оценивайте тропонин в динамике. Нормальный или небольшой исходный уровень не исключает опасное коронарное поражение; диагноз ИМ требует соответствующих критериев.',
      ],
      cathLabRisks: [
        'При подозрении на острое ишемическое поражение ПМЖВ (LAD) приоритет — коронарная оценка и стратификация риска, а не нагрузочная проба.',
        'На КАГ оценивают ПМЖВ (LAD) и остальное коронарное русло. Конкретная выраженность стеноза и способ реваскуляризации не определяются только видом T.',
      ],
      mimics: [
        'Синдром Ямагучи (апикальная ГКМП — высокий вольтаж R в V4–V6 по критериям Соколова–Лайона).',
        'Пост-тахикардиальная память T или инсульт-индуцированные изменения T.',
      ],
    },
  },

  de_winter: {
    id: 'de_winter',
    category: 'nstemi',
    syndromeBadge: 'Де Винтер · Подозрение на окклюзию',
    lesionType: 'occlusion',
    urgencyLabel: 'Срочная КАГ: подозрение на окклюзию',
    shortTitle: 'Паттерн де Винтера (STEMI-эквивалент без ST↑)',
    arteryName: 'Проксимальная ПМЖВ (LAD) — острая окклюзия / субокклюзия (TIMI 0–1)',
    segmentLabel: 'Критическая проксимальная ПМЖВ без подъёма ST (эквивалент STEMI)',
    territoryName: 'Обширный передний, перегородочный и боковой отделы ЛЖ',
    isPathological: true,
    description:
      'Опасный ЭКГ-эквивалент острой проксимальной окклюзии ПМЖВ (~2% всех передних ИМ): вместо подъёма ST в V1–V6 видна косовосходящая депрессия точки J (1–3 мм), переходящая в высокие симметричные заострённые зубцы T, и умеренный подъём ST в aVR.',
    ahaSegments: [1, 2, 6, 7, 8, 12, 13, 14, 17],
    rvInvolved: false,
    reciprocalSegments: [4, 10],
    leads: {
      V1: { stMm: -0.9, shape: 'upsloping', deWinterT: 0.4 },
      V2: {
        stMm: -2.4,
        shape: 'upsloping',
        deWinterT: 1.05,
        qPotential: 0.7,
        rLoss: 0.65,
      },
      V3: {
        stMm: -2.8,
        shape: 'upsloping',
        deWinterT: 1.2,
        qPotential: 0.85,
        rLoss: 0.75,
      },
      V4: {
        stMm: -2.5,
        shape: 'upsloping',
        deWinterT: 1.1,
        qPotential: 0.8,
        rLoss: 0.7,
      },
      V5: {
        stMm: -1.7,
        shape: 'upsloping',
        deWinterT: 0.75,
        qPotential: 0.5,
        rLoss: 0.45,
      },
      V6: { stMm: -1.1, shape: 'upsloping', deWinterT: 0.45 },
      aVR: { stMm: 0.9, shape: 'convex', hyperacuteT: 0.2 },
      III: { stMm: -0.7, shape: 'horizontal', isReciprocal: true },
    },
    defaultHeartRate: 94,
    recommendedExtraLeads: [],
    clinicalInsights: {
      ecgCriteria: [
        'Ключевой признак де Винтера (2008): косовосходящая (upsloping) депрессия сегмента ST в точке J на 1–3 мм в грудных отведениях V1–V6, сразу переходящая в высокий узкий симметричный зубец T.',
        'Отсутствует подъём ST в V1–V6 (ложное успокоение «нет STEMI!»), но в большинстве случаев имеется небольшой подъём ST в aVR (0.5–1.5 мм) и потеря амплитуды R.',
        'Может быть стабильным часами или быстро эволюционировать в классический передний STEMI с куполом ST и формированием Q.',
      ],
      reciprocalAndExtra: [
        'В отличие от обычного ИМбпST с горизонтальной/косонисходящей депрессией ST и уплощённым/отрицательным T, здесь сегмент ST круто идёт вверх из глубокой точки J прямо в гигантский симметричный T.',
      ],
      cathLabRisks: [
        'Подозрение на острое окклюзирующее поражение требует срочной коронарной оценки. При продолжающейся ишемии или нестабильности не откладывайте КАГ ради ожидания серии тропонинов. Показания к реваскуляризации уточняют по клинике и анатомии.',
        'На ангиографии чаще всего обнаруживается острая тромботическая окклюзия (TIMI 0) или критическая субокклюзия проксимальной ПМЖВ.',
      ],
      mimics: [
        'Гиперкалиемия может сопровождаться высокими заострёнными T. Оцените калий, P, QRS и клинический контекст; отдельный признак не исключает электролитную причину.',
        'Гиперострая стадия обычного переднего STEMI (там точка J не опущена, а уже начинает подниматься вверх).',
      ],
    },
  },
};

export const CASE_ORDER: CaseId[] = [
  'lad_prox',
  'lad_mid',
  'lad_wrap',
  'd1',
  'rca_prox',
  'rca_dist',
  'lcx',
  'posterior',
  'nstemi_antlat',
  'nstemi_inf',
  'nstemi_tinv',
  'wellens_a',
  'wellens_b',
  'de_winter',
  'lmca',
  'normal',
];

export interface ResolvedCaseView {
  caseData: CoronaryCase;
  leads: Partial<Record<LeadId, LeadShiftProfile>>;
  ahaSegments: number[];
  rvInvolved: boolean;
  territoryName: string;
}

export function resolveCaseForDominance(
  caseId: CaseId,
  dominance: Dominance
): ResolvedCaseView {
  const base = CORONARY_CASES[caseId];
  if (dominance === 'left' && base.leftDominanceOverride) {
    const ov = base.leftDominanceOverride;
    return {
      caseData: base,
      leads: ov.leads ? { ...base.leads, ...ov.leads } : base.leads,
      ahaSegments: ov.ahaSegments ?? base.ahaSegments,
      rvInvolved: ov.rvInvolved ?? base.rvInvolved,
      territoryName: ov.territoryNote ?? base.territoryName,
    };
  }
  return {
    caseData: base,
    leads: base.leads,
    ahaSegments: base.ahaSegments,
    rvInvolved: base.rvInvolved,
    territoryName: base.territoryName,
  };
}
