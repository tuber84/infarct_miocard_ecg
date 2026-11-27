// Проверки клинических ограничений локализатора без дополнительных зависимостей.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(result.outputText, filename);
};

const {
  sampleBeatMv,
  sampleEcgAtTimeMv,
  generateLeadSignal,
  getBeatTiming,
  getEcgMeasurements,
  getJShiftMm,
  computeStageModifiers,
  computeFrontalVectors,
  getLeadBadge,
  DE_WINTER_STAGE_SUMMARIES,
  STAGE_PRESETS,
} = require('../src/core/ecg/ecgEngine.ts');
const { CORONARY_CASES, resolveCaseForDominance, STANDARD_LEADS, EXTRA_LEADS } = require('../src/core/content/coronaryCases.ts');
const options = { aivr: false, artifacts: false };
const rates = [40, 45, 54, 72, 95, 135, 150];
const close = (a, b, tolerance, context) => assert.ok(Math.abs(a - b) <= tolerance, `${context}: ${a} ≠ ${b}`);

test('J совпадает с заданным смещением во всех сценариях, стадиях и типах кровоснабжения', () => {
  for (const id of Object.keys(CORONARY_CASES)) for (const dominance of ['right', 'left']) {
    const { caseData, leads } = resolveCaseForDominance(id, dominance);
    const caseOptions = { ...options, qrsPattern: caseData.qrsPattern };
    for (const hr of rates) for (const reperfused of [false, true]) for (const time of [0, .12, .35, .58, .8, 1]) {
      const stage = computeStageModifiers(time, reperfused);
      const rr = 60 / hr;
      const { j } = getBeatTiming(rr, false, caseData.qrsPattern);
      for (const lead of [...STANDARD_LEADS, ...EXTRA_LEADS]) {
        const p = leads[lead];
        const expected = getJShiftMm(p, stage);
        const actual = sampleBeatMv(j, rr, lead, p, stage, caseOptions) * 10;
        close(actual, expected, 1e-9, `${id}/${lead}/${hr}/${time}/${reperfused}`);
        const badge = getLeadBadge(p, stage, lead);
        if (/^ST[↑↓]/.test(badge.text)) close(Number(badge.text.split(' ')[1]), actual, .051, 'Бейдж J');
      }
    }
  }
});

test('Направление ST проверяется на суммарной кривой, до начала T', () => {
  const stage = computeStageModifiers(.35, false);
  for (const hr of rates) for (const shape of ['horizontal', 'downsloping', 'upsloping']) {
    const rr = 60 / hr;
    const { j, tOnset } = getBeatTiming(rr);
    const p = { stMm: -2, shape, isSubendocardial: true };
    const values = [.1, .3, .5, .7, .9].map(u => sampleBeatMv(j + (tOnset - j) * u, rr, 'V5', p, stage, options));
    for (let i = 1; i < values.length; i++) {
      if (shape === 'horizontal') close(values[i], -.2, 1e-10, 'Горизонтальная депрессия');
      else assert.ok(shape === 'downsloping' ? values[i] < values[i-1] : values[i] > values[i-1]);
    }
  }
});

test('PR/QRS/QT соответствуют границам ненулевых волн, найденным по отсчётам', () => {
  for (const hr of [40, 54, 72, 95]) for (const aivr of [false, true]) {
    const m = getEcgMeasurements(hr, aivr);
    const rr = 60 / m.hr;
    const signal = generateLeadSignal('II', undefined, computeStageModifiers(.35, false), rr, 10000, hr, { ...options, aivr });
    const intervals = [];
    let start = null;
    for (let i = 0; i <= signal.length; i++) {
      const active = i < signal.length && Math.abs(signal[i]) > 1e-8;
      if (active && start === null) start = i / 10;
      if (!active && start !== null) { intervals.push([start, (i - 1) / 10]); start = null; }
    }
    // Нулевые пересечения внутри QRS не считаем границами волн.
    const merged = [];
    for (const interval of intervals) {
      const last = merged.at(-1);
      if (last && interval[0] - last[1] < 2) last[1] = interval[1];
      else merged.push(interval);
    }
    assert.equal(merged.length, aivr ? 2 : 3);
    const qrs = merged[aivr ? 0 : 1];
    const t = merged.at(-1);
    close(qrs[1] - qrs[0], m.qrsMs, 1, 'QRS по кривой');
    close(t[1] - qrs[0], m.qtMs, 1, 'QT по кривой');
    if (!aivr) close(qrs[0] - merged[0][0], m.prMs, 1, 'PR по кривой');
    close(m.qtcMs, m.qtMs / Math.sqrt(rr), 1, 'QTc Базетт');
  }
});

