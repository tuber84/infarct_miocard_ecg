// Обновление ориентиров после повторного экспорта GLB правого или левого типа из Houdini.
import fs from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Vector3 } from 'three';

const RIGHT_PARENT = {
  LMCA: null, LAD_prox: 'LMCA', LAD_mid: 'LAD_prox', LAD_dist: 'LAD_mid',
  D1: 'LAD_prox', D2: 'LAD_mid', LCx: 'LMCA', OM1: 'LCx',
  RCA_prox: null, RCA_mid: 'RCA_prox', RCA_dist: 'RCA_mid', PDA: 'RCA_dist', PLB: 'RCA_dist',
};

const LEFT_PARENT = {
  ...RIGHT_PARENT,
  PDA: 'LCx',
  PLB: 'LCx',
};

const key = v => v.toArray().map(x => x.toFixed(6)).join(',');
const mean = a => a.reduce((s, v) => s.add(v), new Vector3()).divideScalar(a.length);

async function extractGeometry(glbPath, parentMap) {
  const file = fs.readFileSync(glbPath);
  const { scene } = await new GLTFLoader().parseAsync(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    ''
  );
  const meshes = {};
  scene.traverse(m => { if (m.isMesh) meshes[m.name] = m; });

  const points = {};
  for (const [name, m] of Object.entries(meshes)) {
    const p = m.geometry.attributes.position;
    points[name] = Array.from({ length: p.count }, (_, i) => new Vector3().fromBufferAttribute(p, i));
  }

  const output = {};
  for (const [name, up] of Object.entries(parentMap)) {
    const p = points[name];
    if (!p || !p.length) throw new Error(`Отсутствует меш ${name} в ${glbPath}`);
    const center = mean(p);
    let entry = null;
    if (up) {
      const set = new Set(points[up].map(key));
      const boundary = p.filter(v => set.has(key(v)));
      entry = boundary.length ? mean(boundary) : null;
    }
    if (!entry) {
      const sorted = [...p].sort((a, b) => b.y - a.y);
      entry = mean(sorted.slice(0, Math.max(3, Math.floor(p.length * 0.015))));
    }
    const direction = center.clone().sub(entry).normalize();
    const end = p.reduce(
      (best, v) => v.clone().sub(entry).dot(direction) > best.clone().sub(entry).dot(direction) ? v : best,
      p[0]
    );
    // Маркер ставится на реальную вершину входного сечения сегмента.
    const anchor = p.reduce(
      (best, v) => v.distanceToSquared(entry) < best.distanceToSquared(entry) ? v : best,
      p[0]
    );
    output[name] = {
      entry: entry.toArray(),
      end: end.toArray(),
      marker: anchor.toArray(),
      tangent: direction.toArray(),
    };
  }
  return output;
}

const rightPath = process.argv[2] ?? 'public/models/heart/heart_segmented.glb';
const leftPath = process.argv[3] ?? 'public/models/heart/heart_artery_left_type.glb';

const rightGeometry = await extractGeometry(rightPath, RIGHT_PARENT);
const leftGeometry = await extractGeometry(leftPath, LEFT_PARENT);

const tsSource =
  '// Геометрические ориентиры из heart_segmented.glb (правый тип) и heart_artery_left_type.glb (левый тип); координаты исходного экспорта Houdini.\n' +
  `export const HEART_SEGMENT_GEOMETRY = ${JSON.stringify(rightGeometry, null, 2)} as const;\n\n` +
  `export const HEART_SEGMENT_GEOMETRY_LEFT = ${JSON.stringify(leftGeometry, null, 2)} as const;\n\n` +
  "export function getHeartSegmentGeometry(dominance: 'right' | 'left') {\n" +
  "  return dominance === 'left' ? HEART_SEGMENT_GEOMETRY_LEFT : HEART_SEGMENT_GEOMETRY;\n" +
  '}\n';

fs.writeFileSync('src/presentation/heartSegmentGeometry.ts', tsSource);
console.log('right:', Object.keys(rightGeometry).length, 'left:', Object.keys(leftGeometry).length);
