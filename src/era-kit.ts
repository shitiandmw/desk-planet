import * as THREE from 'three';
import { vec } from './craft';
import { M, add, animated, bush, bx, cyl, lathe, lightStrip, prism, rbox as roundedBox, rod, roundPad, smoke, sph, type V3 } from './building-kit';

/**
 * Shared parts for the later eras. Each era keeps one material language: brick, iron and steam for industry; glass,
 * screens and signal masts for information; white composite, smoked glass and cyan light for intelligence; titanium
 * plating, hex decks, orange markings and energy light for the interstellar age.
 */
export const white = '#f2f2ee', steel = 'metal:#c9ced0', darkSteel = 'metal:#5f676b', iron = 'metal:#2e3130', brass = 'metal:#c9a24a';
export const shell = 'panel:#f3f5f5', graphite = 'metal:#2f353b', titanium = 'hull:#dde1e4', carbon = 'metal:#2a2f35', signal = '#ff7a2f';

/**
 * Rounded box for the era models. Bevels of 2 cm or less get one segment instead of two: smooth normals still read as
 * round at this size, for a third of the triangles.
 */
export const rbox = (w: number, h: number, d: number, r = .03, seg = Math.min(r, w / 2, h / 2, d / 2) <= .02 ? 1 : 2) => roundedBox(w, h, d, r, seg);

// ---------------------------------------------------------------- general
export function lattice(g: THREE.Object3D, base: number, top: number, height: number, segments: number, color: string, at: V3 = [0, 0, 0], radius = .022) {
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
export function blinkLight(g: THREE.Object3D, at: V3, phase = 0, size = .045, mat: THREE.Material = M.red) { const b = animated(g, { type: 'blink', speed: 2.4, phase, always: true }, at); add(b, sph(size, 8, 6), mat).castShadow = false; return b; }
/** Glazed curtain-wall block with white floor bands. */
export function glassBlock(g: THREE.Object3D, w: number, h: number, d: number, at: V3, floors: number, band = white) {
  add(g, rbox(w, h, d, .03), M.facade, [at[0], at[1] + h / 2, at[2]], undefined, .9);
  for (let i = 0; i <= floors; i++) add(g, rbox(w + .05, .045, d + .05, .015), band, [at[0], at[1] + Math.min(h - .02, i * h / floors), at[2]]);
}
export function tree(g: THREE.Object3D, at: V3, size = .3, color = '#6f9a4c') {
  add(g, cyl(.03 * size / .3, .04 * size / .3, size * 1.1, 6), M.darkWood, [at[0], at[1] + size * .55, at[2]]);
  bush(g, [at[0], at[1] + size * .75, at[2]], size, color);
}
/** Light shell around a part: a translucent halo standing in for bloom. */
export const halo = (g: THREE.Object3D, geo: THREE.BufferGeometry, color: string, at: V3 = [0, 0, 0], rot?: V3) => add(g, geo, `holo:${color}`, at, rot);
/** Flat ring lying on the ground or a deck; `sides` 6 gives a hexagonal ring that matches a hex pad. */
export function ring(g: THREE.Object3D, at: V3, radius: number, tube: number, mat: THREE.Material | string = M.cyan, sides = 48) {
  return add(g, new THREE.TorusGeometry(radius, tube, 5, sides), mat, at, [Math.PI / 2, 0, sides === 6 ? Math.PI / 6 : 0]);
}
/** Diagonal hazard stripes on a flat band `w` long and `d` wide, running along x before `rotY`. */
export function stripes(g: THREE.Object3D, at: V3, w: number, d: number, rotY = 0, a = signal, b = '#2a2d31', n = 8) {
  const s = new THREE.Group(); s.position.set(...at); s.rotation.y = rotY; g.add(s);
  const step = w / n, skew = d * .8;
  for (let i = 0; i < n; i++) { const x = -w / 2 - skew / 2 + i * step; add(s, prism([[x, -d / 2], [x + step, -d / 2], [x + step + skew, d / 2], [x + skew, d / 2]], .006), i % 2 ? b : a, [0, 0, 0], [-Math.PI / 2, 0, 0]); }
  return s;
}

/** Turns a surface inside out (winding and normals), for walls seen from the concave side. */
export function inward(geo: THREE.BufferGeometry) {
  const index = geo.index!, n = geo.attributes.normal;
  for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); }
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return geo;
}
/** UVs in metres along a curved wall so the curtain-wall texture keeps its cell size. */
export function arcUV(geo: THREE.BufferGeometry, arc: number, h: number, density = 1.1) {
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * arc * density, uv.getY(i) * h * density);
  geo.userData.keepUV = true; return geo;
}

