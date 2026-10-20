import * as THREE from 'three';
import { vec } from './craft';
import { M, add, animated, bush, bx, cyl, dish, fanUnit, lampPost, lathe, pad, pipe, prism, rod, roundPad, smoke, sph, tank, type V3 } from './building-kit';
import { arcUV, blinkLight, car, glassBlock, helipad, inward, ledScreen, mast, parking, radome, rbox, steel, tree, white } from './era-kit';

/**
 * Information era: glass curtain walls with white fins, LED screens, signal masts, dishes and radomes, set on asphalt
 * with painted bays, kerbs and lawns. Cool blues and whites replace the brick and soot of industry.
 */
const blue = '#2f7fd8', alu = '#e9edee', frame = '#2b3238', lawn = '#7ea457';

/** Lawn patch with a kerb. */
function green(g: THREE.Object3D, at: V3, w: number, d: number) {
  add(g, rbox(w + .04, .05, d + .04, .015), '#c9cbc6', [at[0], at[1] + .025, at[2]]);
  add(g, rbox(w, .055, d, .015), lawn, [at[0], at[1] + .03, at[2]]);
}
/**
 * Residential tower: a glass shaft ribbed with white fins over a podium with a lobby, screens and a roof garden;
 * corner balconies on alternate floors, a lit crown, a helipad and a beacon mast.
 */
export function apartment() {
  const g = new THREE.Group(), y0 = .07;
  pad(g, 1.9, 1.66, M.asphalt);
  add(g, rbox(1.9, .03, .42, .01), '#c3c5c0', [0, y0 + .015, .62]);
  // Podium.
  add(g, rbox(1.5, .55, 1.16, .03), M.concrete, [0, y0 + .275, -.06], undefined, 1.4);
  add(g, bx(1.3, .36, .02), M.glass, [0, y0 + .22, .53]);
  for (let i = 0; i <= 6; i++) add(g, bx(.025, .36, .03), frame, [-.65 + i * 1.3 / 6, y0 + .22, .54]);
  add(g, rbox(.7, .035, .3, .01), alu, [.3, y0 + .43, .66]);
  for (const x of [.0, .6]) rod(g, vec(x, y0, .78), vec(x, y0 + .43, .78), .012, steel, 6);
  ledScreen(g, [-.42, y0 + .4, .55], .5, .2);
  ledScreen(g, [.76, y0 + .3, .1], .28, .4, Math.PI / 2);
  // Roof garden and pool on the podium.
  green(g, [-.38, y0 + .55, .26], .6, .36); bush(g, [-.6, y0 + .6, .3], .1, '#6f9a4c'); tree(g, [-.2, y0 + .6, .3], .18);
  add(g, rbox(.42, .05, .26, .015), white, [.42, y0 + .575, .3]); add(g, bx(.36, .02, .2), M.water, [.42, y0 + .6, .3]);
  // Tower.
  const tx = 0, tz = -.2, W = .84, D = .7, base = y0 + .55, H = 3.5, floors = 10;
  glassBlock(g, W, H, D, [tx, base, tz], floors, alu);
  for (let i = 0; i < 6; i++) add(g, bx(.03, H, .06), alu, [tx - W / 2 + .08 + i * (W - .16) / 5, base + H / 2, tz + D / 2 + .02]);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) add(g, bx(.06, H, .03), alu, [tx + s * (W / 2 + .02), base + H / 2, tz - D / 2 + .1 + i * (D - .2) / 3]);
  for (let f = 1; f < floors - 1; f += 2) {
    const y = base + f * H / floors;
    add(g, rbox(.38, .035, .3, .01), alu, [tx + W / 2 - .08, y, tz + D / 2 + .13]);
    add(g, bx(.38, .1, .012), M.clearGlass, [tx + W / 2 - .08, y + .06, tz + D / 2 + .28]); add(g, bx(.012, .1, .3), M.clearGlass, [tx + W / 2 + .11, y + .06, tz + D / 2 + .13]);
  }
  // Crown: a white frame around a lit top floor, the helipad and a beacon mast.
  const top = base + H;
  add(g, rbox(W + .1, .06, D + .1, .02), alu, [tx, top + .03, tz]);
  add(g, bx(W - .06, .1, D - .06), M.lamp, [tx, top - .08, tz]);
  for (const s of [-1, 1]) add(g, rbox(.06, .5, D + .1, .02), alu, [tx + s * (W / 2 + .02), top + .2, tz]);
  add(g, rbox(W + .1, .06, .06, .02), alu, [tx, top + .44, tz - D / 2 - .02]);
  helipad(g, [tx + .02, top + .06, tz + .04], .3);
  mast(g, [tx - W / 2 + .06, top + .44, tz - D / 2 + .04], .7, .018);
  car(g, [-.6, y0, .66], Math.PI / 2, '#3d6fb6'); lampPost(g, [.86, y0, .6], .86, true);
  return g;
}

