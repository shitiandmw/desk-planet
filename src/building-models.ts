import * as THREE from 'three';
import { mergeMeshes, vec } from './craft';
import { makeShed } from './props';
import { makeShrub } from './trees';
import { BUILDINGS, type BuildingType } from './game-data';
import { SETTLEMENT_SCALE } from './planet-surface';
import { M, add, animated, barrel, boulderGeometry, bush, bx, chimney, crate, cyl, doorAt, fence, framedWalls, gableRoof, groundMaterial, lampPost, lathe, logStack, pad, pipe, plinth, rbox, rod, roofHeight, sack, smoke, sph, timber, windowAt, type RoofSpec, type V3 } from './building-kit';
import { eraModel } from './era-models';

const templates = new Map<BuildingType, THREE.Group>();
const fruitColors = ['#d0453d', '#e48a3a', '#e9c24f', '#9b3f6a'];

function basket(g: THREE.Object3D, at: V3, fruit = '#d0453d', scale = 1) {
  const s = scale;
  add(g, lathe([[0, 0], [.12 * s, .005], [.17 * s, .16 * s], [.165 * s, .18 * s], [0, .17 * s]], 14), M.lightWood, at);
  add(g, cyl(.172 * s, .172 * s, .025 * s, 14), M.darkWood, [at[0], at[1] + .165 * s, at[2]]);
  for (let i = 0; i < 7; i++) { const a = i * 2.4, r = i ? .09 * s : 0; add(g, sph(.045 * s, 7, 5), fruit, [at[0] + Math.cos(a) * r, at[1] + .19 * s + (i ? 0 : .03 * s), at[2] + Math.sin(a) * r]); }
}
function ingots(g: THREE.Object3D, at: V3, rows = 3) {
  for (let row = 0; row < rows; row++) for (let i = 0; i < 4 - row; i++) {
    const m = add(g, rbox(.22, .06, .08, .015), 'metal:#c9c2b4', [at[0] + (i - (3 - row) / 2) * .09, at[1] + .03 + row * .06, at[2]]); m.rotation.y = Math.PI / 2 * (row % 2);
  }
}
function orePile(g: THREE.Object3D, at: V3, size = .3, color = '#5d605b', glint = '#b8743e') {
  for (let i = 0; i < 7; i++) {
    const a = i * 2.3, r = i ? size * .45 : 0;
    const m = add(g, boulderGeometry(40 + i, 1), i % 3 === 0 ? glint : color, [at[0] + Math.cos(a) * r, at[1] + size * (i ? .18 : .42), at[2] + Math.sin(a) * r]);
    m.scale.setScalar(size * (i ? .32 : .45));
  }
}
function boulders(g: THREE.Object3D, spots: [number, number, number, number][], color = '#a9a595') {
  spots.forEach(([x, z, size, h], i) => { const m = add(g, boulderGeometry(7 + i * 13), i % 2 ? color : '#b6b2a3', [x, size * h * .45, z]); m.scale.set(size, size * h, size * .9); m.rotation.y = i * 1.3; });
}
const roof = (spec: Omit<RoofSpec, 'kind'> & { kind?: RoofSpec['kind'] }): RoofSpec => ({ kind: 'thatch', ...spec });

/** Thatched cottage: stone plinth, half-timbered plaster walls, a thick layered thatch and a smoking chimney. */
function house() {
  const g = new THREE.Group();
  pad(g, 1.8, 1.55);
  plinth(g, 1.64, 1.38, .2, .05);
  framedWalls(g, 1.5, 1.0, 1.24, .25);
  const spec = roof({ width: 1.5, depth: 1.24, eave: 1.25, peak: 2.06, overhang: .2, gable: M.plaster });
  gableRoof(g, spec);
  chimney(g, .4, -.3, 1.2, roofHeight(spec, .4) + .55, .25);
  doorAt(g, [.24, .25, .632], 0, .34, .6);
  windowAt(g, [-.36, .8, .64], 0, .3, .32, { shutters: '#6e9089', box: true });
  windowAt(g, [.762, .78, .05], Math.PI / 2, .28, .3, { shutters: '#6e9089' });
  windowAt(g, [-.762, .78, -.05], -Math.PI / 2, .28, .3);
  windowAt(g, [-.2, .78, -.64], Math.PI, .28, .3);
  logStack(g, [-.98, .07, -.15], 2, .62, .065, Math.PI / 2);
  barrel(g, [.66, .07, .8], .85);
  bush(g, [-.72, .07, .86], .13, '#6c8d48', '#e7c25a');
  return g;
}

