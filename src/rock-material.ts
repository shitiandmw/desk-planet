import * as THREE from 'three';
import { detailVolumeGLSL } from './detail-volume';
import { planetFieldSampleGLSL } from './planet-field-texture';
import { PLANET_RADIUS } from './planet-surface';

const rockUniforms = {
  uDetail: { value: null as THREE.Texture | null },
  uPlanetField: { value: null as THREE.Texture | null },
  uRockSand: { value: new THREE.Color('#d6c597') },
  uRockSoil: { value: new THREE.Color('#7b6c4c') },
  uLichen: { value: new THREE.Color('#d8d6c2') },
};
/** Binds the shared detail volume and the baked land field; called once both are baked. */
export function setRockDetail(detail: THREE.Texture, field: THREE.Texture) {
  rockUniforms.uDetail.value = detail; rockUniforms.uPlanetField.value = field;
}

/**
 * Weathered stone for boulders instanced in planet space. Facets keep their flat shading and the baked vertex
 * shading; per pixel the stone gains broad tone and fine grain from the detail volume (continuous across rocks, so
 * no two match), sun-bleached tops with lichen patches, soil or sand drifted against the base with a contact
 * shadow, and a dark, glossy wet band where waves wash the coastal rocks.
 */
export const rockMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93, flatShading: true });
rockMaterial.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, rockUniforms);
  shader.vertexShader = 'varying vec3 vRockPoint;\nvarying vec3 vRockLocal;\nvarying vec3 vRockUp;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vRockLocal = transformed;
    #ifdef USE_INSTANCING
      vRockPoint = (instanceMatrix * vec4(transformed, 1.)).xyz;
    #else
      vRockPoint = transformed;
    #endif
    // The instanced meshes sit at the planet's origin: the radial direction in view space is "up" for the rock.
    vRockUp = normalMatrix * vRockPoint;`);
  shader.fragmentShader = `varying vec3 vRockPoint;
    varying vec3 vRockLocal;
    varying vec3 vRockUp;
    uniform vec3 uRockSand; uniform vec3 uRockSoil; uniform vec3 uLichen;
    ${planetFieldSampleGLSL}${detailVolumeGLSL}
    // Surface-gradient bump with heights in planet units (Mikkelsen), for relief that keeps its scale at any zoom.
    vec3 rockBump(vec3 p, vec3 n, float height) {
      vec3 dpx = dFdx(p), dpy = dFdy(p), r1 = cross(dpy, n), r2 = cross(n, dpx);
      float det = dot(dpx, r1);
      vec3 grad = sign(det) * (r1 * dFdx(height) + r2 * dFdy(height));
      return normalize(abs(det) * n - grad * min(1., abs(det) * 1.2 / max(length(grad), 1e-12)));
    }
  ` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    float upness = dot(normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition))), normalize(vRockUp));
    float rockFootprint = length(fwidth(vRockPoint));
    // Tiles of 0.43 and 0.21 units: tone in patches of 0.03-0.2 units (B), grain cells of 0.0066 units (A).
    vec4 broad = texture(uDetail, vRockPoint * 2.3), fine = texture(uDetail, vRockPoint * 4.7);
    float fineK = DETAIL_FADE(rockFootprint, .0066);
    float stone = broad.b * .7 + (fine.b - .5) * .3 + (fine.a - .5) * .3 * fineK;
    vec3 rock = diffuseColor.rgb * (.8 + .4 * stone);
    // Sun-bleached, weathered tops; pale lichen in patches on the dry upper faces.
    float top = smoothstep(.25, .85, upness), seaHeight = length(vRockPoint) - ${PLANET_RADIUS.toFixed(4)};
    rock = mix(rock, rock * 1.12 + .025, top * .55);
    rock = mix(rock, uLichen * (.85 + .3 * stone), smoothstep(.5, .85, broad.g) * top * smoothstep(.04, .12, seaHeight) * .28);
    // Soil, or sand on the beaches, drifted against the base with a contact shadow.
    vec4 rockGround = planetFieldSample(normalize(vRockPoint));
    float onSand = 1. - smoothstep(.01, .05, planetFieldValue(rockGround) + (rockGround.b - .5) * .014);
    float base = 1. - smoothstep(-.4, -.08, vRockLocal.y + (stone - .5) * .12);
    rock = mix(rock, mix(uRockSoil, uRockSand, onSand) * .7, base * .5) * (1. - base * .18);
    // Dark and glossy just above the sea, where the swash washes over the coastal rocks.
    float rockWet = (1. - smoothstep(0., .045, seaHeight + (stone - .5) * .02)) * step(-.2, seaHeight);
    diffuseColor.rgb = rock * (1. - rockWet * .42);`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
    roughnessFactor = mix(roughnessFactor - top * .05, .38, rockWet);`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
    normal = rockBump(-vViewPosition, normal, (stone * .01 + fine.a * .0012 * fineK) * (1. - rockWet * .5));`);
};
rockMaterial.customProgramCacheKey = () => 'weathered-rock-v1';
