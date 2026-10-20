import * as THREE from 'three';
import { vec } from './craft';
import { M, add, animated, barrel, bush, bx, crate, cyl, gableRoof, lampPost, lathe, pad, pipe, prism, rod, roundPad, sack, smoke, sph, timber, type V3 } from './building-kit';
import { archWindow, brass, iron, pylon, rails, rbox, stack, steamLoco, wagon, waterTower, wire } from './era-kit';

/**
 * Industrial era: brick, iron and steam. Cobbled yards, round-headed iron windows, banded stacks, riveted tanks,
 * rails and power lines set this period apart from the timber village before it and the glass city after it.
 */
const stone = '#e3d8c2', soot = '#3a3734', green = 'rivet:#4f5f55';

function coalHeap(g: THREE.Object3D, at: V3, size = .4) {
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = i ? size * (.35 + (i % 3) * .14) : 0; const m = add(g, new THREE.IcosahedronGeometry(size * (i ? .34 : .5), 1), i % 4 ? '#22221f' : '#34332f', [at[0] + Math.cos(a) * r, at[1] + size * (i ? .1 : .18), at[2] + Math.sin(a) * r]); m.scale.y = .55; }
}
/** Steel I-beam lying along z. */
function girder(g: THREE.Object3D, at: V3, length: number, color = 'metal:#5b5e5c') {
  add(g, prism([[-.05, 0], [.05, 0], [.05, .014], [.009, .014], [.009, .066], [.05, .066], [.05, .08], [-.05, .08], [-.05, .066], [-.009, .066], [-.009, .014], [-.05, .014]], length), color, at);
}
/** Transformer with cooling fins and three porcelain bushings. */
function transformer(g: THREE.Object3D, at: V3) {
  const [x, y, z] = at;
  add(g, rbox(.24, .26, .2, .02), 'metal:#6c7a74', [x, y + .13, z]);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) add(g, bx(.012, .2, .05), 'metal:#5d6a64', [x + s * .126, y + .13, z - .075 + i * .05]);
  for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) add(g, cyl(.02 - j * .003, .022 - j * .003, .04, 8), '#e9e3d6', [x - .07 + k * .07, y + .28 + j * .04, z]);
}
/** Brick wall pilasters on a façade running along x at depth `z`. */
function pilasters(g: THREE.Object3D, xs: number[], z: number, y0: number, h: number, facing = 1) {
  for (const x of xs) add(g, rbox(.09, h, .05, .01), M.brick, [x, y0 + h / 2, z + facing * .02], undefined, 2);
}

/**
 * Coal-fired power station in the manner of the great brick "cathedrals": a pilastered hall with tall round-headed
 * windows, four cream corner chimneys, a coal conveyor from the wagon siding and a transformer yard feeding a pylon.
 */