/** Open forager's hut with a fruit counter, drying rack and berry bushes. */
function forager() {
  const g = new THREE.Group();
  pad(g, 1.75, 1.55);
  add(g, rbox(1.3, .08, 1.05, .03), M.wood, [0, .09, -.05]);
  for (const x of [-.56, .56]) for (const z of [-.48, .38]) rod(g, vec(x, .05, z), vec(x * 1.02, 1.05, z), .05, M.darkWood);
  gableRoof(g, roof({ width: 1.2, depth: .96, eave: 1.02, peak: 1.6, overhang: .18 }));
  add(g, rbox(1.06, .07, .32, .02), M.lightWood, [0, .56, .3]);
  for (const x of [-.45, .45]) timber(g, vec(x, .1, .3), vec(x, .53, .3), .06, .06);
  [-.32, 0, .32].forEach((x, i) => basket(g, [x, .6, .3], fruitColors[i], .82));
  add(g, rbox(1.0, .05, .26, .02), M.wood, [0, .9, -.38]);
  for (let i = 0; i < 5; i++) add(g, cyl(.05, .06, .12, 8), ['#c78e52', '#7f9c55', '#b5503e'][i % 3], [-.36 + i * .18, .98, -.38]);
  basket(g, [.72, .07, .62], '#c8323c', 1.1); basket(g, [-.74, .07, .66], '#e9c24f', .95);
  // A drying rack with herb bundles reads as gathering work from a distance.
  for (const x of [-.95, -.55]) rod(g, vec(x, .07, -.62), vec(x, .78, -.62), .025, M.darkWood);
  timber(g, vec(-1.0, .76, -.62), vec(-.5, .76, -.62), .03, .03);
  for (let i = 0; i < 4; i++) add(g, new THREE.ConeGeometry(.04, .16, 6), ['#7b9a4f', '#9aa95e', '#b78d4c'][i % 3], [-.9 + i * .11, .66, -.62], [Math.PI, 0, 0]);
  mergeMeshes(g);
  for (const [x, z, s, seed] of [[-.95, .62, .26, 500], [.98, -.55, .24, 501], [.95, .78, .2, 502]]) { const b = makeShrub(seed, s); b.position.set(x, .05, z); g.add(b); }
  for (const [x, z] of [[-.95, .62], [.98, -.55], [.95, .78]]) for (let i = 0; i < 7; i++) { const a = i * 2.1; add(g, sph(.028, 6, 4), '#c8323c', [x + Math.cos(a) * .16, .22 + (i % 3) * .07, z + Math.sin(a) * .16]); }
  return g;
}

/** The original timber shed, now with a chopping block, a sawhorse and an outside log pile. */
function lumber() {
  const g = makeShed();
  add(g, cyl(.17, .2, .3, 12), M.darkWood, [.92, .15, 1.05]);
  add(g, new THREE.CircleGeometry(.16, 14), '#dcb780', [.92, .302, 1.05], [-Math.PI / 2, 0, 0]);
  rod(g, vec(.9, .3, 1.05), vec(1.02, .62, .98), .018, M.wood); add(g, rbox(.16, .09, .03, .01), 'metal:#5a5c56', [1.02, .62, .98], [0, .4, -.3]);
  for (const x of [-.25, .25]) for (const s of [-1, 1]) timber(g, vec(-.9 + x, .02, 1.05 + s * .12), vec(-.9 + x, .36, 1.05), .04, .04, M.wood);
  add(g, cyl(.08, .08, .8, 10), M.darkWood, [-.9, .42, 1.05], [0, 0, Math.PI / 2]);
  logStack(g, [1.3, .02, -.2], 2, .9, .08, 0);
  add(g, new THREE.CircleGeometry(.5, 16), '#d9c28f', [.6, .02, 1.12], [-Math.PI / 2, 0, 0]);
  mergeMeshes(g); return g;
}