/**
 * Television tower: a concrete shaft on three raking legs, microwave drums on a service ring, a glazed observation
 * pod with a lit band, and a red and white antenna mast. A dish and a radome stand at the foot.
 */
export function telecom() {
  const g = new THREE.Group(), y0 = .06;
  roundPad(g, 1.04, M.paving);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + Math.PI / 6, foot = vec(Math.sin(a) * .62, y0, Math.cos(a) * .62), head = vec(Math.sin(a) * .1, y0 + 1.15, Math.cos(a) * .1);
    const leg = add(g, rbox(.13, foot.distanceTo(head), .16, .04), M.concrete, foot.clone().lerp(head, .5).toArray() as V3, undefined, 1.4);
    leg.quaternion.setFromUnitVectors(vec(0, 1, 0), head.clone().sub(foot).normalize());
    add(g, rbox(.24, .1, .26, .03), M.concrete, [foot.x, y0 + .05, foot.z]);
  }
  add(g, lathe([[.17, 0], [.15, 1.2], [.12, 2.4], [.105, 3.25], [.001, 3.25]], 28), M.concrete, [0, y0, 0]);
  for (const y of [.8, 1.5]) add(g, cyl(.16 - y * .015, .16 - y * .015, .03, 28), '#b9bcb8', [0, y0 + y, 0]);
  // Service ring with microwave drums.
  add(g, cyl(.3, .3, .05, 28), alu, [0, y0 + 1.9, 0]);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + .3, r = .27;
    add(g, cyl(.075, .075, .07, 18), white, [Math.sin(a) * r, y0 + 2.02, Math.cos(a) * r], [Math.PI / 2, a, 0]).rotation.order = 'YXZ';
  }
  // Observation pod.
  const podY = y0 + 2.42;
  add(g, lathe([[.12, 0], [.34, .1], [.42, .22], [.42, .3], [.36, .42], [.16, .5], [.001, .5]], 40), alu, [0, podY, 0]);
  add(g, cyl(.425, .425, .1, 40), M.facade, [0, podY + .26, 0], undefined, 1.2);
  add(g, cyl(.44, .44, .02, 40), frame, [0, podY + .2, 0]);
  add(g, new THREE.TorusGeometry(.44, .008, 4, 40), steel, [0, podY + .33, 0], [Math.PI / 2, 0, 0]);
  add(g, cyl(.24, .26, .1, 28), alu, [0, podY + .55, 0]);
  add(g, cyl(.245, .245, .04, 28), M.lamp, [0, podY + .55, 0]);
  add(g, cyl(.09, .1, .5, 16), M.concrete, [0, podY + .85, 0]);
  mast(g, [0, podY + 1.1, 0], 1.0, .03);
  for (const y of [podY + .62, podY + 1.42]) for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; add(g, rbox(.05, .26, .03, .01), white, [Math.sin(a) * .06, y, Math.cos(a) * .06], [0, a, 0]); }
  blinkLight(g, [.42, podY + .3, 0], 1.3, .025); blinkLight(g, [-.42, podY + .3, 0], 2.1, .025);
  // Foot of the tower: equipment hall with a roof dish and a radome.
  add(g, rbox(.5, .3, .32, .03), alu, [.42, y0 + .15, .62]);
  add(g, bx(.42, .07, .01), M.glass, [.42, y0 + .2, .785]);
  dish(g, [.42, y0 + .42, .62], .16, [-.9, .4, 0]);
  radome(g, [-.62, y0, .4], .2, alu);
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; add(g, cyl(.008, .008, .26, 4), 'metal:#9aa3a6', [Math.sin(a) * .96, y0 + .13, Math.cos(a) * .96]); }
  add(g, new THREE.TorusGeometry(.96, .006, 4, 64), 'metal:#9aa3a6', [0, y0 + .25, 0], [Math.PI / 2, 0, 0]);
  return g;
}