export function power() {
  const g = new THREE.Group(), hx = -.35, hz = -.5, W = 1.84, D = 1.1, H = 1.42, y0 = .06;
  roundPad(g, 1.8, M.cobble);
  add(g, rbox(W + .1, .22, D + .1, .03), M.stone, [hx, y0 + .06, hz], undefined, 2.4);
  add(g, rbox(W, H, D, .02), M.brick, [hx, y0 + H / 2, hz], undefined, 2);
  const front = hz + D / 2, side = hx + W / 2;
  pilasters(g, [-1.03, -.69, -.35, -.01, .33].map(x => x + 0), front, y0 + .16, H - .26);
  for (const z of [hz - .3, hz + .3]) add(g, rbox(.05, H - .26, .09, .01), M.brick, [side + .02, y0 + .16 + (H - .26) / 2, z], undefined, 2);
  for (const y of [y0 + .17, y0 + H - .12]) add(g, rbox(W + .06, .05, D + .06, .012), stone, [hx, y, hz]);
  // Stepped parapet and a dark roof with a long glazed monitor.
  add(g, rbox(W + .08, .1, D + .08, .02), '#d7cab0', [hx, y0 + H + .03, hz]);
  add(g, rbox(W - .1, .06, D - .1, .02), '#4b4e4f', [hx, y0 + H + .06, hz]);
  add(g, rbox(W * .62, .16, .3, .02), M.glass, [hx, y0 + H + .17, hz]);
  add(g, rbox(W * .62 + .06, .04, .38, .01), '#3d4042', [hx, y0 + H + .27, hz]);
  for (let i = 0; i < 9; i++) add(g, bx(.016, .16, .31), '#e9e2d2', [hx - W * .31 + i * W * .62 / 8, y0 + H + .17, hz]);
  // Tall windows between the pilasters; the centre bay carries the company roundel.
  [-.86, -.52, -.18, .16].forEach((x, i) => archWindow(g, [x, y0 + .3, front + .005], 0, .2, i === 1 || i === 2 ? .86 : .74, { frame: stone }));
  for (const z of [hz - .15, hz + .15]) archWindow(g, [side + .005, y0 + .3, z], Math.PI / 2, .18, .74, { frame: stone });
  add(g, cyl(.13, .13, .03, 24), stone, [-.35, y0 + H - .3, front + .03], [Math.PI / 2, 0, 0]);
  add(g, prism([[.02, .09], [-.05, -.01], [-.005, -.01], [-.03, -.09], [.05, .02], [.005, .02]], .012), '#c4502f', [-.35, y0 + H - .3, front + .05]);
  // Corner towers carry the four fluted cream stacks.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = hx + sx * (W / 2 - .16), z = hz + sz * (D / 2 - .16), top = y0 + H + .32;
    add(g, rbox(.34, H + .32, .34, .02), M.brick, [x, y0 + (H + .32) / 2, z], undefined, 2);
    add(g, rbox(.38, .06, .38, .015), stone, [x, top, z]);
    add(g, lathe([[.15, 0], [.135, .12], [.12, 1.35], [.13, 1.42], [.13, 1.5], [.001, 1.5]], 28), '#efe7d6', [x, top + .03, z]);
    for (const y of [.5, 1.36]) add(g, cyl(.128 - y * .006, .128 - y * .006, .05, 28), '#6b6760', [x, top + .03 + y, z]);
    add(g, cyl(.09, .09, .02, 18), '#1d1d1c', [x, top + 1.54, z]);
    smoke(g, [x, top + 1.6, z], 'industry', .95);
  }
  smoke(g, [hx + .4, y0 + H + .3, hz], 'steam', .6);
  // Coal: a heap by the siding, a hopper and an enclosed conveyor rising into the boiler house.
  rails(g, [-1.25, 1.18], [.95, 1.18]);
  wagon(g, [-.62, .125, 1.18], Math.PI / 2, 'coal'); wagon(g, [.08, .125, 1.18], Math.PI / 2, 'coal');
  coalHeap(g, [-1.28, y0, .62], .34);
  add(g, prism([[-.17, 0], [.17, 0], [.07, -.2], [-.07, -.2]], .34), green, [-1.42, y0 + .52, .3]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(g, vec(-1.42 + sx * .13, y0, .3 + sz * .13), vec(-1.42 + sx * .13, y0 + .54, .3 + sz * .13), .018, iron, 6);
  // Enclosed belt gallery climbing along the west wall into the boiler house.
  const belt = { from: vec(-1.42, y0 + .62, .26), to: vec(-1.42, y0 + 1.3, -.62) }, mid = belt.from.clone().lerp(belt.to, .5);
  const gallery = add(g, rbox(.17, .17, belt.from.distanceTo(belt.to), .02), M.corrugated, mid.toArray() as V3);
  gallery.rotation.x = Math.atan2(belt.to.y - belt.from.y, belt.from.z - belt.to.z);
  add(g, rbox(.2, .22, .2, .02), M.corrugated, [-1.36, y0 + 1.3, -.66]);
  for (const t of [.35, .75]) { const p = belt.from.clone().lerp(belt.to, t); for (const s of [-1, 1]) rod(g, vec(p.x + s * .07, y0, p.z), vec(p.x + s * .06, p.y - .08, p.z), .016, iron, 6); timber(g, vec(p.x - .09, p.y - .09, p.z), vec(p.x + .09, p.y - .09, p.z), .03, .03, iron); }
  // Transformer yard and the line leaving the station.
  for (let i = 0; i < 3; i++) transformer(g, [.86 + (i % 2) * .3, y0, -.2 + i * .3]);
  for (const [x0, z0, x1, z1] of [[.7, -.45, 1.42, -.45], [1.42, -.45, 1.42, .66], [1.42, .66, .7, .66]]) {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / .14);
    for (let i = 0; i <= n; i++) add(g, cyl(.01, .01, .3, 5), 'metal:#7a807f', [x0 + (x1 - x0) * i / n, y0 + .15, z0 + (z1 - z0) * i / n]);
    timber(g, vec(x0, y0 + .28, z0), vec(x1, y0 + .28, z1), .015, .015, 'metal:#7a807f');
  }
  const conductors = pylon(g, [1.12, y0, -.98], 2.0);
  for (const [i, p] of conductors.entries()) wire(g, [side + .02, y0 + 1.0 + (i % 2) * .2, hz - .3 + (i >> 1) * .3 + (i % 2) * .05], p, .08);
  lampPost(g, [.62, y0, .55], .82);
  return g;
}