// ---------------------------------------------------------------- industry: brick, iron and steam
/** Opening with a round head, `w` wide and `h` tall to the crown, standing on y = 0. */
export function archShape(w: number, h: number) {
  const s = new THREE.Shape(), r = w / 2, spring = Math.max(0, h - r);
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, spring); s.absarc(0, spring, r, 0, Math.PI, false); s.lineTo(-r, 0); return s;
}
function archBand(r0: number, r1: number) { const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, Math.PI, false); s.lineTo(-r0, 0); s.absarc(0, 0, r0, Math.PI, 0, true); s.closePath(); return s; }
const extrude = (shape: THREE.Shape, depth: number) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
/**
 * Round-headed iron window in a brick wall: recessed glazing, glazing bars with a fanlight, a stone arch band with a
 * keystone and a sill. `at` is the bottom centre on the wall face; the glass warms up in the evening.
 */
export function archWindow(parent: THREE.Object3D, at: V3, facing: number, w = .26, h = .5, options: { frame?: string; bars?: string; dark?: boolean } = {}) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = facing; parent.add(g);
  const r = w / 2, spring = h - r, frame = options.frame ?? '#e6dcc6', bars = options.bars ?? '#2f3432';
  add(g, extrude(archShape(w, h), .02), options.dark ? '#1c1e1e' : M.glass, [0, 0, -.012]);
  add(g, extrude(archBand(r, r + .05), .035), frame, [0, spring, -.005]);
  add(g, rbox(.05, .07, .05, .01), frame, [0, h + .02, .012]);
  for (const s of [-1, 1]) add(g, bx(.035, spring, .03), frame, [s * (r + .018), spring / 2, .006]);
  add(g, rbox(w + .1, .04, .07, .01), frame, [0, -.02, .02]);
  if (options.dark) return g;
  add(g, bx(.016, h - .02, .016), bars, [0, (h - .02) / 2, .006]);
  for (const y of [spring * .5, spring]) add(g, bx(w, .016, .016), bars, [0, y, .006]);
  for (const s of [-1, 1]) rod(g, vec(0, spring, .006), vec(s * r * .7, spring + r * .7, .006), .008, bars, 4);
  return g;
}
/** Tall tapering brick stack with iron bands and a corbelled cap; returns its smoke marker. */
export function stack(parent: THREE.Object3D, x: number, z: number, base: number, top: number, r = .16, kind: 'industry' | 'steam' = 'industry', size = 1.1) {
  const h = top - base;
  add(parent, cyl(r * .72, r, h, 16), M.brick, [x, base + h / 2, z], undefined, 2.4);
  for (const t of [.25, .55, .82]) { const rr = r * (1 - .28 * t) + .014; add(parent, cyl(rr, rr, .035, 16), iron, [x, base + h * t, z]); }
  add(parent, cyl(r * .86, r * .74, .12, 16), '#cfc5ae', [x, top + .02, z]);
  add(parent, cyl(r * .58, r * .58, .02, 12), '#232323', [x, top + .085, z]);
  return smoke(parent, [x, top + .14, z], kind, size);
}
/** Track on sleepers from `a` to `b` (x, z). The rail top sits .055 above `y`. */
export function rails(parent: THREE.Object3D, a: [number, number], b: [number, number], y = .07, gauge = .2) {
  const A = vec(a[0], y, a[1]), B = vec(b[0], y, b[1]), dir = B.clone().sub(A), len = dir.length();
  const g = new THREE.Group(); g.position.copy(A.clone().add(B).multiplyScalar(.5)); g.rotation.y = Math.atan2(dir.x, dir.z); parent.add(g);
  for (let i = 0; i < Math.floor(len / .13); i++) add(g, bx(gauge + .13, .022, .05), M.darkWood, [0, .011, -len / 2 + .07 + i * .13]);
  for (const s of [-1, 1]) add(g, bx(.022, .03, len), 'metal:#8a8d8b', [s * gauge / 2, .037, 0]);
  return g;
}
/** Tank engine with a tender, facing +z, standing on a rail top at `at`. Returns its funnel smoke. */
export function steamLoco(parent: THREE.Object3D, at: V3, rotY = 0, body = '#2c4a3a') {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rotY; parent.add(g);
  const black = 'metal:#232526', red = '#a3322a', paint = `metal:${body}`;
  add(g, rbox(.28, .06, .9, .02), black, [0, .13, .02]);
  add(g, rbox(.34, .07, .05, .015), red, [0, .13, .49]);
  for (const s of [-1, 1]) add(g, cyl(.024, .024, .06, 8), black, [s * .11, .13, .53], [Math.PI / 2, 0, 0]);
  add(g, cyl(.125, .125, .58, 20), paint, [0, .29, .13], [Math.PI / 2, 0, 0]);
  add(g, cyl(.13, .13, .1, 20), black, [0, .29, .44], [Math.PI / 2, 0, 0]);
  add(g, cyl(.1, .1, .012, 18), '#3a3c3c', [0, .29, .495], [Math.PI / 2, 0, 0]);
  for (const z of [-.08, .12, .32]) add(g, cyl(.129, .129, .02, 20), brass, [0, .29, z], [Math.PI / 2, 0, 0]);
  add(g, lathe([[.032, 0], [.04, .06], [.034, .13], [.062, .18], [.056, .2], [.001, .2]], 14), black, [0, .4, .38]);
  add(g, lathe([[.06, 0], [.058, .04], [.044, .075], [.02, .095], [.001, .1]], 14), brass, [0, .4, .14]);
  add(g, cyl(.016, .016, .07, 8), brass, [0, .44, -.02]);
  add(g, rbox(.32, .3, .26, .025), red, [0, .32, -.26]);
  add(g, rbox(.37, .035, .32, .012), black, [0, .49, -.26]);
  for (const s of [-1, 1]) add(g, bx(.006, .09, .1), M.glass, [s * .161, .4, -.24]);
  add(g, bx(.2, .08, .006), M.glass, [0, .4, -.128]);
  for (const s of [-1, 1]) for (const z of [-.2, .03, .26]) {
    add(g, cyl(.08, .08, .028, 18), red, [s * .155, .08, z], [0, 0, Math.PI / 2]);
    add(g, cyl(.03, .03, .034, 10), black, [s * .156, .08, z], [0, 0, Math.PI / 2]);
  }
  for (const s of [-1, 1]) { add(g, bx(.012, .022, .5), 'metal:#a3a6a3', [s * .176, .1, .03]); add(g, cyl(.042, .042, .13, 12), black, [s * .14, .17, .38], [Math.PI / 2, 0, 0]); }
  // Tender with a coal load.
  add(g, rbox(.3, .2, .34, .02), paint, [0, .25, -.62]);
  for (let i = 0; i < 5; i++) { const m = add(g, new THREE.IcosahedronGeometry(.07, 0), '#1f2020', [-.08 + (i % 3) * .08, .36, -.68 + Math.floor(i / 3) * .1]); m.scale.y = .6; }
  for (const s of [-1, 1]) for (const z of [-.72, -.52]) add(g, cyl(.06, .06, .03, 14), black, [s * .15, .06, z], [0, 0, Math.PI / 2]);
  return smoke(g, [0, .63, .38], 'industry', .8);
}
/** Four-wheeled goods wagon on rails: open with coal or a planked van. */
export function wagon(parent: THREE.Object3D, at: V3, rotY = 0, load: 'coal' | 'van' = 'van') {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rotY; parent.add(g);
  add(g, rbox(.28, .05, .62, .015), 'metal:#2c2e2e', [0, .12, 0]);
  for (const s of [-1, 1]) for (const z of [-.18, .18]) add(g, cyl(.065, .065, .028, 14), 'metal:#2c2e2e', [s * .15, .065, z], [0, 0, Math.PI / 2]);
  if (load === 'van') {
    add(g, rbox(.3, .26, .6, .02), '#8a3b2c', [0, .28, 0]);
    add(g, rbox(.34, .03, .64, .015), '#585d5c', [0, .43, 0]);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) add(g, bx(.006, .24, .012), '#6b2c22', [s * .152, .28, -.24 + i * .12]);
  } else {
    add(g, rbox(.3, .16, .6, .02), 'rivet:#5c5f5a', [0, .23, 0]);
    for (let i = 0; i < 7; i++) { const m = add(g, new THREE.IcosahedronGeometry(.08, 0), '#1e1f1f', [-.07 + (i % 2) * .14, .32, -.22 + i * .075]); m.scale.y = .55; }
  }
  return g;
}
/** Steel lattice pylon with two cross-arms and porcelain insulators; returns the conductor points. */
export function pylon(parent: THREE.Object3D, at: V3, h = 2.1, color = 'metal:#7d8587') {
  lattice(parent, .2, .06, h, 6, color, at, .014);
  const points: V3[] = [];
  for (const [y, span] of [[h * .72, .42], [h * .92, .32]] as const) {
    rod(parent, vec(at[0] - span, at[1] + y, at[2]), vec(at[0] + span, at[1] + y, at[2]), .016, color, 5);
    for (const s of [-1, 1]) {
      rod(parent, vec(at[0] + s * .07, at[1] + y - .14, at[2]), vec(at[0] + s * span, at[1] + y, at[2]), .01, color, 4);
      for (let k = 0; k < 3; k++) add(parent, cyl(.022, .022, .018, 8), '#e9e3d6', [at[0] + s * span, at[1] + y - .03 - k * .03, at[2]]);
      points.push([at[0] + s * span, at[1] + y - .11, at[2]]);
    }
  }
  add(parent, cyl(.006, .006, .25, 4), color, [at[0], at[1] + h + .12, at[2]]);
  return points;
}
/** Sagging line between two points. */
export function wire(parent: THREE.Object3D, a: V3, b: V3, sag = .12, color = '#2a2c2c', segments = 8) {
  let previous = vec(...a);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments, p = vec(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t);
    rod(parent, previous, p, .006, color, 4); previous = p;
  }
}
/** Riveted steel tank on lattice legs with a conical cap and a ladder. */
export function waterTower(parent: THREE.Object3D, at: V3, legs = 1.3, r = .26, h = .42, color = 'rivet:#6d7a72') {
  const [x, y, z] = at, k = r * .78;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(parent, vec(x + sx * k * 1.25, y, z + sz * k * 1.25), vec(x + sx * k, y + legs, z + sz * k), .022, iron, 6);
  for (const t of [.35, .7]) for (let i = 0; i < 4; i++) {
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]], [ax, az] = c[i], [bx2, bz] = c[(i + 1) % 4], kk = k * (1.25 - .25 * t);
    rod(parent, vec(x + ax * kk, y + legs * t, z + az * kk), vec(x + bx2 * kk, y + legs * t, z + bz * kk), .01, iron, 4);
    rod(parent, vec(x + ax * kk, y + legs * t, z + az * kk), vec(x + bx2 * k * (1.25 - .25 * (t + .3)), y + legs * (t + .3), z + bz * k * (1.25 - .25 * (t + .3))), .007, iron, 4);
  }
  add(parent, cyl(r + .03, r + .03, .04, 20), iron, [x, y + legs + .02, z]);
  add(parent, cyl(r, r, h, 22), color, [x, y + legs + .04 + h / 2, z]);
  add(parent, new THREE.ConeGeometry(r + .04, r * .55, 22), iron, [x, y + legs + .04 + h + r * .27, z]);
  for (const s of [-1, 1]) rod(parent, vec(x + s * .05, y, z + k * 1.3), vec(x + s * .05, y + legs + h, z + r + .03), .008, iron, 4);
}

