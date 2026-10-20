import * as THREE from 'three';
import { vec } from './craft';
import type { BuildingType } from './game-data';
import { M, add, animated, barrel, bush, bx, chimney, crate, cyl, dish, doorAt, fanUnit, fence, framedWalls, gableRoof, lampPost, lathe, lightStrip, pad, pipe, plinth, prism, rbox, rod, roofHeight, roundPad, sack, smoke, sph, tank, timber, truck, windowAt, type V3 } from './building-kit';

/**
 * Facilities for the later stages of the development plan. They follow the same miniature language as the
 * founding settlement — chunky proportions, soft bevels, readable roofs — and progress from timber and tile,
 * through brick and steel, to white composite, glass and light.
 */
const white = '#f2f2ee', steel = 'metal:#c9ced0', darkSteel = 'metal:#5f676b', orange = '#e0793a', yellow = '#e5b43c';

// ---------------------------------------------------------------- shared pieces
function lattice(g: THREE.Object3D, base: number, top: number, height: number, segments: number, color: string, at: V3 = [0, 0, 0], radius = .022) {
  const corner = (y: number, sx: number, sz: number) => { const h = base + (top - base) * y / height; return vec(at[0] + sx * h, at[1] + y, at[2] + sz * h); };
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) rod(g, corner(0, sx, sz), corner(height, sx, sz), radius * 1.5, color, 6);
  for (let s = 0; s < segments; s++) {
    const y0 = height * s / segments, y1 = height * (s + 1) / segments;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx2, bz] = corners[(i + 1) % 4];
      rod(g, corner(y0, ax, az), corner(y1, bx2, bz), radius, color, 5);
      rod(g, corner(y0, bx2, bz), corner(y1, ax, az), radius, color, 5);
      rod(g, corner(y1, ax, az), corner(y1, bx2, bz), radius, color, 5);
    }
  }
}
function blinkLight(g: THREE.Object3D, at: V3, phase = 0, size = .045) { const b = animated(g, { type: 'blink', speed: 2.4, phase, always: true }, at); add(b, sph(size, 8, 6), M.red).castShadow = false; return b; }
/** Glazed curtain-wall block with white floor bands. */
function glassBlock(g: THREE.Object3D, w: number, h: number, d: number, at: V3, floors: number, band = white) {
  add(g, rbox(w, h, d, .03), M.facade, [at[0], at[1] + h / 2, at[2]], undefined, .9);
  for (let i = 0; i <= floors; i++) add(g, rbox(w + .05, .045, d + .05, .015), band, [at[0], at[1] + Math.min(h - .02, i * h / floors), at[2]]);
}
function stripedAwning(g: THREE.Object3D, at: V3, rotY: number, color: string, w = .82) {
  const a = new THREE.Group(); a.position.set(...at); a.rotation.y = rotY; g.add(a);
  for (let i = 0; i < 6; i++) add(a, rbox(w / 6 + .005, .025, .58, .008), i % 2 ? '#f5efe2' : color, [-w / 2 + (i + .5) * w / 6, 0, 0], [.32, 0, 0]);
  for (let i = 0; i < 6; i++) add(a, rbox(w / 6, .09, .02, .008), i % 2 ? '#f5efe2' : color, [-w / 2 + (i + .5) * w / 6, -.13, .28]);
  return a;
}
function tree(g: THREE.Object3D, at: V3, size = .3, color = '#6f9a4c') {
  add(g, cyl(.03 * size / .3, .04 * size / .3, size * 1.1, 6), M.darkWood, [at[0], at[1] + size * .55, at[2]]);
  bush(g, [at[0], at[1] + size * .75, at[2]], size, color);
}
function drone(g: THREE.Object3D, at: V3) {
  const d = new THREE.Group(); d.position.set(...at); g.add(d);
  add(d, rbox(.18, .06, .18, .03), white);
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; rod(d, vec(0, 0, 0), vec(Math.cos(a) * .17, .02, Math.sin(a) * .17), .012, darkSteel); add(d, cyl(.07, .07, .008, 12), '#3c4446', [Math.cos(a) * .17, .04, Math.sin(a) * .17]); }
  add(d, rbox(.1, .08, .1, .01), '#c99a5e', [0, -.08, 0]);
  lightStrip(d, [0, .035, .09], .08, .015, .01);
  return d;
}

