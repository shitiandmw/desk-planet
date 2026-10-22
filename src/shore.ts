/**
 * Shore waves shared by the water and the beach. Swells shoal toward the coast, slowing as the water gets shallow;
 * inside the break depth each crest is a bore of white water, and when it reaches the waterline it runs up the sand
 * as a thin sheet, drains back and leaves wet sand. Both shaders evaluate the same phase, so the bore arrives at
 * the waterline exactly when the run-up begins. The baked meadow channel offsets the timing along the coast, so
 * waves peel along a beach instead of arriving everywhere at once.
 * Units: sea depth below the waterline (0..1.4) offshore, the land field (0 at the waterline) on the beach.
 */
export const SHORE_PERIOD = 7.5;
export const SHORE_BREAK_DEPTH = .04;
/** Highest run-up of the swash, in land-field units (about 0.05 planet units up a typical beach). */
export const SHORE_SWASH_MAX = .0065;
/** Seconds of the period, as fractions: the sheet runs up, drains, then the sand lies bare until the next bore. */
export const SWASH_UP = .3, SWASH_DOWN_END = .88;
/** Water extinction per unit of path (red, green, blue): red goes first, so shallow water over sand turns turquoise. */
export const WATER_EXTINCTION: [number, number, number] = [6, 1.15, .52];

/** Wave phase at `depth` below the waterline; integers are crests. `along` is the baked meadow value there. */
export function shorePhase(time: number, depth: number, along: number) {
  return time / SHORE_PERIOD + .42 * Math.sqrt(Math.max(depth, 0) / SHORE_BREAK_DEPTH) + along * 3;
}
/** Run-up at swash phase `tau` (0..1) as a fraction of the wave's reach: decelerating uprush, accelerating backwash. */
export function swashProfile(tau: number) {
  if (tau < SWASH_UP) return Math.sin(Math.PI / 2 * tau / SWASH_UP);
  return Math.cos(Math.PI / 2 * Math.min(1, (tau - SWASH_UP) / (SWASH_DOWN_END - SWASH_UP)));
}
/** Waves come in sets: each crest has its own size. */
export function shoreSet(wave: number) { return .72 + .28 * Math.sin(wave * 2.39996 + 1.3); }

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
/**
 * GLSL mirror of the functions above plus the shared looks. Requires `uOceanTime`, `uRain` and the detail volume
 * (`detailVolumeGLSL`) to be declared first.
 */
export const shoreGLSL = `
#define SHORE_PERIOD ${f(SHORE_PERIOD)}
#define SHORE_BREAK_DEPTH ${f(SHORE_BREAK_DEPTH)}
#define SHORE_SWASH_MAX ${f(SHORE_SWASH_MAX)}
const vec3 WATER_EXTINCTION = vec3(${WATER_EXTINCTION.map(f).join(', ')});
float shorePhase(float depth, float along) {
  return uOceanTime / SHORE_PERIOD + .42 * sqrt(max(depth, 0.) / SHORE_BREAK_DEPTH) + along * 3.;
}
float swashProfile(float tau) {
  return tau < ${f(SWASH_UP)} ? sin(1.5707963 * tau / ${f(SWASH_UP)}) : cos(1.5707963 * min(1., (tau - ${f(SWASH_UP)}) / ${f(SWASH_DOWN_END - SWASH_UP)}));
}
float shoreSet(float wave) { return .72 + .28 * sin(wave * 2.39996 + 1.3); }
// Length of the light path per unit of water depth: down to the bed and back up along the refracted view ray.
float shorePath(vec3 viewPosition, vec3 normal) {
  float muV = clamp(dot(normalize(viewPosition), normalize(normal)), .05, 1.);
  return 1. + 1. / sqrt(1. - (1. - muV * muV) * .5625);
}
// Sand turns darker and slightly more saturated when wet; the water and the beach both use this at the waterline.
vec3 shoreWetSand(vec3 sand) {
  vec3 dark = sand * .62;
  return mix(vec3(dot(dark, vec3(.2126, .7152, .0722))), dark, 1.15) * vec3(.97, .98, 1.);
}
// Foam lace: the volume's foam mat thresholded by coverage, so foam grows, tears into lace and thins out. Dense mats
// are nearly opaque, thin lace lets the water show through. Once a pixel spans several bubbles it shows their average.
float shoreFoam(vec3 p, float coverage, float footprint) {
  vec3 q = p * 3.1 + vec3(0., uOceanTime * .012, 0.);
  vec4 a = textureLod(uDetail, q, 0.), b = textureLod(uDetail, q * 2.31 + .37, 0.);
  float pattern = a.g * .62 + b.g * .38;
  float threshold = 1.05 - coverage * 1.1, soft = .07 + footprint * 5.;
  float lace = smoothstep(threshold - soft, threshold + soft, pattern) * (.7 + .3 * smoothstep(.3, .8, pattern + b.a * .2));
  return mix(lace, coverage * .8, smoothstep(.006, .03, footprint));
}
`;
