import * as THREE from 'three';
import { FIELD_ANCHORS, MIN_ELEVATION } from './planet-surface';

/**
 * The land field and elevation written once in a GLSL/JS-compatible subset, so shaders can shade coastlines
 * per pixel. `evaluatePlanetField` runs the same expressions in JS; tests compare it with planet-surface.ts.
 */
type Line = [name: string, expression: string];
const FIELD: Line[] = [
  ['broad', '.045 * sin(n.x * 13. + n.z * 7.) * cos(n.y * 11. - n.z * 6.)'],
  ['fine', '.018 * sin(n.x * 31. + n.y * 17.) * cos(n.z * 27. - n.x * 9.)'],
  ['mainLand', 'n.y - .46 - .52 * exp((dot(n, PLANET_BAY) - 1.) / .045)'],
  ['rear', 'dot(n, PLANET_BACK) - .73 + .055 * sin(n.x * 7. - n.y * 5.) - .26 * exp((dot(n, PLANET_BACK_BAY) - 1.) / .018)'],
  ['western', 'dot(n, PLANET_WEST) - .81 + .05 * sin(n.y * 9. + n.z * 6.)'],
];
const FIELD_RESULT = 'max(mainLand, max(rear, western)) + broad + fine';
const ELEVATION: Line[] = [
  ['rise', '.055 * (1. - exp(-field * 30.)) + field * .32'],
  ['mountain', 'exp((dot(n, PLANET_RIDGE) - 1.) / .016) * .66'],
  ['backRidge', 'exp((dot(n, PLANET_BACK) - 1.) / .035) * .28'],
  ['grain', '.003 * sin(n.x * 46. + n.z * 18.) * sin(n.y * 39. - n.z * 25.)'],
];
const ELEVATION_RESULT = 'rise + (mountain + backRidge + grain) * smoothstep(0., .08, field)';
const ANCHORS = { PLANET_BAY: FIELD_ANCHORS.bay, PLANET_BACK: FIELD_ANCHORS.back, PLANET_BACK_BAY: FIELD_ANCHORS.backBay, PLANET_WEST: FIELD_ANCHORS.west, PLANET_RIDGE: FIELD_ANCHORS.ridge };
const glslVec = (v: THREE.Vector3) => `vec3(${v.x.toFixed(8)}, ${v.y.toFixed(8)}, ${v.z.toFixed(8)})`;
const floatLiteral = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** Value noise shared by the field bake and the water's caustics. */
export const planetNoiseGLSL = `
float planetHash(vec3 p) { p = fract(p * .3183099 + vec3(.1, .3, .7)); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float planetNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(planetHash(i), planetHash(i + vec3(1, 0, 0)), f.x), mix(planetHash(i + vec3(0, 1, 0)), planetHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(planetHash(i + vec3(0, 0, 1)), planetHash(i + vec3(1, 0, 1)), f.x), mix(planetHash(i + vec3(0, 1, 1)), planetHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float planetFbm(vec3 p) { return planetNoise(p) * .55 + planetNoise(p * 2.03 + 7.1) * .3 + planetNoise(p * 4.1 + 3.7) * .15; }
`;

export const planetFieldGLSL = `
${Object.entries(ANCHORS).map(([name, v]) => `const vec3 ${name} = ${glslVec(v)};`).join('\n')}
float planetLandField(vec3 n) {
${FIELD.map(([name, e]) => `  float ${name} = ${e};`).join('\n')}
  return ${FIELD_RESULT};
}
float planetElevation(vec3 n) {
  float field = planetLandField(n);
  if (field < 0.) return max(${floatLiteral(MIN_ELEVATION)}, field * 5.);
${ELEVATION.map(([name, e]) => `  float ${name} = ${e};`).join('\n')}
  return ${ELEVATION_RESULT};
}
${planetNoiseGLSL}`;

type V = { x: number; y: number; z: number };
const js = (lines: Line[], result: string) => lines.map(([name, e]) => `const ${name} = ${e};`).join('\n') + `\nreturn ${result};`;
const helpers = {
  sin: Math.sin, cos: Math.cos, exp: Math.exp, max: Math.max,
  dot: (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z,
  smoothstep: (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); },
};
const names = ['n', ...Object.keys(ANCHORS), ...Object.keys(helpers)];
const fieldFn = new Function(...names, js(FIELD, FIELD_RESULT)) as (...args: unknown[]) => number;
const elevationFn = new Function(...names, 'field', js(ELEVATION, ELEVATION_RESULT)) as (...args: unknown[]) => number;
/** JS evaluation of the shader expressions; only used to prove the GLSL mirror matches the authoritative field. */
export function evaluatePlanetField(n: THREE.Vector3) {
  const args = [n, ...Object.values(ANCHORS), ...Object.values(helpers)];
  const field = fieldFn(...args);
  const elevation = field < 0 ? Math.max(MIN_ELEVATION, field * 5) : elevationFn(...args, field);
  return { field, elevation };
}
