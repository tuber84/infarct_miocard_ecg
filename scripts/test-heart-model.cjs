// Проверки контракта между экспортом Houdini, маркерами и бассейнами КАГ.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
};
const { HEART_LANDMARKS } = require('../src/presentation/heartLandmarks.ts');
const { ARTERY_SEGMENTS, affectedArterySegments, segmentContrastDistance } = require('../src/presentation/segmentedHeart.ts');
const { CASE_ORDER } = require('../src/core/content/coronaryCases.ts');

test('Экспорт загружается, сохраняет Cd, нормали и все клинические маркеры на поверхности', async () => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const bytes = fs.readFileSync(path.join(__dirname, '../public/models/heart/heart_segmented.glb'));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = {};
  gltf.scene.traverse(n => { if (n.isMesh) meshes[n.name] = n; });
  assert.equal(Object.keys(meshes).length, 14);
  for (const name of ['heart_body', ...ARTERY_SEGMENTS]) {
    const m = meshes[name]; assert.ok(m, name);
    assert.equal(m.geometry.attributes.color.count, m.geometry.attributes.position.count);
    assert.equal(m.geometry.attributes.normal.count, m.geometry.attributes.position.count);
    assert.equal(m.material.vertexColors, true);
  }
  for (const id of CASE_ORDER.filter(id => id !== 'normal')) {
    const lm = HEART_LANDMARKS[id]; assert.ok(lm, id);
    const p = meshes[lm.mesh].geometry.attributes.position;
    let distance = Infinity;
    for (let i = 0; i < p.count; i++) distance = Math.min(distance, Math.hypot(p.getX(i)-lm.localPos[0],p.getY(i)-lm.localPos[1],p.getZ(i)-lm.localPos[2]));
    assert.ok(distance < 1e-6, `${id}: маркер вне сосуда`);
  }
  for (const dominance of ['right', 'left']) for (const id of CASE_ORDER) {
    for (const segment of affectedArterySegments(id, dominance)) assert.ok(meshes[segment], `${id}: ${segment}`);
  }
  for (const name of ARTERY_SEGMENTS) {
    const p = meshes[name].geometry.attributes.position;
    for (let i = 0; i < p.count; i += 100) {
      const distance = segmentContrastDistance(name, p.getX(i),p.getY(i),p.getZ(i),'right');
      assert.ok(Number.isFinite(distance) && distance >= 0 && distance <= 1, name);
    }
  }
});

test('Поражения не затрагивают посторонний бассейн, доминирование переключает нижнее русло', () => {
  assert.deepEqual(affectedArterySegments('normal','right'), []);
  assert.ok(!affectedArterySegments('lad_prox','right').includes('LCx'));
  assert.ok(affectedArterySegments('lad_mid','right').includes('LAD_dist'));
  assert.ok(!affectedArterySegments('lad_mid','right').includes('LAD_prox'));
  assert.ok(affectedArterySegments('nstemi_inf','left').includes('LCx'));
  assert.ok(!affectedArterySegments('nstemi_inf','left').includes('RCA_dist'));
  assert.ok(!affectedArterySegments('rca_prox','left').includes('PDA'));
});