/**
 * Engineering works: sawtooth north-light sheds behind a stepped-gable office with a clock, a riveted water tower,
 * a travelling gantry crane over the steel yard and a siding with a loaded flat wagon.
 */
export function factory() {
  const g = new THREE.Group(), y0 = .06, x0 = -1.12, x1 = .82, z0 = -1.02, z1 = .18, wallH = .88;
  roundPad(g, 1.76, M.cobble);
  add(g, rbox(x1 - x0, wallH, z1 - z0, .02), M.brick, [(x0 + x1) / 2, y0 + wallH / 2, (z0 + z1) / 2], undefined, 2);
  add(g, rbox(x1 - x0 + .05, .05, z1 - z0 + .05, .012), stone, [(x0 + x1) / 2, y0 + wallH, (z0 + z1) / 2]);
  const teeth = 4, run = (z1 - z0) / teeth, rise = .38, angle = Math.atan2(rise, run), len = Math.hypot(rise, run), roofY = y0 + wallH + .02;
  for (let i = 0; i < teeth; i++) {
    const a = z0 + i * run, b = a + run;
    add(g, rbox(x1 - x0 + .08, .04, len + .02, .01), M.slate, [(x0 + x1) / 2, roofY + rise / 2 + .02, (a + b) / 2], [-angle, 0, 0], 1.35);
    add(g, bx(x1 - x0 - .04, rise - .02, .03), M.glass, [(x0 + x1) / 2, roofY + rise / 2, b - .01]);
    for (let k = 0; k < 8; k++) add(g, bx(.022, rise, .04), iron, [x0 + .05 + k * (x1 - x0 - .1) / 7, roofY + rise / 2, b]);
    for (const x of [x0, x1]) add(g, prism([[0, 0], [run, 0], [run, rise]], .05), M.brick, [x, roofY, a], [0, -Math.PI / 2, 0], 2);
  }
  for (let i = 0; i < 4; i++) archWindow(g, [-.02 + i * .22, y0 + .2, z1 + .005], 0, .15, .5, { frame: stone });
  for (let i = 0; i < 4; i++) archWindow(g, [x1 + .005, y0 + .2, z0 + .18 + i * .28], Math.PI / 2, .15, .5, { frame: stone });
  // Office block with a stepped Flemish gable and a clock.
  const ox = -.72, oz = .44, ow = .76, od = .5, oh = 1.12;
  add(g, rbox(ow, oh, od, .02), M.brick, [ox, y0 + oh / 2, oz], undefined, 2);
  for (const y of [y0 + .5, y0 + oh]) add(g, rbox(ow + .05, .04, od + .05, .01), stone, [ox, y, oz]);
  const steps: [number, number][] = [[-ow / 2, 0], [ow / 2, 0], [ow / 2, .14], [ow * .33, .14], [ow * .33, .3], [ow * .17, .3], [ow * .17, .46], [-ow * .17, .46], [-ow * .17, .3], [-ow * .33, .3], [-ow * .33, .14], [-ow / 2, .14]];
  add(g, prism(steps, od - .04), M.brick, [ox, y0 + oh, oz], undefined, 2);
  add(g, rbox(ow * .36, .03, od + .02, .01), stone, [ox, y0 + oh + .47, oz]);
  add(g, cyl(.1, .1, .03, 24), '#f1ebdc', [ox, y0 + oh + .2, oz + od / 2 + .01], [Math.PI / 2, 0, 0]);
  add(g, new THREE.TorusGeometry(.1, .012, 6, 24), brass, [ox, y0 + oh + .2, oz + od / 2 + .025]);
  add(g, bx(.012, .07, .01), '#222', [ox, y0 + oh + .225, oz + od / 2 + .03]); add(g, bx(.05, .012, .01), '#222', [ox + .02, y0 + oh + .2, oz + od / 2 + .03]);
  for (const x of [-.24, .24]) for (const [y, h] of [[.13, .32], [.6, .34]] as const) archWindow(g, [ox + x, y0 + y, oz + od / 2 + .005], 0, .15, h, { frame: stone });
  add(g, rbox(.2, .36, .04, .01), '#3c4f45', [ox, y0 + .2, oz + od / 2 + .01]);
  add(g, rbox(.32, .03, .14, .01), M.slate, [ox, y0 + .42, oz + od / 2 + .06], [.3, 0, 0]);
  stack(g, -.95, -.82, y0, 3.0, .17);
  waterTower(g, [1.2, y0, -.62], 1.32, .25, .42);
  pipe(g, [[x1 + .03, .7, -.2], [1.0, .7, -.2], [1.0, .7, -.62], [1.07, .7, -.62]], .025, 'metal:#7c6a58');
  // Travelling gantry crane over the steel yard on the east side, running along z so the front stays open.
  const cx = 1.08, cz0 = .36, cz1 = 1.2, top = y0 + 1.15, beam = 'rivet:#56645b';
  for (const z of [cz0, cz1]) {
    for (const s of [-1, 1]) timber(g, vec(cx + s * .26, y0, z), vec(cx + s * .05, top, z), .05, .05, beam);
    timber(g, vec(cx - .19, y0 + .45, z), vec(cx + .19, y0 + .45, z), .035, .035, beam);
  }
  for (const s of [-1, 1]) timber(g, vec(cx + s * .07, top + .03, cz0 - .06), vec(cx + s * .07, top + .03, cz1 + .06), .07, .08, beam);
  const trolley = animated(g, { type: 'slide', axis: 'z', speed: .45, amount: .5, always: true }, [cx, top + .1, cz0 + .15]);
  add(trolley, rbox(.24, .1, .2, .02), 'metal:#c9a24a');
  rod(trolley, vec(0, -.05, 0), vec(0, -.62, 0), .006, '#2a2b2b');
  add(trolley, new THREE.TorusGeometry(.03, .008, 5, 12, Math.PI * 1.3), iron, [0, -.66, 0]);
  girder(trolley, [0, -.76, 0], .4);
  for (let i = 0; i < 3; i++) for (let k = 0; k < (i > 1 ? 1 : 2); k++) girder(g, [cx - .14 + i * .14, y0 + .04 + k * .08, .86], .5);
  for (const z of [.68, 1.04]) add(g, bx(.5, .04, .06), M.darkWood, [cx, y0 + .02, z]);
  add(g, rbox(.3, .06, .26, .01), 'metal:#6e716f', [cx, y0 + .03, .5]); add(g, rbox(.28, .06, .24, .01), 'metal:#7c7f7c', [cx, y0 + .09, .5]);
  // Siding with a loaded flat wagon.
  rails(g, [-1.15, 1.3], [.95, 1.3]);
  const flat = new THREE.Group(); flat.position.set(-.45, .125, 1.3); flat.rotation.y = Math.PI / 2; g.add(flat);
  add(flat, rbox(.28, .05, .66, .015), 'metal:#2c2e2e', [0, .12, 0]);
  for (const s of [-1, 1]) for (const z of [-.2, .2]) add(flat, cyl(.065, .065, .028, 14), 'metal:#2c2e2e', [s * .15, .065, z], [0, 0, Math.PI / 2]);
  crate(flat, [0, .145, -.17], .22, .1); crate(flat, [0, .145, .14], .24, -.15);
  barrel(g, [-1.0, y0, .86], .85, 'metal:#4d5a52'); barrel(g, [-1.18, y0, .7], .85, 'metal:#4d5a52');
  lampPost(g, [-.2, y0, .92], .82);
  return g;
}