test('Высокая ЧСС: T переносится через границу RR без скачка', () => {
  for (const hr of [135, 150]) {
    const rr = 60 / hr;
    const stage = computeStageModifiers(.35, false);
    const v = t => sampleBeatMv(t, rr, 'V5', undefined, stage, options);
    assert.ok(Math.abs(v(0)) > .01, 'Хвост предыдущего T сохранён');
    close(v(rr - 1e-7), v(0), 1e-5, 'Непрерывность RR');
    close(v(rr + .01), v(.01), 1e-12, 'Периодичность');
  }
});

test('Сохраняются полярности T Велленса A/B и высокий T де Винтера', () => {
  const stage = computeStageModifiers(.35, false);
  for (const id of ['wellens_a', 'wellens_b', 'de_winter']) for (const hr of rates) {
    const rr = 60 / hr;
    const { tOnset, tEnd } = getBeatTiming(rr);
    const p = CORONARY_CASES[id].leads.V3;
    const values = Array.from({ length: 201 }, (_, i) => sampleBeatMv(tOnset + (tEnd-tOnset)*i/200, rr, 'V3', p, stage, options));
    if (id === 'wellens_a') {
      assert.ok(Math.max(...values) > .05 && Math.min(...values) < -.1);
      assert.ok(values.indexOf(Math.max(...values)) < values.indexOf(Math.min(...values)));
    } else if (id === 'wellens_b') assert.ok(Math.min(...values) < -.3);
    else assert.ok(Math.max(...values) > .5);
  }
});

test('Дискретизация ленты 1000 Гц сохраняет J в пределах 0,05 мм', () => {
  const stage = computeStageModifiers(.35, false);
  for (const hr of rates) for (const id of Object.keys(CORONARY_CASES)) {
    const c = CORONARY_CASES[id];
    const p = c.leads.V3;
    const caseOptions = { ...options, qrsPattern: c.qrsPattern };
    const rr = 60 / hr;
    const { j } = getBeatTiming(rr, false, c.qrsPattern);
    const signal = generateLeadSignal('V3', p, stage, 4, 1000, hr, caseOptions, .137);
    const when = rr + j - .137;
    const x = when * 1000, i = Math.floor(x);
    const interpolated = signal[i] + (signal[i+1] - signal[i]) * (x-i);
    close(interpolated, sampleBeatMv(j, rr, 'V3', p, stage, caseOptions), .005, 'J на ленте');
  }
});

test('Описания стадий де Винтера и бейдж aVR согласованы с сигналом', () => {
  for (const stage of STAGE_PRESETS) {
    const entry = DE_WINTER_STAGE_SUMMARIES[stage.id];
    assert.ok(entry && entry.summary.length > 20 && entry.reperfusionSummary.length > 20, `Пустое описание стадии ${stage.id}`);
    assert.equal(/выпуклый подъём|спинка кошки|надгробие/i.test(entry.summary), false, `Некорректное описание подъёма ST в ${stage.id}`);
  }
  for (const id of Object.keys(CORONARY_CASES)) for (const dominance of ['right', 'left']) {
    const { leads } = resolveCaseForDominance(id, dominance);
    for (const reperfused of [false, true]) for (const time of [0, .12, .35, .58, .8, 1]) {
      const badge = getLeadBadge(leads.aVR, computeStageModifiers(time, reperfused), 'aVR');
      assert.notEqual(badge.text, 'T↑ остр.', `${id}/${dominance}/${time}/${reperfused}`);
      assert.notEqual(badge.text, 'T↓ кор.', `${id}/${dominance}/${time}/${reperfused}`);
    }
  }
});

