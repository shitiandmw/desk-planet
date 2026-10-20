import * as THREE from 'three';
import { vec } from './craft';
import { M, add, animated, bush, bx, cyl, lathe, lightStrip, prism, rod, sph, type V3 } from './building-kit';
import { aiCore, aiPad, arcUV, blinkLight, drone, graphite, halo, holoPanel, humanoid, inward, planter, rbox, ring, robotArm, shell, tree } from './era-kit';

/**
 * Intelligence era: seamless white composite shells, smoked glass streaked with cyan light, violet energy, floating
 * holograms and drones. Forms are rounded and continuous where the earlier eras were boxed and framed.
 */
const pale = 'panel:#e3e8ea', mint = '#7fb069';

/** Glowing inlay line on the ground from `a` to `b` (x, z). */
function inlay(g: THREE.Object3D, a: [number, number], b: [number, number], y = .065, mat: THREE.Material = M.cyan, w = .022) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  lightStrip(g, [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], w, .006, Math.hypot(dx, dz)).rotation.y = Math.atan2(dx, dz);
}
/** Rooftop cooling fan in a smooth white cowl; only some turn, to keep draw calls down. */
function cowlFan(g: THREE.Object3D, at: V3, r: number, spin: boolean) {
  add(g, lathe([[r * .82, 0], [r, .04], [r * 1.02, .12], [r * .9, .16], [r * .86, .14]], 32), shell, at);
  add(g, cyl(r * .84, r * .84, .02, 28), '#1f262c', [at[0], at[1] + .1, at[2]]);
  const hub = spin ? animated(g, { type: 'spin', axis: 'y', speed: 4, always: true }, [at[0], at[1] + .115, at[2]]) : (() => { const o = new THREE.Group(); o.position.set(at[0], at[1] + .115, at[2]); g.add(o); return o; })();
  add(hub, cyl(r * .2, r * .2, .03, 16), shell);
  for (let i = 0; i < 5; i++) { const b = add(hub, bx(r * .66, .008, r * .2), '#596670', [Math.cos(i * 1.2566) * r * .44, 0, -Math.sin(i * 1.2566) * r * .44]); b.rotation.set(.35, i * 1.2566, 0); }
}

/**
 * AI compute campus: a smoked-glass monolith banded in white with streams of cyan light, a glass atrium rising from
 * the roof around the pulsing neural core, rooftop cooling cowls, a liquid-cooling plant with glowing coolant lines
 * and data trenches that run out across the ground.
 */
