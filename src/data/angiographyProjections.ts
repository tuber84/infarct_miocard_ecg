import { CaseId, Dominance } from '../core/types';

export type AngioSystem = 'LCA' | 'RCA' | 'BOTH';

export type AngioProjectionId =
  | 'ap'
  | 'rao_caudal'
  | 'ap_caudal'
  | 'lao_caudal'
  | 'rao_cranial'
  | 'ap_cranial'
  | 'lao_cranial'
  | 'lao_rca'
  | 'lao_cranial_rca'
  | 'rao_rca';

export type CompareGroupId = 'lca_caudal' | 'lca_cranial' | 'rca';

export interface AngioProjection {
  id: AngioProjectionId;
  shortLabel: string;
  title: string;
  fullNameRu: string;
  system: AngioSystem;
  laoDeg: number;
  cranDeg: number;
  whatIsVisible: string[];
  clinicalNote: string;
  uses: string[];
  cheatSheet: string;
  compareGroup: CompareGroupId | null;
}

export const ANGIO_PROJECTIONS: AngioProjection[] = [
  {
    id: 'ap',
    shortLabel: 'AP 0°/0°',
    title: 'AP (Прямая)',
    fullNameRu: 'Прямая передне-задняя проекция (Anteroposterior)',
    system: 'BOTH',
    laoDeg: 0,
    cranDeg: 0,
    whatIsVisible: [
      'Общая анатомия сердца и положение катетера',
      'Устье ствола ЛКА и проксимальный ход сосудов (с наложением ветвей)',
    ],
    clinicalNote:
      'Стартовая позиция С-дуги для катетеризации устьев и контроля положения проводников; для детальной оценки стенозов применяют комбинированные углы.',
    uses: [
      'Позиционирование диагностического катетера',
      'Быстрая оценка кальциноза',
    ],
    cheatSheet: 'AP 0°/0° = стартовая прямая проекция без наклона С-дуги',
    compareGroup: null,
  },
  // ── ЛКА ───────────────────────────────────────────────────────────────────
  {
    id: 'rao_caudal',
    shortLabel: 'RAO Caud',
    title: 'RAO Caudal',
    fullNameRu: 'Правая косая + каудальное положение (RAO 30° / CAU 25°)',
    system: 'LCA',
    laoDeg: -30,
    cranDeg: -25,
    whatIsVisible: [
      'LM — ствол левой коронарной артерии',
      'LCx (ОВ) — огибающая ветвь и ветви тупого края (OM / ВТК)',
      'Проксимальный сегмент ПМЖВ (LAD) и промежуточная ветвь (RI / ramus intermedius)',
    ],
    clinicalNote:
      'Базовая проекция для левой системы. Отлично раскрывает ОВ (LCx), OM-ветви и трифуркацию ствола без укорочения огибающей артерии.',
    uses: [
      'Оценка ОВ (LCx) и ВТК (OM1/OM2)',
      'Бифуркация и трифуркация LM → LAD / LCx / Ramus',
      'Проксимальные сегменты ПМЖВ и ОВ',
    ],
    cheatSheet: 'RAO Caudal = Ствол LM + ОВ (LCx) + ВТК + проксимальная ПМЖВ',
    compareGroup: 'lca_caudal',
  },
  {
    id: 'ap_caudal',
    shortLabel: 'AP Caud',
    title: 'AP Caudal',
    fullNameRu: 'Прямая + каудальное положение (AP 0° / CAU 30°)',
    system: 'LCA',
    laoDeg: 0,
    cranDeg: -30,
    whatIsVisible: [
      'Устье и дистальная бифуркация ствола LM',
      'Проксимальная ПМЖВ (LAD) — лучше, чем в LAO Caudal',
      'Проксимальная ОВ (LCx), но OM-ветви частично укорочены',
    ],
    clinicalNote:
      'Лучшая проекция для устьевого/проксимального поражения ПМЖВ и контроля раскрытия стента в дистальном стволе LM.',
    uses: [
      'Устье и проксимальная треть ПМЖВ (LAD)',
      'Бифуркация ствола ЛКА',
      'Трифуркация LM → LAD / LCx / Ramus',
    ],
    cheatSheet: 'AP Caudal = проксимальная ПМЖВ (LAD) + ствол LM',
    compareGroup: 'lca_caudal',
  },
  {
    id: 'lao_caudal',
    shortLabel: 'LAO Caud (Паук)',
    title: 'LAO Caudal («Паук» / Spider)',
    fullNameRu: 'Левая косая + каудальное положение (LAO 45° / CAU 30°)',
    system: 'LCA',
    laoDeg: 45,
    cranDeg: -30,
    whatIsVisible: [
      'Ствол ЛКА (LM) и вся его бифуркация («паук»)',
      'Проксимальная ПМЖВ (уходит вверх и вправо) и проксимальная ОВ (вниз)',
      'Срединная артерия (Ramus) и начальные отделы D1 / OM',
    ],
    clinicalNote:
      'Классическая «паучья» проекция (Spider View, стандарты SCAI). Главный ракурс для оценки карины ствола ЛКА (Medina) и контроля бифуркационного стентирования ствола.',
    uses: [
      'Бифуркационные поражения ствола ЛКА (Medina)',
      'Контроль стентирования LM и проксимальной ОВ',
      'Разведение устьев LAD и LCx без наложения',
    ],
    cheatSheet: 'LAO Caudal («Паук») = Бифуркация ствола LM → LAD + LCx',
    compareGroup: 'lca_caudal',
  },
  {
    id: 'rao_cranial',
    shortLabel: 'RAO Cran',
    title: 'RAO Cranial',
    fullNameRu: 'Правая косая + краниальное положение (RAO 30° / CRA 25°)',
    system: 'LCA',
    laoDeg: -30,
    cranDeg: 25,
    whatIsVisible: [
      'Средняя и дистальная треть ПМЖВ (LAD) по всей длине',
      'Разделение ПМЖВ и диагональных ветвей (D1, D2)',
      'Дистальная ОВ (LCx) и ВТК (OM), септальные ветви',
    ],
    clinicalNote:
      'Универсальный рабочий ракурс для средней/дистальной ПМЖВ: убирает проекционное укорочение и разводит ПМЖВ с диагональными и септальными ветвями.',
    uses: [
      'Средняя и дистальная ПМЖВ (вкл. wrap-around LAD)',
      'Отхождение D1 и септальных перфорантов',
      'Одновременный контроль дистальной ОВ / OM',
    ],
    cheatSheet: 'RAO Cranial = рабочий вид средней/дистальной ПМЖВ + D1 + дист. ОВ',
    compareGroup: 'lca_cranial',
  },
  {
    id: 'ap_cranial',
    shortLabel: 'AP Cran',
    title: 'AP Cranial',
    fullNameRu: 'Прямая + краниальное положение (AP 0° / CRA 35°)',
    system: 'LCA',
    laoDeg: 0,
    cranDeg: 35,
    whatIsVisible: [
      'Средняя и дистальная ПМЖВ (LAD) в распрямлённом виде',
      'Частично септальные и диагональные ветви',
    ],
    clinicalNote:
      'Краниальный наклон распрямляет ход ПМЖВ, убирая укорочение. Полезна при многососудистом поражении и контроле стента в средней трети ПМЖВ.',
    uses: [
      'Средняя и дистальная ПМЖВ без форешортенинга',
      'Контроль раскрытия стента в mid-LAD',
    ],
    cheatSheet: 'AP Cranial = чистая средняя/дистальная ПМЖВ по прямой оси',
    compareGroup: 'lca_cranial',
  },
  {
    id: 'lao_cranial',
    shortLabel: 'LAO Cran',
    title: 'LAO Cranial',
    fullNameRu: 'Левая косая + краниальное положение (LAO 45° / CRA 30°)',
    system: 'LCA',
    laoDeg: 45,
    cranDeg: 30,
    whatIsVisible: [
      'Бифуркации ПМЖВ с диагональными ветвями (D1, D2)',
      'Перпендикулярно отходящие септальные ветви (S1, S2)',
      'Средняя и дистальная треть ПМЖВ (LAD)',
    ],
    clinicalNote:
      'Ключевой ракурс для оценки устья диагональных ветвей (D1, D2) и планирования бифуркационного ЧКВ на ПМЖВ (чётко видны септальные ветви слева и диагональные справа).',
    uses: [
      'Бифуркации LAD – D1 / D2 (схема Medina)',
      'Дифференциация ПМЖВ (идёт вниз к верхушке) от диагональных ветвей',
      'Оценка септальных коллатералей',
    ],
    cheatSheet: 'LAO Cranial = ПМЖВ + бифуркации D1/D2 + септальные ветви',
    compareGroup: 'lca_cranial',
  },
  // ── ПКА ───────────────────────────────────────────────────────────────────
  {
    id: 'lao_rca',
    shortLabel: 'LAO (ПКА)',
    title: 'LAO (ПКА)',
    fullNameRu: 'Левая косая проекция для ПКА (LAO 35° / 0°)',
    system: 'RCA',
    laoDeg: 35,
    cranDeg: 0,
    whatIsVisible: [
      'Классическая «C-образная» кривизна ПКА от устья до crux cordis',
      'Проксимальный и средний сегменты ПКА в профиль',
      'Ветвь правого желудочка (острого края / Marginal)',
    ],
    clinicalNote:
      'Золотой стандарт и главный обзорный ракурс ПКА: выводит правую артерию сбоку от позвоночника. Если нужен один снимок ПКА — выбирают LAO.',
    uses: [
      'Устье, проксимальный и средний сегменты ПКА',
      'Ветвь ПЖ при нижнем ИМ с вовлечением ПЖ',
      'Оценка типа кровоснабжения (crux cordis)',
    ],
    cheatSheet: 'LAO (ПКА) = классическая С-форма ПКА, устье и прокс./средний сегменты',
    compareGroup: 'rca',
  },
  {
    id: 'lao_cranial_rca',
    shortLabel: 'LAO Cran (Crux)',
    title: 'LAO Cranial (ПКА / Crux)',
    fullNameRu: 'Левая косая + краниальное положение для ПКА (LAO 30° / CRA 25°)',
    system: 'RCA',
    laoDeg: 30,
    cranDeg: 25,
    whatIsVisible: [
      'Дистальная ПКА в области crux cordis («креста сердца»)',
      'Деление на заднюю межжелудочковую (ЗМЖВ / PDA) и заднебоковую (ЗБВ / PLB) ветви',
      'Проксимальный и средний ход ПКА без наложения диафрагмы',
    ],
    clinicalNote:
      'Краниальный наклон в LAO раскрывает дистальную бифуркацию ПКА (PDA + PLB) и убирает проекционное укорочение нижней стенки.',
    uses: [
      'Оценка дистальной ПКА и бифуркации PDA / PLB',
      'Стентирование дистальной ПКА и устья ЗМЖВ',
    ],
    cheatSheet: 'LAO Cranial (ПКА) = crux cordis + бифуркация ЗМЖВ (PDA) и ЗБВ (PLB)',
    compareGroup: 'rca',
  },
  {
    id: 'rao_rca',
    shortLabel: 'RAO (ПКА)',
    title: 'RAO (ПКА)',
    fullNameRu: 'Правая косая проекция для ПКА (RAO 30° / 0°)',
    system: 'RCA',
    laoDeg: -30,
    cranDeg: 0,
    whatIsVisible: [
      'ЗМЖВ (PDA) по всей длине в нижней межжелудочковой борозде',
      'Заднебоковые ветви (ЗБВ / PLB)',
      'Ортогональный вид среднего сегмента ПКА и ветвей ПЖ',
    ],
    clinicalNote:
      'Обязательная ортогональная пара к LAO: вытягивает ЗМЖВ (PDA) вдоль всей длины и выявляет эксцентрические стенозы среднего сегмента ПКА.',
    uses: [
      'Оценка ЗМЖВ (PDA) и заднебоковых ветвей (PLB)',
      'Ортогональный контроль стентирования средней ПКА',
      'Визуализация межсистемных коллатералей',
    ],
    cheatSheet: 'RAO (ПКА) = длина ЗМЖВ (PDA) + ЗБВ (PLB) + ортогональный вид ПКА',
    compareGroup: 'rca',
  },
];