// ---------------------------------------------------------------- information: glass, screens and signals
/** Rooftop helipad: dark deck, white H and ring, edge lights. */
export function helipad(parent: THREE.Object3D, at: V3, r = .34) {
  const [x, y, z] = at;
  add(parent, cyl(r, r, .04, 32), '#3d4347', [x, y + .02, z]);
  ring(parent, [x, y + .043, z], r * .8, .012, white, 40);
  for (const s of [-1, 1]) add(parent, bx(.045, .006, r * .72), white, [x + s * r * .22, y + .043, z]);
  add(parent, bx(r * .44, .006, .045), white, [x, y + .043, z]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; add(parent, sph(.018, 6, 4), M.lamp, [x + Math.cos(a) * r * .95, y + .05, z + Math.sin(a) * r * .95]); }
}
/** Geodesic radar dome on a drum. */
export function radome(parent: THREE.Object3D, at: V3, r = .3, base: THREE.Material | string = M.concrete) {
  add(parent, cyl(r * .62, r * .7, r * .55, 16), base, [at[0], at[1] + r * .27, at[2]]);
  const dome = new THREE.IcosahedronGeometry(r, 2); dome.computeVertexNormals();
  add(parent, dome, '#f4f4f0', [at[0], at[1] + r * .55 + r * .72, at[2]]);
}
/** Glowing LED screen in a slim frame, facing +z before `facing`. */
export function ledScreen(parent: THREE.Object3D, at: V3, w: number, h: number, facing = 0, frame = '#24292d') {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = facing; parent.add(g);
  add(g, rbox(w + .05, h + .05, .04, .012), frame, [0, 0, -.022]);
  const plane = new THREE.PlaneGeometry(w, h); plane.userData.keepUV = true; add(g, plane, M.screen, [0, 0, .001]);
  return g;
}
/** Small modern car facing +z. */
export function car(parent: THREE.Object3D, at: V3, rotY = 0, color = '#c94f3d') {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rotY; parent.add(g);
  add(g, rbox(.2, .075, .42, .035), `metal:${color}`, [0, .07, 0]);
  add(g, rbox(.17, .065, .22, .04), '#26323b', [0, .135, -.02]);
  for (const sx of [-1, 1]) for (const z of [-.13, .13]) add(g, cyl(.038, .038, .03, 12), '#1f2224', [sx * .09, .038, z], [0, 0, Math.PI / 2]);
  for (const sx of [-1, 1]) { add(g, bx(.04, .016, .01), M.lamp, [sx * .062, .08, .211]); add(g, bx(.04, .016, .01), M.red, [sx * .062, .085, -.211]); }
  return g;
}
/** Painted parking bays along x. */
export function parking(parent: THREE.Object3D, at: V3, bays: number, spacing = .3, depth = .42) {
  for (let i = 0; i <= bays; i++) add(parent, bx(.02, .004, depth), white, [at[0] + (i - bays / 2) * spacing, at[1], at[2]]);
}
/** Red and white antenna mast with a beacon. */
export function mast(parent: THREE.Object3D, at: V3, h: number, r = .025) {
  for (let i = 0; i < 6; i++) add(parent, cyl(r * (1 - i * .08), r * (1 - (i - 1) * .08), h / 6, 8), i % 2 ? white : '#d4473a', [at[0], at[1] + h * (i + .5) / 6, at[2]]);
  blinkLight(parent, [at[0], at[1] + h + .03, at[2]], at[0] * 3, .035);
}

