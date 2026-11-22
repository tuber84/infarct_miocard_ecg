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

const { sampleBeatMv, generateLeadSignal, getBeatTiming, getEcgMeasurements, computeStageModifiers, getLeadBadge, DE_WINTER_STAGE_SUMMARIES, STAGE_PRESETS } = require('../src/core/ecg/ecgEngine.ts');
const { CORONARY_CASES, resolveCaseForDominance, STANDARD_LEADS, EXTRA_LEADS } = require('../src/core/content/coronaryCases.ts');
const options = { aivr: false, artifacts: false };
const rates = [40, 45, 54, 72, 95, 135, 150];
const close = (a, b, tolerance, context) => assert.ok(Math.abs(a - b) <= tolerance, `${context}: ${a} ≠ ${b}`);

test('J совпадает с заданным смещением во всех сценариях, стадиях и типах кровоснабжения', () => {
  for (const id of Object.keys(CORONARY_CASES)) for (const dominance of ['right', 'left']) {
    const { leads } = resolveCaseForDominance(id, dominance);
    for (const hr of rates) for (const reperfused of [false, true]) for (const time of [0, .12, .35, .58, .8, 1]) {
      const stage = computeStageModifiers(time, reperfused);
      const rr = 60 / hr;
      const { j } = getBeatTiming(rr);
      for (const lead of [...STANDARD_LEADS, ...EXTRA_LEADS]) {
        const p = leads[lead];
        const factor = p?.deWinterT ? stage.deWinterFactor : p?.isSubendocardial ? stage.subendoStFactor : p?.isReciprocal ? stage.reciprocalFactor : stage.stFactor;
        const expected = (p?.stMm ?? 0) * factor;
        const actual = sampleBeatMv(j, rr, lead, p, stage, options) * 10;
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
    const p = CORONARY_CASES[id].leads.V3;
    const rr = 60 / hr;
    const { j } = getBeatTiming(rr);
    const signal = generateLeadSignal('V3', p, stage, 4, 1000, hr, options, .137);
    const when = rr + j - .137;
    const x = when * 1000, i = Math.floor(x);
    const interpolated = signal[i] + (signal[i+1] - signal[i]) * (x-i);
    close(interpolated, sampleBeatMv(j, rr, 'V3', p, stage, options), .005, 'J на ленте');
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