/**
 * Four-storey workers' block: arched windows with stone keystones, an iron fire escape zig-zagging down the front, a
 * shop with a striped awning, a bracketed cornice, chimneys and a timber water tank on the roof.
 */
export function tenement() {
  const g = new THREE.Group(), y0 = .07, W = 1.36, D = 1.0, zc = -.12, ground = .76, storey = .58, H = ground + storey * 3;
  pad(g, 1.96, 1.62, M.cobble);
  add(g, rbox(W + .06, .16, D + .06, .02), M.stone, [0, y0 + .08, zc], undefined, 2.4);
  add(g, rbox(W, H, D, .02), M.brick, [0, y0 + H / 2, zc], undefined, 2);
  const front = zc + D / 2;
  for (let i = 1; i <= 3; i++) add(g, rbox(W + .04, .045, D + .04, .01), stone, [0, y0 + ground + (i - 1) * storey, zc]);
  // Cornice on brackets.
  add(g, rbox(W + .16, .08, D + .16, .02), '#d9cdb4', [0, y0 + H + .05, zc]);
  add(g, rbox(W - .06, .02, D - .06, .01), '#4a4846', [0, y0 + H + .09, zc]);
  add(g, rbox(W + .1, .05, D + .1, .015), '#cbbd9f', [0, y0 + H - .01, zc]);
  for (let i = 0; i < 9; i++) add(g, bx(.04, .07, .06), '#cbbd9f', [-W / 2 + .08 + i * (W - .16) / 8, y0 + H - .06, front + .04]);
  for (let f = 0; f < 3; f++) for (const x of [-.44, 0, .44]) archWindow(g, [x, y0 + ground + f * storey + .1, front + .005], 0, .2, .36, { frame: stone });
  for (let f = 0; f < 3; f++) for (const s of [-1, 1]) for (const z of [-.25, .2]) archWindow(g, [s * (W / 2 + .005), y0 + ground + f * storey + .1, zc + z], s * Math.PI / 2, .2, .36, { frame: stone });
  // Shop front with sign and awning; the entrance has a fanlight.
  add(g, rbox(.72, .5, .04, .01), '#2f4a3e', [.26, y0 + .4, front + .015]);
  add(g, bx(.62, .38, .02), M.glass, [.26, y0 + .36, front + .03]);
  for (const x of [-.05, .26, .57]) add(g, bx(.025, .4, .03), '#2f4a3e', [x, y0 + .36, front + .04]);
  add(g, rbox(.76, .1, .05, .01), '#2f4a3e', [.26, y0 + .66, front + .03]);
  add(g, bx(.6, .05, .01), '#d8b25a', [.26, y0 + .66, front + .058]);
  for (let i = 0; i < 7; i++) add(g, bx(.11, .02, .3), i % 2 ? '#efe6d2' : '#3f6f58', [-.07 + i * .11, y0 + .6, front + .18], [.42, 0, 0]);
  for (let i = 0; i < 7; i++) add(g, bx(.11, .05, .01), i % 2 ? '#efe6d2' : '#3f6f58', [-.07 + i * .11, y0 + .52, front + .32]);
  archWindow(g, [-.44, y0 + .12, front + .005], 0, .24, .56, { dark: true, frame: stone });
  add(g, rbox(.2, .42, .03, .01), '#5b3a2a', [-.44, y0 + .33, front + .012]);
  for (let i = 0; i < 3; i++) add(g, rbox(.34, .04, .1 - i * .02, .01), M.stone, [-.44, y0 + .02 + i * .04, front + .1 - i * .03]);
  // Fire escape over the left bays: landings, railings, stairs and the drop ladder.
  const fx = -.22, fw = .66, fd = .24, escape = '#232627';
  for (let f = 0; f < 3; f++) {
    const y = y0 + ground + f * storey + .02, z = front + fd / 2 + .01;
    add(g, bx(fw, .018, fd), escape, [fx, y, z]);
    add(g, bx(fw, .015, .015), escape, [fx, y + .26, front + fd]);
    for (const s of [-1, 1]) add(g, bx(.015, .015, fd), escape, [fx + s * fw / 2, y + .26, z]);
    for (let i = 0; i <= 8; i++) add(g, bx(.008, .26, .008), escape, [fx - fw / 2 + i * fw / 8, y + .13, front + fd]);
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) if (i !== 1) add(g, bx(.008, .26, .008), escape, [fx + s * fw / 2, y + .13, front + .03 + i * (fd - .03) / 2]);
    for (const s of [-1, 1]) rod(g, vec(fx + s * .02 - .18, y + .02, z + .04 * s), vec(fx + s * .02 + .2, y + storey - .02 + (f === 2 ? -.6 : 0), z + .04 * s), .007, escape, 4);
    if (f < 2) {
      const a = vec(fx - .2, y + .02, z), b = vec(fx + .22, y + storey, z);
      for (const s of [-.05, .05]) rod(g, a.clone().setZ(z + s), b.clone().setZ(z + s), .008, escape, 4);
      for (let k = 1; k < 7; k++) { const p = a.clone().lerp(b, k / 7); add(g, bx(.02, .006, .1), escape, [p.x, p.y, z]); }
    }
  }
  for (const s of [-1, 1]) rod(g, vec(fx - .26 + s * .05, y0 + .38, front + fd), vec(fx - .26 + s * .05, y0 + ground + .02, front + fd), .007, escape, 4);
  for (let k = 0; k < 5; k++) add(g, bx(.1, .006, .006), escape, [fx - .26, y0 + .42 + k * .08, front + fd]);
  // Roof: chimneys with pots and the timber water tank.
  for (const [x, z] of [[-.5, -.42], [.5, -.42]]) {
    add(g, rbox(.24, .42, .18, .015), M.brick, [x, y0 + H + .25, zc + z + .12], undefined, 2);
    for (const dx of [-.06, .06]) add(g, cyl(.03, .035, .1, 8), '#b8643e', [x + dx, y0 + H + .51, zc + z + .12]);
    smoke(g, [x - .06, y0 + H + .6, zc + z + .12], 'chimney', .7);
  }
  const tx = .32, tz = zc + .05, ty = y0 + H + .09;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(g, vec(tx + sx * .14, ty, tz + sz * .14), vec(tx + sx * .13, ty + .32, tz + sz * .13), .015, iron, 6);
  add(g, cyl(.2, .2, .03, 18), iron, [tx, ty + .33, tz]);
  add(g, cyl(.18, .19, .34, 18), M.wood, [tx, ty + .51, tz], undefined, 2.4);
  for (const y of [.42, .58]) add(g, cyl(.192, .192, .015, 18), iron, [tx, ty + y, tz]);
  add(g, new THREE.ConeGeometry(.21, .16, 18), M.darkWood, [tx, ty + .76, tz]);
  lampPost(g, [.78, y0, .62], .78);
  for (const x of [-.8, .8]) bush(g, [x, y0, .66], .08, '#6f9a4c');
  return g;
}