// ---------------------------------------------------------------- farming
/** Plastered tower mill with a thatched cap and four lattice sails turning in the wind. */
function windmill() {
  const g = new THREE.Group();
  roundPad(g, 1.22, M.dirt);
  add(g, cyl(.62, .66, .22, 20), M.stone, [0, .06, 0], undefined, 2.4);
  add(g, cyl(.39, .55, 1.85, 20), M.plaster, [0, 1.09, 0], undefined, 1.2);
  add(g, cyl(.56, .6, .32, 20), M.stone, [0, .32, 0], undefined, 2.4);
  add(g, new THREE.TorusGeometry(.41, .045, 8, 24), M.darkWood, [0, 2.02, 0], [Math.PI / 2, 0, 0]);
  add(g, new THREE.ConeGeometry(.52, .72, 20), M.thatch, [0, 2.38, 0], undefined, 1.4);
  add(g, sph(.07, 8, 6), M.darkWood, [0, 2.76, 0]);
  doorAt(g, [0, .22, .54], 0, .3, .52);
  windowAt(g, [0, 1.2, .462], 0, .18, .22, { frame: M.darkWood });
  windowAt(g, [.3, 1.62, .3], Math.PI / 4, .16, .2);
  add(g, rbox(.24, .24, .32, .04), M.darkWood, [0, 1.98, .42]);
  const rotor = animated(g, { type: 'spin', axis: 'z', speed: .9, always: true }, [0, 1.98, .62]);
  add(rotor, cyl(.09, .09, .16, 12), M.darkWood, [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2 + .3; rotor.add(arm);
    timber(arm, vec(0, 0, .02), vec(0, 1.18, .02), .05, .05);
    for (const x of [.05, .27]) timber(arm, vec(x, .26, .04), vec(x, 1.14, .04), .022, .022, M.wood);
    for (let k = 0; k < 6; k++) timber(arm, vec(.04, .3 + k * .16, .04), vec(.28, .3 + k * .16, .04), .018, .018, M.wood);
    add(arm, rbox(.22, .84, .012, .005), '#efe6cf', [.16, .72, .055]);
  }
  sack(g, [.75, .07, .55], '#e0d2ab'); sack(g, [.92, .07, .38]); sack(g, [-.78, .07, .6], '#cdb98a');
  crate(g, [-.82, .07, -.55], .3, .3);
  return g;
}

/** Two-storey village house: stone ground floor, jettied timber upper floor, clay tiles and shutters. */
function townhouse() {
  const g = new THREE.Group();
  pad(g, 1.85, 1.6, M.paving);
  plinth(g, 1.5, 1.22, .16, .04);
  add(g, rbox(1.4, .9, 1.12, .02), M.stone, [0, .65, 0], undefined, 2.4);
  add(g, rbox(1.58, .08, 1.3, .02), M.darkWood, [0, 1.12, 0]);
  framedWalls(g, 1.5, .8, 1.22, 1.16);
  const spec = { width: 1.5, depth: 1.22, eave: 1.96, peak: 2.64, overhang: .2, kind: 'tile' as const, gable: M.plaster };
  gableRoof(g, spec);
  chimney(g, -.42, -.24, 1.8, roofHeight(spec, -.42) + .45, .22, M.brick);
  doorAt(g, [.3, .2, .562], 0, .32, .62, '#5d7f6e');
  add(g, rbox(.55, .04, .3, .01), M.tile, [.3, .95, .7], [.35, 0, 0]);
  windowAt(g, [-.32, .66, .565], 0, .3, .34, { shutters: '#5c7d93' });
  for (const x of [-.38, .38]) windowAt(g, [x, 1.56, .625], 0, .28, .32, { shutters: '#5c7d93', box: true });
  for (const s of [-1, 1]) windowAt(g, [s * .762, 1.56, 0], s * Math.PI / 2, .26, .3, { shutters: '#5c7d93' });
  windowAt(g, [.2, 1.56, -.625], Math.PI, .26, .3);
  for (const x of [-.66, .72]) add(g, lathe([[0, 0], [.08, 0], [.1, .14], [0, .14]], 10), '#b8643e', [x, .07, .78]);
  bush(g, [-.66, .2, .78], .09, '#6f9a4c', '#e86a8a'); bush(g, [.72, .2, .78], .09, '#6f9a4c', '#f2c15a');
  lampPost(g, [-.85, .07, .45], .72);
  return g;
}

/** Village market: three striped stalls around a small square, a produce cart and barrels. */
function market() {
  const g = new THREE.Group();
  roundPad(g, 1.48, M.paving);
  const stall = (at: V3, rotY: number, color: string, goods: string[]) => {
    const s = new THREE.Group(); s.position.set(...at); s.rotation.y = rotY; g.add(s);
    add(s, rbox(.82, .06, .42, .015), M.lightWood, [0, .5, 0]);
    add(s, rbox(.8, .4, .02, .01), M.wood, [0, .3, .2]);
    for (const x of [-.38, .38]) for (const z of [-.2, .2]) timber(s, vec(x, .07, z), vec(x, z < 0 ? 1.12 : .98, z), .05, .05);
    stripedAwning(s, [0, 1.07, .02], 0, color);
    goods.forEach((c, i) => {
      const x = -.27 + i * .27;
      add(s, rbox(.22, .08, .3, .02), M.wood, [x, .57, 0]);
      for (let k = 0; k < 6; k++) add(s, sph(.04, 7, 5), c, [x - .06 + (k % 3) * .06, .64, -.06 + Math.floor(k / 3) * .1]);
    });
    crate(s, [.5, .07, -.05], .24, .3); basket(s, [-.52, .07, .1]);
  };
  const basket = (s: THREE.Object3D, at: V3) => { add(s, lathe([[0, 0], [.1, 0], [.13, .13], [0, .12]], 12), M.lightWood, at); for (let i = 0; i < 4; i++) add(s, sph(.04, 6, 5), '#e48a3a', [at[0] + Math.cos(i * 1.6) * .05, at[1] + .14, at[2] + Math.sin(i * 1.6) * .05]); };
  stall([-.82, 0, -.15], .55, '#c9473f', ['#d0453d', '#e9c24f', '#6f9c48']);
  stall([0, 0, -.8], 0, '#4f86b8', ['#c88a4a', '#e48a3a', '#9b3f6a']);
  stall([.82, 0, -.15], -.55, '#e0a43a', ['#6f9c48', '#d0453d', '#b5503e']);
  // Hand cart with a load of produce.
  const cart = new THREE.Group(); cart.position.set(.35, 0, .78); cart.rotation.y = -.5; g.add(cart);
  add(cart, rbox(.5, .14, .36, .02), M.wood, [0, .3, 0]);
  for (const s of [-1, 1]) add(cart, cyl(.15, .15, .04, 14), M.darkWood, [s * .22, .15, 0], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) timber(cart, vec(-.25, .3, s * .12), vec(-.6, .22, s * .12), .03, .03);
  for (let k = 0; k < 7; k++) add(cart, sph(.06, 7, 5), ['#6f9c48', '#d0453d', '#e9c24f'][k % 3], [-.15 + (k % 4) * .1, .42, -.08 + Math.floor(k / 4) * .14]);
  barrel(g, [-.75, .07, .72]); barrel(g, [-.55, .07, .85], .85);
  lampPost(g, [.0, .07, .2], .82);
  return g;
}

// ---------------------------------------------------------------- industrial
/** Brick boiler house with two banded stacks, a cooling tower, coal conveyor and transformer yard. */
function power() {
  const g = new THREE.Group();
  roundPad(g, 1.8);
  plinth(g, 1.25, 1.72, .12, .04).position.x = -.5;
  add(g, rbox(1.1, 1.15, 1.6, .03), M.brick, [-.5, .73, 0], undefined, 2);
  const roofGroup = new THREE.Group(); roofGroup.position.x = -.5; g.add(roofGroup);
  gableRoof(roofGroup, { width: 1.1, depth: 1.6, eave: 1.3, peak: 1.78, overhang: .14, kind: 'slate', gable: M.brick });
  for (let i = 0; i < 2; i++) windowAt(g, [.052, .82, -.55 + i * .35], Math.PI / 2, .24, .56, { frame: '#e4dccb' });
  add(g, rbox(.03, .16, .2, .01), '#2a2e2f', [.06, .84, .1]);
  for (const z of [-.62, .02]) {
    add(g, cyl(.15, .22, 2.9, 14), M.concrete, [-.95, 1.5, z - .38], undefined, 1.4);
    for (const y of [2.55, 2.8]) add(g, cyl(.16, .165, .12, 14), '#c4503e', [-.95, y, z - .38]);
    smoke(g, [-.95, 3.02, z - .38], 'industry', 1.3);
  }
  const tower = lathe([[.66, 0], [.55, .45], [.44, .95], [.45, 1.22], [.52, 1.45]], 28);
  add(g, tower, M.concrete, [.78, .07, -.62]);
  add(g, lathe([[.5, 1.43], [.43, 1.2], [.42, .95], [.53, .45], [.64, .02]], 28), '#9a9d98', [.78, .07, -.62]);
  smoke(g, [.78, 1.55, -.62], 'steam', 1.7);
  // Coal heap and inclined conveyor feeding the boiler house.
  for (let i = 0; i < 6; i++) { const m = add(g, new THREE.IcosahedronGeometry(.18, 1), '#2f302d', [.25 + Math.cos(i * 2.2) * .18, .1 + (i ? 0 : .08), .95 + Math.sin(i * 2.2) * .14]); m.scale.y = .6; }
  add(g, rbox(.16, .05, 1.0, .01), darkSteel, [.1, .55, .45], [.62, 0, 0]);
  for (const z of [.15, .75]) timber(g, vec(.1, .07, z), vec(.1, .7 - (z - .15) * .62, z), .04, .04, darkSteel);
  // Transformer yard with insulators and a pylon carrying the line away.
  for (let i = 0; i < 3; i++) {
    add(g, rbox(.22, .26, .2, .02), '#7e8a86', [.75 + i * .3, .2, .55]);
    for (let k = 0; k < 2; k++) add(g, cyl(.025, .025, .14, 8), '#e9e3d6', [.7 + i * .3 + k * .1, .4, .55]);
  }
  fence(g, [[.55, .3], [1.5, .3], [1.5, .8], [.55, .8]], .24, true);
  rod(g, vec(1.35, .07, 1.05), vec(1.35, 1.35, 1.05), .03, darkSteel);
  timber(g, vec(1.1, 1.3, 1.05), vec(1.6, 1.3, 1.05), .04, .04, darkSteel);
  return g;
}

/** Brick factory hall with a glazed sawtooth roof, loading dock, forklift and stack. */
function factory() {
  const g = new THREE.Group();
  pad(g, 2.7, 2.3, M.concrete, .12);
  plinth(g, 2.5, 1.6, .12, .04);
  add(g, rbox(2.4, .96, 1.5, .03), M.brick, [0, .64, 0], undefined, 2);
  const low = 1.1, rise = .4, run = .375, angle = Math.atan2(rise, run), len = Math.hypot(rise, run);
  for (let i = 0; i < 4; i++) {
    const z0 = -.75 + i * run, z1 = z0 + run;
    add(g, rbox(2.46, .045, len + .02, .01), M.corrugated, [0, low + rise / 2 + .02, (z0 + z1) / 2], [-angle, 0, 0]);
    add(g, bx(2.36, rise - .02, .03), M.glass, [0, low + rise / 2, z1 - .01]);
    for (let k = 0; k < 6; k++) add(g, bx(.025, rise, .045), '#e4dccb', [-1.15 + k * .46, low + rise / 2, z1]);
    for (const s of [-1, 1]) add(g, prism([[0, 0], [run, 0], [run, rise]], .05), M.brick, [s * 1.2, low, z0], [0, -Math.PI / 2, 0], 2);
  }
  for (let i = 0; i < 4; i++) windowAt(g, [-.95 + i * .42, .72, .762], 0, .3, .42, { frame: '#e4dccb' });
  add(g, rbox(.62, .7, .04, .01), M.corrugated, [.82, .5, .77]);
  add(g, rbox(.9, .22, .45, .02), M.concrete, [.82, .11, 1.0], undefined, 2);
  for (let i = 0; i < 3; i++) crate(g, [.55 + i * .28, .22, 1.02], .22, i * .2);
  // Forklift.
  const lift = new THREE.Group(); lift.position.set(-.55, .07, 1.05); lift.rotation.y = .5; g.add(lift);
  add(lift, rbox(.24, .16, .34, .03), yellow, [0, .15, 0]); add(lift, rbox(.2, .2, .03, .01), darkSteel, [0, .32, -.05]);
  for (const s of [-1, 1]) { add(lift, bx(.02, .42, .02), darkSteel, [s * .08, .3, .19]); add(lift, bx(.03, .015, .22), darkSteel, [s * .06, .05, .3]); }
  for (const s of [-1, 1]) for (const z of [-.1, .1]) add(lift, cyl(.05, .05, .04, 10), '#2d2f2f', [s * .13, .05, z], [0, 0, Math.PI / 2]);
  chimney(g, -1.05, -.55, .9, 2.8, .26, M.brick, 'industry');
  return g;
}

/** Three-storey red-brick workers' block with balconies, cornices and two chimneys. */
function tenement() {
  const g = new THREE.Group();
  pad(g, 1.9, 1.6, M.paving);
  plinth(g, 1.62, 1.2, .14, .04);
  add(g, rbox(1.5, 2.1, 1.08, .02), M.brick, [0, 1.23, 0], undefined, 2);
  for (const y of [.9, 1.6]) add(g, rbox(1.56, .06, 1.14, .015), '#e3dccb', [0, y, 0]);
  const spec = { width: 1.5, depth: 1.08, eave: 2.28, peak: 2.72, overhang: .14, kind: 'slate' as const, gable: M.brick };
  gableRoof(g, spec);
  for (const x of [-.5, .5]) chimney(g, x, -.2, 2.1, roofHeight(spec, x) + .4, .2, M.brick);
  for (const [y, row] of [[.55, 0], [1.25, 1], [1.95, 2]] as const) for (const x of [-.48, 0, .48]) {
    if (row === 0 && x === 0) continue;
    windowAt(g, [x, y, .552], 0, .24, .34, { frame: '#e8e1d0' });
  }
  for (const y of [1.25, 1.95]) for (const s of [-1, 1]) windowAt(g, [s * .762, y, 0], s * Math.PI / 2, .24, .34, { frame: '#e8e1d0' });
  doorAt(g, [0, .18, .552], 0, .3, .58, '#3f5a52');
  for (const y of [1.04, 1.74]) {
    add(g, rbox(.6, .05, .26, .01), M.concrete, [0, y, .67]);
    for (let i = 0; i < 7; i++) add(g, bx(.012, .22, .012), 'metal:#3b3d3a', [-.28 + i * .093, y + .13, .79]);
    add(g, bx(.6, .02, .02), 'metal:#3b3d3a', [0, y + .24, .79]);
    add(g, lathe([[0, 0], [.05, 0], [.06, .08], [0, .08]], 8), '#b8643e', [-.2, y + .03, .74]); bush(g, [-.2, y + .1, .74], .06, '#6f9a4c', '#e86a8a');
  }
  add(g, rbox(.5, .04, .25, .01), M.slate, [0, .86, .66], [.3, 0, 0]);
  return g;
}

/** Truck depot: corrugated barrel-vault garage with open bays, fuel pump and two trucks. */
function depot() {
  const g = new THREE.Group();
  pad(g, 2.7, 2.3, M.concrete, .12);
  add(g, rbox(2.3, .8, 1.3, .03), M.concrete, [0, .47, -.45], undefined, 1.4);
  const vault = new THREE.CylinderGeometry(.66, .66, 2.36, 18, 1, false, 0, Math.PI); vault.rotateZ(Math.PI / 2);
  const roofMesh = add(g, vault, M.corrugated, [0, .87, -.45], undefined, 2.2); roofMesh.scale.y = .55;
  // Half-disc gables, squashed like the vault so the ends close it exactly.
  for (const s of [-1, 1]) { const end = new THREE.CircleGeometry(.66, 18, 0, Math.PI); end.rotateY(s * Math.PI / 2); add(g, end, M.concrete, [s * 1.17, .87, -.45]).scale.y = .55; }
  for (let i = 0; i < 3; i++) {
    const x = -.72 + i * .72;
    add(g, rbox(.56, .62, .1, .02), '#2a2e2f', [x, .4, .2]);
    add(g, rbox(.6, .24, .05, .01), M.corrugated, [x, .62, .23]);
    add(g, bx(.6, .05, .06), yellow, [x, .76, .24]);
  }
  truck(g, [-.55, .07, .6], .15, '#e1b443');
  truck(g, [.5, .07, .7], -.2, '#c9563f', '#6c7a84');
  add(g, rbox(.14, .34, .12, .02), '#c9473f', [1.2, .24, .55]); add(g, bx(.1, .08, .02), '#f1ede4', [1.2, .34, .62]);
  add(g, rbox(.62, .16, .5, .02), M.concrete, [-1.15, .1, .55], undefined, 2);
  for (let i = 0; i < 3; i++) crate(g, [-1.3 + i * .22, .18, .55], .19, i * .3);
  lampPost(g, [1.25, .07, 1.0], 1.0, true);
  return g;
}

// ---------------------------------------------------------------- information
/** Glass residential tower over a lobby podium, with balconies and a planted roof. */
function apartment() {
  const g = new THREE.Group();
  pad(g, 1.8, 1.6, M.paving);
  add(g, rbox(1.5, .52, 1.22, .03), M.concrete, [0, .33, 0], undefined, 1.4);
  add(g, rbox(.8, .36, .04, .01), M.glass, [.15, .3, .62]);
  add(g, rbox(1.0, .04, .36, .01), white, [.15, .55, .72]);
  glassBlock(g, 1.2, 2.7, 1.0, [0, .59, -.04], 6);
  for (const x of [-.62, .62]) for (const z of [-.54, .46]) add(g, rbox(.07, 2.72, .07, .02), white, [x, 1.95, z]);
  for (let f = 1; f < 6; f++) if (f % 2) {
    add(g, rbox(.55, .04, .24, .01), white, [-.2, .59 + f * .45, .56]);
    add(g, bx(.55, .14, .015), M.glass, [-.2, .66 + f * .45, .67]);
  } else { add(g, rbox(.5, .04, .24, .01), white, [.28, .59 + f * .45, .56]); add(g, bx(.5, .14, .015), M.glass, [.28, .66 + f * .45, .67]); }
  add(g, rbox(1.24, .1, 1.04, .02), white, [0, 3.34, -.04]);
  for (const [x, z] of [[-.35, .2], [.1, .25], [.35, -.2]]) bush(g, [x, 3.38, z - .04], .14, '#6f9a4c');
  tank(g, [-.3, 3.38, -.32], .14, .3, steel, '#4f86b8');
  rod(g, vec(.42, 3.38, -.35), vec(.42, 3.95, -.35), .015, steel);
  return g;
}

/** Lattice telecom mast with antenna panels, microwave dishes, an equipment hut and an aviation light. */
function telecom() {
  const g = new THREE.Group();
  roundPad(g, 1.04);
  // Grey lower mast, then red and white top sections.
  lattice(g, .42, .171, 2.8, 5, 'metal:#d4d8d6', [0, .07, 0]);
  lattice(g, .171, .1355, .4, 1, 'metal:#d24a3a', [0, 2.87, 0]);
  lattice(g, .1355, .1, .4, 1, 'metal:#f3f1ec', [0, 3.27, 0]);
  for (const [y, size] of [[2.2, .38], [3.05, .28]] as const) {
    add(g, rbox(size * 2, .04, size * 2, .01), darkSteel, [0, y, 0]);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; add(g, rbox(.09, .42, .05, .02), white, [Math.sin(a) * (size + .03), y + .22, Math.cos(a) * (size + .03)], [0, a, 0]); }
  }
  dish(g, [.34, 1.7, .1], .2, [0, Math.PI / 2 + .3, 0]);
  dish(g, [-.1, 1.95, .34], .17, [0, -.4, 0]);
  rod(g, vec(0, 3.6, 0), vec(0, 4.35, 0), .02, steel);
  blinkLight(g, [0, 4.38, 0]); blinkLight(g, [0, 2.26, .38], 1.2, .03);
  add(g, rbox(.62, .42, .45, .03), M.concrete, [.55, .28, .55], undefined, 1.4);
  add(g, rbox(.18, .3, .02, .01), darkSteel, [.4, .22, .785]);
  fanUnit(g, [.7, .49, .55], .2);
  fence(g, [[-.72, -.72], [.72, -.72], [.72, .72], [-.72, .72]], .26, true);
  return g;
}