/**
 * Research campus: a curved two-storey laboratory with ribbon glazing, a white observatory with its shutter open,
 * a large steerable dish, a radome on the roof, and a lawn quad with trees and parking.
 */
export function lab() {
  const g = new THREE.Group(), y0 = .06;
  roundPad(g, 1.7, M.asphalt);
  green(g, [-.05, y0, .55], 1.1, .62);
  // Crescent wing around the back of the quad.
  const r0 = .95, r1 = 1.42, start = Math.PI * .62, span = Math.PI * .76, h = 1.05, mid = (r0 + r1) / 2;
  const wall = (r: number, inside = false) => { const geo = arcUV(new THREE.CylinderGeometry(r, r, h, 48, 1, true, start, span), r * span, h); add(g, inside ? inward(geo) : geo, M.facade, [0, y0 + h / 2, 0]); };
  wall(r1); wall(r0, true);
  // Shape angle φ lies flat at cylinder angle θ = π/2 − φ once the slab is turned onto the ground.
  const sector = (a: number, b: number, depth: number) => { const s = new THREE.Shape(), f0 = Math.PI / 2 - start - span, f1 = Math.PI / 2 - start; s.absarc(0, 0, b, f0, f1, false); s.absarc(0, 0, a, f1, f0, true); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 48 }); };
  for (const [y, t] of [[0, .05], [h * .5, .035], [h - .02, .06]] as const) add(g, sector(r0 - .04, r1 + .04, t), alu, [0, y0 + y + t, 0], [Math.PI / 2, 0, 0]);
  for (const a of [start, start + span]) add(g, rbox(.5, h, .08, .02), alu, [Math.sin(a) * mid, y0 + h / 2, Math.cos(a) * mid], [0, a + Math.PI / 2, 0]);
  for (let i = 0; i < 4; i++) { const a = start + span * (.15 + i * .23); add(g, rbox(.26, .02, .18, .005), M.solar, [Math.sin(a) * mid, y0 + h + .1, Math.cos(a) * mid], [-.35, a, 0]); }
  radome(g, [Math.sin(start + span * .5) * mid, y0 + h + .06, Math.cos(start + span * .5) * mid], .2, alu);
  // Observatory with its slit open and the telescope pointing out.
  const ox = -.95, oz = .52;
  add(g, cyl(.36, .38, .42, 32), alu, [ox, y0 + .21, oz]);
  add(g, cyl(.385, .385, .04, 32), blue, [ox, y0 + .4, oz]);
  const dome = new THREE.Group(); dome.position.set(ox, y0 + .42, oz); dome.rotation.y = .9; g.add(dome);
  for (const s of [-1, 1]) add(dome, new THREE.SphereGeometry(.36, 32, 16, s > 0 ? .14 : Math.PI + .14, Math.PI - .28, 0, Math.PI / 2), 'metal:#eef0ef');
  for (const z of [-.05, .05]) add(dome, new THREE.TorusGeometry(.362, .014, 6, 32, Math.PI), 'metal:#c9cfd0', [0, 0, z]);
  const scope = add(dome, cyl(.06, .07, .5, 16), '#2f3a3d', [.08, .16, 0]); scope.rotation.z = -.75;
  // Steerable dish on a pedestal.
  add(g, cyl(.12, .16, .4, 16), alu, [1.0, y0 + .2, .62]);
  dish(g, [1.0, y0 + .62, .62], .44, [-.75, -.5, 0]);
  for (const [x, z] of [[-.4, .5], [.35, .62]] as const) tree(g, [x, y0 + .05, z], .26);
  bush(g, [.05, y0 + .05, .36], .1, '#6f9a4c'); bush(g, [-.05, y0 + .05, .78], .09, '#86ad57');
  parking(g, [.3, y0 + .002, 1.22], 3, .32, .36); car(g, [.14, y0, 1.22], 0, '#d8d8d2'); car(g, [.78, y0, 1.22], 0, '#c94f3d');
  lampPost(g, [-.55, y0, 1.05], .86, true);
  return g;
}

/** A chip with legs on all four sides and a glowing die, mounted on a façade. */
function chipBadge(g: THREE.Object3D, at: V3, size: number) {
  add(g, rbox(size, size, .03, .01), '#1d2a36', at);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    const o = -size * .38 + i * size * .76 / 5;
    add(g, bx(.02, .05, .012), 'metal:#d9dee0', [at[0] + o, at[1] + s * (size / 2 + .02), at[2]]);
    add(g, bx(.05, .02, .012), 'metal:#d9dee0', [at[0] + s * (size / 2 + .02), at[1] + o, at[2]]);
  }
  add(g, bx(size * .5, size * .5, .02), M.screen, [at[0], at[1], at[2] + .012]);
}

