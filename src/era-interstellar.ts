import * as THREE from 'three';
import { vec } from './craft';
import { M, add, animated, bx, cyl, dish, lathe, lightStrip, prism, rod, roundPad, smoke, sph, type V3 } from './building-kit';
import { beam, blinkLight, carbon, halo, hexPad, holoPanel, lattice, rbox, ring, robotArm, signal, stripes, titanium } from './era-kit';

/**
 * Interstellar era: dark hexagonal decks with orange markings, titanium plating, stainless rockets, hovering craft,
 * energy rings and beams of light. The silhouettes reach upward: towers, masts, tethers and skyward dishes.
 */
const stainless = 'metal:#c3c8cd', dark = 'metal:#1d2126', orange = `metal:${signal}`;

/** Deck ground for the whole complex with an amber service ring. */
function deck(g: THREE.Object3D, r: number) {
  roundPad(g, r, M.hexDeck);
  ring(g, [0, .062, 0], r - .12, .012, M.amber, 72).castShadow = false;
}
/** Cargo container with corrugated ends. */
function container(g: THREE.Object3D, at: V3, color: string, rotY = 0) {
  const c = new THREE.Group(); c.position.set(...at); c.rotation.y = rotY; g.add(c);
  add(c, rbox(.38, .2, .2, .015), `metal:${color}`, [0, .1, 0]);
  for (let i = 0; i < 6; i++) add(c, bx(.012, .17, .205), `metal:${color}`, [-.15 + i * .06, .1, 0]);
  add(c, bx(.002, .15, .14), dark, [.191, .1, 0]);
}
/** Horizontal propellant tank with domed ends, lying along z. */
function propellantTank(g: THREE.Object3D, at: V3, r: number, length: number) {
  add(g, cyl(r, r, length, 28), titanium, at, [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) { const end = add(g, sph(r, 28, 14), titanium, [at[0], at[1], at[2] + s * length / 2]); end.scale.z = .55; }
  add(g, cyl(r + .006, r + .006, .05, 28), orange, at, [Math.PI / 2, 0, 0]);
  for (const s of [-1, 1]) add(g, rbox(r * 1.6, at[1] - .06, .07, .015), carbon, [at[0], (at[1] + .06) / 2, at[2] + s * length * .32]);
}

/**
 * Launch complex: a two-stage stainless rocket on a hexagonal launch table over the flame trench, a dark lattice
 * tower with catch arms and a crew arm, a propellant farm and lightning masts, with vapour venting from the stack.
 */
export function launchpad() {
  const g = new THREE.Group(), y0 = .06, rx = .02, rz = .02, table = y0 + .62;
  deck(g, 1.92);
  // Flame trench, launch table and its legs.
  add(g, rbox(.62, .02, 1.5, .01), '#16191c', [rx, y0 + .005, rz + .6]);
  for (let i = 0; i < 9; i++) add(g, bx(.6, .012, .025), carbon, [rx, y0 + .018, rz + .02 + i * .16]);
  add(g, prism([[-.3, 0], [.3, 0], [0, .32]], .5), stainless, [rx, y0, rz], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; rod(g, vec(rx + Math.sin(a) * .5, y0, rz + Math.cos(a) * .5), vec(rx + Math.sin(a) * .36, table - .05, rz + Math.cos(a) * .36), .04, carbon, 8); }
  add(g, cyl(.46, .46, .12, 6), carbon, [rx, table, rz]);
  ring(g, [rx, table + .062, rz], .3, .012, M.amber, 6);
  for (const [x, z, r] of [[rx, rz + .75, 0], [rx, rz - .75, 0], [rx + .75, rz, Math.PI / 2], [rx - .75, rz, Math.PI / 2]] as const) stripes(g, [x, y0 + .003, z], 1.0, .1, r);
  // Booster.
  const booster = table + .06, bh = 2.0, r = .19;
  add(g, cyl(r, r, bh, 32), stainless, [rx, booster + bh / 2, rz]);
  for (let i = 1; i < 8; i++) add(g, cyl(r + .003, r + .003, .008, 32), 'metal:#9ea4aa', [rx, booster + i * bh / 8, rz]);
  for (const s of [-1, 1]) add(g, rbox(.03, bh * .9, .05, .01), stainless, [rx + s * (r + .01), booster + bh * .47, rz]);
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; add(g, rbox(.13, .14, .02, .005), dark, [rx + Math.sin(a) * (r + .07), booster + bh - .2, rz + Math.cos(a) * (r + .07)], [0, a, 0]); }
  add(g, cyl(r, r, .08, 32), dark, [rx, booster + bh + .04, rz]);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(g, bx(.02, .05, .006), '#0b0c0e', [rx + Math.sin(a) * (r + .002), booster + bh + .04, rz + Math.cos(a) * (r + .002)], [0, a, 0]); }
  // Ship with its heat shield, flaps and nose.
  const ship = booster + bh + .08, sh = 1.15;
  add(g, cyl(r, r, sh, 32), stainless, [rx, ship + sh / 2, rz]);
  // Heat shield tiles on the windward (west) half; the steel side faces the approach road.
  add(g, new THREE.CylinderGeometry(r + .006, r + .006, sh, 32, 1, true, Math.PI, Math.PI), dark, [rx, ship + sh / 2, rz]);
  add(g, lathe([[r, 0], [r * .97, .14], [r * .86, .3], [r * .62, .46], [r * .3, .58], [.001, .64]], 32), stainless, [rx, ship + sh, rz]);
  const shield = new THREE.LatheGeometry([[r + .006, 0], [r * .97 + .006, .14], [r * .86 + .006, .3], [r * .62 + .006, .46], [r * .3 + .004, .58]].map(([x, y]) => new THREE.Vector2(x, y)), 32, Math.PI, Math.PI);
  add(g, shield, dark, [rx, ship + sh, rz]);
  for (const s of [-1, 1]) for (const [y, w, h] of [[ship + .05, .17, .4], [ship + sh + .1, .1, .26]] as const) add(g, prism([[0, 0], [w, .04], [w, h - .04], [0, h]], .025), dark, [rx, y, rz + s * (r - .01)], [0, -s * Math.PI / 2, 0]);
  for (let i = 0; i < 3; i++) add(g, sph(.012, 6, 4), M.lamp, [rx - .08 + i * .08, ship + sh + .1, rz + r - .005]);
  smoke(g, [rx + .22, booster + bh * .55, rz + .05], 'steam', .7); smoke(g, [rx - .2, ship + .1, rz], 'steam', .55);
  // Launch tower with chopsticks and the crew access arm.
  const tx = -.92, tz = -.58, th = 4.25;
  lattice(g, .22, .19, th, 12, 'metal:#3a4047', [tx, y0, tz], .018);
  add(g, rbox(.5, .14, .5, .02), carbon, [tx, y0 + th + .07, tz]); add(g, rbox(.1, .4, .1, .02), carbon, [tx, y0 + th + .34, tz]);
  blinkLight(g, [tx, y0 + th + .58, tz], 0, .035);
  const toward = vec(rx - tx, 0, rz - tz).normalize(), across = vec(-toward.z, 0, toward.x), yaw = Math.atan2(toward.x, toward.z);
  const arms = booster + bh - .35;
  add(g, rbox(.5, .32, .5, .03), carbon, [tx, arms, tz]); add(g, bx(.52, .05, .52), orange, [tx, arms + .1, tz]);
  for (const s of [-1, 1]) { const mid = vec(tx, arms, tz).addScaledVector(toward, .68).addScaledVector(across, s * (r + .06)); add(g, rbox(.06, .1, 1.0, .02), carbon, mid.toArray() as V3, [0, yaw, 0]); add(g, rbox(.07, .03, .2, .01), orange, mid.clone().addScaledVector(toward, .42).setY(arms + .065).toArray() as V3, [0, yaw, 0]); }
  const crew = ship + sh * .7, arm = vec(tx, crew, tz).addScaledVector(toward, .48);
  add(g, rbox(.12, .12, .78, .03), 'hull:#d9dde0', arm.toArray() as V3, [0, yaw, 0]);
  add(g, bx(.08, .06, .7), M.cyan, arm.clone().setY(crew - .03).toArray() as V3, [0, yaw, 0]).scale.set(.4, .3, 1);
  // Propellant farm and spherical tank.
  for (let i = 0; i < 3; i++) propellantTank(g, [.68 + i * .32, y0 + .2, -.9], .13, .76);
  add(g, sph(.28, 32, 20), titanium, [1.18, y0 + .52, .52]);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; rod(g, vec(1.18 + Math.sin(a) * .26, y0, .52 + Math.cos(a) * .26), vec(1.18 + Math.sin(a) * .2, y0 + .42, .52 + Math.cos(a) * .2), .025, carbon, 6); }
  add(g, cyl(.29, .29, .04, 32), orange, [1.18, y0 + .52, .52]);
  for (const [a, b] of [[[.68, -.5], [rx + .3, rz - .2]], [[1.0, .3], [rx + .35, rz + .1]]] as [number, number][][]) { add(g, cyl(.03, .03, Math.hypot(b[0] - a[0], b[1] - a[1]), 10), stainless, [(a[0] + b[0]) / 2, y0 + .06, (a[1] + b[1]) / 2], [Math.PI / 2, 0, -Math.atan2(b[0] - a[0], b[1] - a[1])]); }
  // Lightning masts.
  for (const [x, z, p] of [[-1.42, .78, 0], [.42, -1.62, 1.5]] as const) { add(g, cyl(.02, .045, 4.7, 8), 'metal:#9aa1a6', [x, y0 + 2.35, z]); blinkLight(g, [x, y0 + 4.73, z], p, .03); }
  return g;
}