/** Research centre: glazed laboratory wings, an observatory dome with telescope, roof dish and courtyard. */
function lab() {
  const g = new THREE.Group();
  roundPad(g, 1.7, M.paving);
  add(g, rbox(1.8, .9, 1.1, .04), M.concrete, [-.3, .52, -.35], undefined, 1.2);
  add(g, rbox(1.74, .26, 1.12, .02), M.glass, [-.3, .58, -.35]);
  add(g, rbox(1.2, .55, .9, .04), M.concrete, [-.55, 1.24, -.4], undefined, 1.2);
  add(g, rbox(1.14, .18, .92, .02), M.glass, [-.55, 1.26, -.4]);
  add(g, rbox(1.86, .06, 1.16, .02), white, [-.3, .98, -.35]);
  add(g, rbox(.6, .5, .04, .01), M.glass, [-.1, .32, .22]); add(g, rbox(.9, .04, .4, .01), white, [-.1, .6, .38]);
  for (const x of [-.48, .28]) rod(g, vec(x, .07, .55), vec(x, .58, .55), .02, steel);
  dish(g, [-.95, 1.65, -.4], .22, [-.7, .6, 0]);
  for (let i = 0; i < 3; i++) add(g, rbox(.3, .02, .2, .005), M.solar, [-.05 + i * .32, 1.0, -.6], [-.3, 0, 0]);
  // Observatory.
  add(g, cyl(.46, .48, .55, 24), M.concrete, [.85, .35, .35], undefined, 1.4);
  add(g, new THREE.SphereGeometry(.47, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 'metal:#eef0ef', [.85, .62, .35]);
  add(g, rbox(.14, .5, .12, .02), '#2f3a3d', [.85, .95, .58], [.75, 0, 0]);
  rod(g, vec(.85, .85, .45), vec(.85, 1.2, .75), .055, 'metal:#d9dee0');
  for (const [x, z] of [[.3, .95], [1.2, -.35]]) { add(g, cyl(.14, .15, .14, 12), M.concrete, [x, .14, z]); tree(g, [x, .2, z], .26); }
  add(g, rbox(.5, .05, .14, .01), M.wood, [-.95, .3, .55]);
  return g;
}

/** Clean-room electronics fab: white block with a blue band, rooftop air handlers, ducts and gas tanks. */
function chipfab() {
  const g = new THREE.Group();
  roundPad(g, 1.8);
  add(g, rbox(2.5, .92, 1.7, .05), white, [0, .53, -.25]);
  add(g, rbox(2.52, .12, 1.72, .02), '#4b88c7', [0, .86, -.25]);
  add(g, rbox(2.3, .16, 1.72, .01), M.glass, [0, .55, -.25]);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) fanUnit(g, [-.8 + i * .8, .99, -.65 + k * .7], .34);
  pipe(g, [[-1.15, 1.1, -.95], [-1.15, 1.1, .3], [1.0, 1.1, .3]], .045, steel);
  for (const x of [.85, 1.05]) { add(g, cyl(.06, .06, .4, 10), steel, [x, 1.2, -.95]); smoke(g, [x, 1.42, -.95], 'steam', .7); }
  glassBlock(g, .75, .66, .5, [.6, .07, .82], 2);
  add(g, rbox(.9, .04, .6, .01), white, [.6, .75, .85]);
  tank(g, [-1.2, .07, .78], .2, .8, steel, '#4b88c7'); tank(g, [-.75, .07, .9], .17, .65, steel, '#4b88c7');
  pipe(g, [[-1.2, .7, .6], [-1.2, .7, .4]], .035, steel);
  return g;
}

