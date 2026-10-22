import * as THREE from 'three';

/**
 * One small tileable 3D texture of procedural detail, baked once on the GPU and shared by the water, the beach and
 * the rocks. Shaders sample it with planet-space positions, so patterns have no seams or pole pinching on the
 * sphere, and one fetch replaces several octaves of hashed noise. Moving the lookup through the volume morphs the
 * slice that the surface cuts, which animates caustics and foam without extra passes.
 *   R: caustic web — distance to the nearest edge of domain-warped Voronoi cells (0 on the edge)
 *   G: foam mat — ragged fbm density with holes of two sizes punched through; thresholded, it tears into lace
 *   B: smooth fbm (stone tone, damp mottling, gust patches)
 *   A: fine grain (sand, rock pitting)
 * No mipmaps: consumers fade detail out by their pixel footprint before it could shimmer.
 */
export const DETAIL_SIZE = 64;

const bakeGLSL = `
uniform float uLayer;
varying vec2 vUv;

// Hash without sine (Dave Hoskins); lattice coordinates are wrapped to the period, so the volume tiles.
float hash13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }

float vnoise(vec3 p, float period) {
  vec3 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6. - 15.) + 10.);
  #define H(o) hash13(mod(i + o, period))
  return mix(mix(mix(H(vec3(0, 0, 0)), H(vec3(1, 0, 0)), u.x), mix(H(vec3(0, 1, 0)), H(vec3(1, 1, 0)), u.x), u.y),
             mix(mix(H(vec3(0, 0, 1)), H(vec3(1, 0, 1)), u.x), mix(H(vec3(0, 1, 1)), H(vec3(1, 1, 1)), u.x), u.y), u.z);
  #undef H
}
// Octaves double the period, so every octave tiles with the volume.
float fbm(vec3 q, float period, int octaves) {
  float sum = 0., amp = .5, norm = 0.;
  for (int o = 0; o < 4; o++) {
    if (o >= octaves) break;
    sum += vnoise(q * period, period) * amp; norm += amp; amp *= .5; period *= 2.;
  }
  return sum / norm;
}
// F1 and F2 of periodic Worley noise.
vec2 worley(vec3 p, float period) {
  vec3 i = floor(p), f = fract(p);
  float f1 = 8., f2 = 8.;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(x, y, z);
    float d = length(o + hash33(mod(i + o, period)) - f);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return vec2(f1, f2);
}

void main() {
  vec3 q = vec3(vUv, uLayer);
  // Caustics: warping the cells bends their straight Voronoi edges into the curved light network.
  vec3 bend = vec3(fbm(q, 3., 3), fbm(q + .37, 3., 3), fbm(q + .71, 3., 3)) - .5;
  vec2 cell = worley((q + bend * .22) * 6., 6.);
  float caustic = clamp((cell.y - cell.x) * 1.6, 0., 1.);
  // Foam: domain-warped density with holes of two sizes.
  vec3 wq = q + (vec3(fbm(q, 4., 3), fbm(q + .43, 4., 3), fbm(q + .19, 4., 3)) - .5) * .12;
  float density = fbm(wq, 4., 4);
  float holeA = smoothstep(.34, .14, worley(wq * 8., 8.).x + (fbm(q, 16., 2) - .5) * .25);
  float holeB = smoothstep(.34, .17, worley(wq * 16. + .17, 16.).x);
  float foam = clamp(density * 1.45 - clamp(holeA * .9 + holeB * .65, 0., 1.) * .55 - .08, 0., 1.);
  float mottle = fbm(q, 2., 4);
  float grain = vnoise(q * 32., 32.) * .6 + smoothstep(.42, .1, worley(q * 16. + .5, 16.).x) * .4;
  gl_FragColor = vec4(caustic, foam, mottle, grain);
}`;

export function bakeDetailVolume(renderer: THREE.WebGLRenderer, size = DETAIL_SIZE) {
  const target = new THREE.WebGL3DRenderTarget(size, size, size, { depthBuffer: false, generateMipmaps: false });
  const texture = target.texture;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.RepeatWrapping;
  const material = new THREE.ShaderMaterial({
    uniforms: { uLayer: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: bakeGLSL, depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene(), camera = new THREE.Camera(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false; scene.add(quad);
  const previous = renderer.getRenderTarget();
  for (let layer = 0; layer < size; layer++) {
    material.uniforms.uLayer.value = (layer + .5) / size;
    renderer.setRenderTarget(target, layer); renderer.render(scene, camera);
  }
  renderer.setRenderTarget(previous);
  quad.geometry.dispose(); material.dispose();
  return target;
}

/** Declares the shared volume; `uDetail` must be bound to the texture of `bakeDetailVolume`. */
export const detailVolumeGLSL = `
uniform highp sampler3D uDetail;
// World units per pixel at this fragment; detail finer than a few pixels fades to its average instead of shimmering.
#define DETAIL_FADE(footprint, feature) (1. - smoothstep((feature) * .25, (feature), (footprint)))
`;
