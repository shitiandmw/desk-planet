import * as THREE from 'three';
import { beam, branchGeometry, canvasTexture, mesh, mergeMeshes, rng, standard, vec, woodMaterial } from './craft';

const timber = woodMaterial('#ad8960'), darkwood = woodMaterial('#796044'), bark = woodMaterial('#807052', true);
const iron = new THREE.MeshStandardMaterial({ color: '#51534a', roughness: .65, metalness: .55 });
const stone = standard('#aaa895');
const endMap = canvasTexture(256, (ctx, s) => {
  ctx.fillStyle = '#d9bc85'; ctx.fillRect(0, 0, s, s);
  for (let i = 1; i < 14; i++) { ctx.beginPath(); ctx.ellipse(s * .49, s * .48, i * 9.2, i * 8.8, .1, 0, 7); ctx.lineWidth = i % 3 === 0 ? 1.8 : .8; ctx.strokeStyle = '#b2915e'; ctx.stroke(); }
  ctx.strokeStyle = '#967549'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(198, 213); ctx.moveTo(168, 178); ctx.lineTo(206, 190); ctx.stroke();
});
const endMaterial = new THREE.MeshStandardMaterial({ map: endMap, roughness: 1, color: '#ead7b4' });

export function log(parent: THREE.Object3D, position: THREE.Vector3, length = 1, radius = .13, rotation = Math.PI / 2) {
  const group = new THREE.Group(); group.position.copy(position); group.rotation.x = rotation;
  mesh(new THREE.CylinderGeometry(radius * .91, radius, length, 12), bark, group);
  const top = mesh(new THREE.CircleGeometry(radius * .9, 20), endMaterial, group, vec(0, length / 2 + .002, 0)); top.rotation.x = -Math.PI / 2;
  const bottom = mesh(new THREE.CircleGeometry(radius * .97, 20), endMaterial, group, vec(0, -length / 2 - .002, 0)); bottom.rotation.x = Math.PI / 2;
  parent.add(group); return group;
}

export function stump(seed: number) {
  const g = new THREE.Group(), random = rng(seed);
  mesh(branchGeometry([vec(0, -.03, 0), vec(.01, .16, 0), vec(.03, .43, 0)], [.27, .21, .195], seed, 12), bark, g);
  const cut = mesh(new THREE.CircleGeometry(.19, 24), endMaterial, g, vec(.03, .431, 0)); cut.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4 + random() * .2; mesh(branchGeometry([vec(Math.cos(a) * .4, .015, Math.sin(a) * .4), vec(Math.cos(a) * .15, .12, Math.sin(a) * .15), vec(0, .25, 0)], [.018, .08, .11], seed, 8), bark, g); }
  mergeMeshes(g); return g;
}

export function makeShed() {
  const g = new THREE.Group(), random = rng(405);
  for (const x of [-1.05, 1.05]) for (const z of [-.7, .7]) {
    mesh(new THREE.BoxGeometry(.28, .12, .28), stone, g, vec(x, .04, z));
    beam(g, vec(x, .08, z), vec(x, 1.62, z), .13, .14, timber);
    for (const dx of [-1, 1]) if (x * dx < 0) beam(g, vec(x, 1.13, z), vec(x + dx * .39, 1.57, z), .09, .09, darkwood);
  }
  for (const z of [-.76, .76]) {
    beam(g, vec(-1.15, 1.59, z), vec(1.15, 1.59, z), .14, .15, timber);
    beam(g, vec(-1.18, 1.63, z), vec(0, 2.28, z), .13, .13, timber);
    beam(g, vec(0, 2.28, z), vec(1.18, 1.63, z), .13, .13, timber);
    beam(g, vec(0, 1.64, z), vec(0, 2.25, z), .09, .09, darkwood);
  }
  beam(g, vec(0, 2.25, -.97), vec(0, 2.25, .97), .14, .15, darkwood);
  const roofMaterials = ['#a98456', '#b59261', '#ab8758', '#c09b68'].map(c => woodMaterial(c));
  for (const sign of [-1, 1]) {
    for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
      const x0 = sign * row * .325, x1 = sign * (row + 1) * .325;
      const z = -.87 + col * .25 + (random() - .5) * .012;
      const offset = (3 - row) * .018;
      const material = roofMaterials[Math.floor(random() * 4)];
      // Shared map generated once below by material consolidation; shingles have real overlapping thickness.
      const board = beam(g, vec(x0, 2.31 - Math.abs(x0) * .53 + offset, z), vec(x1 + sign * .07, 2.31 - Math.abs(x1 + sign * .07) * .53 + offset, z), .057, .244, material);
      board.userData.roof = true;
    }
  }
  for (const z of [-.97, 1.0]) for (const sign of [-1, 1]) beam(g, vec(0, 2.37, z), vec(sign * 1.4, 1.63, z), .09, .09, darkwood);
  for (let i = 0; i < 8; i++) beam(g, vec(-.98 + i * .28, .15, -.69), vec(-.98 + i * .28, .9, -.69), .24, .045, timber);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5 - r; c++) log(g, vec(-.65 + c * .28 + r * .14, .15 + r * .24, -.1), 1.1, .13);
  // Low workbench, axe and a small open crate reinforce the working structure.
  beam(g, vec(-.82, .64, .45), vec(-.82, .64, -.35), .08, .46, timber);
  for (const z of [-.32, .4]) beam(g, vec(-.82, 0, z), vec(-.82, .62, z), .075, .075, darkwood);
  beam(g, vec(.88, .04, .68), vec(.98, 1.06, .5), .035, .035, timber);
  const axeHead = mesh(new THREE.BoxGeometry(.2, .11, .035), iron, g, vec(.98, 1.02, .5)); axeHead.rotation.z = -.1;
  mergeMeshes(g); return g;
}

