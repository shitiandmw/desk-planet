import * as THREE from 'three';
import { mesh, rng, vec } from './craft';
import { boulderGeometry, rockMaterial } from './building-kit';
import { elevation, landField, NORTH, PLANET_RADIUS } from './planet-surface';
import { bakeTree, bark, canopyCore, makePinePrototype, makeTree } from './trees';
import { BACKGROUND_TREES } from './world-layout';
import type { SceneryClearance } from './scenery';

const UPLAND_PINES = 42;

/**
 * Background woods, upland conifers, boulders and the atmospheric rim. Trees are a handful of baked prototypes
 * instanced across the globe, so the whole background costs a few draw calls. Returns the number of trees.
 */
export function makePlanetNature(parent: THREE.Object3D, scenery: SceneryClearance) {
  const random = rng(862), dummy = new THREE.Object3D();
  const prototypes = [...[0, 1, 2].map(k => bakeTree(makeTree(300 + k * 17, -1, true))), makePinePrototype(411), makePinePrototype(433)];
  const placements: { n: THREE.Vector3; kind: number; scale: number }[] = [];
  // The gameplay woods keep their exact spots and broadleaf look (lumber rules read BACKGROUND_TREES).
  for (const location of BACKGROUND_TREES) placements.push({ n: vec(...location.normal), kind: location.seed % 3, scale: .14 + random() * .1 });
  // Conifers climb the mountain flanks. They are scenery only: a facility built among them clears its footprint.
  for (let i = 0, pines = 0; i < 3200 && pines < UPLAND_PINES; i++) {
    const y = 1 - 2 * (i + .5) / 3200, a = i * 2.399963, r = Math.sqrt(1 - y * y);
    const n = vec(Math.cos(a) * r, y, Math.sin(a) * r), h = elevation(n);
    if (landField(n) < .06 || h < .2 || h > .66 || random() > .7) continue;
    if (placements.some(p => p.n.distanceTo(n) * PLANET_RADIUS < .42)) continue;
    placements.push({ n, kind: 3 + (i % 2), scale: .12 + random() * .08 }); pines++;
  }
  const warm = new THREE.Color('#f4dc9c');
  prototypes.forEach((proto, kind) => {
    const list = placements.filter(p => p.kind === kind); if (!list.length) return;
    const parts = [new THREE.InstancedMesh(proto.trunk, bark, list.length), new THREE.InstancedMesh(proto.leaves, proto.leafMaterial, list.length)];
    if (proto.core) parts.push(new THREE.InstancedMesh(proto.core, canopyCore, list.length));
    list.forEach((p, i) => {
      dummy.position.copy(p.n).multiplyScalar(PLANET_RADIUS + elevation(p.n) - .015);
      dummy.quaternion.setFromUnitVectors(NORTH, p.n); dummy.rotateY(random() * Math.PI * 2); dummy.scale.setScalar(p.scale); dummy.updateMatrix();
      // Gentle variation between trees; about one broadleaf in eight turns a warmer gold.
      const tint = new THREE.Color(1, 1, 1).multiplyScalar(.9 + random() * .18); if (kind < 3 && random() < .12) tint.multiply(warm);
      parts.forEach((m, j) => { m.setMatrixAt(i, dummy.matrix); if (j) m.setColorAt(i, tint); });
    });
    for (const m of parts) { m.castShadow = m.receiveShadow = true; m.name = 'background-trees'; parent.add(m); }
    if (kind >= 3) for (const m of parts) scenery.register(m, 1.3);
  });

  // Weathered boulders on the coasts and mountain flanks: three shapes, mossy tops, sunk into the slope.
  const shapes = [boulderGeometry(901, 2, .9), boulderGeometry(917, 2, .55), boulderGeometry(933, 2, 1)];
  const rocks = shapes.map(g => new THREE.InstancedMesh(g, rockMaterial, 72)), counts = [0, 0, 0];
  const stone = ['#b5af9f', '#a9ab9f', '#bdb5a2', '#a3a598'].map(c => new THREE.Color(c));
  for (let i = 0, count = 0; i < 1600 && count < 150; i++) {
    const index = (i * 557) % 1600;
    const y = 1 - 2 * (index + .5) / 1600, a = index * 2.399963;
    const n = vec(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y));
    const h = elevation(n), field = landField(n), upland = h > .3;
    if (field < .001 || (field > .06 && !upland) || n.y > .96) continue;
    if (!upland && random() > .28) continue;
    if (placements.some(p => p.n.distanceTo(n) * PLANET_RADIUS < .32)) continue;
    const size = upland ? .2 + random() * .34 : .07 + random() * .13;
    dummy.position.copy(n).multiplyScalar(PLANET_RADIUS + h - size * (upland ? .35 : .15));
    dummy.quaternion.setFromUnitVectors(NORTH, n); dummy.rotateY(random() * 7);
    dummy.scale.set(size * (1 + random() * .4), size * (upland ? 1.5 : .8), size);
    dummy.updateMatrix();
    const k = count++ % 3; rocks[k].setMatrixAt(counts[k], dummy.matrix);
    rocks[k].setColorAt(counts[k]++, stone[Math.floor(random() * stone.length)].clone().multiplyScalar(.9 + random() * .14));
  }
  // Rocks in the shallows, in twos and threes: some break the surface, some lie just under it. Through the clear water
  // their sides, the caustics on them and their shadows on the bed show how deep it is. The tops weather to algae.
  const shallows: THREE.Vector3[] = [];
  for (let i = 0; i < 9000 && shallows.length < 13; i++) {
    const index = (i * 2113) % 9000, y = 1 - 2 * (index + .5) / 9000, a = index * 2.399963;
    const n = vec(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y)), depth = -elevation(n);
    if (depth < .04 || depth > .22 || random() > .35 || shallows.some(p => p.distanceTo(n) * PLANET_RADIUS < 1.2)) continue;
    shallows.push(n);
    const east = vec(0, 1, 0).cross(n).normalize(), north = n.clone().cross(east);
    for (let j = 0, members = 2 + Math.floor(random() * 2); j < members; j++) {
      const spread = j ? .14 + random() * .18 : 0, turn = random() * Math.PI * 2;
      const m = n.clone().addScaledVector(east, Math.cos(turn) * spread / PLANET_RADIUS).addScaledVector(north, Math.sin(turn) * spread / PLANET_RADIUS).normalize();
      const bed = Math.min(0, elevation(m)), size = j ? .05 + random() * .08 : .1 + random() * .12;
      dummy.position.copy(m).multiplyScalar(PLANET_RADIUS + bed + size * .28);
      dummy.quaternion.setFromUnitVectors(NORTH, m); dummy.rotateY(random() * 7);
      dummy.scale.set(size * (1 + random() * .4), size * (.75 + random() * .35), size);
      dummy.updateMatrix();
      const k = (shallows.length + j) % 3; rocks[k].setMatrixAt(counts[k], dummy.matrix);
      rocks[k].setColorAt(counts[k]++, stone[Math.floor(random() * stone.length)].clone().multiplyScalar(.82 + random() * .12));
    }
  }
  rocks.forEach((m, k) => { m.count = counts[k]; m.castShadow = m.receiveShadow = true; m.name = 'boulders'; parent.add(m); scenery.register(m); });

  // A thin atmospheric rim reinforces the round silhouette without obscuring the land.
  const atmosphere = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#a9d4d4') } },
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader: 'uniform vec3 color; varying vec3 n; varying vec3 v; void main(){ float rim=pow(1.-abs(dot(normalize(n),normalize(v))),4.); gl_FragColor=vec4(color,rim*.19); }',
    transparent: true, side: THREE.BackSide, depthWrite: false,
  });
  const rim = mesh(new THREE.SphereGeometry(PLANET_RADIUS + .095, 96, 48), atmosphere, parent); rim.castShadow = rim.receiveShadow = false;
  return placements.length;
}