// ---------------------------------------------------------------- intelligence: composite, smoked glass, living light
/** Pale composite ground with a glowing inlay ring near its edge: the intelligence-era footing. */
export function aiPad(parent: THREE.Object3D, r: number) {
  roundPad(parent, r, M.composite);
  ring(parent, [0, .062, 0], r - .14, .014, M.cyan, 64).castShadow = false;
  ring(parent, [0, .061, 0], r - .1, .006, '#9aa5aa', 64);
}
/** Pulsing neural core: a violet heart in two light shells, with tilted rings turning around it. */
export function aiCore(parent: THREE.Object3D, at: V3, r = .2) {
  const core = animated(parent, { type: 'pulse', speed: 2.1, amount: 1.4, always: true }, at);
  add(core, sph(r, 24, 16), M.violet);
  halo(core, sph(r * 1.35, 24, 16), '#6a4cff'); halo(core, sph(r * 1.8, 24, 16), '#1e4cff');
  [[.5, .9], [-.7, -.6]].forEach(([tilt, speed], i) => {
    const spin = animated(parent, { type: 'spin', axis: 'y', speed, always: true }, at);
    add(spin, new THREE.TorusGeometry(r * (1.9 + i * .35), .012, 6, 48), M.cyan, [0, 0, 0], [Math.PI / 2 + tilt, 0, 0]);
    add(spin, sph(.025, 8, 6), M.cyan, [r * (1.9 + i * .35), 0, 0]);
  });
  return core;
}
/** Floating translucent display with a lit frame and a few bars of data. */
export function holoPanel(parent: THREE.Object3D, at: V3, w: number, h: number, facing = 0, color = '#38d7ff') {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = facing; parent.add(g);
  halo(g, new THREE.PlaneGeometry(w, h), color);
  for (const s of [-1, 1]) { add(g, bx(w, .008, .008), M.cyan, [0, s * h / 2, 0]).castShadow = false; add(g, bx(.008, h, .008), M.cyan, [s * w / 2, 0, 0]).castShadow = false; }
  [.7, .45, .58, .3].forEach((f, i) => halo(g, new THREE.PlaneGeometry(w * f * .8, h * .08), '#bff4ff', [-w * .4 + w * f * .4, h * (.28 - i * .17), .004]));
  return g;
}
/** Sleek humanoid robot in white composite with a dark visor and cyan eyes; about .56 tall. */
export function humanoid(parent: THREE.Object3D, at: V3, rotY = 0, body = shell, joint = graphite) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rotY; parent.add(g);
  add(g, rbox(.14, .17, .085, .04), body, [0, .37, 0]);
  add(g, rbox(.09, .05, .07, .02), joint, [0, .27, 0]);
  add(g, rbox(.12, .07, .075, .03, 1), body, [0, .22, 0]);
  add(g, cyl(.025, .03, .04, 10), joint, [0, .47, 0]);
  add(g, sph(.058, 16, 12), body, [0, .52, 0]).scale.set(.9, 1.05, 1);
  add(g, bx(.085, .03, .03), '#141a20', [0, .525, .042]);
  lightStrip(g, [0, .526, .058], .06, .008, .004);
  lightStrip(g, [0, .39, .044], .028, .028, .004);
  for (const s of [-1, 1]) {
    add(g, sph(.03, 10, 8), joint, [s * .088, .43, 0]);
    add(g, new THREE.CapsuleGeometry(.024, .1, 3, 8), body, [s * .098, .35, 0]);
    add(g, new THREE.CapsuleGeometry(.021, .09, 3, 8), body, [s * .104, .245, .015], [-.2, 0, 0]);
    add(g, new THREE.CapsuleGeometry(.032, .09, 3, 8), body, [s * .036, .13, 0]);
    add(g, new THREE.CapsuleGeometry(.027, .07, 3, 8), joint, [s * .036, .045, .005]);
  }
  return g;
}
/**
 * Articulated assembly arm: turret, shoulder and elbow swing out of phase. Returns the elbow so a tool or a part
 * can ride on it.
 */