export function logPile() {
  const g = new THREE.Group();
  for (const z of [-.5, .5]) beam(g, vec(-.7, .05, z), vec(.7, .05, z), .12, .12, darkwood);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) log(g, vec(-.48 + c * .32 + r * .16, .22 + r * .28, 0), 1.35 + .05 * Math.sin(c + r), .155);
  mergeMeshes(g); return g;
}

export interface Person { root: THREE.Group; body: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group; carried: THREE.Group; axe: THREE.Group }
/** People share one vertex-coloured material, and each body part merges into a single mesh. */
const figure = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, at: THREE.Vector3) {
  const c = new THREE.Color(color), data = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < data.length; i += 3) c.toArray(data, i);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(data, 3)); return mesh(geo, figure, parent, at);
}
export function makePerson(id: number): Person {
  const root = new THREE.Group(), body = new THREE.Group(), staticBody = new THREE.Group(); root.add(body); body.add(staticBody);
  const shirt = ['#b28553', '#7b8b86', '#9a775f'][id % 3], trousers = '#55635f', skin = '#d7b187', boots = '#514b3a', hat = '#baa174';
  part(staticBody, new THREE.CapsuleGeometry(.105, .15, 3, 8), shirt, vec(0, .37, 0));
  part(staticBody, new THREE.SphereGeometry(.095, 12, 8), skin, vec(0, .62, 0));
  part(staticBody, new THREE.SphereGeometry(.025, 6, 4), skin, vec(0, .61, .085));
  part(staticBody, new THREE.CylinderGeometry(.089, .1, .06, 12), hat, vec(0, .7, 0));
  part(staticBody, new THREE.CylinderGeometry(.15, .15, .018, 16), hat, vec(0, .665, 0));
  mergeMeshes(staticBody);
  const leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
  [leftLeg, rightLeg].forEach((limb, i) => { limb.position.set(i ? .062 : -.062, .28, 0); body.add(limb); part(limb, new THREE.CapsuleGeometry(.041, .13, 3, 6), trousers, vec(0, -.09, 0)); part(limb, new THREE.BoxGeometry(.087, .065, .14), boots, vec(0, -.235, .025)); mergeMeshes(limb); });
  const leftArm = new THREE.Group(), rightArm = new THREE.Group();
  [leftArm, rightArm].forEach((limb, i) => { limb.position.set(i ? .13 : -.13, .47, 0); body.add(limb); part(limb, new THREE.CapsuleGeometry(.037, .12, 3, 6), shirt, vec(0, -.075, 0)); part(limb, new THREE.SphereGeometry(.04, 8, 6), skin, vec(0, -.172, 0)); mergeMeshes(limb); });
  const carried = new THREE.Group(); log(carried, vec(0, 0, 0), .68, .075); mergeMeshes(carried); carried.position.set(.13, .55, .06); body.add(carried);
  const axe = new THREE.Group(); beam(axe, vec(0, -.15, 0), vec(0, -.15, .36), .025, .025, timber); mesh(new THREE.BoxGeometry(.14, .08, .04), iron, axe, vec(0, -.15, .34)); rightArm.add(axe);
  return { root, body, leftLeg, rightLeg, leftArm, rightArm, carried, axe };
}
