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

const { localizeFromManualLeads: localize } = require('../src/core/ecg/localizer.ts');
const { buildManualFallbackLeads } = require('../src/core/ecg/ecgEngine.ts');
const { resolveCaseForDominance } = require('../src/core/content/coronaryCases.ts');

for (const dominance of ['right', 'left']) {
  test(`Одиночный признак не определяет паттерн: ${dominance}`, () => {
    for (const states of [{}, { V2: 'tinv' }, { V1: 'std' }, { aVR: 'ste' }]) {
      const result = localize(states, dominance);
      assert.equal(result.primaryCaseId, null);
      assert.equal(result.secondaryCaseId, null);
      assert.equal('confidence' in result, false);
    }
  });

  test(`Задние отведения рекомендуются и при неполных данных: ${dominance}`, () => {
    const result = localize({ V1: 'std' }, dominance);
    assert.equal(result.primaryCaseId, null);
    assert.deepEqual(result.recommendedExtraLeads, ['V7', 'V8', 'V9']);
  });

  test(`Нижние изменения требуют оценки ПЖ: ${dominance}`, () => {
    const result = localize({ II: 'ste', III: 'ste', aVF: 'ste', aVL: 'std' }, dominance);
    assert.ok(result.recommendedExtraLeads.includes('V3R'));
    assert.ok(result.recommendedExtraLeads.includes('V4R'));
  });

  test(`Вовлечение V6 не исключает гипотезу Велленса B: ${dominance}`, () => {
    const result = localize({ V2: 'tinv', V3: 'tinv', V4: 'tinv', V5: 'tinv', V6: 'tinv' }, dominance);
    assert.ok([result.primaryCaseId, result.secondaryCaseId].includes('wellens_b'));
  });
}

test('Де Винтер и Велленс A не определяются без ввода формы ST/T', () => {
  for (const states of [
    { aVR: 'ste', V2: 'std', V3: 'std', V4: 'std', V5: 'std', V6: 'std' },
    { V2: 'tinv', V3: 'tinv' },
  ]) {
    const result = localize(states, 'right');
    for (const id of [result.primaryCaseId, result.secondaryCaseId]) {
      assert.notEqual(id, 'de_winter');
      assert.notEqual(id, 'wellens_a');
    }
  }
});

test('Несвязанные изменения не создают анатомический диагноз', () => {
  assert.equal(localize({ I: 'ste', V4: 'tinv' }, 'right').primaryCaseId, null);
});

test('Ручная разметка сохраняет каждый выбранный признак', () => {
  const profiles = buildManualFallbackLeads({ II: 'ste', V1: 'std', V2: 'tinv' });
  assert.ok(profiles.II.stMm > 0);
  assert.ok(profiles.V1.stMm < 0);
  assert.ok(profiles.V2.primaryTInversion > 0);
});

test('Изолированная депрессия I и aVL не относит разметку к ПКА и предупреждает о нижних отведениях', () => {
  for (const dominance of ['right', 'left']) {
    const result = localize({ I: 'std', aVL: 'std' }, dominance);
    assert.equal(result.primaryCaseId, 'nstemi_antlat');
    assert.ok(result.reasoning.some((line) => line.includes('II, III, aVF')));
  }
});

test('Левый тип кровоснабжения разделяет ЗМЖВ/ЗБВ от ОВ и исключает сегменты ЛЖ у гипопластичной ПКА', () => {
  assert.deepEqual(resolveCaseForDominance('rca_prox', 'left').ahaSegments, []);
  assert.equal(resolveCaseForDominance('rca_prox', 'left').rvInvolved, true);
  assert.deepEqual(resolveCaseForDominance('rca_dist', 'left').ahaSegments, []);
  assert.ok(resolveCaseForDominance('pda', 'right').arteryName.includes('ПКА'));
  assert.ok(resolveCaseForDominance('pda', 'left').arteryName.includes('ОВ'));
  assert.ok(resolveCaseForDominance('posterior', 'left').arteryName.includes('ОВ'));
  const pureInferiorLeft = localize({ II: 'ste', III: 'ste', aVF: 'ste', aVL: 'std' }, 'left');
  assert.equal(pureInferiorLeft.primaryCaseId, 'pda');
});
