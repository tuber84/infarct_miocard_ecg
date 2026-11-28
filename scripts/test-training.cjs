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

const core = require('../src/core/index.ts');
const s = core.FIRST_CLINICAL_CASE;
const now = '2026-11-22T10:00:00.000Z';
const fresh = () => core.createAttempt(s, 'test-attempt', now);
const { loadAttempts, saveAttempts } = require('../src/platform/trainingStorage.ts');

test('Авторский случай проходит проверку структуры', () => {
  assert.deepEqual(core.validateScenario(s), []);
  assert.equal(s.steps.filter(step=>step.question).length,3);
});

test('До ответа экран не получает разбор, диагноз, правильные ответы и будущую КАГ', () => {
  const v=core.getTrainingView(s,fresh());
  assert.equal(v.debrief,null);
  assert.equal(v.feedback,null);
  assert.deepEqual(v.results,[]);
  assert.equal(v.question.acceptedChoiceIds,undefined);
  assert.equal(v.question.explanation,undefined);
  assert.equal(v.step.question,undefined);
  assert.equal(v.step.showExtraLeads,undefined);
  assert.equal(JSON.stringify(v).includes('тромботическая окклюзия'),false);
});

test('Нельзя пропустить вопрос, записать неизвестный ответ или изменить принятый', () => {
  const a=fresh();
  assert.throws(()=>core.advanceAttempt(s,a,now));
  assert.throws(()=>core.answerQuestion(s,a,'missing',now));
  const answered=core.answerQuestion(s,a,'inferior-ste',now);
  assert.deepEqual(a.answers,{});
  assert.throws(()=>core.answerQuestion(s,answered,'normal',now));
  assert.equal(core.getTrainingView(s,answered).feedback.correct,true);
});

test('Последовательное прохождение с ошибкой даёт 2/3 и сохраняет первый ответ', () => {
  let a=fresh();
  for(let i=0;i<s.steps.length;i++) {
    const q=s.steps[i].question;
    if(q) a=core.answerQuestion(s,a,i===0?'normal':q.acceptedChoiceIds[0],now);
    a=core.advanceAttempt(s,a,now);
  }
  const v=core.getTrainingView(s,a);
  assert.equal(v.completed,true);
  assert.equal(v.score,2);
  assert.equal(v.results.length,3);
  assert.equal(v.results[0].correct,false);
  assert.ok(v.debrief.diagnosis);
  assert.throws(()=>core.advanceAttempt(s,a,now));
  assert.deepEqual(core.restoreAttempt(s,JSON.parse(JSON.stringify(a))),a);
});

test('Восстановление отклоняет подмену редакции, пропуск вопроса и чужие ответы', () => {
  for(const bad of [null,{}, {...fresh(),scenarioRevision:99}, {...fresh(),stepIndex:2}, {...fresh(),answers:{later:{choiceId:'right',answeredAt:now}}}, {...fresh(),stepIndex:5,completedAt:now}]) assert.equal(core.restoreAttempt(s,bad),null);
  assert.throws(()=>core.answerQuestion(s,{...fresh(),scenarioRevision:99},'normal',now));
  const a=core.answerQuestion(s,fresh(),'normal',now);
  assert.deepEqual(core.restoreAttempt(s,JSON.parse(JSON.stringify(a))),a);
});

test('Хранилище восстанавливает ответы и этап, сообщает ошибки и не стирает повреждённую запись', () => {
  let value=null;
  global.localStorage={getItem:()=>value,setItem:(_k,v)=>{value=v;}};
  const a=core.advanceAttempt(s,core.answerQuestion(s,fresh(),'normal',now),now);
  assert.equal(saveAttempts([a]),null);
  assert.deepEqual(loadAttempts(s),{attempts:[a],error:null});
  value='{broken';
  assert.ok(loadAttempts(s).error);
  assert.equal(value,'{broken');
  global.localStorage={getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('quota')}};
  assert.ok(loadAttempts(s).error);
  assert.ok(saveAttempts([a]));
  delete global.localStorage;
});

test('Второй случай сохраняет отметки, выбор отведений и проекцию КАГ', () => {
  const scenario = core.POSTERIOR_CLINICAL_CASE;
  assert.deepEqual(core.validateScenario(scenario), []);
  let attempt = core.createAttempt(scenario, 'posterior-attempt', now);
  assert.equal(core.getTrainingView(scenario, attempt).reviewSteps.length, 0);
  assert.throws(() => core.answerQuestion(scenario, attempt, 'posterior', now));
  assert.throws(() => core.answerQuestion(scenario, attempt, 'posterior', now, { markedLeads: ['V8'] }));
  const answerAndAdvance = (choice, evidence) => {
    attempt = core.answerQuestion(scenario, attempt, choice, now, evidence);
    attempt = core.advanceAttempt(scenario, attempt, now);
  };
  answerAndAdvance('posterior', { markedLeads: ['V1', 'V2'] });
  answerAndAdvance('right');
  assert.deepEqual(core.getTrainingView(scenario, attempt).step.extraLeads, ['V7', 'V8', 'V9']);
  answerAndAdvance('supports');
  assert.throws(() => core.answerQuestion(scenario, attempt, 'posterior', now, {
    angiography: { system: 'RCA', laoDeg: 500, cranDeg: 20 },
  }));
  const angiography = { system: 'RCA', laoDeg: 35, cranDeg: 20 };
  answerAndAdvance('posterior', { angiography });
  const restored = core.restoreAttempt(scenario, JSON.parse(JSON.stringify(attempt)));
  const view = core.getTrainingView(scenario, restored);
  assert.equal(view.score, 3);
  assert.deepEqual(view.results[0].evidence, { markedLeads: ['V1', 'V2'] });
  assert.deepEqual(view.results[3].evidence, { angiography });
  assert.deepEqual(view.reviewSteps.map(step => step.kind), ['ecg', 'ecg', 'angiography']);

  const store = new Map();
  global.localStorage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  try {
    const first = fresh();
    assert.equal(saveAttempts([first]), null);
    assert.equal(saveAttempts([restored], scenario.id), null);
    assert.deepEqual(loadAttempts(s).attempts, [first]);
    assert.deepEqual(loadAttempts(scenario).attempts, [restored]);
  } finally {
    delete global.localStorage;
  }
});
