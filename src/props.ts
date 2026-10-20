import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, at?: THREE.Vector3) {
  const c = new THREE.Color(color), data = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < data.length; i += 3) c.toArray(data, i);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(data, 3)); return mesh(geo, figure, parent, at);
}
/** Profiles run bottom to top for outward faces; `[radius, height]` pairs. */
const lathe = (profile: number[][], segments = 14, start = 0, length = Math.PI * 2) => new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments, start, length);
const ring = (radius: number, tube: number, segments = 14) => new THREE.TorusGeometry(radius, tube, 4, segments).rotateX(Math.PI / 2);

// Wardrobe in the village palette. Each citizen id fixes a look; the six founders each get a different role.
const SKIN = ['#f0d0ae', '#e2b38b', '#c78d63', '#9a6646'], HAIR = ['#2f241d', '#5a3b26', '#8b5a32', '#caa05f', '#1f1c1b', '#a9a39a'];
const TOPS = ['#c27b4a', '#7f9c6b', '#5d84a3', '#d2a650', '#a3595a', '#e3d8bf', '#7c6e9c', '#4e8a80'];
const TROUSERS = ['#4f5a68', '#6d5843', '#5a6247', '#3f4650', '#8a7558'], WRAPS = ['#c4553d', '#d9a441', '#4f7fa6', '#7aa36b', '#b46a8a'];
const VESTS = ['#5b4636', '#3f4a5a', '#6b6f4b', '#8a5a3c'], CAPS = ['#5a5550', '#6b5a48', '#4a5664', '#7d6b52'], SHOES = ['#4a3a2c', '#3a3634', '#6b4a33'], LINEN = '#efe6d2';