/** 1920s lorry with rounded wings, a bonnet and a tarpaulined load, facing +z. */
function lorry(parent: THREE.Object3D, at: V3, rotY = 0, color = '#3f5d78') {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rotY; parent.add(g);
  add(g, rbox(.24, .05, .7, .015), '#262828', [0, .1, 0]);
  add(g, rbox(.17, .13, .2, .04), `metal:${color}`, [0, .2, .26]);
  add(g, rbox(.15, .12, .02, .01), 'metal:#b9b4a6', [0, .2, .365]);
  add(g, rbox(.26, .2, .16, .03), `metal:${color}`, [0, .26, .08]);
  add(g, rbox(.28, .03, .2, .01), '#262828', [0, .37, .06]);
  add(g, bx(.18, .08, .006), M.glass, [0, .3, .162]);
  add(g, rbox(.28, .18, .38, .03), '#8a7b5a', [0, .25, -.16]);
  for (const s of [-1, 1]) for (const z of [.24, -.22]) {
    add(g, cyl(.065, .065, .04, 14), '#1f2020', [s * .12, .065, z], [0, 0, Math.PI / 2]);
    add(g, cyl(.08, .08, .07, 14, false), `metal:${color}`, [s * .12, .1, z], [0, 0, Math.PI / 2]).scale.set(1, 1, .6);
  }
  for (const s of [-1, 1]) add(g, sph(.025, 8, 6), M.lamp, [s * .07, .24, .37]);
  return g;
}