export function datacenter() {
  const g = new THREE.Group(), y0 = .06, x0 = -1.28, x1 = .72, z0 = -1.06, z1 = .02, H = .95;
  aiPad(g, 1.8);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  add(g, rbox(W + .06, .12, D + .06, .05), shell, [cx, y0 + .06, cz]);
  add(g, rbox(W, H - .18, D, .08), M.darkGlass, [cx, y0 + .12 + (H - .18) / 2, cz], undefined, 1.2);
  add(g, rbox(W + .08, .12, D + .08, .06), shell, [cx, y0 + H - .02, cz]);
  for (let i = 0; i < 9; i++) {
    const x = x0 + .14 + i * (W - .28) / 8;
    add(g, rbox(.05, H - .18, .05, .02), shell, [x, y0 + .12 + (H - .18) / 2, z1 + .01]);
    if (i % 2) lightStrip(g, [x + .11, y0 + .2 + (i % 3) * .12, z1 + .006], .016, .32, .01);
  }
  for (let i = 0; i < 5; i++) { const z = z0 + .14 + i * (D - .28) / 4; add(g, rbox(.05, H - .18, .05, .02), shell, [x1 + .01, y0 + .12 + (H - .18) / 2, z]); }
  lightStrip(g, [cx, y0 + H - .1, z1 + .045], W, .015, .01);
  // Entrance and a floating status display.
  add(g, rbox(.42, .5, .06, .02), shell, [-.1, y0 + .37, z1 + .05]);
  add(g, bx(.3, .38, .02), M.clearGlass, [-.1, y0 + .31, z1 + .085]);
  holoPanel(g, [-.1, y0 + .95, z1 + .42], .5, .28, 0);
  rod(g, vec(-.1, y0, z1 + .42), vec(-.1, y0 + .78, z1 + .42), .012, graphite, 6);
  // Atrium and neural core.
  const ax = -.32, az = -.52, top = y0 + H + .04;
  add(g, cyl(.46, .48, .08, 40), shell, [ax, top + .04, az]);
  add(g, cyl(.42, .42, .9, 40, true), M.clearGlass, [ax, top + .53, az]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; add(g, bx(.03, .9, .03), shell, [ax + Math.sin(a) * .42, top + .53, az + Math.cos(a) * .42]); }
  add(g, lathe([[.44, 0], [.47, .03], [.46, .08], [.3, .12], [.3, .1], [.42, .06]], 40), shell, [ax, top + .96, az]);
  ring(g, [ax, top + 1.04, az], .37, .012, M.cyan, 48);
  add(g, cyl(.06, .08, .5, 16), graphite, [ax, top + .33, az]);
  for (const y of [.18, .36, .54]) ring(g, [ax, top + y, az], .12, .012, M.cyan, 24);
  aiCore(g, [ax, top + .7, az], .15);
  // Roof cooling cowls.
  [[-1.0, -.82, true], [-1.0, -.28, false], [.32, -.82, false], [.32, -.28, true]].forEach(([x, z, spin]) => cowlFan(g, [x as number, top, z as number], .2, spin as boolean));
  // Liquid cooling plant and glowing coolant lines.
  for (const [i, z] of [-.82, -.32].entries()) {
    const x = 1.18;
    add(g, lathe([[.2, 0], [.21, .1], [.19, .5], [.16, .58], [.001, .58]], 32), shell, [x, y0, z]);
    add(g, cyl(.13, .13, .02, 24), '#1f262c', [x, y0 + .58, z]);
    ring(g, [x, y0 + .3, z], .202, .01, M.cyan, 32);
    for (const dy of [.16, .24]) rod(g, vec(x1 + .02, y0 + dy, z + .05 * i), vec(x - .2, y0 + dy, z + .05 * i), .016, M.cyan, 8);
  }
  for (const [a, b] of [[[.2, .1], [.2, 1.55]], [[-.62, .1], [-.95, 1.35]], [[.72, -.2], [1.62, .45]]] as [[number, number], [number, number]][]) inlay(g, a, b);
  planter(g, [.62, y0, .58], .22); planter(g, [-.85, y0, .62], .2, mint);
  return g;
}

/**
 * Robot works: a seamless white vault open to the front over a glowing assembly line, two arms building a humanoid
 * on its cradle, finished robots on charging rings outside, sparks and a hologram of the design.
 */
