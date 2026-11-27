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

const path = require('node:path');
const coreDir = path.resolve(__dirname, '../src/core');
const core = require('../src/core/index.ts');
const { HEART_LANDMARKS } = require('../src/presentation/heartLandmarks.ts');

test('Ядро имеет замкнутый граф импортов без платформенных библиотек', () => {
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!file.endsWith('.ts')) continue;
      const ast = ts.createSourceFile(file, fs.readFileSync(file,'utf8'), ts.ScriptTarget.Latest, true);
      function inspect(node) {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
          const spec = node.moduleSpecifier.text;
          assert.ok(spec.startsWith('.'), `${file}: внешняя зависимость ${spec}`);
          const target = path.resolve(path.dirname(file), spec);
          assert.ok(target.startsWith(coreDir + path.sep), `${file}: выход из ядра ${spec}`);
        }
        if (ts.isCallExpression(node)) {
          assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword, 'Динамический импорт требует пересмотра проверки границ');
          assert.notEqual(node.expression.getText(ast), 'require', 'require запрещён в ядре');
        }
        ts.forEachChild(node, inspect);
      }
      inspect(ast);
    }
  }
  visit(coreDir);
  assert.equal(typeof window, 'undefined');
  assert.equal(typeof document, 'undefined');
  assert.ok(core.generateLeadSignal('II', undefined, core.computeStageModifiers(.35,false), 1, 250,72,{aivr:false,artifacts:false}).length === 250);
});

test('Все профили доступны как версионированные сценарии атласа без данных 3D', () => {
  assert.equal(core.ATLAS_SCENARIOS.length, core.CASE_ORDER.length);
  assert.equal(new Set(core.ATLAS_SCENARIOS.map(s=>s.id)).size, core.CASE_ORDER.length);
  for (const id of core.CASE_ORDER) {
    const scenario = core.getAtlasScenario(id);
    assert.deepEqual(core.validateScenario(scenario), []);
    assert.equal(scenario.kind,'atlas');
    assert.equal(scenario.review.status,'partially-reviewed');
    assert.equal('patient' in scenario,false);
    assert.equal('landmark' in core.CORONARY_CASES[id],false);
    const hasCoronaryLesion = core.CORONARY_CASES[id].lesionType !== 'none';
    if (hasCoronaryLesion) assert.ok(HEART_LANDMARKS[id], `${id}: отсутствует 3D-маркер`);
    else assert.equal(HEART_LANDMARKS[id], undefined, `${id}: мимик без окклюзии не должен иметь 3D-маркер`);
    const replacement = HEART_LANDMARKS[id]?.replacesBaseMarker;
    if(replacement) assert.ok(HEART_LANDMARKS[replacement]);
  }
});

// Технический пример проверяет контракт; не является опубликованной клинической задачей.
function draft() {
  const refs = core.getAtlasScenario('normal').references;
  return {
    schemaVersion:1, id:'test:case', revision:1, kind:'clinical-case', title:'Тест структуры',
    learningObjectives:['Проверка связности данных'], references:refs,
    review:{status:'draft',note:'Техническая фикстура'},
    patient:{ageYears:50,sex:'male',complaint:'Тест',history:'Тест',symptomOnsetMinutesAgo:null,bloodPressure:null,heartRate:72},
    steps:[{id:'ecg',title:'ЭКГ',kind:'ecg',profileId:'normal',dominance:'right',timeline:.35,reperfused:false,heartRate:72,
      question:{id:'q1',prompt:'Тест?',choices:[{id:'a',text:'A'},{id:'b',text:'Б'}],acceptedChoiceIds:['a'],explanation:'Тест',references:refs}}],
    debrief:{diagnosis:'Тест',explanation:'Тест',references:refs}
  };
}

test('Контракт клинической задачи сериализуется и проверяет ответы, этапы и источники', () => {
  const valid = JSON.parse(JSON.stringify(draft()));
  assert.deepEqual(core.validateScenario(valid), []);
  const broken = draft();
  broken.steps[0].question.acceptedChoiceIds = ['missing'];
  broken.steps[0].timeline = 2;
  broken.steps.push({...broken.steps[0]});
  broken.references = [{guidelineId:'missing',sections:[],scope:''}];
  const errors=core.validateScenario(broken);
  assert.ok(errors.some(e=>e.includes('отсутствующий вариант')));
  assert.ok(errors.some(e=>e.includes('диапазона')));
  assert.ok(errors.some(e=>e.includes('идентификатор этапа')));
  assert.ok(errors.some(e=>e.includes('неизвестный источник')));
});