/** Three wind turbines on separate footings, rotors staggered so they never cross, plus a substation. */
function windfarm() {
  const g = new THREE.Group();
  const turbine = (x: number, z: number, phase: number) => {
    add(g, cyl(.22, .26, .14, 16), M.concrete, [x, .02, z]);
    add(g, cyl(.045, .085, 3.0, 14), white, [x, 1.56, z]);
    add(g, rbox(.16, .14, .38, .05), white, [x, 3.1, z - .04]);
    const rotor = animated(g, { type: 'spin', axis: 'z', speed: 1.6, phase, always: true }, [x, 3.1, z + .19]);
    add(rotor, new THREE.ConeGeometry(.07, .16, 12), white, [0, 0, .06], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) { const blade = new THREE.Group(); blade.rotation.z = i * Math.PI * 2 / 3; rotor.add(blade); const b = add(blade, rbox(.075, .95, .02, .008), white, [.02, .5, 0]); b.rotation.y = .25; }
  };
  turbine(-1.05, .35, 0); turbine(0, -.55, 1.7); turbine(1.05, .35, 3.1);
  add(g, rbox(.5, .32, .4, .02), '#7e8a86', [0, .2, .95]);
  for (let i = 0; i < 3; i++) add(g, cyl(.025, .025, .14, 8), '#e9e3d6', [-.15 + i * .15, .42, .95]);
  fence(g, [[-.4, .65], [.4, .65], [.4, 1.25], [-.4, 1.25]], .22, true);
  return g;
}