export function robotics() {
  const g = new THREE.Group(), y0 = .06, r = .86, L = 2.3, z0 = -.42, open = .95;
  aiPad(g, 1.8);
  const vault = (radius: number, inside: boolean, paint: string) => {
    const geo = arcUV(new THREE.CylinderGeometry(radius, radius, L, 48, 1, true, open, Math.PI - open), radius * (Math.PI - open), L, 1.2);
    geo.rotateZ(Math.PI / 2);
    add(g, inside ? inward(geo) : geo, paint, [0, y0, z0]);
  };
  vault(r, false, shell); vault(r - .05, true, pale);
  for (const x of [-L / 2, -L / 6, L / 6, L / 2]) add(g, new THREE.TorusGeometry(r - .02, .035, 8, 32, Math.PI - open), shell, [x, y0, z0], [0, Math.PI / 2, 0]);
  for (const x of [-L / 3, 0, L / 3]) add(g, new THREE.TorusGeometry(r + .004, .012, 4, 32, Math.PI - open - .2), M.cyan, [x, y0, z0], [0, Math.PI / 2, 0]).castShadow = false;
  // Smoked-glass end walls following the vault profile.
  const profile: [number, number][] = [[-r * Math.cos(open), 0]];
  for (let i = 0; i <= 16; i++) { const t = open + (Math.PI - open) * i / 16; profile.push([-r * Math.cos(t), r * Math.sin(t)]); }
  for (const s of [-1, 1]) add(g, prism(profile, .05), M.darkGlass, [s * (L / 2 - .02), y0, z0], [0, Math.PI / 2, 0]);
  // Assembly line with a humanoid on its cradle.
  add(g, rbox(L - .3, .16, .3, .04), graphite, [0, y0 + .08, z0 + .2]);
  for (const s of [-1, 1]) lightStrip(g, [0, y0 + .165, z0 + .2 + s * .14], L - .34, .01, .015);
  for (let i = 0; i < 4; i++) add(g, rbox(.18, .1, .2, .03), i % 2 ? shell : pale, [-.75 + i * .5, y0 + .21, z0 + .2]);
  add(g, rbox(.32, .05, .32, .02), graphite, [0, y0 + .19, z0 + .2]);
  humanoid(g, [0, y0 + .2, z0 + .2], 0);
  for (const s of [-1, 1]) {
    robotArm(g, [s * .55, y0, z0 + .62], s > 0 ? 1.9 : 0);
    const spark = animated(g, { type: 'blink', speed: 7, phase: s, always: true }, [s * .2, y0 + .52, z0 + .3]);
    add(spark, sph(.03, 6, 5), M.lamp).castShadow = false; halo(spark, sph(.07, 8, 6), '#9fe8ff');
  }
  holoPanel(g, [-.62, y0 + .75, z0 + .5], .5, .32, .25);
  // Finished robots on charging rings.
  for (let i = 0; i < 3; i++) {
    const x = -.6 + i * .6, z = .95 - Math.abs(i - 1) * .1;
    ring(g, [x, y0 + .005, z], .16, .012, M.cyan, 32); add(g, cyl(.15, .15, .01, 28), graphite, [x, y0, z]);
    humanoid(g, [x, y0 + .01, z], -.2 * (i - 1));
  }
  planter(g, [1.3, y0, .55], .22); planter(g, [-1.3, y0, .55], .2, mint);
  return g;
}

/**
 * Autonomous factory: a ribbed white dome over a smoked-glass drum, a drone tower with landing rings, a glass maglev
 * tube carrying capsules to the dispatch hub, and drones circling overhead.
 */