/**
 * Semiconductor fab: a long clean-room hall with ribbon glazing and a chip emblem, rows of rooftop air handlers,
 * exhaust stacks, a bulk-gas yard and a colour-coded pipe bridge, a glazed lobby and parking.
 */
export function chipfab() {
  const g = new THREE.Group(), y0 = .06, x0 = -1.25, x1 = .78, z0 = -1.05, z1 = .1, H = .9;
  roundPad(g, 1.8, M.asphalt);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  add(g, rbox(W, H, D, .05), alu, [cx, y0 + H / 2, cz]);
  add(g, rbox(W + .01, .2, D + .01, .02), M.facade, [cx, y0 + .5, cz], undefined, 1.1);
  add(g, rbox(W + .02, .06, D + .02, .02), blue, [cx, y0 + H - .1, cz]);
  for (let i = 0; i < 12; i++) add(g, bx(.02, .2, .02), alu, [x0 + .1 + i * (W - .2) / 11, y0 + .5, z1 + .005]);
  chipBadge(g, [-.15, y0 + .52, z1 + .03], .34);
  // Roof plant: air handlers, a duct spine and exhaust stacks.
  add(g, rbox(W - .3, .14, .2, .03), alu, [cx, y0 + H + .07, cz]);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const at: V3 = [x0 + .35 + i * .45, y0 + H, cz + s * .3];
    if ((i + (s > 0 ? 1 : 0)) % 2) fanUnit(g, at, .3); else { add(g, rbox(.3, .14, .3, .02), 'metal:#c7ccca', [at[0], at[1] + .07, at[2]]); add(g, cyl(.11, .11, .02, 18), '#2f3537', [at[0], at[1] + .145, at[2]]); }
  }
  for (const [i, x] of [-.9, -.7, -.5].entries()) {
    add(g, cyl(.045, .05, .62, 14), alu, [x, y0 + H + .31, z0 + .12]);
    add(g, cyl(.052, .052, .05, 14), blue, [x, y0 + H + .5, z0 + .12]);
    smoke(g, [x, y0 + H + .66, z0 + .12], 'steam', .5 + i * .05);
  }
  // Bulk gases and the pipe bridge into the fab.
  for (const [i, [x, z]] of [[1.08, -.75], [1.4, -.45], [1.08, -.3]].entries()) tank(g, [x, y0, z], .15, .75 + i * .1, 'metal:#eef0f0', i % 2 ? '#3fa36b' : blue);
  add(g, cyl(.13, .13, .55, 20), 'metal:#eef0f0', [1.25, y0 + .3, .25], [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) { add(g, sph(.13, 20, 12), 'metal:#eef0f0', [1.25, y0 + .3, .25 + s * .275]); add(g, rbox(.22, .18, .08, .01), M.concrete, [1.25, y0 + .09, .25 + s * .18]); }
  for (const x of [.95, 1.25]) for (const s of [-1, 1]) rod(g, vec(x, y0, -.55 + s * .1), vec(x, y0 + .68, -.55 + s * .1), .016, steel, 6);
  ['#e5b43c', '#3fa36b', blue, '#c9ced0'].forEach((c, i) => pipe(g, [[x1 + .02, y0 + .62 + i * .045, -.55 + (i - 1.5) * .04], [1.3, y0 + .62 + i * .045, -.55 + (i - 1.5) * .04]], .018, `metal:${c}`));
  // Glazed lobby, screen and parking.
  glassBlock(g, .7, .5, .42, [.25, y0, z1 + .2], 2, alu);
  add(g, rbox(.9, .04, .6, .01), alu, [.25, y0 + .52, z1 + .26]);
  ledScreen(g, [.25, y0 + .7, z1 + .02], .5, .2);
  parking(g, [-.65, y0 + .002, .78], 4, .3, .38);
  car(g, [-.8, y0, .78], 0, '#3d6fb6'); car(g, [-.2, y0, .78], 0, '#d8d8d2'); car(g, [-.5, y0, .78], Math.PI, '#4a4f55');
  lampPost(g, [.95, y0, .85], .86, true);
  for (const x of [-1.25, .55]) tree(g, [x, y0, 1.2], .24);
  return g;
}