// ---------------------------------------------------------------- intelligence
/** Data centre: dark clad hall with cyan light lines, rows of rooftop fans, chillers and a generator. */
function datacenter() {
  const g = new THREE.Group();
  roundPad(g, 1.8);
  add(g, rbox(2.6, .82, 1.6, .05), 'metal:#59616a', [0, .48, -.2]);
  for (let i = 0; i < 11; i++) add(g, bx(.02, .78, .02), 'metal:#7c858d', [-1.25 + i * .25, .48, .61]);
  for (const y of [.28, .62]) lightStrip(g, [0, y, .615], 2.5, .025, .02);
  for (const s of [-1, 1]) lightStrip(g, [s * 1.305, .45, -.2], .02, .025, 1.5);
  add(g, rbox(.5, .5, .04, .01), M.glass, [-.85, .32, .62]); add(g, rbox(.7, .04, .3, .01), '#e9ecec', [-.85, .6, .72]);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) fanUnit(g, [-.95 + i * .63, .9, -.6 + k * .7], .36);
  for (let i = 0; i < 3; i++) { add(g, rbox(.36, .3, .36, .03), 'metal:#cfd4d4', [1.38, .22, -.75 + i * .45]); fanUnit(g, [1.38, .37, -.75 + i * .45], .3); }
  pipe(g, [[1.22, .3, -.75], [1.22, .3, .15]], .04, steel);
  add(g, rbox(.8, .36, .36, .03), '#d9dcd8', [.6, .25, .95]); add(g, cyl(.04, .04, .2, 8), darkSteel, [.9, .52, .95]);
  for (let i = 0; i < 3; i++) add(g, rbox(.34, .02, .22, .005), M.solar, [-1.1 + i * .36, .1, 1.0], [-.35, 0, 0]);
  return g;
}

/** Open robotics hall: two articulated arms assembling on a conveyor, a finished robot standing by. */
function robotics() {
  const g = new THREE.Group();
  roundPad(g, 1.8);
  add(g, rbox(2.5, 1.3, .12, .03), '#eceeed', [0, .72, -.95]);
  for (const s of [-1, 1]) add(g, rbox(.12, 1.3, 1.3, .03), '#eceeed', [s * 1.2, .72, -.35]);
  add(g, rbox(2.56, .1, 1.42, .03), '#eceeed', [0, 1.42, -.32]);
  for (let i = 0; i < 3; i++) add(g, rbox(.5, .04, 1.0, .01), M.glass, [-.8 + i * .8, 1.48, -.32]);
  for (const x of [-1.2, -.4, .4, 1.2]) add(g, rbox(.1, .1, 1.44, .02), orange, [x, 1.36, -.32]);
  for (const s of [-1, 1]) add(g, rbox(.1, 1.36, .1, .02), orange, [s * 1.22, .72, .32]);
  add(g, rbox(2.0, .14, .32, .03), '#3a4144', [0, .2, .05]);
  for (let i = 0; i < 9; i++) add(g, cyl(.04, .04, .34, 8), steel, [-.95 + i * .24, .28, .05], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) add(g, rbox(.16, .14, .16, .02), i % 2 ? '#c99a5e' : white, [-.75 + i * .5, .38, .05]);
  for (const x of [-.9, .9]) for (let i = 0; i < 6; i++) add(g, bx(.1, .005, .04), i % 2 ? '#2d2f2f' : yellow, [x, .075, .55 - i * .08]);
  const arm = (x: number, phase: number) => {
    add(g, cyl(.14, .17, .14, 16), '#3a4144', [x, .14, .55]);
    const turret = animated(g, { type: 'swing', axis: 'y', speed: .9, amount: .9, phase, always: true }, [x, .22, .55]);
    add(turret, cyl(.11, .12, .14, 14), orange, [0, .07, 0]);
    const shoulder = animated(turret, { type: 'swing', axis: 'x', speed: 1.3, amount: .35, phase: phase + 1, always: true }, [0, .16, 0]);
    add(shoulder, sph(.08, 10, 8), darkSteel);
    add(shoulder, rbox(.1, .5, .1, .03), orange, [0, .25, 0]);
    const elbow = animated(shoulder, { type: 'swing', axis: 'x', speed: 1.3, amount: .5, phase: phase + 2.2, always: true }, [0, .5, 0]);
    add(elbow, sph(.065, 10, 8), darkSteel);
    add(elbow, rbox(.08, .08, .4, .02), orange, [0, 0, -.2]);
    add(elbow, cyl(.04, .04, .08, 10), darkSteel, [0, -.03, -.42]);
    for (const s of [-1, 1]) add(elbow, bx(.015, .08, .02), darkSteel, [s * .03, -.09, -.42]);
  };
  arm(-.55, 0); arm(.55, 1.9);
  const bot = new THREE.Group(); bot.position.set(1.2, .07, .9); bot.rotation.y = -.6; g.add(bot);
  add(bot, rbox(.22, .26, .16, .06), white, [0, .42, 0]); add(bot, rbox(.18, .14, .15, .05), white, [0, .66, 0]);
  lightStrip(bot, [0, .67, .078], .13, .03, .01);
  for (const s of [-1, 1]) { add(bot, new THREE.CapsuleGeometry(.035, .18, 3, 8), '#9aa3a5', [s * .07, .17, 0]); add(bot, new THREE.CapsuleGeometry(.03, .16, 3, 8), '#9aa3a5', [s * .15, .42, 0]); }
  return g;
}