export function autofactory() {
  const g = new THREE.Group(), y0 = .06, dx = -.32, dz = -.34, r = .92;
  aiPad(g, 1.84);
  add(g, cyl(r, r + .04, .34, 48), M.darkGlass, [dx, y0 + .17, dz], undefined, 1.3);
  add(g, cyl(r + .06, r + .06, .05, 48), shell, [dx, y0 + .34, dz]);
  const dome = add(g, new THREE.SphereGeometry(r, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2), shell, [dx, y0 + .36, dz]); dome.scale.y = .72;
  for (let i = 0; i < 8; i++) { const rib = add(g, new THREE.TorusGeometry(r + .012, .025, 6, 24, Math.PI / 2), shell, [dx, y0 + .36, dz], [0, i * Math.PI / 4, 0]); rib.scale.set(1, .72, 1); }
  for (const [t, w] of [[.32, .012], [.62, .01]] as const) { const rr = r * Math.cos(Math.asin(t)) + .01; ring(g, [dx, y0 + .36 + t * r * .72, dz], rr, w, M.cyan, 64).castShadow = false; }
  add(g, cyl(.26, .3, .06, 32), M.darkGlass, [dx, y0 + .36 + r * .72, dz]);
  ring(g, [dx, y0 + .4 + r * .72, dz], .28, .014, M.cyan, 40);
  // Drone tower with three landing rings.
  const tx = .98, tz = -.82;
  add(g, cyl(.16, .2, .12, 24), shell, [tx, y0 + .06, tz]);
  add(g, lathe([[.08, 0], [.06, 1.0], [.05, 1.95], [.001, 2.0]], 20), shell, [tx, y0 + .1, tz]);
  for (const [i, y] of [.75, 1.3, 1.85].entries()) {
    const a = i * 2.1, px = tx + Math.sin(a) * .2, pz = tz + Math.cos(a) * .2;
    rod(g, vec(tx, y0 + y - .05, tz), vec(px, y0 + y, pz), .02, shell, 8);
    add(g, cyl(.17, .15, .04, 28), shell, [px, y0 + y, pz]); ring(g, [px, y0 + y + .022, pz], .13, .01, M.cyan, 28);
    if (i < 2) drone(g, [px, y0 + y + .07, pz], false);
  }
  blinkLight(g, [tx, y0 + 2.12, tz], 0, .03, M.cyan);
  // Maglev tube to the dispatch hub.
  const a = vec(dx + .55, y0 + .42, dz + .78), b = vec(1.02, y0 + .42, .82), dir = b.clone().sub(a), len = dir.length();
  const track = new THREE.Group(); track.position.copy(a); track.rotation.y = Math.atan2(-dir.z, dir.x); g.add(track);
  add(track, cyl(.1, .1, len, 24, true), M.clearGlass, [len / 2, 0, 0], [0, 0, Math.PI / 2]);
  add(track, rbox(len, .025, .06, .01), graphite, [len / 2, -.08, 0]);
  lightStrip(track, [len / 2, -.065, 0], len, .006, .02);
  for (const t of [.25, .75]) add(track, rbox(.06, .36, .06, .02), shell, [len * t, -.26, 0]);
  [0, Math.PI].forEach(phase => { const pod = animated(track, { type: 'slide', axis: 'x', speed: .7, amount: len - .3, phase, always: true }, [.15, 0, 0]); add(pod, new THREE.CapsuleGeometry(.065, .14, 4, 12), shell, [0, 0, 0], [0, 0, Math.PI / 2]); add(pod, cyl(.067, .067, .02, 16), M.cyan, [0, 0, 0], [0, 0, Math.PI / 2]); });
  // Dispatch hub with parcels.
  add(g, rbox(.62, .42, .5, .14), shell, [1.12, y0 + .21, .98]);
  add(g, rbox(.64, .1, .52, .05), M.darkGlass, [1.12, y0 + .26, .98]);
  add(g, cyl(.2, .2, .03, 28), graphite, [1.12, y0 + .435, .98]); ring(g, [1.12, y0 + .452, .98], .16, .01, M.cyan, 28);
  for (let i = 0; i < 3; i++) add(g, rbox(.14, .1, .14, .015), '#c99a5e', [.62 + i * .17, y0 + .05, 1.36 - i * .05]);
  // Drones on their rounds.
  const orbit = animated(g, { type: 'spin', axis: 'y', speed: .55, always: true }, [dx, y0 + 1.25, dz]);
  drone(animated(orbit, { type: 'bob', axis: 'y', speed: 2, amount: .06, always: true }, [.75, 0, 0]), [0, 0, 0]);
  const orbitB = animated(g, { type: 'spin', axis: 'y', speed: -.4, always: true }, [tx, y0 + 1.0, tz]);
  drone(animated(orbitB, { type: 'bob', axis: 'y', speed: 1.6, amount: .07, phase: 1, always: true }, [.55, 0, 0]), [0, 0, 0]);
  planter(g, [-1.25, y0, .82], .22, mint);
  return g;
}

