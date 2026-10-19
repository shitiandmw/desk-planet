import * as THREE from 'three';
import { branchGeometry, leafGeometry, leafMaterial, mesh, rng, vec, woodMaterial, mergeMeshes } from './craft';
import { TREE_LOCATIONS } from './world-layout';

const bark = woodMaterial('#c4ad89', true);
const foliage = leafMaterial();
const leaf = leafGeometry();
export const treeLocations = TREE_LOCATIONS;
export interface Tree { root: THREE.Group; crown: THREE.Group; id: number; seed: number }

export function makeTree(seed: number, id: number, distant = false): Tree {
  const root = new THREE.Group(), crown = new THREE.Group(), trunk = new THREE.Group();
  root.add(trunk, crown); root.userData.treeId = id;
  const random = rng(seed), sign = random() > .5 ? 1 : -1;
  const trunkPath = [vec(0, -.08, 0), vec(.06, .55, .03), vec(-.08 * sign, 1.3, .04), vec(.15 * sign, 2.2, -.03), vec(.05, 3.0, .08), vec(.13, 3.9, -.07)];
  mesh(branchGeometry(trunkPath, [.31, .22, .19, .145, .085, .025], seed, 35), bark, trunk);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + random() * .3, length = .55 + random() * .35;
    mesh(branchGeometry([vec(Math.cos(a) * length, .015, Math.sin(a) * length), vec(Math.cos(a) * .36, .07, Math.sin(a) * .36), vec(Math.cos(a) * .15, .35, Math.sin(a) * .15), vec(0, .65, 0)], [.015, .09, .13, .12], seed + i, 12), bark, trunk);
  }
  // Four principal crown masses supported by four readable branch systems.
  const centers = [vec(-.95, 2.8, .28), vec(.92, 3.05, .28), vec(-.35, 3.8, -.46), vec(.28, 4.22, .03)];
  const scales = [vec(.83, .63, .8), vec(.9, .62, .74), vec(.75, .65, .72), vec(.7, .56, .64)];
  const twigEnds: THREE.Vector3[] = [];
  centers.forEach((center, ci) => {
    center.x += (random() - .5) * .2; center.z += (random() - .5) * .25;
    const start = vec(.04 * sign, 1.35 + ci * .38, .02);
    const mid = start.clone().lerp(center, .55); mid.y -= .15;
    mesh(branchGeometry([start, mid, center.clone().add(vec(0, -.1, 0))], [.14 - ci * .018, .09 - ci * .012, .018], seed + ci, 20), bark, trunk);
    for (let j = 0; j < 7; j++) {
      const a = j / 7 * Math.PI * 2 + random() * .4;
      const end = center.clone().add(vec(Math.cos(a) * scales[ci].x * .7, (random() - .45) * .7, Math.sin(a) * scales[ci].z * .7));
      const startPoint = mid.clone().lerp(center, .45);
      mesh(branchGeometry([startPoint, center.clone().lerp(end, .55), end], [.035, .023, .004], seed + j, 10), bark, trunk); twigEnds.push(end);
    }
  });
  mergeMeshes(trunk);
  const perMass = distant ? 150 : 780, total = perMass * centers.length;
  const foliageGeometry = leaf.clone();
  const crownNormals = new Float32Array(total * 3);
  const leaves = new THREE.InstancedMesh(foliageGeometry, foliage, total);
  const dummy = new THREE.Object3D();
  const palette = ['#829653', '#91a15b', '#9aa966', '#a6b36a', '#778f52', '#b2ba74'].map(c => new THREE.Color(c));
  for (let i = 0; i < total; i++) {
    const ci = Math.floor(i / perMass), c = centers[ci], s = scales[ci];
    const theta = random() * Math.PI * 2, yy = random() * 2 - 1;
    const rr = Math.pow(random(), .25), sin = Math.sqrt(1 - yy * yy);
    const irregular = 1 + .12 * Math.sin(theta * 3 + ci) + .07 * Math.cos(yy * 7);
    dummy.position.set(c.x + sin * Math.cos(theta) * s.x * rr * irregular, c.y + yy * s.y * rr, c.z + sin * Math.sin(theta) * s.z * rr * irregular);
    dummy.rotation.set(random() * 2.5 - .8, random() * Math.PI * 2, random() * Math.PI * 2);
    const size = (distant ? .29 : .17) + random() * .12; dummy.scale.set(size * (.8 + random() * .35), size, size);
    const normal = vec(sin * Math.cos(theta), yy * .5 + .65, sin * Math.sin(theta)).normalize(); normal.toArray(crownNormals, i * 3);
    dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    const color = palette[Math.floor(random() * palette.length)].clone();
    color.multiplyScalar(.89 + (yy + 1) * .075); leaves.setColorAt(i, color);
  }
  foliageGeometry.setAttribute('canopyNormal', new THREE.InstancedBufferAttribute(crownNormals, 3));
  leaves.castShadow = true; leaves.receiveShadow = true; leaves.userData.treeId = id; crown.add(leaves);
  return { root, crown, id, seed };
}

export function makeShrub(seed: number, size = .35) {
  const random = rng(seed), group = new THREE.Group();
  const shrubGeo = leaf.clone(); const shrubNormals = new Float32Array(95 * 3);
  const leaves = new THREE.InstancedMesh(shrubGeo, foliage, 95), dummy = new THREE.Object3D();
  for (let i = 0; i < 95; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * size;
    dummy.position.set(Math.cos(a) * r, .07 + (1 - r / size) * size * .7 + random() * .12, Math.sin(a) * r);
    dummy.rotation.set(random() * Math.PI, random() * Math.PI * 2, random() * 6);
    dummy.scale.setScalar(.12 + random() * .1); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix); vec(Math.cos(a) * .5, 1, Math.sin(a) * .5).normalize().toArray(shrubNormals, i * 3);
    leaves.setColorAt(i, new THREE.Color().setHSL(.22 + random() * .025, .39, .28 + random() * .13));
  }
  shrubGeo.setAttribute('canopyNormal', new THREE.InstancedBufferAttribute(shrubNormals, 3));
  leaves.castShadow = true; leaves.receiveShadow = true; group.add(leaves); return group;
}