test('БЛНПГ: ширина QRS 148 мс, критерии Сгарбосса/Смита и норма дискордантности', () => {
  const stage = computeStageModifiers(.35, false);
  for (const id of ['lbbb_sgarbossa', 'lbbb_benign']) {
    const m = getEcgMeasurements(72, false, CORONARY_CASES[id].qrsPattern);
    assert.equal(m.qrsMs, 148);
    const rr = 60 / m.hr;
    const timing = getBeatTiming(rr, false, 'lbbb');
    // Проверяем реальную ненулевую ширину QRS на чистой кривой БЛНПГ с нулевым J
    const signal = generateLeadSignal('V5', undefined, stage, rr, 10000, m.hr, { ...options, qrsPattern: 'lbbb' });
    let activeStart = null;
    let activeEnd = null;
    for (let i = Math.floor(timing.qrsOnset * 10000); i <= Math.ceil((timing.j + 0.01) * 10000); i++) {
      if (Math.abs(signal[i]) > 1e-8) {
        if (activeStart === null) activeStart = i / 10;
        activeEnd = i / 10;
      }
    }
    close(activeEnd - activeStart, 148, 1, `${id}: ширина QRS`);
  }

  // Сгарбосса / Смит: конкордантный ST↑ >= 1.5 мм в V5 и |ST/S| >= 0.25 в V2
  const stV5Sgarb = getJShiftMm(CORONARY_CASES.lbbb_sgarbossa.leads.V5, stage);
  assert.ok(stV5Sgarb >= 1.5, `Ожидался конкордантный ST↑ в V5, получено ${stV5Sgarb}`);
  const stV2Sgarb = getJShiftMm(CORONARY_CASES.lbbb_sgarbossa.leads.V2, stage);
  assert.ok(stV2Sgarb / 17.5 >= 0.25, `Ожидалось |ST/S| >= 0.25 в V2, получено ${stV2Sgarb / 17.5}`);

  // Неосложнённая БЛНПГ: дискордантная депрессия в V5 (< 0) и пропорциональный ST в V2 (|ST/S| < 0.20)
  const stV5Benign = getJShiftMm(CORONARY_CASES.lbbb_benign.leads.V5, stage);
  assert.ok(stV5Benign < 0, `Ожидалась дискордантность в V5, получено ${stV5Benign}`);
  const stV2Benign = getJShiftMm(CORONARY_CASES.lbbb_benign.leads.V2, stage);
  assert.ok(stV2Benign / 17.5 < 0.2, `Ожидалось |ST/S| < 0.20 в V2, получено ${stV2Benign / 17.5}`);
});

test('Острый перикардит (смещение PR без Q) и Такоцубо (без подъёма в V1 и гигантские T↓)', () => {
  const acute = computeStageModifiers(.35, false);
  const subacute = computeStageModifiers(.8, false);
  const chronic = computeStageModifiers(1.0, false);
  const rr = 60 / 90;
  const timing = getBeatTiming(rr);
  const tPrMid = (timing.pEnd + timing.qrsOnset) / 2;

  // Перикардит: депрессия PR в II, подъём PR в aVR, отсутствие патологического Q на стадии рубца
  const prII = sampleBeatMv(tPrMid, rr, 'II', CORONARY_CASES.pericarditis.leads.II, acute, options) * 10;
  const prAvr = sampleBeatMv(tPrMid, rr, 'aVR', CORONARY_CASES.pericarditis.leads.aVR, acute, options) * 10;
  assert.ok(prII < -0.3, `Ожидалась депрессия PR в II, получено ${prII}`);
  assert.ok(prAvr > 0.3, `Ожидался подъём PR в aVR, получено ${prAvr}`);
  const qPeric = sampleBeatMv(timing.qrsOnset + 0.014, rr, 'V4', CORONARY_CASES.pericarditis.leads.V4, chronic, options);
  const qNorm = sampleBeatMv(timing.qrsOnset + 0.014, rr, 'V4', undefined, chronic, options);
  close(qPeric, qNorm, 1e-6, 'Перикардит не должен формировать зубец Q');

  // Такоцубо: подъём ST в V4, интактный V1, гигантский отрицательный T в подострой фазе без Q
  assert.ok(getJShiftMm(CORONARY_CASES.takotsubo.leads.V4, acute) >= 2.0);
  assert.equal(getJShiftMm(CORONARY_CASES.takotsubo.leads.V1, acute), 0);
  const tTako = Array.from({ length: 101 }, (_, i) =>
    sampleBeatMv(timing.tOnset + (timing.tEnd - timing.tOnset) * i / 100, rr, 'V4', CORONARY_CASES.takotsubo.leads.V4, subacute, options)
  );
  assert.ok(Math.min(...tTako) < -0.6, 'Ожидалась глубокая симметричная инверсия T при Такоцубо');
  const qTako = sampleBeatMv(timing.qrsOnset + 0.014, rr, 'V4', CORONARY_CASES.takotsubo.leads.V4, chronic, options);
  assert.ok(qTako >= qNorm - 0.05, 'Такоцубо не должен формировать глубокий некротический Q');
});