/** Open quarry face: weathered outcrop, cut blocks, a timber derrick with a hanging stone and a barrow. */
function quarry() {
  const g = new THREE.Group();
  pad(g, 2.0, 1.8, M.dirt);
  boulders(g, [[-.62, -.45, .42, 1.15], [-.1, -.6, .5, 1.3], [.48, -.5, .42, 1.05], [.85, -.15, .3, .9], [-.9, -.02, .28, .8]]);
  add(g, rbox(.9, .5, .08, .02), M.stone, [-.1, .3, -.35], [-.25, 0, 0], 2.2);
  [[-.55, .1, .4], [-.15, .1, .4], [.25, .1, .4], [-.35, .38, .4], [.05, .38, .4]].forEach(([x, y, z], i) => add(g, rbox(.36, .26, .3, .03), M.stone, [x, y + .02, z], [0, (i % 3 - 1) * .05, 0], 2.4));
  // Derrick: A-frame mast, angled boom, rope and hoisted block.
  for (const s of [-1, 1]) timber(g, vec(.55 + s * .22, .05, .15), vec(.55, 1.6, .15), .07, .07);
  timber(g, vec(.55, .05, -.2), vec(.55, 1.6, .15), .06, .06);
  timber(g, vec(.55, 1.5, .15), vec(.15, 1.3, .75), .06, .06, M.wood);
  rod(g, vec(.17, 1.3, .75), vec(.17, .78, .75), .008, '#d8c9a0');
  add(g, cyl(.06, .06, .05, 12), 'metal:#5a5c56', [.17, 1.29, .75], [Math.PI / 2, 0, 0]);
  add(g, rbox(.24, .18, .2, .03), M.stone, [.17, .68, .75], undefined, 2.4);
  // Barrow and a short workbench with tools.
  add(g, rbox(.36, .14, .26, .03), 'metal:#6b6e66', [-.75, .26, .72], [.15, .3, 0]);
  add(g, cyl(.07, .07, .03, 12), '#3d3a33', [-.6, .1, .86], [0, .3, Math.PI / 2]);
  for (const s of [-1, 1]) timber(g, vec(-.82 + s * .1, .24, .62), vec(-.98 + s * .1, .3, .42), .025, .025, M.wood);
  add(g, rbox(.6, .05, .26, .015), M.lightWood, [.95, .5, .55]);
  for (const x of [.72, 1.18]) timber(g, vec(x, .07, .55), vec(x, .48, .55), .05, .05);
  add(g, rbox(.14, .05, .05, .01), 'metal:#5a5c56', [.85, .55, .55]);
  return g;
}

/** Central store: a big open timber barn stacked with the settlement's shared goods. */
function warehouse() {
  const g = new THREE.Group();
  pad(g, 2.4, 2.0, M.dirt);
  add(g, rbox(2.2, .12, 1.6, .03), M.wood, [0, .12, 0]);
  for (const x of [-1.0, 0, 1.0]) for (const z of [-.72, .72]) {
    add(g, rbox(.22, .12, .22, .03), M.stone, [x, .12, z]);
    timber(g, vec(x, .16, z), vec(x, 1.48, z), .12, .12);
  }
  for (const z of [-.72, .72]) timber(g, vec(-1.1, 1.45, z), vec(1.1, 1.45, z), .11, .13);
  for (const x of [-1.0, 0, 1.0]) timber(g, vec(x, 1.45, -.75), vec(x, 1.45, .75), .09, .11, M.wood);
  for (let i = 0; i < 8; i++) add(g, rbox(.27, 1.22, .05, .01), i % 2 ? M.wood : M.lightWood, [-.945 + i * .27, .79, -.74]);
  for (const x of [-1.0, 1.0]) for (const s of [-1, 1]) timber(g, vec(x, 1.1, s * .32), vec(x, 1.43, s * .04), .055, .055);
  gableRoof(g, roof({ width: 2.2, depth: 1.5, eave: 1.5, peak: 2.18, overhang: .18, kind: 'shingle', gable: M.wood }));
  logStack(g, [-.62, .18, -.36], 3, .9, .085, Math.PI / 2);
  for (let i = 0; i < 3; i++) add(g, rbox(.28, .21, .24, .03), M.stone, [.1 + i * .3, .285, -.42], undefined, 2.4);
  for (let i = 0; i < 2; i++) add(g, rbox(.28, .21, .24, .03), M.stone, [.25 + i * .3, .495, -.42], undefined, 2.4);
  barrel(g, [.82, .18, .12]); barrel(g, [.82, .18, -.2]);
  for (let i = 0; i < 3; i++) sack(g, [-.05 + i * .24, .18, .22], ['#d8c79c', '#cdb98a', '#e0d2ab'][i]);
  basket(g, [-.5, .18, .32], '#d0453d'); basket(g, [-.8, .18, .4], '#e9c24f');
  crate(g, [.62, .07, .9], .32, .2); crate(g, [-.82, .07, .92], .28, -.3); crate(g, [-.82, .35, .92], .22, .2);
  return g;
}

