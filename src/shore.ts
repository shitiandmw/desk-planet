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
/**
 * Sea depths (planet units) over which the bed fades from view: past the first, sediment in the water starts to veil
 * it; past the second only the water's own blue is left, so the open sea reads deep and the bed there can be left out.
 */
export const SEABED_FADE: [number, number] = [.45, 1];
/**
 * How far a straight view ray has to dip under the sea surface for the bed drawn under it (apparentSeaPointGLSL) to
 * show: by the first it reaches the deepest layer seen at grazing incidence, by the second the bed shows in full.
 */
export const SEABED_RAY_REACH: [number, number] = [.07, .12];

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
/** Depth under the surface at which something `depth` under the water is drawn, seen at incidence cos `cosI`. */
export function apparentSeaDepth(depth: number, cosI: number) {
  const seen = depth * cosI / (1.333 * Math.sqrt(1 - (1 - cosI * cosI) * .5625));
  const t = Math.min(Math.max(depth / .25, 0), 1);
  return Math.max(seen, Math.min(depth, .004 + .022 * t * t * (3 - 2 * t) + .03 * depth));
}

const f = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
/**
 * Looking into the sea. The bed and anything else under the water is drawn first and dims itself by the water it is
 * seen through; the sea surface is then blended over it, adding the light the water scatters back, the reflection
 * and the foam (ocean.ts). Needs no uniforms.
 */
export const waterColumnGLSL = `
const vec3 WATER_EXTINCTION = vec3(${WATER_EXTINCTION.map(f).join(', ')});
#define SEABED_FADE_START ${f(SEABED_FADE[0])}
#define SEABED_FADE_END ${f(SEABED_FADE[1])}
// Length of the light path per unit of water depth: down to the bed and back up along the refracted view ray.
float shorePath(vec3 viewPosition, vec3 up) {
  float muV = clamp(dot(normalize(viewPosition), normalize(up)), .05, 1.);
  return 1. + 1. / sqrt(1. - (1. - muV * muV) * .5625);
}
// Share of the light from something this deep under the surface that reaches the eye, per channel.
vec3 seenThroughWater(float depth, vec3 viewPosition, vec3 up) {
  return exp(-WATER_EXTINCTION * max(depth, 0.) * shorePath(viewPosition, up));
}
// How much of the bed shows at all at this depth (SEABED_FADE).
float seabedVisible(float depth) { return 1. - smoothstep(SEABED_FADE_START, SEABED_FADE_END, depth); }
`;

/**
 * Vertex shaders of everything that can lie under the water. Light leaving the water bends away from the vertical, so
 * a point at depth d under the flat surface appears on the straight view line at depth d cos(i) / (n cos(t)), where i
 * and t are the angles of the view ray in air and in water: three quarters of d seen from above, rising toward the
 * surface at grazing views. Drawing submerged vertices there (and nowhere else: shadows, patterns and the absorption
 * keep the true positions) lets a straight view ray find what the refracted one would, at any angle, and objects
 * standing in the water look broken at the waterline. Takes view-space points and the planet's centre in view space.
 */
export const apparentSeaPointGLSL = `
float apparentSeaDepth(float depth, float cosI) {
  float seen = depth * cosI / (1.333 * sqrt(1. - (1. - cosI * cosI) * .5625));
  // Stay below the lowest wave trough (the swell is damped over the shallows) and the sea's flat triangles, deeper
  // things still further down, so grazing views keep the bed's layers in order.
  return max(seen, min(depth, .004 + .022 * smoothstep(0., .25, depth) + .03 * depth));
}
vec3 apparentSeaPoint(vec3 viewPoint, vec3 viewCentre, float depth) {
  vec3 up = normalize(viewPoint - viewCentre);
  // The view meets the water above the point. From the point itself the deep side of a drop-off would see the camera
  // too steeply, sink too far and fall out of sight behind its own slope.
  float cosI = clamp(dot(normalize(-viewPoint - up * depth), up), 0., 1.);
  return viewPoint + up * (depth - apparentSeaDepth(depth, cosI));
}
`;

/**
 * Stands in for three's lights_fragment_maps in a standard material whose envMap is the sea's sky (ocean.ts). Under
 * the water (`depth` > 0) the sky lights the surface as it lights the sea's own water column. All of it comes in
 * through the surface, from within a cone around `up` (view space): a face gets what it sees of that, so the sides
 * of a rock stay darker than the bed. Scaled by `weight`. The bed must stay as brightly lit as the water column
 * wherever it shows, or it would draw a dark band between the shallows and the open sea; only once the water has all
 * but hidden it (the end of SEABED_FADE) does the sky light go out, so it meets the unlit deep floor without a seam.
 * Above the water there is no environment light at all. Needs shoreGLSL and `uReflection`, the sea's environment
 * intensity.
 */
export const seaSkyLightGLSL = (depth: string, up: string, weight: string) => `
  #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
  if (${depth} > 0.) {
    vec3 seaUp = normalize(${up});
    float facing = clamp(dot(geometryNormal, seaUp) * .5 + .5, 0., 1.);
    float hidden = smoothstep(SEABED_FADE_END - .12, SEABED_FADE_END, ${depth});
    iblIrradiance += getIBLIrradiance(seaUp) * facing * facing * ${weight} * (1. - hidden) * uReflection;
  }
  #endif`;

/**
 * GLSL mirror of the functions above plus the shared looks. Requires `uOceanTime` and the detail volume
 * (`detailVolumeGLSL`) to be declared first.
 */
export const shoreGLSL = `${waterColumnGLSL}
#define SHORE_PERIOD ${f(SHORE_PERIOD)}
#define SHORE_BREAK_DEPTH ${f(SHORE_BREAK_DEPTH)}
#define SHORE_SWASH_MAX ${f(SHORE_SWASH_MAX)}
float shorePhase(float depth, float along) {
  return uOceanTime / SHORE_PERIOD + .42 * sqrt(max(depth, 0.) / SHORE_BREAK_DEPTH) + along * 3.;
}
float swashProfile(float tau) {
  return tau < ${f(SWASH_UP)} ? sin(1.5707963 * tau / ${f(SWASH_UP)}) : cos(1.5707963 * min(1., (tau - ${f(SWASH_UP)}) / ${f(SWASH_DOWN_END - SWASH_UP)}));
}
float shoreSet(float wave) { return .72 + .28 * sin(wave * 2.39996 + 1.3); }
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
// Caustics on whatever lies under the water, as a factor for its direct sunlight: two drifting slices of the warped
// cell network, the light gathering on their edges and crossings. Lines are drawn at least a pixel and a half wide
// (edge distance per pixel ~ footprint / 0.06) and fade once a pixel spans the cells; deeper, they blur and fade.
// The web roughly keeps the light it gathers: brighter lines, slightly dimmer cells between them.
float underwaterCaustics(vec3 p, float depth, float footprint) {
  float k = DETAIL_FADE(footprint, .016) * smoothstep(0., .015, depth) * (1. - smoothstep(.1, .5, depth));
  if (k < .002) return 1.;
  vec3 q = p * 1.6;
  float a = textureLod(uDetail, q + vec3(.045, .028, -.036) * uOceanTime, 0.).r;
  float b = textureLod(uDetail, q * 1.37 + vec3(-.032, .04, .024) * uOceanTime + .5, 0.).r;
  float line = max(.11 + depth * .3, footprint * 25.);
  float web = (1. - smoothstep(0., line, a)) + (1. - smoothstep(0., line * 1.3, b)) * .55;
  return 1. + (web * web * .85 - .16) * k;
}
`;