export function robotArm(parent: THREE.Object3D, at: V3, phase = 0, body = shell, joint = graphite, accent: THREE.Material = M.cyan, reach = 1) {
  add(parent, cyl(.12, .15, .1, 20), joint, [at[0], at[1] + .05, at[2]]);
  const turret = animated(parent, { type: 'swing', axis: 'y', speed: .9, amount: .9, phase, always: true }, [at[0], at[1] + .1, at[2]]);
  add(turret, cyl(.095, .11, .12, 20), body, [0, .06, 0]);
  add(turret, new THREE.TorusGeometry(.104, .012, 6, 28), accent, [0, .02, 0], [Math.PI / 2, 0, 0]);
  const shoulder = animated(turret, { type: 'swing', axis: 'x', speed: 1.3, amount: .35, phase: phase + 1, always: true }, [0, .16, 0]);
  add(shoulder, sph(.07, 14, 10), joint);
  add(shoulder, rbox(.09, .44 * reach, .085, .04), body, [0, .22 * reach, 0]);
  const elbow = animated(shoulder, { type: 'swing', axis: 'x', speed: 1.3, amount: .5, phase: phase + 2.2, always: true }, [0, .44 * reach, 0]);
  add(elbow, sph(.058, 14, 10), joint);
  add(elbow, new THREE.TorusGeometry(.062, .01, 6, 24), accent, [0, 0, 0], [0, Math.PI / 2, 0]);
  add(elbow, rbox(.068, .068, .36 * reach, .03), body, [0, 0, -.18 * reach]);
  add(elbow, cyl(.034, .03, .09, 12), joint, [0, -.03, -.37 * reach]);
  add(elbow, sph(.018, 8, 6), accent, [0, -.08, -.37 * reach]);
  return elbow;
}
/** Delivery drone: white body, four ducted rotors and a cyan light band, carrying a parcel. */
export function drone(g: THREE.Object3D, at: V3, parcel = true) {
  const d = new THREE.Group(); d.position.set(...at); g.add(d);
  add(d, rbox(.18, .06, .18, .03), shell);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2; rod(d, vec(0, 0, 0), vec(Math.cos(a) * .15, .02, Math.sin(a) * .15), .012, graphite);
    add(d, new THREE.TorusGeometry(.065, .014, 6, 18), shell, [Math.cos(a) * .17, .03, Math.sin(a) * .17], [Math.PI / 2, 0, 0]);
    add(d, cyl(.055, .055, .006, 12), '#3c4446', [Math.cos(a) * .17, .03, Math.sin(a) * .17]);
  }
  if (parcel) add(d, rbox(.1, .08, .1, .01), '#c99a5e', [0, -.08, 0]);
  lightStrip(d, [0, .0, .092], .1, .015, .01);
  return d;
}
/** Low rounded planter with a small tree. */
export function planter(parent: THREE.Object3D, at: V3, size = .24, color = '#6f9a4c') {
  add(parent, cyl(size * .55, size * .5, .1, 18), shell, [at[0], at[1] + .05, at[2]]);
  add(parent, cyl(size * .5, size * .5, .02, 18), '#5b7a3c', [at[0], at[1] + .1, at[2]]);
  tree(parent, [at[0], at[1] + .1, at[2]], size, color);
}

// ---------------------------------------------------------------- interstellar: titanium, hex decks and energy
/** Hexagonal deck with a glowing hexagonal rim; the deck top is at `at[1] + .1`. */
export function hexPad(parent: THREE.Object3D, at: V3, r: number, glow: THREE.Material = M.cyan) {
  add(parent, cyl(r, r + .04, .1, 6), M.hexDeck, [at[0], at[1] + .05, at[2]], undefined, 1.3);
  ring(parent, [at[0], at[1] + .1, at[2]], r * .9, .016, glow, 6).castShadow = false;
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(parent, bx(.12, .008, .035), i % 2 ? white : signal, [at[0] + Math.sin(a) * r * .72, at[1] + .102, at[2] + Math.cos(a) * r * .72], [0, a, 0]); }
}
/** Light shaft rising from `at`, fading toward its top. */
export function beam(parent: THREE.Object3D, at: V3, r0: number, r1: number, h: number, color = '#7fe6ff') {
  const geo = new THREE.CylinderGeometry(r1, r0, h, 24, 1, true); geo.userData.keepUV = true;
  return add(parent, geo, `beam:${color}`, [at[0], at[1] + h / 2, at[2]]);
}
