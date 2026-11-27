// Проверки контракта между экспортом Houdini, маркерами и бассейнами КАГ (правый и левый типы).
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
const { HEART_LANDMARKS, getHeartLandmarks } = require('../src/presentation/heartLandmarks.ts');
const { ARTERY_SEGMENTS, affectedArterySegments, segmentContrastDistance } = require('../src/presentation/segmentedHeart.ts');
const { CASE_ORDER, CORONARY_CASES } = require('../src/core/content/coronaryCases.ts');

function getVertexKeySet(mesh) {
  const p = mesh.geometry.attributes.position;
  const set = new Set();
  for (let i = 0; i < p.count; i++) {
    set.add(`${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`);
  }
  return set;
}

function countSharedVertices(meshA, meshB) {
  const a = getVertexKeySet(meshA);
  const b = getVertexKeySet(meshB);
  let count = 0;
  for (const key of a) if (b.has(key)) count++;
  return count;
}

function minDistanceBetweenMeshes(meshA, meshB) {
  const pa = meshA.geometry.attributes.position;
  const pb = meshB.geometry.attributes.position;
  let bestSq = Infinity;
  for (let i = 0; i < pa.count; i++) {
    const ax = pa.getX(i), ay = pa.getY(i), az = pa.getZ(i);
    for (let j = 0; j < pb.count; j++) {
      const dx = ax - pb.getX(j);
      const dy = ay - pb.getY(j);
      const dz = az - pb.getZ(j);
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestSq) bestSq = d2;
    }
  }
  return Math.sqrt(bestSq);
}

function countConnectedComponents(mesh) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const idx = g.index;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const vKey = new Int32Array(pos.count);
  const kMap = new Map();
  for (let i = 0; i < pos.count; i++) {
    const s = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    let id = kMap.get(s);
    if (id === undefined) {
      id = kMap.size;
      kMap.set(s, id);
    }
    vKey[i] = id;
  }
  const adj = Array.from({ length: kMap.size }, () => []);
  for (let t = 0; t < triCount; t++) {
    const a = vKey[idx ? idx.getX(3 * t) : 3 * t];
    const b = vKey[idx ? idx.getX(3 * t + 1) : 3 * t + 1];
    const c = vKey[idx ? idx.getX(3 * t + 2) : 3 * t + 2];
    adj[a].push(b, c);
    adj[b].push(a, c);
    adj[c].push(a, b);
  }
  const vis = new Uint8Array(kMap.size);
  let comps = 0;
  for (let s = 0; s < kMap.size; s++) {
    if (vis[s]) continue;
    comps++;
    const q = [s];
    vis[s] = 1;
    while (q.length) {
      const u = q.pop();
      for (const v of adj[u]) {
        if (!vis[v]) {
          vis[v] = 1;
          q.push(v);
        }
      }
    }
  }
  return comps;
}

