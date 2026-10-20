import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { branchGeometry, crownMaterial, leafGeometry, leafMaterial, mesh, rng, vec, woodMaterial, mergeMeshes } from './craft';
import { TREE_LOCATIONS } from './world-layout';

export const bark = woodMaterial('#c4ad89', true);
const foliage = leafMaterial();
/** Baked crowns share the leaf texture of the instanced hero foliage; conifers use plain needle colours. */
export const bakedFoliage = crownMaterial(foliage.map);
export const needles = crownMaterial(null);
/** Inner canopy volume: fills the gaps between leaves so crowns read as full masses with depth. */
export const canopyCore = new THREE.MeshStandardMaterial({ color: '#6c8442', vertexColors: true, roughness: 1 });
const leaf = leafGeometry(20), farLeaf = leafGeometry(9);
export const treeLocations = TREE_LOCATIONS;
export interface Tree { root: THREE.Group; crown: THREE.Group; id: number; seed: number }
/** A tree flattened to a few geometries in its own space, ready to be instanced across the globe. */
export interface TreePrototype { trunk: THREE.BufferGeometry; leaves: THREE.BufferGeometry; leafMaterial: THREE.Material; core: THREE.BufferGeometry | null }

/** Lumpy ellipsoid for the dense middle of a crown, darker underneath like a self-shadowed canopy. */
function coreGeometry(seed: number) {
  const source = new THREE.IcosahedronGeometry(1, 2); source.deleteAttribute('normal'); source.deleteAttribute('uv');
  const g = mergeVertices(source), p = g.attributes.position, v = new THREE.Vector3(), colors = new Float32Array(p.count * 3);
  source.dispose();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(1 + .17 * Math.sin(v.x * 5 + seed) * Math.sin(v.y * 4 - seed * .5) * Math.sin(v.z * 6 + seed * .3));
    p.setXYZ(i, v.x, v.y, v.z);
    colors.fill(.6 + .4 * THREE.MathUtils.smoothstep(v.y, -.9, .8), i * 3, i * 3 + 3);
  }
  g.computeVertexNormals(); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

/** Broadleaf tree. `distant` trades twigs, bark facets and leaf count for bigger leaves on small background trees. */
export function makeTree(seed: number, id: number, distant = false): Tree {
  const root = new THREE.Group(), crown = new THREE.Group(), trunk = new THREE.Group();
  root.add(trunk, crown); root.userData.treeId = id;
  const random = rng(seed), sign = random() > .5 ? 1 : -1, sides = distant ? 7 : 14;
  const trunkPath = [vec(0, -.08, 0), vec(.06, .55, .03), vec(-.08 * sign, 1.3, .04), vec(.15 * sign, 2.2, -.03), vec(.05, 3.0, .08), vec(.13, 3.9, -.07)];
  mesh(branchGeometry(trunkPath, [.31, .22, .19, .145, .085, .025], seed, distant ? 14 : 30, sides), bark, trunk);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + random() * .3, length = .55 + random() * .35;
    if (distant && i % 2) continue;
    mesh(branchGeometry([vec(Math.cos(a) * length, .015, Math.sin(a) * length), vec(Math.cos(a) * .36, .07, Math.sin(a) * .36), vec(Math.cos(a) * .15, .35, Math.sin(a) * .15), vec(0, .65, 0)], [.015, .09, .13, .12], seed + i, distant ? 5 : 10, distant ? 5 : 9), bark, trunk);
  }
  // Four principal crown masses supported by four readable branch systems.
  const centers = [vec(-.95, 2.8, .28), vec(.92, 3.05, .28), vec(-.35, 3.8, -.46), vec(.28, 4.22, .03)];
  const scales = [vec(.83, .63, .8), vec(.9, .62, .74), vec(.75, .65, .72), vec(.7, .56, .64)];
  centers.forEach((center, ci) => {
    center.x += (random() - .5) * .2; center.z += (random() - .5) * .25;
    const start = vec(.04 * sign, 1.35 + ci * .38, .02);
    const mid = start.clone().lerp(center, .55); mid.y -= .15;
    mesh(branchGeometry([start, mid, center.clone().add(vec(0, -.1, 0))], [.14 - ci * .018, .09 - ci * .012, .018], seed + ci, distant ? 8 : 16, distant ? 6 : 10), bark, trunk);
    for (let j = 0; j < 7; j++) {
      const a = j / 7 * Math.PI * 2 + random() * .4;
      const end = center.clone().add(vec(Math.cos(a) * scales[ci].x * .7, (random() - .45) * .7, Math.sin(a) * scales[ci].z * .7));
      if (!distant) mesh(branchGeometry([mid.clone().lerp(center, .45), center.clone().lerp(end, .55), end], [.035, .023, .004], seed + j, 6, 5), bark, trunk);
    }
  });
  mergeMeshes(trunk);
  const perMass = distant ? 110 : 720, total = perMass * centers.length;
  const foliageGeometry = (distant ? farLeaf : leaf).clone();
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
    const size = (distant ? .36 : .17) + random() * .12; dummy.scale.set(size * (.8 + random() * .35), size, size);
    const normal = vec(sin * Math.cos(theta), yy * .5 + .65, sin * Math.sin(theta)).normalize(); normal.toArray(crownNormals, i * 3);
    dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    // Lighter toward the sky, darker deep inside the mass where neighbouring leaves shade each other.
    const color = palette[Math.floor(random() * palette.length)].clone();
    color.multiplyScalar((.89 + (yy + 1) * .075) * (.74 + .26 * rr)); leaves.setColorAt(i, color);
  }
  foliageGeometry.setAttribute('canopyNormal', new THREE.InstancedBufferAttribute(crownNormals, 3));
  leaves.castShadow = true; leaves.receiveShadow = true; leaves.userData.treeId = id; crown.add(leaves);
  const fill = distant ? .8 : .72;
  const cores = centers.map((center, ci) => coreGeometry(seed + ci * 7).scale(scales[ci].x * fill, scales[ci].y * fill, scales[ci].z * fill).translate(center.x, center.y, center.z));
  const core = mesh(mergeGeometries(cores), canopyCore, crown); core.userData.treeId = id; cores.forEach(g => g.dispose());
  return { root, crown, id, seed };
}