/** Tapered blade with a red tip, root at the origin and the tip up +y. */
function blade(parent: THREE.Object3D, length: number) {
  add(parent, prism([[-.045, .08], [.06, .1], [.03, length * .7], [.012, length - .1], [-.012, length - .1], [-.03, .2]], .022), white, [0, 0, 0], [0, .35, 0]);
  add(parent, prism([[.012, length - .1], [.008, length], [-.008, length], [-.012, length - .1]], .022), '#d24a3a', [0, 0, 0], [0, .35, 0]);
}
/**
 * Wind and solar park: three slender turbines with nacelles, spinners and red-tipped blades, rows of solar tables,
 * battery containers and a fenced substation linked by a gravel track.
 */
export function windfarm() {
  const g = new THREE.Group(), y0 = .02;
  add(g, rbox(2.9, .04, .2, .02), '#b9b19c', [0, y0, .55], [0, .08, 0]);
  const turbine = (x: number, z: number, phase: number) => {
    add(g, cyl(.24, .27, .1, 20), M.concrete, [x, y0 + .03, z]);
    add(g, lathe([[.09, 0], [.08, 1.0], [.06, 2.2], [.045, 3.0], [.001, 3.0]], 18), white, [x, y0 + .06, z]);
    add(g, cyl(.092, .092, .05, 18), blue, [x, y0 + .3, z]);
    add(g, rbox(.17, .16, .44, .07), white, [x, y0 + 3.12, z - .06]);
    add(g, rbox(.08, .03, .12, .01), '#c9ced0', [x, y0 + 3.21, z - .2]);
    blinkLight(g, [x, y0 + 3.23, z - .26], phase, .022);
    const rotor = animated(g, { type: 'spin', axis: 'z', speed: 1.4, phase, always: true }, [x, y0 + 3.12, z + .18]);
    add(rotor, lathe([[.07, 0], [.065, .06], [.04, .12], [.001, .15]], 16), white, [0, 0, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 3; i++) { const b = new THREE.Group(); b.rotation.z = i * Math.PI * 2 / 3; rotor.add(b); blade(b, 1.0); }
  };
  turbine(-1.08, .1, 0); turbine(.02, -.85, 1.7); turbine(1.1, .1, 3.1);
  // Solar tables between the towers.
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
    const x = -.62 + i * .32 + (row % 2) * .08, z = .95 + row * .26;
    if (Math.hypot(x, z + .1) > 1.68) continue;
    add(g, rbox(.3, .015, .17, .005), M.solar, [x, y0 + .14, z], [-.45, 0, 0]);
    add(g, bx(.02, .12, .02), steel, [x, y0 + .07, z + .03]);
  }
  // Battery containers and the substation.
  for (const [i, x] of [-.82, -.4].entries()) {
    add(g, rbox(.36, .22, .2, .02), 'metal:#eef0f0', [x, y0 + .12, -.62 + i * .02]);
    add(g, bx(.36, .03, .202), blue, [x, y0 + .18, -.62 + i * .02]);
    for (let k = 0; k < 4; k++) add(g, bx(.025, .012, .01), M.cyan, [x - .12 + k * .08, y0 + .1, -.515 + i * .02]);
  }
  add(g, rbox(.5, .04, .42, .01), M.concrete, [.88, y0 + .02, -.6]);
  for (let i = 0; i < 2; i++) {
    add(g, rbox(.18, .2, .16, .02), 'metal:#7e8a86', [.78 + i * .22, y0 + .14, -.62]);
    for (let k = 0; k < 3; k++) add(g, cyl(.015, .018, .12, 8), '#e9e3d6', [.72 + i * .22 + k * .06, y0 + .3, -.62]);
  }
  for (const [x0, z0, x1, z1] of [[.6, -.84, 1.16, -.84], [1.16, -.84, 1.16, -.36], [1.16, -.36, .6, -.36], [.6, -.36, .6, -.84]]) {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / .1);
    for (let i = 0; i < n; i++) add(g, cyl(.006, .006, .22, 4), 'metal:#9aa3a6', [x0 + (x1 - x0) * i / n, y0 + .11, z0 + (z1 - z0) * i / n]);
    rod(g, vec(x0, y0 + .22, z0), vec(x1, y0 + .22, z1), .006, 'metal:#9aa3a6', 4);
  }
  return g;
}