/** D-shaped field coil in the radial (x) and vertical (y) plane. */
function coilShape(ri: number, ro: number, hh: number, w: number) {
  const d = (a: number, b: number, h: number) => { const pts: THREE.Vector2[] = []; for (let i = 0; i <= 16; i++) { const t = -Math.PI / 2 + Math.PI * i / 16; pts.push(new THREE.Vector2(a + (b - a) * Math.cos(t), h * Math.sin(t))); } return pts; };
  const shape = new THREE.Shape(d(ri, ro, hh)); shape.holes.push(new THREE.Path(d(ri + w, ro - w, hh - w).reverse()));
  return new THREE.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, -.035);
}
/**
 * Fusion plant: a ring of sixteen D-shaped field coils around a pulsing violet plasma torus on a white cryostat, a
 * central solenoid, three energy pylons fed by glowing conduits, and a curved control hall.
 */
export function fusion() {
  const g = new THREE.Group(), y0 = .06, cz = -.18, base = y0 + .24, mid = base + .4;
  aiPad(g, 1.84);
  add(g, cyl(1.0, 1.04, .24, 64), shell, [0, y0 + .12, cz]);
  ring(g, [0, base + .005, cz], .98, .012, M.violet, 64).castShadow = false;
  add(g, cyl(.86, .86, .02, 64), graphite, [0, base, cz]);
  const coil = coilShape(.36, .94, .36, .08);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; add(g, coil.clone(), 'metal:#35598f', [0, mid, cz], [0, a, 0]); lightStrip(g, [Math.cos(a) * .94, mid, cz - Math.sin(a) * .94], .012, .3, .02).rotation.y = a; }
  add(g, new THREE.TorusGeometry(.95, .025, 6, 64), 'metal:#c9d1d6', [0, mid + .2, cz], [Math.PI / 2, 0, 0]);
  add(g, new THREE.TorusGeometry(.95, .025, 6, 64), 'metal:#c9d1d6', [0, mid - .2, cz], [Math.PI / 2, 0, 0]);
  const plasma = animated(g, { type: 'pulse', speed: 2.4, amount: .8, always: true }, [0, mid, cz]);
  add(plasma, new THREE.TorusGeometry(.62, .075, 12, 64), M.violet, [0, 0, 0], [Math.PI / 2, 0, 0]);
  halo(plasma, new THREE.TorusGeometry(.62, .13, 12, 64), '#8a5cff', [0, 0, 0], [Math.PI / 2, 0, 0]);
  halo(plasma, new THREE.TorusGeometry(.62, .2, 12, 64), '#2b55ff', [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(g, cyl(.17, .19, .72, 28), graphite, [0, base + .36, cz]);
  for (const y of [.18, .36, .54]) ring(g, [0, base + y, cz], .19, .012, M.cyan, 28);
  add(g, sph(.12, 20, 14), shell, [0, base + .76, cz]);
  // Energy pylons and conduits.
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 3 + i * Math.PI * 2 / 3, px = Math.sin(a) * 1.42, pz = cz + Math.cos(a) * 1.42 * .92;
    add(g, cyl(.14, .16, .1, 24), shell, [px, y0 + .05, pz]);
    add(g, lathe([[.08, 0], [.07, .9], [.05, 1.15], [.001, 1.16]], 20), shell, [px, y0 + .1, pz]);
    for (const y of [.35, .6, .85]) ring(g, [px, y0 + y, pz], .085 - y * .02, .016, M.violet, 24);
    add(g, sph(.08, 18, 12), M.violet, [px, y0 + 1.3, pz]); halo(g, sph(.15, 18, 12), '#7b5cff', [px, y0 + 1.3, pz]);
    inlay(g, [Math.sin(a) * 1.05, cz + Math.cos(a) * 1.05 * .92], [px, pz], .065, M.violet, .03);
  }
  // Control hall.
  const hall = new THREE.Group(); hall.position.set(0, y0, 1.28); g.add(hall);
  add(hall, rbox(.86, .3, .36, .15), shell, [0, .15, 0]);
  add(hall, rbox(.88, .09, .38, .045), M.darkGlass, [0, .17, 0]);
  holoPanel(hall, [.3, .5, .05], .36, .18, -.3, '#a98bff');
  planter(g, [-1.35, y0, .4], .2, mint);
  return g;
}