export const PROJECTION_MAP: Record<AngioProjectionId, AngioProjection> =
  ANGIO_PROJECTIONS.reduce(
    (acc, item) => {
      acc[item.id] = item;
      return acc;
    },
    {} as Record<AngioProjectionId, AngioProjection>
  );

export interface CaseOptimalProjection {
  projectionId: AngioProjectionId;
  system: AngioSystem;
  reason: string;
}

export const CASE_OPTIMAL_PROJECTION: Record<CaseId, CaseOptimalProjection> = {
  normal: {
    projectionId: 'ap',
    system: 'BOTH',
    reason: 'Обзорная прямая проекция обоих коронарных бассейнов',
  },
  lmca: {
    projectionId: 'lao_caudal',
    system: 'LCA',
    reason: '«Паук» раскрывает ствол ЛКА и бифуркацию LAD/LCx без наложения',
  },
  lad_prox: {
    projectionId: 'lao_caudal',
    system: 'LCA',
    reason: 'Оптимальна для бифуркации LM и устья/прокс. ПМЖВ (альт. AP Caudal)',
  },
  lad_mid: {
    projectionId: 'rao_cranial',
    system: 'LCA',
    reason: 'Распрямляет среднюю ПМЖВ и отделяет её от диагональных ветвей',
  },
  lad_wrap: {
    projectionId: 'rao_cranial',
    system: 'LCA',
    reason: 'Помогает оценить дистальный сегмент ПМЖВ и его ход у верхушки сердца',
  },
  d1: {
    projectionId: 'lao_cranial',
    system: 'LCA',
    reason: 'Чётко раскрывает угол отхождения D1 и D2 от ПМЖВ',
  },
  lcx: {
    projectionId: 'rao_caudal',
    system: 'LCA',
    reason: 'Выводит ОВ (LCx) и ветви тупого края (OM) без проекционного укорочения',
  },
  posterior: {
    projectionId: 'lao_cranial_rca',
    system: 'RCA',
    reason: 'Раскрывает бифуркацию crux cordis и заднебоковую ветвь (ЗБВ / PLB) доминантной ПКА',
  },
  rca_prox: {
    projectionId: 'lao_rca',
    system: 'RCA',
    reason: 'Классическая С-форма ПКА: устье, прокс. сегмент и ветвь ПЖ',
  },
  rca_dist: {
    projectionId: 'lao_cranial_rca',
    system: 'RCA',
    reason: 'Раскрывает дистальную ПКА в области crux cordis (PDA + PLB)',
  },
  pda: {
    projectionId: 'rao_rca',
    system: 'RCA',
    reason: 'Выводит ЗМЖВ (PDA) по всей длине в задней межжелудочковой борозде без укорочения',
  },
  nstemi_antlat: {
    projectionId: 'rao_cranial',
    system: 'LCA',
    reason: 'Выводит ПМЖВ, диагональные ветви и огибающее русло при субэндокардиальной ишемии',
  },
  nstemi_inf: {
    projectionId: 'lao_rca',
    system: 'RCA',
    reason: 'Классическая С-форма ПКА для поиска критического стеноза при нижнем ИМбпST',
  },
  nstemi_tinv: {
    projectionId: 'rao_cranial',
    system: 'LCA',
    reason: 'Оценка проксимального и среднего русла ПМЖВ при не-Q передне-боковом инфаркте',
  },
  wellens_a: {
    projectionId: 'lao_caudal',
    system: 'LCA',
    reason: 'Оценка устья ПМЖВ и бифуркации ствола ЛКА при синдроме Велленса тип A',
  },
  wellens_b: {
    projectionId: 'ap_cranial',
    system: 'LCA',
    reason: 'Оптимально раскрывает проксимальный и средний сегменты ПМЖВ при Велленсе тип B',
  },
  de_winter: {
    projectionId: 'lao_caudal',
    system: 'LCA',
    reason: 'Экстренная оценка проксимальной ПМЖВ и ствола ЛКА при паттерне де Винтера',
  },
  lbbb_sgarbossa: {
    projectionId: 'lao_caudal',
    system: 'LCA',
    reason: 'Экстренная оценка проксимальной ПМЖВ и ствола ЛКА при ОИМ на фоне БЛНПГ (критерии Сгарбосса/Смита)',
  },
  lbbb_benign: {
    projectionId: 'ap',
    system: 'BOTH',
    reason: 'Интактное коронарное русло при неосложнённой БЛНПГ (отрицательные критерии Сгарбосса/Смита)',
  },
  pericarditis: {
    projectionId: 'ap',
    system: 'BOTH',
    reason: 'Проходимые коронарные артерии (TIMI 3) при остром перикардите — исключение ОКС при сомнениях',
  },
  early_repol: {
    projectionId: 'ap',
    system: 'BOTH',
    reason: 'Нормальное коронарное русло (TIMI 3) — ранняя реполяризация желудочков не требует КАГ',
  },
  takotsubo: {
    projectionId: 'ap',
    system: 'BOTH',
    reason: 'Интактные коронарные артерии (TIMI 3) на экстренной КАГ при синдроме Такоцубо (диагноз исключения)',
  },
};