/** Tool workshop and first research room: slate roof, lean-to bench, drafting table and a telescope. */
function workshop() {
  const g = new THREE.Group();
  pad(g, 2.1, 1.7);
  plinth(g, 1.62, 1.22, .18, .05);
  framedWalls(g, 1.46, .98, 1.06, .23);
  const spec = roof({ width: 1.46, depth: 1.06, eave: 1.21, peak: 1.86, overhang: .2, kind: 'slate', gable: M.plaster });
  gableRoof(g, spec);
  chimney(g, -.4, -.22, 1.0, roofHeight(spec, -.4) + .5, .22, M.stone);
  doorAt(g, [-.18, .23, .545], 0, .3, .58); doorAt(g, [.14, .23, .545], 0, .3, .58, M.lightWood);
  windowAt(g, [-.734, .74, 0], -Math.PI / 2, .3, .3, { shutters: '#7d8f72' });
  windowAt(g, [.3, .74, -.545], Math.PI, .3, .3);
  // Lean-to workbench on the east wall.
  for (const z of [-.42, .42]) timber(g, vec(1.18, .07, z), vec(1.18, .9, z), .07, .07);
  add(g, rbox(.55, .05, 1.06, .02), M.wood, [.98, .98, 0], [0, 0, -.32]);
  add(g, rbox(.38, .06, .8, .015), M.lightWood, [.98, .5, 0]);
  for (const z of [-.32, .32]) timber(g, vec(.98, .07, z), vec(.98, .47, z), .05, .05);
  add(g, rbox(.12, .08, .1, .01), 'metal:#55585a', [.98, .57, -.22]);
  for (let i = 0; i < 4; i++) { rod(g, vec(.79, .62, -.3 + i * .18), vec(.79, .86, -.3 + i * .18), .012, M.wood); add(g, rbox(.03, .07, .1, .01), 'metal:#6a6c6a', [.79, .62, -.3 + i * .18]); }
  // Drafting table and brass telescope: the research of the first era.
  add(g, rbox(.5, .04, .36, .01), M.lightWood, [-.62, .55, .86], [-.22, 0, 0]);
  for (const x of [-.82, -.42]) timber(g, vec(x, .07, .86), vec(x, .5, .86), .04, .04);
  add(g, bx(.36, .01, .26), '#efe6cf', [-.62, .58, .86], [-.22, 0, 0]);
  for (const [dx, dz] of [[0, -.12], [-.1, .07], [.1, .07]]) rod(g, vec(.45 + dx, .07, .95 + dz), vec(.45, .62, .95), .012, M.darkWood);
  rod(g, vec(.38, .6, .88), vec(.6, .78, 1.05), .035, 'metal:#c8a24f');
  crate(g, [-1.0, .07, -.5], .3, .3); barrel(g, [-1.0, .07, .3], .8);
  lampPost(g, [.2, .07, 1.02], .78);
  return g;
}

/** Field split into ripe wheat and green vegetables, fenced, with a scarecrow and a hay bale. */
function farm() {
  const g = new THREE.Group();
  pad(g, 2.5, 2.5, M.dirt, .12);
  for (let i = 0; i < 6; i++) add(g, rbox(.13, .07, 2.0, .03), '#7a6542', [-1.0 + i * .18, .1, 0]);
  for (let i = 0; i < 4; i++) add(g, rbox(.16, .07, 2.0, .03), '#73603f', [.2 + i * .25, .1, 0]);
  const wheat = ['#e3bd57', '#d9ae48', '#ecc969', '#cf9f3e'];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 13; j++) {
    const x = -1.0 + i * .18, z = -.93 + j * .155;
    for (let k = 0; k < 3; k++) {
      const dx = Math.sin(i * 7 + j * 3 + k * 2.1) * .04, dz = Math.cos(i * 5 + j * 2 + k) * .04, h = .3 + .06 * Math.sin(i + j * 1.7 + k);
      const lean = .06 * Math.sin(j * .9 + k);
      add(g, cyl(.006, .009, h, 3, true), '#c9a04a', [x + dx + lean / 2, .12 + h / 2, z + dz], [0, 0, -lean]);
      add(g, new THREE.ConeGeometry(.024, .12, 5), wheat[(i + j + k) % 4], [x + dx + lean, .14 + h, z + dz], [Math.PI, 0, -lean]);
    }
  }
  const leaves = ['#6f9c48', '#88ad55', '#5e8b42'];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) {
    const m = add(g, new THREE.IcosahedronGeometry(.085, 1), leaves[(i + j) % 3], [.2 + i * .25, .19, -.84 + j * .28]); m.scale.y = .72;
  }
  fence(g, [[-1.2, 1.2], [-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [.3, 1.2]], .3);
  fence(g, [[-.3, 1.2], [-1.2, 1.2]], .3);
  // Scarecrow on the path between beds.
  rod(g, vec(.03, .1, .2), vec(.03, .82, .2), .02, M.darkWood);
  rod(g, vec(-.2, .62, .2), vec(.26, .62, .2), .016, M.darkWood);
  add(g, rbox(.22, .26, .12, .04), '#8f5a3c', [.03, .56, .2]);
  add(g, sph(.07, 10, 8), '#e6d3a3', [.03, .78, .2]);
  add(g, cyl(.06, .12, .06, 10), '#b9963f', [.03, .85, .2]);
  const bale = add(g, cyl(.16, .16, .3, 14), M.thatch, [.86, .25, .96], [0, 0, Math.PI / 2], 2.2); bale.rotation.y = .4;
  return g;
}