/** Flattens a tree: every leaf instance is baked with its colour and crown normal into one crown geometry. */
export function bakeTree(tree: Tree): TreePrototype {
  const trunk = (tree.root.children[0].children[0] as THREE.Mesh).geometry;
  const leaves = tree.crown.children.find(c => c instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
  const core = tree.crown.children.find(c => c !== leaves) as THREE.Mesh;
  const matrix = new THREE.Matrix4(), color = new THREE.Color(), canopy = leaves.geometry.attributes.canopyNormal as THREE.InstancedBufferAttribute;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < leaves.count; i++) {
    leaves.getMatrixAt(i, matrix); leaves.getColorAt(i, color);
    const g = leaves.geometry.clone(); g.deleteAttribute('canopyNormal'); g.applyMatrix4(matrix);
    const n = g.attributes.position.count, colors = new Float32Array(n * 3), normals = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { color.toArray(colors, k * 3); normals.set([canopy.getX(i), canopy.getY(i), canopy.getZ(i)], k * 3); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setAttribute('canopyNormal', new THREE.Float32BufferAttribute(normals, 3));
    parts.push(g);
  }
  const baked = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); leaves.geometry.dispose();
  return { trunk, leaves: baked, leafMaterial: bakedFoliage, core: core.geometry };
}

/** Upland conifer: a slim trunk under stacked, slightly ragged cones of needles. */
export function makePinePrototype(seed: number): TreePrototype {
  const random = rng(seed), lean = (random() - .5) * .08;
  const trunk = branchGeometry([vec(0, -.1, 0), vec(lean, 1.7, 0), vec(lean * 2, 3.6, .02)], [.17, .1, .025], seed, 6, 7);
  const light = new THREE.Color('#86a05a'), dark = new THREE.Color('#4c673a'), tiers = 5, layers: THREE.BufferGeometry[] = [];
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1), radius = (1.2 - t * .82) * (.92 + random() * .16), height = 1.3 - t * .42, base = .95 + k * .64;
    const cone = new THREE.ConeGeometry(radius, height, 11, 2), p = cone.attributes.position;
    const colors = new Float32Array(p.count * 3), normals = new Float32Array(p.count * 3), phase = random() * 6;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), angle = Math.atan2(z, x), up = y / height + .5;
      // Angle-based raggedness keeps duplicated seam vertices together; the hem droops between branch tips.
      const ragged = 1 + .1 * Math.sin(angle * 5 + phase) * (1 - up);
      p.setXYZ(i, x * ragged + lean * (base + y), y + base + height / 2 - .12 * (1 - up) * (.5 + .5 * Math.sin(angle * 5 + phase + 1.6)), z * ragged);
      dark.clone().lerp(light, Math.min(1, up * .8 + t * .3)).multiplyScalar(.93 + .07 * Math.sin(angle * 3 + k)).toArray(colors, i * 3);
      vec(x, radius * .7 + y * .3, z).normalize().toArray(normals, i * 3);
    }
    cone.deleteAttribute('uv');
    cone.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); cone.setAttribute('canopyNormal', new THREE.Float32BufferAttribute(normals, 3));
    cone.computeVertexNormals(); layers.push(cone);
  }
  const leaves = mergeGeometries(layers)!; layers.forEach(g => g.dispose());
  return { trunk, leaves, leafMaterial: needles, core: null };
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