/** Lifting-body shuttle with delta wings and twin engines, nose to +z. */
function shuttle(parent: THREE.Object3D, at: V3, rotY = 0, glow: THREE.Material = M.cyan) {
  const s = new THREE.Group(); s.position.set(...at); s.rotation.y = rotY; parent.add(s);
  const body = new THREE.CapsuleGeometry(.15, .5, 6, 20); body.rotateX(Math.PI / 2); body.scale(1.25, .72, 1);
  add(s, body, titanium);
  const canopy = new THREE.SphereGeometry(.1, 20, 12); canopy.scale(1, .55, 1.7); add(s, canopy, M.darkGlass, [0, .07, .2]);
  for (const side of [-1, 1]) {
    add(s, prism([[.1 * side, -.18], [.56 * side, .2], [.56 * side, .32], [.1 * side, .32]], .03), titanium, [0, -.03, 0], [-Math.PI / 2, 0, 0]);
    add(s, prism([[.56 * side, .2], [.6 * side, .22], [.6 * side, .33], [.56 * side, .32]], .032), orange, [0, -.03, 0], [-Math.PI / 2, 0, 0]);
    add(s, prism([[0, 0], [.16, .02], [.2, .2], [.08, .2]], .02), titanium, [side * .12, .04, -.22], [0, Math.PI / 2, side * .35]);
    add(s, cyl(.055, .07, .1, 16), carbon, [side * .09, -.01, -.42], [Math.PI / 2, 0, 0]);
    add(s, cyl(.05, .05, .01, 16), glow, [side * .09, -.01, -.475], [Math.PI / 2, 0, 0]);
    halo(s, sph(.08, 12, 8), '#ffb066', [side * .09, -.01, -.5]);
  }
  for (const [x, z] of [[-.12, .15], [.12, .15], [0, -.25]]) rod(s, vec(x, -.08, z), vec(x * 1.2, -.17, z), .012, carbon, 6);
  return s;
}