/** Stone well with a shingled hood, winch, rope and bucket. */
function well() {
  const g = new THREE.Group();
  add(g, cyl(.7, .72, .24, 28), groundMaterial(M.paving), [0, -.04, 0], undefined, 2.2);
  add(g, cyl(.43, .47, .5, 22), M.stone, [0, .3, 0], undefined, 2.6);
  add(g, new THREE.TorusGeometry(.43, .055, 8, 24), '#b7b2a2', [0, .56, 0], [Math.PI / 2, 0, 0]);
  add(g, cyl(.36, .36, .02, 22), M.water, [0, .49, 0]);
  for (const x of [-.45, .45]) timber(g, vec(x, .08, 0), vec(x, 1.22, 0), .08, .08);
  gableRoof(g, roof({ width: .9, depth: .62, eave: 1.18, peak: 1.5, overhang: .14, kind: 'shingle' }));
  add(g, cyl(.05, .05, .86, 10), M.wood, [0, .95, 0], [0, 0, Math.PI / 2]);
  timber(g, vec(.48, .95, 0), vec(.56, .82, 0), .03, .03); timber(g, vec(.56, .82, 0), vec(.56, .82, .12), .025, .025, M.wood);
  rod(g, vec(.06, .93, 0), vec(.06, .66, 0), .008, '#d8c9a0');
  add(g, lathe([[0, 0], [.07, 0], [.085, .12], [0, .12]], 12), M.wood, [.06, .55, 0]);
  add(g, lathe([[0, 0], [.07, 0], [.085, .12], [0, .12]], 12), M.wood, [.55, .08, .42]);
  for (const [x, z, a] of [[.42, .5, .4], [-.46, .44, -.3]]) add(g, rbox(.2, .06, .26, .025), M.stone, [x, .1, z], [0, a, 0], 2.4);
  return g;
}

/** Raised granary on staddle stones with a thatched roof, steps and grain sacks. */
function granary() {
  const g = new THREE.Group();
  pad(g, 1.8, 1.7);
  for (const x of [-.55, 0, .55]) for (const z of [-.42, .42]) {
    add(g, cyl(.06, .1, .32, 10), M.stone, [x, .2, z], undefined, 2.4);
    add(g, cyl(.16, .14, .07, 12), M.stone, [x, .39, z], undefined, 2.4);
  }
  add(g, rbox(1.42, .08, 1.08, .02), M.darkWood, [0, .46, 0]);
  framedWalls(g, 1.3, .92, .98, .5, { wall: M.wood, braces: false });
  for (const sz of [-1, 1]) for (let i = 1; i < 8; i++) add(g, bx(.018, .88, .02), M.darkWood, [-.65 + i * .1625, .96, sz * .5]);
  gableRoof(g, roof({ width: 1.3, depth: .98, eave: 1.42, peak: 2.06, overhang: .22, gable: M.wood }));
  doorAt(g, [0, .5, .5], 0, .32, .56, M.lightWood);
  for (let i = 0; i < 4; i++) add(g, rbox(.38, .05, .14, .015), M.wood, [0, .08 + i * .11, .66 + (3 - i) * .12]);
  for (const s of [-1, 1]) timber(g, vec(s * .2, .05, 1.08), vec(s * .2, .5, .58), .04, .04);
  sack(g, [-.68, .07, .72]); sack(g, [-.46, .07, .82], '#cdb98a'); sack(g, [.62, .07, .78], '#e0d2ab'); sack(g, [.8, .07, .6]);
  return g;
}

