import * as THREE from 'three';
import { mesh, rng, standard, vec } from './craft';
import { facilityDistance, pathDistance } from './terrain';
import { NORTH, SETTLEMENT_SCALE, placeOnPlanet, plotDirection, surfacePoint } from './planet-surface';
import { makeShrub, treeLocations } from './trees';

export function makeDecor(parent: THREE.Object3D) {
  const random = rng(73), dummy = new THREE.Object3D();
  const wrapInstance = () => {
    const { x, y, z } = dummy.position;
    const localRotation = dummy.quaternion.clone();
    dummy.position.copy(surfacePoint(x, z, y));
    dummy.quaternion.setFromUnitVectors(NORTH, plotDirection(x, z)).multiply(localRotation);
    dummy.scale.multiplyScalar(SETTLEMENT_SCALE);
  };
  const positions: number[] = [], colors: number[] = [];
  const light = new THREE.Color('#a6ad61'), dark = new THREE.Color('#7c904c');
  for (let i = 0; i < 32000; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 6 * .997;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (pathDistance(x, z) < .34 + random() * .12 || facilityDistance(x, z) < .18) continue;
    if (treeLocations.some(t => Math.hypot(t.x - x, t.z - z) < .3)) continue;
    const y = 0 + .005, h = .035 + random() * .085, w = .01 + random() * .013, angle = random() * Math.PI * 2;
    const dx = Math.cos(angle) * w, dz = Math.sin(angle) * w, leanX = (random() - .5) * .09, leanZ = (random() - .5) * .09;
    positions.push(x - dx, y, z - dz, x + dx, y, z + dz, x + leanX, y + h, z + leanZ);
    const c = dark.clone().lerp(light, random());
    for (let j = 0; j < 3; j++) { const scale = j === 2 ? 1.1 : .82; colors.push(c.r * scale, c.g * scale, c.b * scale); }
  }
  for (let i = 0; i < positions.length; i += 3) surfacePoint(positions[i], positions[i + 2], positions[i + 1]).toArray(positions, i);
  const grass = new THREE.BufferGeometry(); grass.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); grass.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); grass.computeVertexNormals();
  const grassNormals = grass.attributes.normal;
  for (let i = 0; i < grassNormals.count; i++) { const n = vec(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]).normalize(); grassNormals.setXYZ(i, n.x, n.y, n.z); }
  const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, color: '#bbcb9b' });
  grassMat.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', '')); };
  grassMat.customProgramCacheKey = () => 'grass-soft-normal';
  const m = mesh(grass, grassMat, parent); m.castShadow = false;

  const rockGeo = new THREE.IcosahedronGeometry(1, 1), pos = rockGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), distortion = 1 + .11 * Math.sin(x * 9 + z * 5) * Math.cos(y * 8); pos.setXYZ(i, x * distortion, y * distortion, z * distortion); }
  rockGeo.computeVertexNormals();
  const rocks = new THREE.InstancedMesh(rockGeo, standard('#acac96'), 190);
  for (let i = 0; i < 190; i++) {
    let x: number, z: number, size: number;
    if (i < 24) { const a = random() * Math.PI * 2; const r = 6 * (.95 + random() * .045); x = Math.cos(a) * r; z = Math.sin(a) * r; size = .14 + random() * .25; }
    else { const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 5.55; x = Math.cos(a) * r; z = Math.sin(a) * r; size = .025 + random() * .06; if (pathDistance(x, z) > .9 && facilityDistance(x, z) > .3 && i < 44) size = .25 + random() * .18; }
    dummy.position.set(x, 0 - size * .27, z); dummy.rotation.set(random(), random() * 6, random()); dummy.scale.set(size * (1 + random() * .6), size * .7, size); wrapInstance(); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
    rocks.setColorAt(i, new THREE.Color().setHSL(.12, .1, .74 + random() * .16));
  }
  rocks.castShadow = true; rocks.receiveShadow = true; parent.add(rocks);
  const bushes = [[-4.5, -2.5, .27], [-4.7, 1, .34], [-3.9, 3, .26], [-1.5, -4.5, .31], [1.8, -4.2, .32], [4.8, -1.8, .3], [4.3, 1.5, .27], [2.9, 4.3, .25], [-1.5, 4.4, .24]];
  bushes.forEach(([x, z, size], i) => { const b = makeShrub(i * 37 + 3, size); placeOnPlanet(b, x, z); parent.add(b); });

  // Small daisy patches have stems, warm hearts and five ivory petals.
  const flowerGeo = new THREE.SphereGeometry(1, 5, 3);
  const flowers = new THREE.InstancedMesh(flowerGeo, standard('#f3eac1'), 450);
  const hearts = new THREE.InstancedMesh(new THREE.SphereGeometry(.016, 6, 4), standard('#d4ad52'), 75);
  for (let i = 0; i < 75; i++) {
    const patch = [[-1.9, 2.5], [-4.3, .3], [2.7, 3.6], [4.5, -2], [-.8, -4.3]][i % 5];
    const x = patch[0] + (random() - .5) * .9, z = patch[1] + (random() - .5) * .8, y = 0 + .1 + random() * .06;
    dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); wrapInstance(); dummy.updateMatrix(); hearts.setMatrixAt(i, dummy.matrix);
    for (let p = 0; p < 6; p++) { const a = p / 6 * Math.PI * 2; dummy.position.set(x + Math.cos(a) * .024, y, z + Math.sin(a) * .024); dummy.rotation.set(0, -a, 0); dummy.scale.set(.026, .009, .012); wrapInstance(); dummy.updateMatrix(); flowers.setMatrixAt(i * 6 + p, dummy.matrix); }
  }
  parent.add(flowers, hearts);

  // Fallen leaves collect at tree bases, leaving the route open.
  const fallen = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 5), standard('#b49a4c'), 250);
  for (let i = 0; i < 250; i++) { const t = treeLocations[i % 5], a = random() * 7, r = .35 + random() * .9; const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r; dummy.position.set(x, 0 + .014, z); dummy.rotation.set(-Math.PI / 2, 0, random() * 7); dummy.scale.set(.022, .05, 1); wrapInstance(); dummy.updateMatrix(); fallen.setMatrixAt(i, dummy.matrix); }
  parent.add(fallen);
}