/**
 * Railway goods depot: a brick engine shed with arched doors and a smoke-vent ridge, two tracks with a steam engine
 * and a box van, a water tower and water crane, and a covered goods platform with a lorry backed up to it.
 */
export function depot() {
  const g = new THREE.Group(), y0 = .06, sx = -.48, sz = -.52, W = 1.5, D = 1.1, wallH = .95;
  roundPad(g, 1.72, M.cobble);
  add(g, rbox(W, wallH, D, .02), M.brick, [sx, y0 + wallH / 2, sz], undefined, 2);
  const front = sz + D / 2;
  add(g, rbox(W + .04, .05, D + .04, .01), stone, [sx, y0 + wallH, sz]);
  const shed = new THREE.Group(); shed.position.set(sx, 0, sz); g.add(shed);
  gableRoof(shed, { width: W, depth: D, eave: y0 + wallH, peak: y0 + wallH + .5, overhang: .12, kind: 'slate', gable: M.brick, trim: '#3b3d3c' });
  for (const dz of [-.25, .2]) {
    add(g, rbox(.16, .26, .16, .015), M.brick, [sx, y0 + wallH + .5, sz + dz], undefined, 2);
    add(g, rbox(.22, .03, .22, .01), '#3b3d3c', [sx, y0 + wallH + .65, sz + dz]);
    smoke(g, [sx, y0 + wallH + .72, sz + dz], 'industry', .6);
  }
  const doors = [sx - .36, sx + .36];
  for (const x of doors) {
    archWindow(g, [x, y0, front + .005], 0, .5, .78, { dark: true, frame: stone });
    rails(g, [x, sz - .3], [x, Math.sqrt(1.68 ** 2 - x * x) - .02]);
  }
  for (const z of [sz - .25, sz + .2]) archWindow(g, [sx + W / 2 + .005, y0 + .3, z], Math.PI / 2, .18, .42, { frame: stone });
  steamLoco(g, [doors[1], y0 + .065, .5]);
  wagon(g, [doors[0], y0 + .065, .7]);
  // Water tower and the swinging water crane beside the engine road.
  waterTower(g, [.72, y0, -.88], 1.0, .24, .36, 'rivet:#56645b');
  const crane = [.22, y0, .1] as V3;
  add(g, cyl(.05, .07, .7, 12), iron, [crane[0], y0 + .35, crane[2]]);
  timber(g, vec(crane[0], y0 + .66, crane[2]), vec(crane[0] - .26, y0 + .66, crane[2] + .12), .04, .04, iron);
  add(g, cyl(.025, .02, .3, 8), '#2b2b2a', [crane[0] - .26, y0 + .5, crane[2] + .12]);
  // Covered goods platform.
  const px = 1.0, pz = .3;
  add(g, rbox(.62, .22, 1.06, .02), M.brick, [px, y0 + .11, pz], undefined, 2);
  add(g, rbox(.66, .04, 1.1, .01), M.wood, [px, y0 + .24, pz]);
  for (const z of [pz - .44, pz + .44]) for (const x of [px - .22, px + .22]) add(g, cyl(.022, .026, .66, 8), 'metal:#2e4a3d', [x, y0 + .57, z]);
  const canopy = new THREE.Group(); canopy.position.set(px, 0, pz); g.add(canopy);
  gableRoof(canopy, { width: .62, depth: 1.08, eave: y0 + .9, peak: y0 + 1.06, overhang: .06, kind: 'metal', trim: '#2e4a3d' });
  crate(g, [px - .12, y0 + .26, pz - .3], .2, .2); crate(g, [px + .1, y0 + .26, pz - .28], .18, -.3); crate(g, [px - .1, y0 + .46, pz - .3], .16, .5);
  sack(g, [px + .12, y0 + .26, pz + .05], '#d8c79c', .8); sack(g, [px - .08, y0 + .26, pz + .12], '#cdb98a', .8);
  barrel(g, [px + .12, y0 + .26, pz + .32], .7);
  lorry(g, [px - .1, y0, pz + .86], Math.PI - .25);
  // Semaphore signal at the throat of the yard.
  const sig = [-1.25, y0, .85] as V3;
  add(g, cyl(.02, .03, 1.15, 8), '#efe9dc', [sig[0], y0 + .58, sig[2]]);
  add(g, rbox(.24, .045, .015, .005), '#c4302b', [sig[0] + .12, y0 + 1.02, sig[2]], [0, 0, .5]);
  add(g, bx(.04, .045, .016), '#f2ede2', [sig[0] + .2, y0 + .98, sig[2] + .002], [0, 0, .5]);
  add(g, sph(.03, 8, 6), M.lamp, [sig[0], y0 + .94, sig[2] + .02]);
  lampPost(g, [.42, y0, 1.1], .8);
  return g;
}
