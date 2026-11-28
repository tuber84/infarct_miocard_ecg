import { Box3, Mesh, SphereGeometry, Vector3 } from 'three';

/** Купол в координатах экспорта. Край следует габаритам лёгких, вершина прилегает к сердцу. */
export function createDiaphragmGeometry(heart: Mesh, lungBounds: Box3): SphereGeometry {
  const positions = heart.geometry.getAttribute('position');
  const vertex = new Vector3();
  const contact = new Vector3(0, Infinity, 0);
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i).applyMatrix4(heart.matrixWorld);
    if (vertex.y < contact.y) contact.copy(vertex);
  }

  const center = lungBounds.getCenter(new Vector3());
  const size = lungBounds.getSize(new Vector3());
  const rimY = lungBounds.min.y - size.y * 0.025;
  const polarAngle = Math.PI * 0.36;
  const geometry = new SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, polarAngle);
  const rimCos = Math.cos(polarAngle);
  const rimSin = Math.sin(polarAngle);
  const dome = geometry.getAttribute('position');

  for (let i = 0; i < dome.count; i++) {
    const height = Math.max(0, (dome.getY(i) - rimCos) / (1 - rimCos));
    const offsetWeight = height * height;
    dome.setXYZ(
      i,
      center.x + dome.getX(i) * size.x / (2 * rimSin) + (contact.x - center.x) * offsetWeight,
      rimY + (contact.y - rimY) * height,
      center.z + dome.getZ(i) * size.z / (2 * rimSin) + (contact.z - center.z) * offsetWeight
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}