/**
 * Spaceport: a lens-roofed terminal over a smoked-glass hall, a control tower with a floating halo, two hexagonal
 * pads — one with a shuttle hovering in its landing beam — cargo containers, a loader and a beacon.
 */
export function spaceport() {
  const g = new THREE.Group(), y0 = .06, tx = -.1, tz = -1.0;
  deck(g, 2.1);
  const drum = new THREE.CylinderGeometry(1, 1, .34, 56); drum.scale(1.12, 1, .5); add(g, drum, M.darkGlass, [tx, y0 + .17, tz]);
  const roof = new THREE.SphereGeometry(1, 56, 14, 0, Math.PI * 2, 0, Math.PI / 2); roof.scale(1.24, .34, .6); add(g, roof, titanium, [tx, y0 + .32, tz]);
  const band = new THREE.TorusGeometry(1, .022, 6, 72); band.rotateX(Math.PI / 2); band.scale(1.13, 1, .51); add(g, band, M.cyan, [tx, y0 + .31, tz]);
  const stripe = new THREE.TorusGeometry(1, .02, 6, 72); stripe.rotateX(Math.PI / 2); stripe.scale(1.24, 1, .6); add(g, stripe, orange, [tx, y0 + .33, tz]);
  for (let i = 0; i < 5; i++) add(g, rbox(.02, .3, .02, .006), titanium, [tx - .9 + i * .45, y0 + .17, tz + Math.sqrt(Math.max(0, 1 - ((-.9 + i * .45) / 1.12) ** 2)) * .5 + .005]);
  holoPanel(g, [tx + .2, y0 + .62, tz + .6], .56, .2, 0, '#ffb066');
  // Control tower with a floating halo.
  const cx = 1.28, cz = -.78;
  add(g, lathe([[.17, 0], [.13, .3], [.09, 1.5], [.11, 1.72], [.001, 1.72]], 28), titanium, [cx, y0, cz]);
  add(g, lathe([[.1, 0], [.25, .1], [.27, .24], [.19, .34], [.001, .36]], 32), M.darkGlass, [cx, y0 + 1.66, cz]);
  add(g, cyl(.275, .275, .025, 32), orange, [cx, y0 + 1.83, cz]);
  rod(g, vec(cx, y0 + 2.0, cz), vec(cx, y0 + 2.45, cz), .012, 'metal:#9aa1a6', 6); blinkLight(g, [cx, y0 + 2.47, cz], 0, .03, M.amber);
  const crown = animated(g, { type: 'spin', axis: 'y', speed: .8, always: true }, [cx, y0 + 2.2, cz]);
  add(crown, new THREE.TorusGeometry(.32, .016, 6, 40), M.cyan, [0, 0, 0], [Math.PI / 2 + .25, 0, 0]);
  halo(crown, new THREE.TorusGeometry(.32, .05, 8, 40), '#5fe0ff', [0, 0, 0], [Math.PI / 2 + .25, 0, 0]);
  // Pads: a shuttle hovering in its beam, and one parked for loading.
  const a: V3 = [-.78, y0, .62], b: V3 = [.72, y0, .72];
  hexPad(g, a, .58); hexPad(g, b, .58, M.amber);
  beam(g, [a[0], a[1] + .1, a[2]], .32, .2, .62, '#7fe6ff');
  const hover = animated(g, { type: 'bob', axis: 'y', speed: 1.3, amount: .05, always: true }, [a[0], y0 + .78, a[2]]);
  shuttle(hover, [0, 0, 0], .4);
  shuttle(g, [b[0], y0 + .29, b[2]], -2.6, M.amber);
  add(g, rbox(.16, .02, .3, .01), titanium, [b[0] + .15, y0 + .2, b[2] + .3], [.5, -2.6, 0]);
  // Cargo, a loader and a beacon.
  container(g, [1.42, y0, .02], '#d8dcdf', .3); container(g, [1.36, y0, .3], signal, .3); container(g, [1.4, y0 + .2, .15], '#4f86b8', .3);
  const loader = new THREE.Group(); loader.position.set(1.0, y0, 1.32); loader.rotation.y = -.8; g.add(loader);
  add(loader, rbox(.22, .1, .3, .04), titanium, [0, .09, 0]); add(loader, rbox(.18, .02, .2, .005), M.cyan, [0, .145, 0]);
  for (const s of [-1, 1]) for (const z of [-.1, .1]) add(loader, cyl(.04, .04, .03, 12), dark, [s * .11, .04, z], [0, 0, Math.PI / 2]);
  add(g, rbox(.08, 1.3, .08, .02), titanium, [-1.55, y0 + .65, -.25]);
  blinkLight(g, [-1.55, y0 + 1.34, -.25], 1, .035, M.amber);
  ring(g, [-1.55, y0 + 1.0, -.25], .12, .01, M.cyan, 24);
  return g;
}