/** Autonomous factory: composite dome with light rings, a production wing and orbiting delivery drones. */
function autofactory() {
  const g = new THREE.Group();
  roundPad(g, 1.84, M.paving);
  add(g, new THREE.SphereGeometry(1.0, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), 'metal:#f0f2f1', [-.35, .07, -.35]);
  for (const [y, r] of [[.32, .95], [.64, .8]] as const) { const ring = add(g, new THREE.TorusGeometry(r, .022, 6, 40), M.cyan, [-.35, .07 + y, -.35], [Math.PI / 2, 0, 0]); ring.castShadow = false; }
  add(g, cyl(.22, .22, .06, 20), M.glass, [-.35, 1.06, -.35]);
  add(g, rbox(1.0, .55, .8, .05), white, [.95, .35, .45]);
  add(g, rbox(1.02, .14, .82, .02), M.glass, [.95, .42, .45]);
  lightStrip(g, [.95, .64, .86], .9, .02, .02);
  const tube = add(g, cyl(.11, .11, .9, 14), M.glass, [.32, .35, .12], [0, 0, Math.PI / 2]); tube.rotation.y = -.55;
  add(g, cyl(.42, .42, .05, 24), '#3a4144', [.95, .09, -.75]);
  add(g, new THREE.TorusGeometry(.36, .02, 6, 30), M.cyan, [.95, .125, -.75], [Math.PI / 2, 0, 0]).castShadow = false;
  const orbitA = animated(g, { type: 'spin', axis: 'y', speed: .7, always: true }, [.95, .55, -.75]);
  const bobA = animated(orbitA, { type: 'bob', axis: 'y', speed: 2.1, amount: .06, always: true }, [.38, 0, 0]); drone(bobA, [0, 0, 0]);
  const orbitB = animated(g, { type: 'spin', axis: 'y', speed: -.45, always: true }, [-.35, 1.45, -.35]);
  const bobB = animated(orbitB, { type: 'bob', axis: 'y', speed: 1.7, amount: .08, phase: 1, always: true }, [.75, 0, 0]); drone(bobB, [0, 0, 0]);
  for (let i = 0; i < 3; i++) add(g, rbox(.2, .16, .2, .02), '#c99a5e', [1.35, .15, .95 - i * .25]);
  return g;
}

/** Fusion plant: tokamak ring wrapped in field coils with a glowing plasma band and a control hall. */
function fusion() {
  const g = new THREE.Group();
  roundPad(g, 1.84, M.paving);
  add(g, cyl(1.1, 1.16, .2, 36), M.concrete, [0, .14, -.2], undefined, 1.4);
  add(g, new THREE.TorusGeometry(.75, .25, 16, 40), 'metal:#cfd5d8', [0, .62, -.2], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, coil = add(g, rbox(.12, .68, .64, .05), 'metal:#3f6fa8', [Math.cos(a) * .75, .62, -.2 + Math.sin(a) * .75]);
    coil.rotation.y = -a;
  }
  const plasma = animated(g, { type: 'pulse', speed: 2.2, amount: .6, always: true }, [0, .88, -.2]);
  add(plasma, new THREE.TorusGeometry(.75, .055, 10, 48), M.cyan, [0, 0, 0], [Math.PI / 2, 0, 0]);
  plasma.userData.noShadow = true;
  add(g, cyl(.26, .3, 1.1, 20), 'metal:#dfe3e4', [0, .79, -.2]);
  for (const y of [.6, .95]) add(g, new THREE.TorusGeometry(.275, .015, 6, 24), M.cyan, [0, y, -.2], [Math.PI / 2, 0, 0]);
  add(g, rbox(.7, .45, .45, .04), white, [.95, .3, 1.05]);
  add(g, rbox(.72, .12, .47, .02), M.glass, [.95, .36, 1.05]);
  pipe(g, [[.45, .3, .45], [.8, .3, .82]], .05, steel);
  pipe(g, [[-.6, .25, .45], [-1.05, .25, .9], [-1.05, .7, .9]], .05, steel);
  rod(g, vec(-1.05, .07, .9), vec(-1.05, 1.2, .9), .03, darkSteel);
  return g;
}

/** Terraced eco tower: glazed floors stepping back, each terrace planted, a vertical-axis turbine on top. */
function ecotower() {
  const g = new THREE.Group();
  roundPad(g, 1.34, M.paving);
  const greens = ['#6f9a4c', '#86ad57', '#5c8a45', '#7aa552'];
  let y = .07;
  // Each storey twists a little; every terrace carries hedges, shrubs and small trees, with vines on the glazing.
  for (let k = 0; k < 6; k++) {
    const tier = new THREE.Group(); tier.position.y = y; tier.rotation.y = k * .2; g.add(tier);
    const w = 1.46 - k * .14, core = w - .32;
    add(tier, rbox(w, .07, w, .03), white, [0, .035, 0]);
    add(tier, rbox(core, .4, core, .04), M.facade, [0, .27, 0], undefined, .9);
    for (let side = 0; side < 4; side++) {
      const a = side * Math.PI / 2, cx = Math.sin(a), cz = Math.cos(a), edge = w / 2 - .085;
      add(tier, rbox(w - .12, .08, .09, .035), greens[(k + side) % 4], [cx * edge, .1, cz * edge], [0, a, 0]);
      for (const t of [-.26, .26]) bush(tier, [cx * edge + Math.cos(a) * t * w, .1, cz * edge - Math.sin(a) * t * w], .1 + ((side + k) % 2) * .03, greens[(side + k + 1) % 4]);
    }
    if (k % 2 === 0) tree(tier, [w / 2 - .15, .07, w / 2 - .15], .2, greens[k % 4]);
    for (const [sx, sz] of [[-1, 1], [1, -1]]) add(tier, rbox(.06, .36, .06, .025), '#5f8e45', [sx * core / 2, .26, sz * core / 2]);
    y += .48;
  }
  add(g, rbox(.62, .05, .62, .02), white, [0, y + .03, 0]);
  rod(g, vec(0, y, 0), vec(0, y + .55, 0), .025, steel);
  const vawt = animated(g, { type: 'spin', axis: 'y', speed: 1.4, always: true }, [0, y + .3, 0]);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const b = add(vawt, rbox(.04, .42, .1, .015), white, [Math.cos(a) * .17, 0, Math.sin(a) * .17]); b.rotation.set(0, -a, .3); }
  tree(g, [.85, .07, .7], .28); tree(g, [-.85, .07, .75], .24, '#86ad57'); tree(g, [.9, .07, -.62], .22, '#5c8a45');
  return g;
}