test('Нарушения проводимости и ритма (АВ-блок I ст., Мобитц I Венкебах, ЖЭС) и векторный анализ ЭОС/ST', () => {
  const stage = computeStageModifiers(.35, false);
  const rr = 60 / 72;

  // 1. АВ-блокада I ст.: PR = 248 мс, нормальное положение QRS сдвинуто на +86 мс
  const mAv1 = getEcgMeasurements(72, false, 'normal', 'av_block_1');
  assert.equal(mAv1.prMs, 248);
  const { qrsOnset: av1Qrs } = getBeatTiming(rr, false, 'normal', 0.248);
  const sigAv1 = generateLeadSignal('II', undefined, stage, rr, 1000, 72, { ...options, rhythmDisorder: 'av_block_1' });
  const rPeakSample = sigAv1[Math.round((av1Qrs + 0.044) * 1000)];
  assert.ok(rPeakSample > 0.7, `Пик R при АВ-блок I должен быть в смещённом окне, получено ${rPeakSample}`);

  // 2. Периодика Венкебаха (Мобитц I): прогрессирующее удлинение PR и выпадение QRS на 4-м ударе
  const wenckOpts = { ...options, rhythmDisorder: 'wenckebach' };
  const prSlots = [0.162, 0.215, 0.268];
  for (let slot = 0; slot < 3; slot++) {
    const rTime = slot * rr + 0.02 + prSlots[slot] + 0.04;
    const v = sampleEcgAtTimeMv(rTime, rr, 'II', undefined, stage, wenckOpts);
    assert.ok(v > 0.65, `Слот ${slot}: ожидался проведённый R, получено ${v}`);
  }
  // 4-й слот: P сохранён (t = 3*rr + 0.07), QRS отсутствует (t = 3*rr + 0.02 + 0.22 + 0.04)
  assert.ok(sampleEcgAtTimeMv(3 * rr + 0.07, rr, 'II', undefined, stage, wenckOpts) > 0.1, 'Должен быть заблокированный P');
  assert.equal(sampleEcgAtTimeMv(3 * rr + 0.26, rr, 'II', undefined, stage, wenckOpts), 0, 'QRS на 4-м ударе должен выпасть');

  // 3. ЖЭС: на 4-м слоте преждевременный широкий комплекс и затем тихая компенсаторная пауза на месте пропущенного синусового удара
  const pvcOpts = { ...options, rhythmDisorder: 'pvc' };
  const pvcStart = 2 * rr + Math.max(0.38, 0.66 * rr);
  assert.ok(sampleEcgAtTimeMv(pvcStart + 0.045, rr, 'II', undefined, stage, pvcOpts) > 0.8, 'Ожидался широкий комплекс ЖЭС');
  assert.ok(sampleEcgAtTimeMv(3 * rr + 0.06, rr, 'II', undefined, stage, pvcOpts) <= 0, 'Не должно быть положительного синусового P во время реполяризации ЖЭС');
  assert.equal(sampleEcgAtTimeMv(3 * rr + 0.25, rr, 'II', undefined, stage, pvcOpts), 0, 'Компенсаторная пауза на изолинии');

  // 4. Фронтальные векторы (ЭОС + вектор ST на круге Кабрера)
  const normVec = computeFrontalVectors(CORONARY_CASES.normal.leads, stage, 72, options);
  assert.ok(normVec.qrsAxisDeg >= -30 && normVec.qrsAxisDeg <= 90, `ЭОС нормы вне диапазона: ${normVec.qrsAxisDeg}`);
  assert.equal(normVec.stAxisDeg, null);

  const rcaVec = computeFrontalVectors(CORONARY_CASES.rca_prox.leads, stage, 54, options);
  assert.ok(rcaVec.stAxisDeg !== null && rcaVec.stAxisDeg > 70 && rcaVec.stAxisDeg < 140, `Вектор ST при ПКА должен смотреть вниз/вправо (+70..+140°), получено ${rcaVec.stAxisDeg}`);

  const d1Vec = computeFrontalVectors(CORONARY_CASES.d1.leads, stage, 78, options);
  assert.ok(d1Vec.stAxisDeg !== null && d1Vec.stAxisDeg < -10 && d1Vec.stAxisDeg > -80, `Вектор ST при D1 должен смотреть влево-вверх (-10..-80°), получено ${d1Vec.stAxisDeg}`);
});
