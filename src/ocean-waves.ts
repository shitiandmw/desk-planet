import * as THREE from 'three';

/**
 * Wind waves on the open sea: two dozen directional waves from a swell of a unit down to chop of 3.5 cm, four or five
 * to an octave, each running its own way at the speed of a deep-water wave of its length (short waves are slower),
 * with the sharp crests and broad troughs of real wind waves (exp(sin x − 1)). With several waves of every size
 * crossing at wide angles, no single one shows: the sea never lines up into the parallel bands (or, seen from afar,
 * the grid in the sun's glint) a few sines make. Directions spread over all of space; wherever a wave would run
 * straight up the planet's surface (around the two points where its direction meets the sphere head on) it fades out
 * instead of drawing a bullseye.
 */
export const OCEAN_WAVE_COUNT = 24;
/** Waves long enough for the sea mesh (vertices 0.2 units apart) to follow; the rest only bend the normal. */
export const OCEAN_VERTEX_WAVES = 2;
/** The swell: waves of more than about two thirds of a unit, which flatten out over the shallows. */
export const OCEAN_SWELL_WAVES = 4;
/** Deep-water dispersion ω² = g k, in planet units and seconds: the longest waves pass every 5 s. */
export const OCEAN_GRAVITY = .3;
/** Mean of the wave shape exp(sin x − 1), e⁻¹ I₀(1): subtracted, so the waves leave the mean sea level in place. */
export const WAVE_SHAPE_MEAN = .4657596;
/** Mean square of the shape's derivative: the slope variance a wave of unit steepness (amplitude × k) adds. */
export const WAVE_SLOPE_VARIANCE = .1076346;
/** Average share of a wave that runs along the surface (1 − cos² over all directions). */
const MEAN_ALONG = 2 / 3;

export interface OceanWave { direction: [number, number, number]; k: number; amplitude: number; omega: number; phase: number }

// The directions: a Fibonacci spiral over a hemisphere (a direction and its opposite draw the same crests), turned
// off the planet's axes and visited in a scrambled order, so waves of neighbouring lengths cross at wide angles.
const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(.83, .41, -.57));
export const OCEAN_WAVES: OceanWave[] = Array.from({ length: OCEAN_WAVE_COUNT }, (_, i) => {
  const j = (i * 7) % OCEAN_WAVE_COUNT, z = 1 - (j + .5) / OCEAN_WAVE_COUNT, r = Math.sqrt(1 - z * z), turn = j * 2.39996323;
  const direction = new THREE.Vector3(r * Math.cos(turn), z, r * Math.sin(turn)).applyQuaternion(tilt).toArray();
  // Nearly equal steepness at every length (the saturated range of a wind sea); the longest waves are gentler, so
  // from afar, where only they are drawn, the sea stays calm.
  const k = 6 * 1.16 ** i, steepness = .075 * .985 ** i * Math.min(1, .4 + .15 * i);
  return { direction, k, amplitude: steepness / k, omega: Math.sqrt(OCEAN_GRAVITY * k), phase: (i * .618034 % 1) * Math.PI * 2 };
});

/** Height of the sea mesh above the mean sea level at `p` (planet space) and time `t`; mirrored in GLSL below. */
export function oceanSwellHeight(p: THREE.Vector3, t: number) {
  const up = p.clone().normalize();
  let height = 0;
  for (const wave of OCEAN_WAVES.slice(0, OCEAN_VERTEX_WAVES)) {
    const d = new THREE.Vector3(...wave.direction), dn = d.dot(up), x = p.dot(d) * wave.k - t * wave.omega + wave.phase;
    height += wave.amplitude * (1 - dn * dn) * (Math.exp(Math.sin(x) - 1) - WAVE_SHAPE_MEAN);
  }
  return height;
}

const f = (n: number) => { const s = n.toPrecision(7); return /[.e]/.test(s) ? s : `${s}.0`; };
const vec4s = (rows: number[][]) => rows.map(r => `vec4(${r.map(f).join(', ')})`).join(',\n  ');
// Slope variance of each wave and all shorter ones, for the roughness once a pixel can no longer resolve them.
const tail = OCEAN_WAVES.map((_, i) => OCEAN_WAVES.slice(i).reduce((sum, w) => sum + (w.amplitude * w.k) ** 2 * WAVE_SLOPE_VARIANCE * MEAN_ALONG, 0));

/**
 * The waves in GLSL; needs `uOceanTime` and `uRain`. Positions and directions are in planet space, `up` is the unit
 * radial direction at the point.
 */
export const oceanWavesGLSL = `
uniform float uOceanTime;
uniform float uRain;
#define OCEAN_WAVE_COUNT ${OCEAN_WAVE_COUNT}
#define OCEAN_VERTEX_WAVES ${OCEAN_VERTEX_WAVES}
#define OCEAN_SWELL_WAVES ${OCEAN_SWELL_WAVES}
#define WAVE_SHAPE_MEAN ${f(WAVE_SHAPE_MEAN)}
#define WAVE_SLOPE_VARIANCE ${f(WAVE_SLOPE_VARIANCE)}
// Direction and wavenumber.
const vec4 OCEAN_WAVE[${OCEAN_WAVE_COUNT}] = vec4[${OCEAN_WAVE_COUNT}](
  ${vec4s(OCEAN_WAVES.map(w => [...w.direction, w.k]))});
// Amplitude, angular speed, phase, and the slope variance of this wave and all shorter ones.
const vec4 OCEAN_WAVE_MOTION[${OCEAN_WAVE_COUNT}] = vec4[${OCEAN_WAVE_COUNT}](
  ${vec4s(OCEAN_WAVES.map((w, i) => [w.amplitude, w.omega, w.phase, tail[i]]))});
float oceanSwellHeight(vec3 p, vec3 up) {
  float height = 0.;
  for (int i = 0; i < OCEAN_VERTEX_WAVES; i++) {
    vec4 wave = OCEAN_WAVE[i], motion = OCEAN_WAVE_MOTION[i];
    float dn = dot(wave.xyz, up), x = dot(p, wave.xyz) * wave.w - uOceanTime * motion.y + motion.z;
    height += motion.x * (1. - dn * dn) * (exp(sin(x) - 1.) - WAVE_SHAPE_MEAN);
  }
  return height * (1. + uRain * .65);
}
// Surface gradient of the waves a pixel of this footprint (planet units) resolves. A wave fades out once a pixel spans
// a fifth of its length; from there on its slopes only roughen the surface: their variance goes to unresolved.
// scale sets the strength of the swell (x) and of the shorter chop (y).
vec3 oceanSlope(vec3 p, vec3 up, float footprint, vec2 scale, out float unresolved) {
  vec3 slope = vec3(0.);
  unresolved = 0.;
  for (int i = 0; i < OCEAN_WAVE_COUNT; i++) {
    vec4 wave = OCEAN_WAVE[i], motion = OCEAN_WAVE_MOTION[i];
    float strength = i < OCEAN_SWELL_WAVES ? scale.x : scale.y;
    float resolved = 1. - smoothstep(.06, .2, footprint * wave.w * .1591549);
    if (resolved <= 0.) { unresolved += motion.w * scale.y * scale.y; break; }
    float dn = dot(wave.xyz, up), steep = motion.x * wave.w * (1. - dn * dn) * strength;
    float x = dot(p, wave.xyz) * wave.w - uOceanTime * motion.y + motion.z;
    slope += wave.xyz * (steep * cos(x) * exp(sin(x) - 1.) * resolved);
    unresolved += steep * steep * WAVE_SLOPE_VARIANCE * (1. - resolved * resolved);
  }
  return slope;
}
`;
