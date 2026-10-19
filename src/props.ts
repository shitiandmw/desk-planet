import * as THREE from 'three';
import { beam, branchGeometry, canvasTexture, mesh, mergeMeshes, rng, standard, up, vec, woodMaterial } from './craft';

const timber = woodMaterial('#ad8960'), darkwood = woodMaterial('#796044'), bark = woodMaterial('#807052', true);
const iron = new THREE.MeshStandardMaterial({ color: '#51534a', roughness: .65, metalness: .55 });
const stone = standard('#aaa895'), mortar = standard('#d7cfb5');
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

export function makeCottage() {
  const g = new THREE.Group(), random = rng(132);
  mesh(new THREE.BoxGeometry(1.55, 1.16, 1.35), mortar, g, vec(0, .69, 0));
  // Triangular gables, thick eaves and overlapping straw bundles.
  const shape = new THREE.Shape(); shape.moveTo(-.775, 1.25); shape.lineTo(.775, 1.25); shape.lineTo(0, 1.94); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.35, bevelEnabled: false }); geo.translate(0, 0, -.675); mesh(geo, mortar, g);
  for (let i = 0; i < 7; i++) for (const z of [-.69, .69]) mesh(new THREE.BoxGeometry(.205, .17, .13), stone, g, vec(-.66 + i * .22, .09, z));
  for (const x of [-.76, .76]) for (const z of [-.68, .68]) beam(g, vec(x, .15, z), vec(x, 1.3, z), .085, .085, darkwood);
  for (const z of [-.72, .72]) {
    beam(g, vec(-.8, 1.28, z), vec(.8, 1.28, z), .08, .08, darkwood);
    beam(g, vec(-.8, 1.28, z), vec(0, 1.98, z), .08, .08, darkwood);
    beam(g, vec(0, 1.98, z), vec(.8, 1.28, z), .08, .08, darkwood);
  }
  const straw = ['#c5a55d', '#bca05f', '#d3b56c', '#b89953', '#c8ad6b'].map(c => woodMaterial(c));
  for (const sign of [-1, 1]) {
    for (let row = 0; row < 4; row++) for (let j = 0; j < 25; j++) {
      const x = sign * row * .25, z = -.88 + j * .071;
      const p1 = vec(x, 2.02 - Math.abs(x) * .77 + (3 - row) * .025, z);
      const p2 = vec(x + sign * .34, 2.02 - Math.abs(x + sign * .34) * .77 + (3 - row) * .025, z);
      const m = mesh(new THREE.CylinderGeometry(.045, .065, p1.distanceTo(p2), 6), straw[Math.floor(random() * straw.length)], g, p1.clone().add(p2).multiplyScalar(.5));
      m.quaternion.setFromUnitVectors(up, p2.clone().sub(p1).normalize());
    }
  }
  beam(g, vec(0, 2.1, -.96), vec(0, 2.1, .96), .14, .15, straw[2]);
  mesh(new THREE.BoxGeometry(.36, .74, .04), darkwood, g, vec(.2, .47, .697));
  for (let i = 0; i < 4; i++) beam(g, vec(.06 + i * .087, .12, .725), vec(.06 + i * .087, .82, .725), .078, .018, timber);
  mesh(new THREE.SphereGeometry(.025, 8, 6), iron, g, vec(.31, .45, .752));
  mesh(new THREE.BoxGeometry(.52, .09, .25), stone, g, vec(.2, .045, .82));
  const glass = new THREE.MeshStandardMaterial({ color: '#4e665c', roughness: .3 });
  for (const x of [-.48]) {
    mesh(new THREE.BoxGeometry(.3, .37, .025), darkwood, g, vec(x, .75, .704));
    mesh(new THREE.BoxGeometry(.24, .3, .03), glass, g, vec(x, .75, .723));
    beam(g, vec(x, .59, .75), vec(x, .91, .75), .026, .025, timber);
    beam(g, vec(x - .13, .75, .75), vec(x + .13, .75, .75), .026, .025, timber);
    beam(g, vec(x - .19, .56, .75), vec(x + .19, .56, .75), .06, .13, timber);
  }
  // Chimney is structurally attached through the thatch roof.
  mesh(new THREE.BoxGeometry(.25, .67, .28), stone, g, vec(.43, 1.92, -.3));
  mesh(new THREE.BoxGeometry(.3, .09, .33), standard('#929184'), g, vec(.43, 2.29, -.3));
  mesh(new THREE.BoxGeometry(.14, .012, .16), standard('#464a3e'), g, vec(.43, 2.34, -.3));
  mergeMeshes(g); return g;
}

export interface Person { root: THREE.Group; body: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group; carried: THREE.Group; axe: THREE.Group }
export function makePerson(id: number): Person {
  const root = new THREE.Group(), body = new THREE.Group(), staticBody = new THREE.Group(); root.add(body); body.add(staticBody);
  const shirt = standard(['#b28553', '#7b8b86', '#9a775f'][id % 3]), trousers = standard('#55635f'), skin = standard('#d7b187'), boots = standard('#514b3a');
  mesh(new THREE.CapsuleGeometry(.105, .15, 3, 8), shirt, staticBody, vec(0, .37, 0));
  mesh(new THREE.SphereGeometry(.095, 12, 8), skin, staticBody, vec(0, .62, 0));
  mesh(new THREE.SphereGeometry(.025, 6, 4), skin, staticBody, vec(0, .61, .085));
  const hat = standard('#baa174');
  mesh(new THREE.CylinderGeometry(.089, .1, .06, 12), hat, staticBody, vec(0, .7, 0));
  mesh(new THREE.CylinderGeometry(.15, .15, .018, 16), hat, staticBody, vec(0, .665, 0));
  mergeMeshes(staticBody);
  const leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
  [leftLeg, rightLeg].forEach((limb, i) => { limb.position.set(i ? .062 : -.062, .28, 0); body.add(limb); mesh(new THREE.CapsuleGeometry(.041, .13, 3, 6), trousers, limb, vec(0, -.09, 0)); mesh(new THREE.BoxGeometry(.087, .065, .14), boots, limb, vec(0, -.235, .025)); });
  const leftArm = new THREE.Group(), rightArm = new THREE.Group();
  [leftArm, rightArm].forEach((limb, i) => { limb.position.set(i ? .13 : -.13, .47, 0); body.add(limb); mesh(new THREE.CapsuleGeometry(.037, .12, 3, 6), shirt, limb, vec(0, -.075, 0)); mesh(new THREE.SphereGeometry(.04, 8, 6), skin, limb, vec(0, -.172, 0)); });
  const carried = new THREE.Group(); log(carried, vec(0, 0, 0), .68, .075); mergeMeshes(carried); carried.position.set(.13, .55, .06); body.add(carried);
  const axe = new THREE.Group(); beam(axe, vec(0, -.15, 0), vec(0, -.15, .36), .025, .025, timber); mesh(new THREE.BoxGeometry(.14, .08, .04), iron, axe, vec(0, -.15, .34)); rightArm.add(axe);
  return { root, body, leftLeg, rightLeg, leftArm, rightArm, carried, axe };
}