/** Hillside mine: boulder mound, timbered adit, rails, an ore cart and a lantern. */
function mine() {
  const g = new THREE.Group();
  pad(g, 2.0, 1.8, M.dirt);
  boulders(g, [[-.68, -.4, .42, 1.25], [-.28, -.62, .5, 1.4], [.3, -.64, .5, 1.45], [.7, -.38, .42, 1.2], [-.92, .05, .28, .8], [.94, .02, .26, .75]], '#9e9a8b');
  add(g, rbox(.62, .78, .5, .04), '#1d221f', [0, .42, -.35]);
  for (const x of [-.36, .36]) timber(g, vec(x, .05, -.1), vec(x * .92, .88, -.1), .12, .12);
  timber(g, vec(-.48, .9, -.1), vec(.48, .9, -.1), .14, .13);
  for (const s of [-1, 1]) timber(g, vec(s * .36, .62, -.08), vec(s * .14, .86, -.08), .06, .06, M.wood);
  for (const x of [-.13, .13]) add(g, rbox(.03, .03, 1.2, .01), 'metal:#6f726d', [x, .1, .42]);
  for (let i = 0; i < 6; i++) add(g, rbox(.42, .04, .08, .015), M.darkWood, [0, .075, -.1 + i * .2]);
  // Ore cart on the rails.
  add(g, rbox(.42, .26, .5, .03), 'metal:#7a6450', [0, .32, .58]);
  for (const sx of [-1, 1]) for (const z of [.42, .74]) add(g, cyl(.07, .07, .04, 12), 'metal:#3b3a36', [sx * .16, .14, z], [0, 0, Math.PI / 2]);
  orePile(g, [0, .38, .58], .2, '#4f524e', '#c27e42');
  orePile(g, [.8, .07, .55], .32, '#5d605b', '#b8743e');
  lampPost(g, [-.6, .07, .25], .7);
  crate(g, [-.82, .07, .75], .28, .4);
  return g;
}

/** Brick furnace with iron bands, a smoking stack, glowing mouth, bellows, fuel and ingots. */
function smelter() {
  const g = new THREE.Group();
  pad(g, 1.9, 1.75, M.dirt);
  add(g, rbox(1.3, .26, 1.3, .05), M.stone, [-.15, .13, -.1], undefined, 2.4);
  add(g, cyl(.42, .6, 1.25, 16), M.brick, [-.15, .88, -.1], undefined, 2.2);
  for (let i = 0; i < 4; i++) add(g, new THREE.TorusGeometry(.585 - i * .052, .026, 6, 22), 'metal:#4c4a44', [-.15, .36 + i * .3, -.1], [Math.PI / 2, 0, 0]);
  add(g, cyl(.2, .27, 1.05, 12), M.brick, [-.15, 2.0, -.1], undefined, 2.2);
  add(g, cyl(.25, .25, .1, 12), '#6e6d5c', [-.15, 2.55, -.1]);
  smoke(g, [-.15, 2.66, -.1], 'industry', 1.1);
  add(g, rbox(.42, .42, .2, .08), '#2c2622', [-.15, .5, .43]);
  const glow = add(g, sph(.17, 12, 8), M.fire, [-.15, .48, .5]); glow.scale.set(1, .8, .3); glow.name = 'furnace-glow'; glow.castShadow = false; Object.assign(glow.userData, { separate: true, activeOnly: true });
  add(g, rbox(.6, .07, .46, .02), M.stone, [-.15, .1, .72]);
  // Bellows beside the mouth.
  add(g, rbox(.34, .1, .2, .04), M.wood, [.42, .45, .32], [0, .5, .25]);
  add(g, rbox(.28, .12, .18, .05), '#7a4e32', [.4, .38, .3], [0, .5, .25]);
  logStack(g, [.75, .07, -.45], 2, .7, .07, 0);
  orePile(g, [-.85, .07, .55], .28);
  ingots(g, [.6, .07, .72]);
  for (const x of [.3, .85]) timber(g, vec(x, .07, .82), vec(x, 1.0, .82), .07, .07);
  add(g, rbox(.7, .05, .55, .02), M.wood, [.58, 1.05, .62], [-.25, 0, 0]);
  return g;
}