test('Экспорт правого типа загружается, сохраняет Cd, нормали и все клинические маркеры на поверхности', async () => {
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
  for (const id of CASE_ORDER.filter(id => CORONARY_CASES[id].lesionType !== 'none')) {
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

test('Экспорт левого типа загружается, сохраняет Cd, нормали, стыки SYNTAX 13->14/15, изоляцию ПКА и маркеры', async () => {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const bytes = fs.readFileSync(path.join(__dirname, '../public/models/heart/heart_artery_left_type.glb'));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = {};
  gltf.scene.traverse(n => { if (n.isMesh) meshes[n.name] = n; });
  assert.equal(Object.keys(meshes).length, 13);
  for (const name of ARTERY_SEGMENTS) {
    const m = meshes[name]; assert.ok(m, name);
    assert.equal(m.geometry.attributes.color.count, m.geometry.attributes.position.count);
    assert.equal(m.geometry.attributes.normal.count, m.geometry.attributes.position.count);
    assert.equal(m.material.vertexColors, true);
  }
  const leftLandmarks = getHeartLandmarks('left');
  for (const id of CASE_ORDER.filter(id => CORONARY_CASES[id].lesionType !== 'none')) {
    const lm = leftLandmarks[id]; assert.ok(lm, id);
    const p = meshes[lm.mesh].geometry.attributes.position;
    let distance = Infinity;
    for (let i = 0; i < p.count; i++) distance = Math.min(distance, Math.hypot(p.getX(i)-lm.localPos[0],p.getY(i)-lm.localPos[1],p.getZ(i)-lm.localPos[2]));
    assert.ok(distance < 1e-6, `${id}: маркер вне сосуда (left)`);
  }
  for (const name of ARTERY_SEGMENTS) {
    const p = meshes[name].geometry.attributes.position;
    for (let i = 0; i < p.count; i += 100) {
      const distance = segmentContrastDistance(name, p.getX(i), p.getY(i), p.getZ(i), 'left');
      assert.ok(Number.isFinite(distance) && distance >= 0 && distance <= 1, `${name} (left)`);
    }
  }
  assert.ok(countSharedVertices(meshes.LCx, meshes.PLB) > 0, 'LCx должна стыковаться с PLB');
  assert.ok(countSharedVertices(meshes.LCx, meshes.PDA) > 0, 'LCx должна стыковаться с PDA');
  for (const target of ['PDA', 'PLB', 'LCx']) {
    assert.equal(countSharedVertices(meshes.RCA_dist, meshes[target]), 0, `RCA_dist не должна стыковаться с ${target}`);
    assert.ok(minDistanceBetweenMeshes(meshes.RCA_dist, meshes[target]) > 0.15, `RCA_dist слишком близко к ${target}`);
  }
  for (const rcaSeg of ['RCA_prox', 'RCA_mid', 'RCA_dist']) {
    assert.equal(countConnectedComponents(meshes[rcaSeg]), 1, `${rcaSeg} должен быть одной связной компонентой`);
  }
});

test('Поражения не затрагивают посторонний бассейн, доминирование переключает нижнее русло, а маркеры ЗМЖВ и ЗБВ разнесены', () => {
  assert.deepEqual(affectedArterySegments('normal','right'), []);
  for (const mimicId of ['lbbb_benign', 'pericarditis', 'early_repol', 'takotsubo']) {
    assert.deepEqual(affectedArterySegments(mimicId, 'right'), [], `${mimicId} не должен поражать артерии (right)`);
    assert.deepEqual(affectedArterySegments(mimicId, 'left'), [], `${mimicId} не должен поражать артерии (left)`);
    assert.equal(HEART_LANDMARKS[mimicId], undefined, `${mimicId} не должен иметь 3D-маркер`);
  }
  assert.ok(affectedArterySegments('lbbb_sgarbossa', 'right').includes('LAD_prox'));
  assert.ok(!affectedArterySegments('lad_prox','right').includes('LCx'));
  assert.ok(affectedArterySegments('lad_mid','right').includes('LAD_dist'));
  assert.ok(!affectedArterySegments('lad_mid','right').includes('LAD_prox'));
  assert.deepEqual(affectedArterySegments('pda','right'), ['PDA']);
  assert.deepEqual(affectedArterySegments('pda','left'), ['PDA']);
  assert.deepEqual(affectedArterySegments('posterior','right'), ['PLB']);
  assert.deepEqual(affectedArterySegments('posterior','left'), ['PLB']);
  assert.ok(affectedArterySegments('nstemi_inf','left').includes('LCx'));
  assert.ok(!affectedArterySegments('nstemi_inf','left').includes('RCA_dist'));
  assert.ok(!affectedArterySegments('rca_prox','left').includes('PDA'));
  for (const dom of ['right', 'left']) {
    const lms = getHeartLandmarks(dom);
    const pPda = lms.pda.localPos;
    const pPlb = lms.posterior.localPos;
    const dist = Math.hypot(pPda[0] - pPlb[0], pPda[1] - pPlb[1], pPda[2] - pPlb[2]);
    assert.ok(dist > 0.1, `${dom}: маркеры ЗМЖВ и ЗБВ слишком близко (${dist.toFixed(4)})`);
  }
});