// ---------------------------------------------------------------- interstellar
/** Launch complex: flame-trench platform, service tower with access arms, a two-stage rocket venting vapour. */
function launchpad() {
  const g = new THREE.Group();
  roundPad(g, 1.9, M.concrete, .14);
  add(g, rbox(1.4, .36, 1.4, .05), M.concrete, [0, .26, 0], undefined, 1.4);
  add(g, rbox(.5, .3, .9, .03), '#2b2f30', [0, .24, .45]);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) add(g, bx(.1, .005, .05), i % 2 ? '#2d2f2f' : yellow, [s * .62, .445, -.4 + i * .2]);
  const rocket = new THREE.Group(); rocket.position.set(0, .44, 0); g.add(rocket);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; add(rocket, new THREE.ConeGeometry(.075, .14, 12, 1, true), darkSteel, [Math.cos(a) * .09, .06, Math.sin(a) * .09]); }
  add(rocket, cyl(.2, .2, 2.0, 22), white, [0, 1.13, 0]);
  add(rocket, cyl(.205, .205, .14, 22), '#2f3437', [0, .5, 0]); add(rocket, cyl(.205, .205, .1, 22), '#2f3437', [0, 1.95, 0]);
  add(rocket, cyl(.17, .2, .3, 22), '#cfd3d4', [0, 2.28, 0]);
  add(rocket, cyl(.17, .17, .7, 22), white, [0, 2.78, 0]);
  add(rocket, lathe([[.17, 0], [.165, .18], [.14, .36], [.09, .52], [.03, .62], [0, .64]], 22), white, [0, 3.13, 0]);
  add(rocket, cyl(.172, .172, .06, 22), orange, [0, 3.1, 0]);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, fin = add(rocket, rbox(.03, .42, .26, .01), '#2f3437', [Math.cos(a) * .27, .38, Math.sin(a) * .27]); fin.rotation.y = -a; }
  lattice(g, .2, .2, 3.9, 9, 'metal:#c8553a', [-.72, .07, -.1], .02);
  for (const y of [2.1, 3.25]) { add(g, rbox(.55, .06, .14, .02), 'metal:#9aa1a3', [-.38, y, -.06]); add(g, rbox(.16, .2, .18, .03), '#d9dcd8', [-.14, y + .05, -.04]); }
  add(g, rbox(.5, .06, .5, .02), darkSteel, [-.72, 3.98, -.1]); blinkLight(g, [-.72, 4.05, -.1]);
  for (const [x, z] of [[1.25, 1.1], [-1.25, 1.1]]) { rod(g, vec(x, .07, z), vec(x, 4.25, z), .025, steel); blinkLight(g, [x, 4.28, z], x); }
  add(g, sph(.32, 18, 12), white, [1.12, .58, -.95]); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; rod(g, vec(1.12 + Math.cos(a) * .22, .07, -.95 + Math.sin(a) * .22), vec(1.12 + Math.cos(a) * .18, .4, -.95 + Math.sin(a) * .18), .025, steel); }
  pipe(g, [[.85, .2, -.85], [.3, .2, -.4], [.12, .44, -.18]], .04, steel);
  smoke(g, [.32, .46, .25], 'steam', 1.4); smoke(g, [-.3, .46, .3], 'steam', 1.1);
  return g;
}