/** Open forge: tiled roof on posts, hearth with hood and glow, anvil, quench barrel and grindstone. */
function smithy() {
  const g = new THREE.Group();
  pad(g, 1.9, 1.75);
  add(g, rbox(1.8, .1, 1.45, .03), M.stone, [0, .08, 0], undefined, 2.6);
  for (const x of [-.78, .78]) for (const z of [-.6, .6]) timber(g, vec(x, .12, z), vec(x, 1.32, z), .1, .1);
  for (const z of [-.6, .6]) timber(g, vec(-.86, 1.3, z), vec(.86, 1.3, z), .09, .1);
  const spec = roof({ width: 1.56, depth: 1.2, eave: 1.33, peak: 1.9, overhang: .22, kind: 'tile' });
  gableRoof(g, spec);
  add(g, rbox(1.56, .48, .12, .03), M.stone, [0, .36, -.6], undefined, 2.4);
  add(g, rbox(.72, .5, .58, .05), M.stone, [-.4, .37, -.28], undefined, 2.4);
  const coals = add(g, rbox(.46, .05, .34, .03), M.fire, [-.4, .63, -.24]); coals.name = 'furnace-glow'; coals.castShadow = false; Object.assign(coals.userData, { separate: true, activeOnly: true });
  add(g, new THREE.ConeGeometry(.38, .4, 4), 'metal:#47443e', [-.4, 1.0, -.28], [0, Math.PI / 4, 0]);
  chimney(g, -.4, -.28, 1.18, roofHeight(spec, -.4) + .5, .2, M.stone);
  add(g, cyl(.13, .16, .28, 10), M.darkWood, [.25, .27, .15]);
  add(g, rbox(.34, .12, .14, .02), 'metal:#3f3e3a', [.25, .47, .15]);
  add(g, new THREE.ConeGeometry(.06, .2, 8), 'metal:#3f3e3a', [.5, .48, .15], [0, 0, -Math.PI / 2]);
  barrel(g, [.62, .13, -.25], .9); add(g, cyl(.13, .13, .01, 12), M.water, [.62, .38, -.25]);
  add(g, cyl(.16, .16, .05, 16), '#a49d8c', [.58, .38, .55], [Math.PI / 2, 0, 0]);
  for (const z of [.48, .62]) timber(g, vec(.58, .13, z), vec(.58, .4, z), .035, .035, M.wood);
  for (let i = 0; i < 4; i++) { rod(g, vec(.2 + i * .14, .7, -.53), vec(.2 + i * .14, .95, -.53), .01, M.wood); add(g, rbox(.08, .05, .02, .01), 'metal:#5b5d5b', [.2 + i * .14, .7, -.53]); }
  crate(g, [-.92, .07, .78], .3, .2); ingots(g, [-.45, .13, .5], 2);
  return g;
}

/** Brick machine shop with tall windows, a smoking stack and a driven flywheel train. */
function machine() {
  const g = new THREE.Group();
  pad(g, 2.6, 2.2, M.dirt);
  plinth(g, 2.0, 1.5, .16, .05);
  add(g, rbox(1.9, 1.12, 1.4, .03), M.brick, [0, .77, 0], undefined, 2);
  for (const z of [-.7, .7]) add(g, rbox(1.96, .07, .06, .015), '#cdbfa5', [0, 1.33, z]);
  const spec = roof({ width: 1.9, depth: 1.4, eave: 1.35, peak: 2.0, overhang: .18, kind: 'slate', gable: M.brick });
  gableRoof(g, spec);
  add(g, rbox(.7, .22, .5, .03), M.glass, [0, 1.85, 0], [0, 0, 0]);
  for (const x of [-.55, .05]) windowAt(g, [x, .86, .712], 0, .38, .52, { frame: '#e4dccb' });
  windowAt(g, [-.962, .86, 0], -Math.PI / 2, .38, .52, { frame: '#e4dccb' });
  add(g, rbox(.48, .74, .04, .02), 'metal:#5b6b6c', [.6, .58, .72]);
  for (let i = 0; i < 4; i++) add(g, bx(.46, .015, .045), 'metal:#7c8b8b', [.6, .3 + i * .17, .74]);
  chimney(g, -.65, -.45, 1.1, 2.75, .3, M.brick, 'industry');
  // Steam engine and flywheel on the east side.
  add(g, cyl(.2, .2, .7, 16), 'metal:#5c4f45', [1.25, .35, -.25], [Math.PI / 2, 0, 0]);
  add(g, rbox(.2, .3, .3, .03), 'metal:#44403b', [1.25, .3, .2]);
  pipe(g, [[1.25, .55, -.3], [1.25, .9, -.3], [.95, .9, -.3]], .035, 'metal:#8c7c6a');
  const wheel = animated(g, { type: 'spin', axis: 'x', speed: 1.8 }, [1.12, .62, .5]); wheel.name = 'mechanism';
  add(wheel, new THREE.TorusGeometry(.42, .04, 8, 28), 'metal:#3e3d39', [0, 0, 0], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; rod(wheel, vec(0, 0, 0), vec(0, Math.cos(a) * .41, Math.sin(a) * .41), .022, 'metal:#56544f'); }
  add(wheel, cyl(.08, .08, .12, 12), 'metal:#7d6a52', [0, 0, 0], [0, 0, Math.PI / 2]);
  const gear = animated(g, { type: 'spin', axis: 'x', speed: -3.6 }, [1.12, 1.2, .1]);
  add(gear, cyl(.17, .17, .06, 10), 'metal:#4e4c46', [0, 0, 0], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(gear, bx(.06, .06, .06), 'metal:#4e4c46', [0, Math.cos(a) * .19, Math.sin(a) * .19], [a, 0, 0]); }
  for (let i = 0; i < 3; i++) crate(g, [-1.15 + i * .02, .07 + i * .29, .82], .28, i * .3);
  crate(g, [-.8, .07, .95], .26, -.2);
  return g;
}