/**
 * Orbital elevator: a hexagonal anchor platform with three curving buttresses gathered into a collar, a spinning
 * energy ring, the tether climbing past the clouds with two climbers, and the ring station turning in orbit.
 */
export function elevator() {
  const g = new THREE.Group(), y0 = .06;
  deck(g, 1.62);
  add(g, cyl(1.12, 1.18, .28, 6), titanium, [0, y0 + .14, 0]);
  ring(g, [0, y0 + .285, 0], 1.0, .016, M.cyan, 6);
  add(g, cyl(.78, .86, .24, 6), titanium, [0, y0 + .4, 0]);
  add(g, cyl(.8, .8, .03, 6), orange, [0, y0 + .5, 0]);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(g, rbox(.24, .16, .04, .01), M.darkGlass, [Math.sin(a) * .96, y0 + .14, Math.cos(a) * .96], [0, a, 0]); }
  // Buttresses gathering into the collar.
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + Math.PI / 6, out = vec(Math.sin(a), 0, Math.cos(a));
    const curve = new THREE.QuadraticBezierCurve3(out.clone().multiplyScalar(.82).setY(y0 + .5), out.clone().multiplyScalar(.85).setY(y0 + 1.7), out.clone().multiplyScalar(.2).setY(y0 + 2.3));
    add(g, new THREE.TubeGeometry(curve, 24, .085, 10), titanium);
    for (const t of [.3, .55, .8]) { const p = curve.getPoint(t), band = add(g, new THREE.TorusGeometry(.092, .018, 6, 16), orange, p.toArray() as V3); band.quaternion.setFromUnitVectors(vec(0, 0, 1), curve.getTangent(t)); }
    lightStrip(g, out.clone().multiplyScalar(.82).setY(y0 + .56).toArray() as V3, .05, .02, .05);
  }
  add(g, cyl(.24, .3, .5, 28), titanium, [0, y0 + 2.45, 0]);
  add(g, cyl(.305, .305, .04, 28), orange, [0, y0 + 2.25, 0]);
  add(g, new THREE.ConeGeometry(.24, .2, 28), titanium, [0, y0 + 2.8, 0]);
  const energy = animated(g, { type: 'spin', axis: 'y', speed: 1.1, always: true }, [0, y0 + 2.4, 0]);
  add(energy, new THREE.TorusGeometry(.5, .022, 8, 56), M.cyan, [0, 0, 0], [Math.PI / 2, 0, 0]);
  halo(energy, new THREE.TorusGeometry(.5, .07, 8, 56), '#4fd9ff', [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; add(energy, sph(.04, 10, 8), M.cyan, [Math.sin(a) * .5, 0, Math.cos(a) * .5]); }
  energy.userData.noShadow = true;
  // Tether, climbers and the station.
  const tether = add(g, cyl(.024, .024, 9.0, 6), 'metal:#8a949a', [0, y0 + 2.9 + 4.5, 0]); tether.castShadow = false; tether.userData.separate = true;
  const glow = add(g, cyl(.01, .01, 9.0, 4), M.cyan, [.03, y0 + 2.9 + 4.5, 0]); glow.castShadow = false; glow.userData.separate = true;
  [0, Math.PI].forEach(phase => {
    const climber = animated(g, { type: 'slide', axis: 'y', speed: .2, amount: 8.2, phase, always: true }, [0, y0 + 3.0, 0]);
    add(climber, new THREE.CapsuleGeometry(.12, .2, 4, 16), titanium);
    add(climber, cyl(.125, .125, .03, 20), M.cyan);
    for (const s of [-1, 1]) add(climber, sph(.02, 6, 4), M.amber, [s * .12, .12, 0]);
    climber.userData.noShadow = true;
  });
  const station = animated(g, { type: 'spin', axis: 'y', speed: .18, always: true }, [0, 11.8, 0]);
  add(station, new THREE.TorusGeometry(.78, .1, 12, 48), titanium, [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(station, new THREE.TorusGeometry(.78, .03, 6, 48), M.cyan, [0, .085, 0], [Math.PI / 2, 0, 0]);
  add(station, cyl(.2, .2, .55, 20), titanium);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; rod(station, vec(0, 0, 0), vec(Math.cos(a) * .72, 0, Math.sin(a) * .72), .03, 'metal:#c9ced0', 6); }
  for (const s of [-1, 1]) { add(station, rbox(.95, .02, .34, .005), M.solar, [s * 1.45, 0, 0]); rod(station, vec(s * .8, 0, 0), vec(s * .98, 0, 0), .02, 'metal:#c9ced0', 6); }
  station.userData.noShadow = true;
  // Cargo at the foot.
  container(g, [1.18, y0, .62], signal, -.5); container(g, [1.0, y0, .9], '#d8dcdf', -.5); container(g, [-1.15, y0, .7], '#4f86b8', .5);
  stripes(g, [0, y0 + .003, 1.32], 1.0, .1);
  return g;
}

/**
 * Deep-space array: a giant dish on a turning yoke, its feed horn throwing a beam into the sky, four smaller dishes
 * listening alongside, and an operations hall with a holographic star chart.
 */
export function deepradar() {
  const g = new THREE.Group(), y0 = .06, R = 1.12, tilt = -.75;
  deck(g, 1.8);
  add(g, new THREE.TorusGeometry(.66, .03, 6, 56), carbon, [0, y0 + .02, -.2], [Math.PI / 2, 0, 0]);
  add(g, cyl(.5, .58, .22, 6), titanium, [0, y0 + .11, -.2]);
  const mount = animated(g, { type: 'spin', axis: 'y', speed: .12, always: true }, [0, y0 + .22, -.2]);
  add(mount, cyl(.46, .46, .1, 28), carbon, [0, .05, 0]);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; add(mount, rbox(.12, .1, .16, .02), orange, [Math.sin(a) * .5, .02, Math.cos(a) * .5], [0, a, 0]); }
  for (const s of [-1, 1]) {
    add(mount, prism([[-.22, 0], [.22, 0], [.07, .84], [-.07, .84]], .1), titanium, [s * .42, .1, 0], [0, Math.PI / 2, 0]);
    add(mount, cyl(.08, .08, .14, 16), carbon, [s * .42, .92, 0], [0, 0, Math.PI / 2]);
  }
  const head = new THREE.Group(); head.position.y = .92; head.rotation.x = tilt; mount.add(head);
  add(head, cyl(.06, .06, .96, 12), carbon, [0, 0, 0], [0, 0, Math.PI / 2]);
  add(head, cyl(.24, .32, .3, 20), titanium, [0, 0, .02], [Math.PI / 2, 0, 0]);
  dish(head, [0, 0, .16], R, [0, 0, 0], 'metal:#eef1f2');
  for (const f of [.42, .72, .98]) add(head, new THREE.TorusGeometry(R * f, .008, 4, 64), 'metal:#c5ccd0', [0, 0, .16 + (R * f) ** 2 / (R * 2.4) + .004]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rod(head, vec(Math.cos(a) * .2, Math.sin(a) * .2, .06), vec(Math.cos(a) * R * .96, Math.sin(a) * R * .96, .16 + R * .96 * R * .96 / (R * 2.4) - .03), .022, 'metal:#aab3b8', 6); }
  const focus = .16 + R * .78;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; rod(head, vec(Math.cos(a) * R * .9, Math.sin(a) * R * .9, .16 + (R * .9) ** 2 / (R * 2.4)), vec(Math.cos(a) * .06, Math.sin(a) * .06, focus), .014, 'metal:#c5ccd0', 6); }
  add(head, cyl(.13, .1, .05, 24), titanium, [0, 0, focus + .03], [Math.PI / 2, 0, 0]);
  add(head, cyl(.05, .07, .14, 16), carbon, [0, 0, focus - .06], [Math.PI / 2, 0, 0]);
  add(head, sph(.045, 12, 8), M.cyan, [0, 0, focus - .14]);
  const shaft = beam(head, [0, 0, focus + .05], .05, .55, 5.5, '#8fe9ff'); shaft.rotation.x = Math.PI / 2; shaft.position.set(0, 0, focus + .05 + 2.75);
  // Array dishes, the operations hall and the star chart.
  for (const [x, z] of [[-1.3, .55], [-1.22, -.92], [1.3, -.85], [1.42, .2]] as const) {
    add(g, cyl(.06, .1, .42, 12), titanium, [x, y0 + .21, z]);
    dish(g, [x, y0 + .48, z], .26, [tilt - .2, -.35, 0], 'metal:#e8ebec');
    ring(g, [x, y0 + .005, z], .16, .008, M.cyan, 24);
  }
  const hall = new THREE.Group(); hall.position.set(.62, y0, 1.12); hall.rotation.y = -.45; g.add(hall);
  add(hall, rbox(.8, .34, .44, .1), titanium, [0, .17, 0]);
  add(hall, rbox(.82, .08, .46, .04), M.darkGlass, [0, .2, 0]);
  add(hall, bx(.82, .015, .46), orange, [0, .3, 0]);
  const chart = animated(g, { type: 'spin', axis: 'y', speed: .5, always: true }, [-.55, y0 + .62, 1.1]);
  halo(chart, sph(.2, 20, 14), '#7fe6ff');
  add(chart, new THREE.TorusGeometry(.26, .006, 4, 40), M.cyan, [0, 0, 0], [Math.PI / 2 + .4, 0, 0]);
  for (let i = 0; i < 9; i++) add(chart, sph(.012, 6, 4), i % 3 ? M.cyan : M.amber, [Math.cos(i * 2.4) * .15, Math.sin(i * 1.7) * .12, Math.sin(i * 2.4) * .15]);
  add(g, cyl(.14, .16, .1, 24), titanium, [-.55, y0 + .05, 1.1]); ring(g, [-.55, y0 + .105, 1.1], .1, .01, M.cyan, 24);
  return g;
}

