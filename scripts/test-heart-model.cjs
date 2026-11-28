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
const {
  ARTERY_SEGMENTS,
  affectedArterySegments,
  getCollateralDonorSystem,
  segmentContrastDistance,
  segmentRetrogradeDistance,
} = require('../src/presentation/segmentedHeart.ts');
const { getHeartSegmentGeometry } = require('../src/presentation/heartSegmentGeometry.ts');
const { CASE_ORDER, CORONARY_CASES } = require('../src/core/content/coronaryCases.ts');
const { createDiaphragmGeometry } = require('../src/presentation/diaphragm.ts');

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

async function loadModel(name) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const bytes = fs.readFileSync(path.join(__dirname, '../public/models/heart', name));
  return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}

test('Экспорт правого типа загружается, сохраняет Cd, нормали и все клинические маркеры на поверхности', async () => {
  const scene = await loadModel('heart_segmented.glb');
  const meshes = {};
  scene.traverse(n => { if (n.isMesh) meshes[n.name] = n; });
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
  const scene = await loadModel('heart_artery_left_type.glb');
  const meshes = {};
  scene.traverse(n => { if (n.isMesh) meshes[n.name] = n; });
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

test('Поражения не затрагивают посторонний бассейн, доминирование переключает нижнее русло', () => {
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
});

test('Ориентиры КАГ и оба коронарных дерева совмещены в общем масштабе', async () => {
  const { Box3, Vector3 } = await import('three');
  const [right, left, lungs, spine] = await Promise.all(
    ['heart_segmented.glb', 'heart_artery_left_type.glb', 'lungs.glb', 'spine.glb'].map(loadModel)
  );
  const heartBounds = new Box3().setFromObject(right);
  const lungBounds = new Box3().setFromObject(lungs);
  const spineBounds = new Box3().setFromObject(spine);
  const heartSize = heartBounds.getSize(new Vector3());
  const normScale = 3.15 / Math.max(heartSize.x, heartSize.y, heartSize.z);
  assert.ok(lungBounds.min.y < heartBounds.min.y && lungBounds.max.y > heartBounds.max.y);
  assert.ok(Math.abs(spineBounds.getCenter(new Vector3()).x - lungBounds.getCenter(new Vector3()).x) < heartSize.x * 0.1);
  assert.ok(spineBounds.max.z < heartBounds.min.z, 'Позвоночник должен находиться позади сердца');
  const markerPos = (scene, landmark) =>
    scene.getObjectByName(landmark.mesh).localToWorld(new Vector3(...landmark.localPos));
  const rightLm = getHeartLandmarks('right');
  const leftLm = getHeartLandmarks('left');
  for (const id of ['lad_prox', 'rca_prox']) {
    const difference = markerPos(right, rightLm[id]).distanceTo(markerPos(left, leftLm[id])) * normScale;
    assert.ok(difference < 0.2, `${id}: маркеры у проксимальных сегментов должны совпадать после переключения типа`);
  }
  for (const [scene, landmarks] of [[right, rightLm], [left, leftLm]]) {
    const distance = markerPos(scene, landmarks.pda).distanceTo(markerPos(scene, landmarks.posterior)) * normScale;
    assert.ok(distance > 0.25, `Маркеры ЗМЖВ и ЗБВ слишком близко в сцене (${distance.toFixed(4)})`);
  }
});

test('Купол диафрагмы прилегает к нижней поверхности сердца и охватывает основания лёгких', async () => {
  const { Box3, Vector3 } = require('three');
  const [heart, lungs] = await Promise.all(['heart_segmented.glb', 'lungs.glb'].map(loadModel));
  const body = heart.getObjectByName('heart_body');
  const lungBounds = new Box3().setFromObject(lungs, true);
  const heartBounds = new Box3().setFromObject(body, true);
  const dome = createDiaphragmGeometry(body, lungBounds);
  dome.computeBoundingBox();
  const bounds = dome.boundingBox;
  assert.ok(Math.abs(bounds.max.y - heartBounds.min.y) < 1e-6, 'Вершина купола должна касаться сердца');
  assert.ok(bounds.min.y < lungBounds.min.y);
  assert.ok(Math.abs(bounds.getSize(new Vector3()).x - lungBounds.getSize(new Vector3()).x) < 1e-6);
  assert.ok(Math.abs(bounds.getSize(new Vector3()).z - lungBounds.getSize(new Vector3()).z) < 1e-6);
  dome.dispose();
});

test('Коллатерали Rentrop (ретроградный градиент и донорский бассейн) согласованы', () => {
  for (const dom of ['right', 'left']) {
    const geom = getHeartSegmentGeometry(dom);
    for (const seg of ARTERY_SEGMENTS) {
      const { entry, end } = geom[seg];
      const rEntry = segmentRetrogradeDistance(seg, entry[0], entry[1], entry[2], dom);
      const rEnd = segmentRetrogradeDistance(seg, end[0], end[1], end[2], dom);
      assert.ok(rEntry >= 0 && rEntry <= 1 && rEnd >= 0 && rEnd <= 1, `${dom}/${seg} out of [0,1]`);
      assert.ok(rEnd <= rEntry, `${dom}/${seg}: на периферии ретроградная дистанция должна быть <= входной`);
    }
  }

  assert.equal(getCollateralDonorSystem('lad_prox', 'right'), 'RCA');
  assert.equal(getCollateralDonorSystem('rca_prox', 'right'), 'LCA');
  assert.equal(getCollateralDonorSystem('pda', 'right'), 'LCA');
  assert.equal(getCollateralDonorSystem('pda', 'left'), 'RCA');
  assert.equal(getCollateralDonorSystem('normal', 'right'), null);
});