const builders: Partial<Record<BuildingType, () => THREE.Group>> = { house, forager, lumber, quarry, warehouse, workshop, farm, well, granary, mine, smelter, smithy, machine };

function buildTemplate(type: BuildingType) {
  const g = builders[type]?.() ?? eraModel(type);
  mergeMeshes(g);
  // Flat ground details and flagged parts (glows, orbital pieces) stay out of the shadow pass.
  g.traverse(o => {
    if (o instanceof THREE.Mesh && (o.material as THREE.Material).userData.ground) o.castShadow = false;
    if (o.userData.noShadow) o.traverse(c => { if (c instanceof THREE.Mesh) c.castShadow = false; });
  });
  return g;
}

export function buildingModel(type: BuildingType) { if (!templates.has(type)) templates.set(type, buildTemplate(type)); return templates.get(type)!.clone(true); }

/** Scaffold with a rising frame, material piles and a ground pad sized to the facility footprint. */
export function constructionModel(type: BuildingType) {
  const root = new THREE.Group(), frame = new THREE.Group(); root.add(frame);
  const half = BUILDINGS[type].radius / SETTLEMENT_SCALE * .68;
  pad(root, half * 2.1, half * 2.1, M.dirt);
  add(root, rbox(half * 2, .1, half * 2, .03), M.stone, [0, .1, 0], undefined, 2.4);
  for (const x of [-half, half]) for (const z of [-half, half]) timber(frame, vec(x, 0, z), vec(x, 1.5, z), .07, .07, M.wood);
  for (const y of [.75, 1.45]) {
    for (const z of [-half, half]) timber(frame, vec(-half, y, z), vec(half, y, z), .06, .06, M.wood);
    for (const x of [-half, half]) timber(frame, vec(x, y, -half), vec(x, y, half), .06, .06, M.wood);
  }
  timber(frame, vec(-half, .05, -half), vec(half, 1.45, -half), .05, .05);
  add(frame, rbox(half * 1.8, .04, .26, .01), M.lightWood, [0, .78, half]);
  for (let i = 0; i < 4; i++) add(root, rbox(.65, .035, .12, .01), M.lightWood, [-half * .3, .14 + i * .035, half * .7]);
  for (let i = 0; i < 3; i++) add(root, rbox(.22, .16, .2, .03), M.stone, [half * .45 + i * .23, .2, -half * .2], undefined, 2.4);
  // The frame scales with progress, so it merges on its own instead of into the root.
  frame.userData.separate = true; mergeMeshes(root);
  return { root, frame };
}

export function foodCargo() { const g = new THREE.Group(); basket(g, [0, 0, 0], '#d0453d'); mergeMeshes(g); g.scale.setScalar(.55); return g; }
export function stoneCargo() { const g = new THREE.Group(); add(g, rbox(.18, .13, .15, .03), M.stone, [0, 0, 0], undefined, 2.4); mergeMeshes(g); return g; }
export function industryCargo() { const g = new THREE.Group(); crate(g, [0, 0, 0], .23); for (let i = 0; i < 2; i++) add(g, rbox(.16, .05, .065, .012), 'metal:#c9c2b4', [0, .25, i * .08 - .04]); mergeMeshes(g); return g; }