export function getOptimalProjectionForCase(
  caseId: CaseId,
  dominance: Dominance
): CaseOptimalProjection {
  if (dominance === 'left') {
    if (caseId === 'pda') {
      return {
        projectionId: 'lao_cranial',
        system: 'LCA',
        reason: 'Раскрывает терминальную ОВ и ход ЗМЖВ (PDA, сегмент 15 SYNTAX) в задней МЖ-борозде',
      };
    }
    if (caseId === 'posterior') {
      return {
        projectionId: 'rao_caudal',
        system: 'LCA',
        reason: 'Раскрывает доминантную ОВ и заднебоковую ветвь ЛЖ (ЗБВ / PLB, сегмент 14 SYNTAX)',
      };
    }
    if (caseId === 'nstemi_inf') {
      return {
        projectionId: 'rao_caudal',
        system: 'LCA',
        reason: 'Раскрывает доминантную ОВ (LCx) и ВТК при левом типе кровоснабжения',
      };
    }
  }
  return CASE_OPTIMAL_PROJECTION[caseId];
}

export interface CompareTableDef {
  id: CompareGroupId;
  title: string;
  columns: { label: string; projectionId: AngioProjectionId }[];
  rows: string[][];
}

export const PROJECTION_COMPARE_TABLES: Record<CompareGroupId, CompareTableDef> = {
  lca_caudal: {
    id: 'lca_caudal',
    title: 'Сравнение Caudal-проекций (ЛКА)',
    columns: [
      { label: 'RAO Caudal', projectionId: 'rao_caudal' },
      { label: 'AP Caudal', projectionId: 'ap_caudal' },
      { label: 'LAO Caudal (Паук)', projectionId: 'lao_caudal' },
    ],
    rows: [
      ['Ствол LM', 'Хорошо', 'Хорошо', 'Отлично'],
      ['Проксимальная ПМЖВ', 'Хорошо', 'Лучше всех', 'Хуже AP'],
      ['ОВ (LCx) и ВТК (OM)', 'Лучше всех', 'Укорочены', 'Лучше AP'],
      ['Бифуркация LM (карина)', 'Хорошо', 'Хорошо', 'Лучше всех'],
      ['Основной фокус', 'ОВ + ВТК + прокс. ПМЖВ', 'Проксимальная ПМЖВ', 'Бифуркация LM + ОВ'],
    ],
  },
  lca_cranial: {
    id: 'lca_cranial',
    title: 'Сравнение Cranial-проекций (ЛКА)',
    columns: [
      { label: 'RAO Cranial', projectionId: 'rao_cranial' },
      { label: 'LAO Cranial', projectionId: 'lao_cranial' },
      { label: 'AP Cranial', projectionId: 'ap_cranial' },
    ],
    rows: [
      ['Средняя/дист. ПМЖВ', 'Отлично', 'Хорошо', 'Отлично'],
      ['Диагональные ветви (ДВ1/D1, ДВ2/D2)', 'Хорошо', 'Лучше всех', 'Наложение'],
      ['Дист. ОВ / ВТК', 'Раскрывает', 'Слабо', 'Слабо'],
      ['Разделение ПМЖВ/диаг.', 'Лучше всех', 'Хорошо', 'Наложение'],
      ['Основной фокус', 'Рабочий обзор ПМЖВ', 'Бифуркации ПМЖВ–D1', 'Узкая mid-dist ПМЖВ'],
    ],
  },
  rca: {
    id: 'rca',
    title: 'Сравнение проекций ПКА (RCA)',
    columns: [
      { label: 'LAO (ПКА)', projectionId: 'lao_rca' },
      { label: 'LAO Cranial (Crux)', projectionId: 'lao_cranial_rca' },
      { label: 'RAO (ПКА)', projectionId: 'rao_rca' },
    ],
    rows: [
      ['Проксимальная ПКА', 'Лучше всех', 'Хорошо', 'Ортогонально'],
      ['Средняя ПКА и ветвь ПЖ', 'Отлично', 'Хорошо', 'Ортогонально'],
      ['Дист. ПКА / Crux cordis', 'Умеренно', 'Лучше всех', 'Хорошо'],
      ['ЗМЖВ (PDA) и ЗБВ (PLB)', 'Укорочены', 'Бифуркация', 'По всей длине'],
      ['Один быстрый ракурс', 'Выбор №1', 'Для crux', 'Пара к LAO'],
    ],
  },
};
