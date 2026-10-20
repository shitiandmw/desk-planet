import * as THREE from 'three';
import { vec } from './craft';
import type { BuildingType } from './game-data';
import { M, add, animated, barrel, bush, chimney, crate, cyl, doorAt, framedWalls, gableRoof, lampPost, lathe, pad, plinth, rbox, roofHeight, roundPad, sack, sph, timber, windowAt, type V3 } from './building-kit';
import { depot, factory, power, tenement } from './era-industrial';
import { apartment, chipfab, lab, telecom, windfarm } from './era-information';
import { autofactory, datacenter, ecotower, fusion, robotics } from './era-intelligence';
import { deepradar, elevator, launchpad, shipyard, spaceport } from './era-interstellar';

/**
 * Facilities for the later stages of the development plan, registered by building type. The farming village stays in
 * the founding settlement's timber, plaster and tile; each later era lives in its own module with its own materials:
 * industry in brick, iron and steam, information in glass and screens, intelligence in white composite and light,
 * the interstellar age in titanium, hex decks and energy.
 */
function stripedAwning(g: THREE.Object3D, at: V3, rotY: number, color: string, w = .82) {
  const a = new THREE.Group(); a.position.set(...at); a.rotation.y = rotY; g.add(a);
  for (let i = 0; i < 6; i++) add(a, rbox(w / 6 + .005, .025, .58, .008), i % 2 ? '#f5efe2' : color, [-w / 2 + (i + .5) * w / 6, 0, 0], [.32, 0, 0]);
  for (let i = 0; i < 6; i++) add(a, rbox(w / 6, .09, .02, .008), i % 2 ? '#f5efe2' : color, [-w / 2 + (i + .5) * w / 6, -.13, .28]);
  return a;
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