/**
 * Starship yard: a hull half plated in titanium on a lit slipway, its open frame showing orange ribs, held by three
 * hovering anti-gravity cradles; welding arms throw sparks under a gantry whose trolley carries the next plate.
 */
export function shipyard() {
  const g = new THREE.Group(), y0 = .06;
  deck(g, 2.08);
  add(g, rbox(1.2, .1, 3.2, .03), carbon, [0, y0 + .05, -.05]);
  for (const s of [-1, 1]) lightStrip(g, [s * .55, y0 + .102, -.05], .02, .008, 3.1);
  for (const z of [-.9, .0, .9]) add(g, rbox(.5, .06, .1, .02), titanium, [0, y0 + .13, z]);
  // The ship: plated bow, open stern frame, wings and engines.
  const ship = new THREE.Group(); ship.position.set(0, y0 + .72, 1.32); g.add(ship);
  const profile: [number, number][] = [[.001, 0], [.1, .12], [.22, .38], [.32, .72], [.38, 1.1], [.4, 1.3]];
  const bow = lathe(profile, 40); bow.rotateX(-Math.PI / 2); add(ship, bow, titanium);
  add(ship, rbox(.22, .05, .3, .02), M.darkGlass, [0, .24, -.5], [-.22, 0, 0]);
  for (const s of [-1, 1]) add(ship, rbox(.02, .05, .5, .01), orange, [s * .3, .05, -.9], [0, s * .08, 0]);
  add(ship, cyl(.26, .26, 1.2, 28), carbon, [0, 0, -1.9], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) add(ship, new THREE.TorusGeometry(.4 - i * .012, .025, 6, 36), orange, [0, 0, -1.36 - i * .2]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; add(ship, rbox(.03, .03, 1.2, .01), orange, [Math.cos(a) * .37, Math.sin(a) * .37, -1.9]); }
  add(ship, cyl(.36, .3, .16, 28), titanium, [0, 0, -2.52], [Math.PI / 2, 0, 0]);
  for (const [x, y] of [[0, .12], [-.14, -.08], [.14, -.08]]) {
    add(ship, cyl(.09, .12, .16, 18), dark, [x, y, -2.66], [Math.PI / 2, 0, 0]);
    add(ship, cyl(.085, .085, .01, 18), M.cyan, [x, y, -2.745], [Math.PI / 2, 0, 0]);
    halo(ship, sph(.12, 14, 10), '#66dfff', [x, y, -2.78]);
  }
  for (const s of [-1, 1]) {
    add(ship, prism([[s * .34, -1.3], [s * .95, -2.1], [s * .95, -2.35], [s * .34, -2.4]].map(([x, z]) => [x, -z] as [number, number]), .035), titanium, [0, -.08, 0], [-Math.PI / 2, 0, 0]);
    add(ship, rbox(.03, .05, 1.1, .01), orange, [s * .64, -.06, -1.86], [0, s * .62, 0]);
  }
  // Anti-gravity cradles.
  for (const [i, z] of [-.15, -.95, -1.75].entries()) {
    const cradle = animated(ship, { type: 'bob', axis: 'y', speed: 1.2, amount: .025, phase: i * 1.3, always: true }, [0, 0, z]);
    add(cradle, new THREE.TorusGeometry(.56, .05, 10, 48), titanium);
    add(cradle, new THREE.TorusGeometry(.5, .014, 6, 48), M.cyan);
    halo(cradle, new THREE.TorusGeometry(.5, .05, 8, 48), '#5fdcff');
  }
  // Gantry with a travelling trolley carrying the next plate.
  for (const s of [-1, 1]) {
    add(g, rbox(.22, 2.3, .22, .03), carbon, [s * 1.05, y0 + 1.15, -.55]);
    for (let k = 0; k < 4; k++) add(g, bx(.225, .06, .225), orange, [s * 1.05, y0 + .4 + k * .5, -.55]);
    add(g, rbox(.4, .08, .4, .02), carbon, [s * 1.05, y0 + .04, -.55]);
  }
  add(g, rbox(2.36, .16, .24, .03), carbon, [0, y0 + 2.36, -.55]);
  stripes(g, [0, y0 + 2.36, -.42], 2.0, .06, 0, signal, '#2a2d31', 14).rotation.x = Math.PI / 2;
  const trolley = animated(g, { type: 'slide', axis: 'x', speed: .3, amount: 1.2, always: true }, [-.6, y0 + 2.24, -.55]);
  add(trolley, rbox(.26, .1, .3, .02), orange);
  rod(trolley, vec(0, -.05, 0), vec(0, -.92, 0), .007, '#2a2b2b', 4);
  add(trolley, rbox(.4, .03, .3, .01), titanium, [0, -.95, 0], [.15, 0, 0]);
  // Welding arms and their sparks.
  for (const [s, phase] of [[-1, 0], [1, 2.2]] as const) {
    robotArm(g, [s * .82, y0, .35], phase, 'hull:#e1e5e8', carbon, M.amber, 1.05);
    const spark = animated(g, { type: 'blink', speed: 6.5, phase: s, always: true }, [s * .38, y0 + .62, .2]);
    add(spark, sph(.03, 6, 5), M.lamp).castShadow = false; halo(spark, sph(.08, 10, 8), '#ffc98a');
  }
  container(g, [1.4, y0, 1.0], signal, -.6); container(g, [1.2, y0, 1.32], '#d8dcdf', -.6); container(g, [1.32, y0 + .2, 1.15], '#4f86b8', -.6);
  holoPanel(g, [-1.3, y0 + .65, .9], .44, .26, .6, '#ffb066');
  rod(g, vec(-1.3, y0, .9), vec(-1.3, y0 + .5, .9), .012, carbon, 6);
  stripes(g, [0, y0 + .103, -1.58], 1.1, .1);
  return g;
}
