import * as THREE from 'three';

export const PLANET_RADIUS = 8.4;
export const MIN_ELEVATION = -1.4;
export const SETTLEMENT_SCALE = .55;
export const NORTH = new THREE.Vector3(0, 1, 0);
export const BACK_LAND = new THREE.Vector3(.18, -.42, -.89).normalize();
const west = new THREE.Vector3(-.86, -.4, .32).normalize();
const bay = new THREE.Vector3(-.34, .63, .7).normalize();
const ridge = new THREE.Vector3(.48, .8, -.35).normalize();
const backBay = new THREE.Vector3(.68, -.16, -.72).normalize();

/** A global 3D field has neither a longitude seam nor an unmodeled hemisphere. */
export function landField(n: THREE.Vector3) {
  const broad = .045 * Math.sin(n.x * 13 + n.z * 7) * Math.cos(n.y * 11 - n.z * 6);
  const fine = .018 * Math.sin(n.x * 31 + n.y * 17) * Math.cos(n.z * 27 - n.x * 9);
  const main = n.y - .46 - .52 * Math.exp((n.dot(bay) - 1) / .045);
  const rear = n.dot(BACK_LAND) - .73 + .055 * Math.sin(n.x * 7 - n.y * 5) - .26 * Math.exp((n.dot(backBay) - 1) / .018);
  const western = n.dot(west) - .81 + .05 * Math.sin(n.y * 9 + n.z * 6);
  return Math.max(main, rear, western) + broad + fine;
}

export function elevation(n: THREE.Vector3) {
  const field = landField(n);
  if (field < 0) return Math.max(MIN_ELEVATION, field * 5);
  const rise = .055 * (1 - Math.exp(-field * 30)) + field * .32;
  const mountain = Math.exp((n.dot(ridge) - 1) / .016) * .66;
  const backRidge = Math.exp((n.dot(BACK_LAND) - 1) / .035) * .28;
  const grain = .003 * Math.sin(n.x * 46 + n.z * 18) * Math.sin(n.y * 39 - n.z * 25);
  return rise + (mountain + backRidge + grain) * THREE.MathUtils.smoothstep(field, 0, .08);
}

/** Exponential map from the settlement plan to the sphere, shared by roads and feet. */
export function plotDirection(x: number, z: number) {
  const distance = Math.hypot(x, z), angle = distance * SETTLEMENT_SCALE / PLANET_RADIUS;
  if (distance < 1e-9) return NORTH.clone();
  return new THREE.Vector3(Math.sin(angle) * x / distance, Math.cos(angle), Math.sin(angle) * z / distance);
}

export function surfacePoint(x: number, z: number, altitude = 0) {
  const n = plotDirection(x, z);
  return n.multiplyScalar(PLANET_RADIUS + elevation(n) + altitude * SETTLEMENT_SCALE);
}

export function placeOnPlanet(object: THREE.Object3D, x: number, z: number, yaw = 0, scale = 1, altitude = 0) {
  const n = plotDirection(x, z);
  object.position.copy(surfacePoint(x, z, altitude));
  object.quaternion.setFromUnitVectors(NORTH, n); object.rotateY(yaw);
  object.scale.setScalar(SETTLEMENT_SCALE * scale);
}

export function planetGeometry(widthSegments = 256, heightSegments = 128) {
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.attributes.position, n = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    n.fromBufferAttribute(positions, i).normalize();
    // Collapse the floating-point copies of pole/seam coordinates to exact shared positions.
    if (Math.abs(n.x) < 1e-12) n.x = 0;
    if (Math.abs(n.y) < 1e-12) n.y = 0;
    if (Math.abs(n.z) < 1e-12) n.z = 0;
    n.multiplyScalar(PLANET_RADIUS + elevation(n));
    positions.setXYZ(i, n.x, n.y, n.z);
  }
  geometry.computeVertexNormals(); return geometry;
}

export function dragRotation(previous: THREE.Vector3, current: THREE.Vector3, cameraRotation: THREE.Quaternion) {
  return cameraRotation.clone().multiply(new THREE.Quaternion().setFromUnitVectors(previous, current)).multiply(cameraRotation.clone().invert());
}