/** Spaceport: curved terminal and control tower, two lit landing pads, a parked transport ship and cargo. */
function spaceport() {
  const g = new THREE.Group();
  roundPad(g, 2.1);
  glassBlock(g, 2.4, .55, .78, [0, .07, -1.0], 1);
  const vault = new THREE.CylinderGeometry(.62, .62, 2.6, 22, 1, false, 0, Math.PI); vault.rotateZ(Math.PI / 2);
  const roofMesh = add(g, vault, white, [0, .62, -1.0]); roofMesh.scale.y = .42;
  add(g, cyl(.12, .16, 1.55, 14), white, [1.45, .85, -1.0]);
  add(g, cyl(.3, .24, .3, 16), M.glass, [1.45, 1.75, -1.0]); add(g, cyl(.34, .34, .05, 16), white, [1.45, 1.93, -1.0]);
  rod(g, vec(1.45, 1.95, -1.0), vec(1.45, 2.35, -1.0), .015, steel); blinkLight(g, [1.45, 2.38, -1.0]);
  for (const [x, z] of [[-.78, .4], [.82, .55]]) {
    add(g, cyl(.64, .66, .06, 32), '#3a4144', [x, .12, z]);
    add(g, new THREE.TorusGeometry(.58, .02, 6, 40), M.cyan, [x, .16, z], [Math.PI / 2, 0, 0]).castShadow = false;
    for (const s of [-1, 1]) add(g, bx(.05, .006, .4), '#f1ede4', [x + s * .14, .155, z]);
    add(g, bx(.28, .006, .05), '#f1ede4', [x, .155, z]);
  }
  // Transport ship on the first pad.
  const ship = new THREE.Group(); ship.position.set(-.78, .38, .4); ship.rotation.y = .35; g.add(ship);
  add(ship, new THREE.CapsuleGeometry(.2, .75, 6, 16), white, [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(ship, sph(.15, 14, 10), M.glass, [0, .07, .42]).scale.set(1, .6, 1.2);
  for (const s of [-1, 1]) { const wing = add(ship, rbox(.55, .04, .32, .015), '#d9dcd8', [s * .38, -.04, -.12]); wing.rotation.y = s * .35; add(ship, rbox(.04, .18, .22, .015), orange, [s * .62, .04, -.26]); }
  for (const s of [-1, 1]) { add(ship, cyl(.08, .1, .3, 14), darkSteel, [s * .14, -.02, -.55], [Math.PI / 2, 0, 0]); add(ship, cyl(.065, .065, .01, 14), M.cyan, [s * .14, -.02, -.705], [Math.PI / 2, 0, 0]).castShadow = false; }
  for (const [x, z] of [[-.15, .25], [.15, .25], [0, -.35]]) rod(ship, vec(x, -.15, z), vec(x * 1.4, -.26, z * 1.1), .015, darkSteel);
  for (let i = 0; i < 3; i++) add(g, rbox(.36, .26, .24, .02), ['#4f86b8', orange, '#d9dcd8'][i], [1.45 - i * .02, .2 + (i === 2 ? .26 : 0), .1 + (i === 2 ? 0 : i * .28)]);
  lampPost(g, [0, .07, 1.25], .9, true);
  return g;
}

/** Orbital elevator: anchor station, a tether rising past the clouds, a climber pod and a slowly turning station. */
function elevator() {
  const g = new THREE.Group();
  roundPad(g, 1.6, M.paving);
  add(g, cyl(1.0, 1.15, .4, 8), M.concrete, [0, .27, 0], undefined, 1.4);
  add(g, cyl(.58, .82, .52, 8), white, [0, .73, 0]);
  add(g, new THREE.TorusGeometry(.6, .03, 6, 32), M.cyan, [0, 1.0, 0], [Math.PI / 2, 0, 0]).castShadow = false;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; rod(g, vec(Math.cos(a) * .55, .98, Math.sin(a) * .55), vec(Math.cos(a) * .08, 1.9, Math.sin(a) * .08), .04, steel); }
  add(g, cyl(.12, .14, .3, 12), darkSteel, [0, 1.95, 0]);
  const tether = add(g, cyl(.022, .022, 9.7, 6), '#7b8489', [0, 6.95, 0]); tether.castShadow = false; tether.userData.separate = true;
  const climber = animated(g, { type: 'slide', axis: 'y', speed: .22, amount: 8.4, always: true }, [0, 2.2, 0]);
  add(climber, cyl(.13, .13, .32, 12), white); add(climber, new THREE.TorusGeometry(.14, .02, 6, 20), M.cyan, [0, .1, 0], [Math.PI / 2, 0, 0]);
  climber.userData.noShadow = true;
  const station = animated(g, { type: 'spin', axis: 'y', speed: .18, always: true }, [0, 11.8, 0]);
  add(station, new THREE.TorusGeometry(.75, .08, 10, 40), white, [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(station, cyl(.18, .18, .5, 14), steel);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; rod(station, vec(0, 0, 0), vec(Math.cos(a) * .72, 0, Math.sin(a) * .72), .025, steel); }
  for (const s of [-1, 1]) add(station, rbox(.9, .02, .34, .005), M.solar, [s * 1.3, 0, 0]);
  lightStrip(station, [0, .27, 0], .1, .03, .1);
  station.userData.noShadow = true;
  for (const [x, z] of [[1.15, .75], [-1.15, .75]]) { add(g, rbox(.42, .32, .32, .03), x > 0 ? '#4f86b8' : '#d9dcd8', [x, .23, z]); }
  return g;
}

/** Deep-space radar: a giant steerable dish on a turning mount, control building and two tracking dishes. */
function deepradar() {
  const g = new THREE.Group();
  roundPad(g, 1.8);
  add(g, cyl(.55, .72, .5, 18), M.concrete, [0, .32, -.2], undefined, 1.4);
  const mount = animated(g, { type: 'spin', axis: 'y', speed: .14, always: true }, [0, .57, -.2]);
  add(mount, cyl(.45, .45, .1, 18), darkSteel, [0, .05, 0]);
  for (const s of [-1, 1]) add(mount, rbox(.1, .9, .3, .03), '#d9dcd8', [s * .42, .5, 0]);
  const tilt = new THREE.Group(); tilt.position.y = .9; tilt.rotation.x = -.75; mount.add(tilt);
  add(tilt, cyl(.06, .06, .9, 12), darkSteel, [0, 0, 0], [0, 0, Math.PI / 2]);
  dish(tilt, [0, 0, .12], 1.2, [0, 0, 0], 'metal:#eceeed');
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; rod(tilt, vec(Math.cos(a) * .85, Math.sin(a) * .85, .45), vec(0, 0, 1.15), .018, steel); }
  add(tilt, rbox(.16, .16, .16, .03), '#d9dcd8', [0, 0, 1.18]);
  add(g, rbox(.7, .45, .5, .04), white, [.95, .3, 1.0]); add(g, rbox(.72, .12, .52, .02), M.glass, [.95, .36, 1.0]);
  for (const [x, z, r] of [[-1.15, .8, .26], [-1.2, -.75, .22]]) { rod(g, vec(x, .07, z), vec(x, .55, z), .03, steel); dish(g, [x, .62, z], r, [-.9, .5, 0]); }
  return g;
}

/** Starship yard: slipway with a half-plated hull, gantry crane with a moving trolley and welding sparks. */
function shipyard() {
  const g = new THREE.Group();
  roundPad(g, 2.1);
  add(g, rbox(1.1, .12, 3.1, .03), M.concrete, [0, .12, 0], undefined, 1.4);
  for (const s of [-1, 1]) add(g, bx(.04, .03, 3.0), darkSteel, [s * .32, .19, 0]);
  const hull = new THREE.Group(); hull.position.y = .62; g.add(hull);
  add(hull, lathe([[0, 0], [.18, .1], [.34, .35], [.42, .7], [.44, 1.1]], 24), '#e6e8e6', [0, 0, 1.35], [-Math.PI / 2, 0, 0]);
  add(hull, sph(.12, 12, 8), M.glass, [0, .3, .95]);
  for (let i = 0; i < 6; i++) add(hull, new THREE.TorusGeometry(.42, .03, 6, 26), '#c86b3e', [0, 0, .2 - i * .2], [0, 0, 0]);
  add(hull, rbox(.08, .08, 1.3, .02), '#c86b3e', [0, .42, -.3]);
  add(hull, rbox(.08, .08, 1.3, .02), '#c86b3e', [0, -.42, -.3]);
  add(hull, cyl(.44, .4, .35, 24), '#cfd3d4', [0, 0, -1.1], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) add(hull, cyl(.13, .16, .3, 14), darkSteel, [s * .18, 0, -1.38], [Math.PI / 2, 0, 0]);
  for (const z of [-.6, .4]) for (const s of [-1, 1]) rod(g, vec(s * .25, .2, z), vec(s * .25, .3, z), .05, darkSteel);
  // Gantry crane straddling the slipway.
  for (const z of [-.75, .55]) for (const s of [-1, 1]) timber(g, vec(s * 1.2, .07, z), vec(s * 1.2, 2.25, z), .1, .1, yellow);
  for (const z of [-.75, .55]) timber(g, vec(-1.28, 2.25, z), vec(1.28, 2.25, z), .12, .14, yellow);
  for (const s of [-1, 1]) timber(g, vec(s * 1.2, 2.25, -.8), vec(s * 1.2, 2.25, .6), .08, .08, yellow);
  const trolley = animated(g, { type: 'slide', axis: 'x', speed: .35, amount: 1.4, always: true }, [-.7, 2.18, -.1]);
  add(trolley, rbox(.26, .14, 1.42, .03), '#c99a2e', [0, 0, 0]);
  rod(trolley, vec(0, -.05, 0), vec(0, -.85, 0), .008, '#3b3d3a'); add(trolley, rbox(.12, .1, .12, .02), darkSteel, [0, -.88, 0]);
  for (const [x, y, z, p] of [[.32, .85, -.2, 0], [-.3, .5, .1, 1.3], [.1, 1.05, -.6, 2.5]]) {
    const spark = animated(g, { type: 'blink', speed: 6, phase: p, always: true }, [x, y, z]); add(spark, sph(.035, 6, 5), M.lamp).castShadow = false;
  }
  add(g, rbox(.75, .55, .6, .03), M.corrugated, [1.3, .35, -1.0], undefined, 2);
  add(g, rbox(.8, .06, .66, .02), darkSteel, [1.3, .65, -1.0]);
  for (let i = 0; i < 3; i++) add(g, rbox(.3, .2, .3, .02), ['#c86b3e', '#d9dcd8', '#4f86b8'][i], [-1.4, .17, -.9 + i * .35]);
  return g;
}

const models: Partial<Record<BuildingType, () => THREE.Group>> = {
  windmill, townhouse, market, power, factory, tenement, depot,
  apartment, telecom, lab, chipfab, windfarm,
  datacenter, robotics, autofactory, fusion, ecotower,
  launchpad, spaceport, elevator, deepradar, shipyard,
};
export function eraModel(type: BuildingType) {
  const make = models[type];
  if (!make) throw new Error(`No model for ${type}`);
  return make();
}