/**
 * Eco tower: rounded floor plates twisting as they rise, each ringed with planting and underlit in cyan, a smoked
 * glass core with vertical gardens, and a sky garden crowned by a helical wind turbine.
 */
export function ecotower() {
  const g = new THREE.Group(), y0 = .06;
  aiPad(g, 1.34);
  const greens = ['#6f9a4c', '#86ad57', '#5c8a45', '#7aa552'];
  add(g, bx(.46, .02, .3), M.water, [-.62, y0 + .02, .6]); add(g, rbox(.5, .04, .34, .02), shell, [-.62, y0 + .01, .6]);
  let y = y0;
  for (let k = 0; k < 7; k++) {
    const tier = new THREE.Group(); tier.position.y = y; tier.rotation.y = k * .2; g.add(tier);
    const w = 1.36 - k * .1, core = w - .38, h = .44;
    add(tier, rbox(w, .07, w, .24), shell, [0, .035, 0]);
    add(tier, rbox(core, h - .07, core, .14), M.darkGlass, [0, .07 + (h - .07) / 2, 0], undefined, 1.2);
    lightStrip(tier, [0, .002, w / 2 - .02], w - .4, .01, .02);
    for (let side = 0; side < 4; side++) {
      const a = side * Math.PI / 2, cx = Math.sin(a), cz = Math.cos(a), edge = w / 2 - .09;
      add(tier, rbox(w - .34, .08, .1, .04), greens[(k + side) % 4], [cx * edge, .11, cz * edge], [0, a, 0]);
      for (const t of [-.24, .24]) bush(tier, [cx * edge + Math.cos(a) * t * w, .1, cz * edge - Math.sin(a) * t * w], .09 + ((side + k) % 2) * .03, greens[(side + k + 1) % 4]);
    }
    if (k % 2 === 0) tree(tier, [w / 2 - .17, .07, w / 2 - .17], .2, greens[k % 4]);
    for (const [sx, sz] of [[-1, 1], [1, -1]]) add(tier, rbox(.07, h - .1, .07, .03), '#5f8e45', [sx * core / 2, .05 + h / 2, sz * core / 2]);
    y += h;
  }
  // Sky garden and helical turbine.
  add(g, rbox(.7, .06, .7, .2), shell, [0, y + .03, 0]);
  tree(g, [.12, y + .06, .1], .2, '#86ad57'); bush(g, [-.18, y + .06, -.12], .1, '#6f9a4c');
  add(g, new THREE.TorusGeometry(.36, .02, 6, 40), shell, [0, y + .5, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; rod(g, vec(Math.sin(a) * .3, y + .06, Math.cos(a) * .3), vec(Math.sin(a) * .36, y + .5, Math.cos(a) * .36), .015, shell, 6); }
  rod(g, vec(0, y + .06, 0), vec(0, y + 1.0, 0), .02, graphite, 8);
  const turbine = animated(g, { type: 'spin', axis: 'y', speed: 1.3, always: true }, [0, y + .62, 0]);
  for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) {
    const a = i * Math.PI * 2 / 3 + k * .14, b = add(turbine, bx(.05, .07, .02), shell, [Math.cos(a) * .15, -.2 + k * .075, Math.sin(a) * .15]);
    b.rotation.y = -a + Math.PI / 2;
  }
  ring(g, [0, y + 1.0, 0], .06, .01, M.cyan, 16);
  blinkLight(g, [0, y + 1.04, 0], 0, .025, M.cyan);
  ([[.75, .55], [-.2, .75], [.7, -.6]] as const).forEach(([x, z], i) => planter(g, [x, y0, z], .2, greens[i]));
  return g;
}
