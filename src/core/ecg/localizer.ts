import {
  CASE_ORDER,
  CORONARY_CASES,
  resolveCaseForDominance,
} from '../content/coronaryCases';
import {
  CaseId,
  Dominance,
  ExtraLeadId,
  LeadId,
  LocalizationResult,
  ManualLeadState,
} from '../types';

/**
 * Эвристические веса сходства с учебными примерами.
 * Это не диагностическая шкала и не оценка вероятности поражения артерии.
 */
const DIAGNOSTIC_LEAD_WEIGHTS: Partial<Record<LeadId, number>> = {
  aVR: 1.7,
  aVL: 1.6,
  V1: 1.5,
  V2: 1.4,
  III: 1.4,
  II: 1.25,
  V4R: 1.9,
  V3R: 1.5,
  V7: 1.7,
  V8: 1.7,
  V9: 1.6,
};

export function localizeFromManualLeads(
  manualStates: Partial<Record<LeadId, ManualLeadState>>,
  dominance: Dominance
): LocalizationResult {
  const activeEntries = (Object.entries(manualStates) as [LeadId, ManualLeadState][]).filter(
    ([, st]) => st === 'ste' || st === 'std' || st === 'tinv'
  );

  if (activeEntries.length === 0) {
    return {
      primaryCaseId: null,
      secondaryCaseId: null,
      activeLeadCount: 0,
      reasoning: [
        'Кликайте по карточкам отведений слева: 1 клик = подъём ST (ST↑), 2 = депрессия ST (ST↓), 3 = инверсия T (T↓), 4 = сброс.',
      ],
      recommendedExtraLeads: [],
    };
  }

  const steSet = new Set(activeEntries.filter(([, s]) => s === 'ste').map(([l]) => l));
  const stdSet = new Set(activeEntries.filter(([, s]) => s === 'std').map(([l]) => l));
  const tinvSet = new Set(activeEntries.filter(([, s]) => s === 'tinv').map(([l]) => l));
  // Тип A, де Винтер, блокады и некоронарные мимики требуют признаков, которых нет в четырёхпозиционном вводе.
  const excludedIds = new Set<CaseId>([
    'normal',
    'wellens_a',
    'de_winter',
    'lbbb_sgarbossa',
    'lbbb_benign',
    'pericarditis',
    'early_repol',
    'takotsubo',
  ]);
  const candidateIds = CASE_ORDER.filter(
    (id) => !excludedIds.has(id) && (id !== 'wellens_b' || (tinvSet.has('V2') && tinvSet.has('V3')))
  );
  const scores: { id: CaseId; score: number }[] = [];

  for (const caseId of candidateIds) {
    const resolved = resolveCaseForDominance(caseId, dominance);
    const leads = resolved.leads;

    let score = 0;
    let maxPossible = 0;

    // 1. Оценка совпадения по отмеченным пользователем отведениям
    for (const [lead, state] of activeEntries) {
      const weight = DIAGNOSTIC_LEAD_WEIGHTS[lead] ?? 1.1;
      maxPossible += weight * 2;

      const prof = leads[lead];
      const expected: ManualLeadState = prof
        ? prof.stMm >= 0.65
          ? 'ste'
          : prof.stMm <= -0.65
            ? 'std'
            : (prof.primaryTInversion ?? 0) >= 0.25 || (prof.biphasicT ?? 0) >= 0.25
              ? 'tinv'
              : 'normal'
        : 'normal';

      if (state === expected) {
        score += weight * 2.2;
      } else if (
        state === 'tinv' &&
        expected === 'std' &&
        (prof?.primaryTInversion ?? 0) >= 0.25
      ) {
        score += weight * 1.4;
      } else if (caseId === 'wellens_b' && lead === 'V6' && state === 'tinv') {
        // РФ, ОКСбпST 2024, приложение А3: Велленс B может распространяться на V6.
        score += weight * 2.2;
      } else if (expected === 'normal') {
        score -= weight * 0.65;
      } else {
        // Противоположное направление (например, пользователь отметил ST↑ там, где должна быть ST↓)
        score -= weight * 2.0;
      }
    }

    // 2. Бонус / штраф за ключевые отведения в данном сценарии
    for (const [leadKey, prof] of Object.entries(leads) as [
      LeadId,
      NonNullable<(typeof leads)[LeadId]>,
    ][]) {
      const isKeyLead =
        prof.stMm >= 1.5 ||
        prof.stMm <= -1.5 ||
        (prof.primaryTInversion ?? 0) >= 0.35 ||
        (prof.biphasicT ?? 0) >= 0.5;
      if (isKeyLead) {
        const w = DIAGNOSTIC_LEAD_WEIGHTS[leadKey] ?? 1.0;
        const expectedKey: ManualLeadState =
          prof.stMm >= 1.5 ? 'ste' : prof.stMm <= -1.5 ? 'std' : 'tinv';
        const userState = manualStates[leadKey];
        if (userState === expectedKey) {
          score += w * 0.5;
        } else if (userState === 'normal') {
          score -= w * 0.25;
        }
      }
    }

    // 3. Специальные клинические правила-усилители
    // «Флаг ЮАР» (I + aVL + V2 подъём, III депрессия)
    if (caseId === 'd1' && steSet.has('aVL') && steSet.has('V2') && !steSet.has('V3') && !steSet.has('V4')) {
      score += 3.0;
    }
    // Ствол ЛКА (aVR подъём + диффузная депрессия без переднего STEMI)
    if (caseId === 'lmca' && (steSet.has('aVR') || steSet.has('V1')) && stdSet.size >= 6 && !steSet.has('V3')) {
      score += 3.5;
    }
    // Изолированный задний ИМ (изолированная V1-V3 депрессия или V7-V9 подъём без V5-V6 депрессии)
    if (
      caseId === 'posterior' &&
      (stdSet.has('V1') || stdSet.has('V2') || stdSet.has('V3')) &&
      !stdSet.has('V5') &&
      !stdSet.has('V6') &&
      !steSet.has('II') &&
      !steSet.has('III')
    ) {
      score += 2.6;
    }
    // Wrap-around ПМЖВ (передний + нижний подъём)
    if (
      caseId === 'lad_wrap' &&
      (steSet.has('V3') || steSet.has('V4')) &&
      (steSet.has('II') || steSet.has('III') || steSet.has('aVF'))
    ) {
      score += 3.2;
    }
    // Проксимальная ПКА с ИМ ПЖ (нижние + V4R/V1 подъём)
    if (
      caseId === 'rca_prox' &&
      (steSet.has('V4R') || steSet.has('V3R') || (steSet.has('V1') && stdSet.has('V2')))
    ) {
      score += 2.8;
    }
    // Изолированный нижний ИМ (ЗМЖВ / PDA): нижний подъём без вовлечения ПЖ, V1–V3↓, передних и боковых отведений
    if (
      caseId === 'pda' &&
      (steSet.has('II') || steSet.has('III')) &&
      steSet.has('aVF') &&
      !steSet.has('V4R') &&
      !steSet.has('V3R') &&
      !steSet.has('V1') &&
      !steSet.has('V3') &&
      !steSet.has('V4') &&
      !stdSet.has('V1') &&
      !stdSet.has('V2') &&
      !stdSet.has('V3') &&
      !steSet.has('V5') &&
      !steSet.has('V6')
    ) {
      score += 1.6;
    }
    // ОВ (II/III/aVF + боковые V5/V6/I/aVL без депрессии в aVL)
    if (
      caseId === 'lcx' &&
      (steSet.has('V5') || steSet.has('V6') || steSet.has('I') || steSet.has('aVL')) &&
      (steSet.has('II') || steSet.has('aVF') || stdSet.has('V2'))
    ) {
      score += 2.2;
    }
    // ИМбпST передне-боковой (депрессия ST в V4-V6 или I + aVL без подъёма в aVR и V2-V4)
    if (
      caseId === 'nstemi_antlat' &&
      (stdSet.has('V4') ||
        stdSet.has('V5') ||
        stdSet.has('V6') ||
        (stdSet.has('I') && stdSet.has('aVL'))) &&
      !steSet.has('aVR') &&
      !steSet.has('V2') &&
      !steSet.has('V3') &&
      !steSet.has('V4')
    ) {
      score += 3.0;
    }
    // Без единой отметки подъёма ST классические STEMI-сценарии (кроме заднего ИМ) уступают ОКСбпST
    if (
      steSet.size === 0 &&
      CORONARY_CASES[caseId].category === 'stemi' &&
      caseId !== 'posterior'
    ) {
      score -= 2.4;
    }
    // ИМбпST нижне-боковой (депрессия ST в >=2 нижних отведениях без элевации в aVL/aVR)
    if (
      caseId === 'nstemi_inf' &&
      (['II', 'III', 'aVF'] as LeadId[]).filter((l) => stdSet.has(l)).length >= 2 &&
      !steSet.has('aVL') &&
      !steSet.has('aVR')
    ) {
      score += 3.0;
    }
    // Сходство с Велленсом B; вовлечение V5/V6 не исключает этот паттерн.
    if (
      caseId === 'wellens_b' &&
      tinvSet.has('V2') && tinvSet.has('V3') &&
      steSet.size === 0 &&
      stdSet.size === 0
    ) {
      score += 3.2;
    }
    // ИМбпST с диффузной инверсией T (не-Q ИМ: >=4 отведений включая боковые V5/V6/I/aVL)
    if (
      caseId === 'nstemi_tinv' &&
      tinvSet.size >= 4 &&
      (tinvSet.has('V5') || tinvSet.has('V6') || tinvSet.has('I') || tinvSet.has('aVL'))
    ) {
      score += 3.2;
    }
    const normalized = maxPossible > 0 ? score / maxPossible : 0;
    scores.push({ id: caseId, score: normalized });
  }

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1] ?? null;

  // Минимум для сравнения шаблонов, а не проверка диагностических критериев STEMI.
  const groups: LeadId[][] = [
    ['II', 'III', 'aVF'], ['I', 'aVL', 'V5', 'V6'],
    ['V1', 'V2', 'V3'], ['V2', 'V3', 'V4'], ['V3', 'V4', 'V5'],
    ['V4', 'V5', 'V6'], ['V7', 'V8', 'V9'], ['V3R', 'V4R'], ['aVL', 'V2'],
  ];
  const hasRelatedChanges = groups.some((group) =>
    [steSet, stdSet, tinvSet].some((set) => group.filter((lead) => set.has(lead)).length >= 2)
  );
  const hasHypothesis = activeEntries.length >= 2 && hasRelatedChanges && top.score >= 0.55;

  const primaryCase = CORONARY_CASES[top.id];
  const reasoning: string[] = [];
  const steLeads = activeEntries.filter(([, s]) => s === 'ste').map(([l]) => l);
  const stdLeads = activeEntries.filter(([, s]) => s === 'std').map(([l]) => l);
  const tinvLeads = activeEntries.filter(([, s]) => s === 'tinv').map(([l]) => l);

  if (steLeads.length > 0) {
    reasoning.push(`Элевация ST отмечена в: ${steLeads.join(', ')}.`);
  }
  if (stdLeads.length > 0) {
    reasoning.push(`Депрессия ST отмечена в: ${stdLeads.join(', ')}.`);
  }
  if (tinvLeads.length > 0) {
    reasoning.push(`Инверсия зубца T отмечена в: ${tinvLeads.join(', ')}.`);
  }
  reasoning.push(hasHypothesis
    ? `Похожий учебный сценарий: ${primaryCase.shortTitle}. Это гипотеза по разметке, а не подтверждённая ИСА.`
    : 'Недостаточно согласованных признаков для выбора сценария. Оцените полную ЭКГ, амплитуду, морфологию и динамику изменений.');
  reasoning.push('Неотмеченные отведения считаются неоценёнными. Тактика зависит от симптомов, гемодинамики и риска; диагноз ИМ требует соответствующих клинических и лабораторных данных.');
  if (tinvSet.has('V2') && tinvSet.has('V3')) {
    reasoning.push('Оцените паттерн Велленса: симметрию и глубину T, уровень J и недавнюю боль. Изменения могут распространяться до V6; двухфазный T типа A здесь не задан.');
  }
  if (['V2', 'V3', 'V4', 'V5', 'V6'].some((lead) => stdSet.has(lead as LeadId))) {
    reasoning.push('Если депрессия J косовосходящая и переходит в высокий симметричный T, оцените де Винтера. Для этого недостаточно только отметки ST↓; подъём aVR не обязателен.');
  }
  if (hasHypothesis && top.id === 'lmca') {
    reasoning.push('Распространённая депрессия ST с aVR/V1↑ требует оценки ствола ЛКА (LMCA) и многососудистого поражения. Неполная разметка не подтверждает критерий ≥6 отведений; проверьте также амплитуду и гемодинамику.');
  }
  if (stdSet.has('aVL') && steSet.size === 0) {
    reasoning.push('Депрессия ST в aVL (и I) без отмеченных подъёмов может быть как боковой субэндокардиальной ишемией, так и ранним реципрокным признаком нижнего ИМпST — оцените II, III, aVF в динамике.');
  }
  const hasDiffuseSte =
    (steSet.has('V3') || steSet.has('V4')) &&
    (steSet.has('II') || steSet.has('III') || steSet.has('aVF')) &&
    (steSet.has('V5') || steSet.has('V6') || steSet.has('I')) &&
    !stdSet.has('aVL');
  if (hasDiffuseSte) {
    reasoning.push('При диффузном подъёме ST без реципрокной депрессии в aVL оцените вогнутость ST, депрессию сегмента PR (острый перикардит) и синдром Такоцубо, не откладывая исключение ОКС / wrap-around ПМЖВ.');
  } else if (
    (steSet.has('V2') || steSet.has('V3') || steSet.has('V4')) &&
    stdSet.size === 0
  ) {
    reasoning.push('При переднем подъёме ST без реципрокной депрессии проверьте ширину QRS (при БЛНПГ — критерии Сгарбосса / Смита) и наличие J-зазубрины (СРРЖ); диагноз не ставится без клиники и динамики ЭКГ.');
  }

  const recExtra = new Set<ExtraLeadId>(hasHypothesis ? primaryCase.recommendedExtraLeads : []);
  if (steLeads.some((l) => l === 'II' || l === 'III' || l === 'aVF')) {
    recExtra.add('V3R');
    recExtra.add('V4R');
  }
  if (stdLeads.some((l) => l === 'V1' || l === 'V2' || l === 'V3')) {
    recExtra.add('V7');
    recExtra.add('V8');
    recExtra.add('V9');
  }

  return {
    primaryCaseId: hasHypothesis ? top.id : null,
    secondaryCaseId: hasHypothesis && second && second.score > 0.15 ? second.id : null,
    activeLeadCount: activeEntries.length,
    reasoning,
    recommendedExtraLeads: Array.from(recExtra),
  };
}