export function makePerson(id: number): Person {
  const root = new THREE.Group(), body = new THREE.Group(), torso = new THREE.Group(); root.add(body); body.add(torso);
  const random = rng(id * 7919 + 17), pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  // Roles: 0 farmer in a straw hat, 1 headscarf and apron, 2 carter in cap and waistcoat, 3 bun, 4 smith in a beanie, 5 bare-headed.
  const role = id < 6 ? id : Math.floor(random() * 6), dress = role === 1 || (role === 3 && random() < .5);
  const skin = pick(SKIN), hair = pick(HAIR), top = pick(TOPS), legs = dress ? '#4b423c' : pick(TROUSERS), shoes = pick(SHOES), wrap = pick(WRAPS);
  const rolled = role === 0 || role === 4 || random() < .3, whiskers = !dress && role !== 5 && random() < .6, boots = role === 0 || role === 4 || random() < .3;

  // Body: hips, or a skirt flared so a striding leg stays inside the hem; a tapered chest, belt, collar and neck.
  if (dress) part(torso, lathe([[.085, .3], [.1, .2], [.13, .15], [.145, .145], [.14, .16], [.118, .23], [.102, .29], [.093, .33]], 16).scale(1, 1, .9), top);
  else part(torso, new THREE.SphereGeometry(.098, 12, 6).scale(1, .6, .8), legs, vec(0, .27, 0));
  part(torso, lathe([[.088, .29], [.095, .34], [.104, .4], [.106, .44], [.098, .485], [.078, .515], [.045, .535], [.001, .54]], 12).scale(1, 1, .8), top);
  part(torso, new THREE.CylinderGeometry(.097, .097, .026, 16, 1, true).scale(1, 1, .8), dress ? wrap : '#5a4130', vec(0, .305, 0));
  if (!dress) part(torso, new THREE.BoxGeometry(.03, .024, .01), '#c9a24e', vec(0, .305, .079));
  part(torso, new THREE.CylinderGeometry(.033, .037, .07, 10), skin, vec(0, .55, 0));
  part(torso, ring(.043, .011, 12), role === 3 ? wrap : LINEN, vec(0, .528, 0));
  // Over-clothes: aprons for the farm wife and the smith, waistcoats for the carter and some of the young.
  if (role === 1 || role === 4) part(torso, lathe([[.155, .16], [.13, .23], [.11, .29], [.104, .34], [.106, .41]], 10, -1, 2).scale(1, 1, .86), role === 4 ? '#7d5d40' : LINEN);
  if (role === 2 || (role === 5 && random() < .5)) part(torso, lathe([[.099, .3], [.108, .4], [.11, .44], [.103, .485], [.083, .512]], 14, .5, Math.PI * 2 - 1).scale(1, 1, .8), pick(VESTS));

  // Head: painted-toy face with ears, oval eyes, brows, blush and a small smile.
  const blush = new THREE.Color(skin).lerp(new THREE.Color('#e0705f'), .4);
  part(torso, new THREE.SphereGeometry(.1, 14, 10), skin, vec(0, .645, 0));
  part(torso, new THREE.SphereGeometry(.019, 8, 6), skin, vec(0, .625, .097));
  part(torso, new THREE.TorusGeometry(.012, .0026, 4, 8, Math.PI).rotateZ(Math.PI).rotateX(.4), '#7a3b30', vec(0, .608, .093));
  for (const s of [-1, 1]) {
    part(torso, new THREE.SphereGeometry(.022, 6, 4).scale(.55, 1, .8), skin, vec(s * .099, .638, -.004));
    part(torso, new THREE.SphereGeometry(.012, 6, 4).scale(1, 1.3, .55).rotateY(s * .36), '#2a221d', vec(s * .035, .648, .091));
    part(torso, new THREE.BoxGeometry(.032, .008, .01).rotateZ(-s * .12).rotateY(s * .36), hair, vec(s * .037, .675, .087));
    part(torso, new THREE.SphereGeometry(.019, 6, 4).scale(1, .7, .35).rotateY(s * .6), blush, vec(s * .056, .618, .079));
  }
  if (whiskers) part(torso, new THREE.CapsuleGeometry(.009, .03, 2, 6).rotateZ(Math.PI / 2), hair, vec(0, .613, .096));
  if (whiskers && random() < .5) part(torso, new THREE.SphereGeometry(.104, 14, 5, Math.PI / 2 - 1.2, 2.4, 1.98, .8), hair, vec(0, .642, .004));

  // Hair is a sphere cap tilted back, so it starts at the forehead and reaches the nape; hats sit on top.
  const hat = ['straw', 'scarf', 'cap', 'none', 'beanie', 'none'][role], style = role === 3 ? 'bun' : role === 5 ? pick(['ponytail', 'bob']) : 'short';
  if (hat !== 'scarf') part(torso, new THREE.SphereGeometry(.108, 14, 7, 0, Math.PI * 2, 0, style === 'bun' ? 1.85 : 1.72).rotateX(style === 'bun' ? -.75 : -.62), hair, vec(0, .65, -.004));
  if (style === 'bob') part(torso, new THREE.SphereGeometry(.112, 16, 6, Math.PI / 2 + .95, Math.PI * 2 - 1.9, .85, 1.35), hair, vec(0, .645, -.006));
  if (style === 'bun') part(torso, new THREE.SphereGeometry(.05, 10, 8), hair, vec(0, .7, -.105));
  if (style === 'ponytail') { part(torso, new THREE.SphereGeometry(.024, 8, 6), wrap, vec(0, .668, -.104)); part(torso, new THREE.CapsuleGeometry(.03, .1, 3, 8).rotateX(.3), hair, vec(0, .59, -.122)); }
  const cover = new THREE.Group(); torso.add(cover);
  if (hat === 'straw') {
    cover.position.set(0, .705, 0); cover.rotation.x = -.08;
    part(cover, lathe([[.094, 0], [.092, .03], [.086, .055], [.06, .07], [.001, .072]], 16), '#d9bc7c');
    part(cover, new THREE.CylinderGeometry(.165, .17, .012, 20), '#d9bc7c', vec(0, .004, 0));
    part(cover, new THREE.CylinderGeometry(.0945, .0935, .02, 16, 1, true), pick(['#8a4b3a', '#4e5f73', '#5d6b45']), vec(0, .02, 0));
  } else if (hat === 'cap') {
    const color = pick(CAPS); cover.position.set(0, .7, -.006); cover.rotation.x = .12;
    part(cover, new THREE.SphereGeometry(.113, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .62, 1.06), color);
    part(cover, new THREE.CylinderGeometry(.075, .075, .01, 14, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, .8).rotateX(.15), color, vec(0, .003, .1));
  } else if (hat === 'scarf') {
    part(cover, new THREE.SphereGeometry(.113, 14, 8, 0, Math.PI * 2, 0, 1.9).rotateX(-.75), wrap, vec(0, .648, -.004));
    part(cover, new THREE.SphereGeometry(.026, 6, 5), wrap, vec(0, .6, -.113));
    for (const s of [-1, 1]) part(cover, new THREE.SphereGeometry(.026, 6, 4).scale(.7, 1.5, .5).rotateZ(s * .5), wrap, vec(s * .02, .566, -.112));
  } else if (hat === 'beanie') {
    part(cover, new THREE.SphereGeometry(.112, 14, 6, 0, Math.PI * 2, 0, 1.45).scale(1, 1.05, 1), wrap, vec(0, .688, -.003));
    part(cover, ring(.106, .018, 16), wrap, vec(0, .7, -.003));
    part(cover, new THREE.SphereGeometry(.032, 8, 6), LINEN, vec(0, .82, -.008));
  }
  mergeMeshes(torso);

  const leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
  [leftLeg, rightLeg].forEach((limb, i) => {
    limb.position.set(i ? .062 : -.062, .28, 0); body.add(limb);
    part(limb, new THREE.CapsuleGeometry(.044, .14, 2, 8), legs, vec(0, -.11, 0));
    if (boots) part(limb, new THREE.CylinderGeometry(.048, .05, .08, 10), shoes, vec(0, -.2, 0));
    part(limb, new RoundedBoxGeometry(.088, .065, .15, 1, .026), shoes, vec(0, -.245, .025));
    mergeMeshes(limb);
  });
  // Rolled sleeves show the forearm; full ones end in a linen cuff.
  const leftArm = new THREE.Group(), rightArm = new THREE.Group();
  [leftArm, rightArm].forEach((limb, i) => {
    limb.position.set(i ? .13 : -.13, .47, 0); body.add(limb);
    part(limb, new THREE.CapsuleGeometry(.039, rolled ? .06 : .1, 2, 8), top, vec(0, rolled ? -.05 : -.075, 0));
    if (rolled) part(limb, new THREE.CapsuleGeometry(.03, .06, 2, 8), skin, vec(0, -.13, 0));
    part(limb, ring(.036, rolled ? .0065 : .008, 8), rolled ? top : LINEN, vec(0, rolled ? -.098 : -.15, 0));
    part(limb, new THREE.SphereGeometry(.035, 8, 6).scale(.9, 1.1, 1), skin, vec(0, -.185, .004));
    mergeMeshes(limb);
  });
  const carried = new THREE.Group(); log(carried, vec(0, 0, 0), .68, .075); mergeMeshes(carried); carried.position.set(.16, .56, .04); body.add(carried);
  // The blade sits on the side the swing moves towards, so it leads each chop.
  const axe = new THREE.Group(); beam(axe, vec(0, -.185, -.03), vec(0, -.185, .36), .022, .022, timber); mesh(new THREE.BoxGeometry(.03, .1, .065), iron, axe, vec(0, -.22, .33)); rightArm.add(axe);
  return { root, body, leftLeg, rightLeg, leftArm, rightArm, carried, axe };
}
