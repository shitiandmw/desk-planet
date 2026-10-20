import * as THREE from 'three';
import { planetFieldGLSL } from './planet-glsl';

/**
 * The analytic land field and the meadow noise, baked once on the GPU into an equirectangular texture. Ground and
 * water then shade with a single texture read per pixel instead of evaluating exponentials and noise octaves.
 * R/G hold the land field in 16 bits (linear packing, so bilinear filtering stays exact); B is fine meadow
 * mottling; A is broad sun-dried patches.
 */
export function bakePlanetField(renderer: THREE.WebGLRenderer, width = 2048) {
  const target = new THREE.WebGLRenderTarget(width, width / 2, {
    depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping,
  });
  const material = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `${planetFieldGLSL}
      varying vec2 vUv;
      void main() {
        float lon = (vUv.x - .5) * 6.28318530718, lat = (vUv.y - .5) * 3.14159265359;
        vec3 n = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
        float field = clamp(planetLandField(n) + .5, 0., 1.) * 65535.;
        float high = floor(field / 256.);
        gl_FragColor = vec4(high / 255., (field - high * 256.) / 255., planetFbm(n * 26.), smoothstep(.42, .74, planetFbm(n * 8. + 4.)));
      }`,
    depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false; scene.add(quad);
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target); renderer.render(scene, new THREE.Camera()); renderer.setRenderTarget(previous);
  quad.geometry.dispose(); material.dispose();
  return target;
}

/** Shader helpers for the baked field; `uPlanetField` must be bound to the texture returned by `bakePlanetField`. */
export const planetFieldSampleGLSL = `
uniform sampler2D uPlanetField;
vec4 planetFieldSample(vec3 n) {
  return texture2D(uPlanetField, vec2(atan(n.z, n.x) * .15915494309 + .5, asin(clamp(n.y, -1., 1.)) * .31830988618 + .5));
}
float planetFieldValue(vec4 s) { return (s.r * 65280. + s.g * 255.) / 65535. - .5; }
// Water depth below the sea surface; matches elevation() for the sea floor (field * 5, floored at -1.4).
float planetSeaDepth(vec4 s) { return clamp(-planetFieldValue(s) * 5., 0., 1.4); }
`;
