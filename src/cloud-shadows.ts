import * as THREE from 'three';
import { PLANET_RADIUS } from './planet-surface';

export const createCloudShadowUniform = () => ({
  value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 1, 0, 0)),
  radii: { value: new Float32Array(4).fill(.007) },
});
export type CloudShadowUniform = ReturnType<typeof createCloudShadowUniform>;

/** Project onto the globe along the sun ray; fade at grazing incidence instead of popping at the horizon. */
export function projectCloudShadow(center: THREE.Vector3, sun: THREE.Vector3, strength: number, out: THREE.Vector4) {
  const b = center.dot(sun), discriminant = b*b - (center.lengthSq()-PLANET_RADIUS*PLANET_RADIUS);
  if (b <= 0 || discriminant <= 0 || strength <= 0) { out.w=0; return out; }
  const root = Math.sqrt(discriminant), distance = -b+root;
  const x=center.x+sun.x*distance, y=center.y+sun.y*distance, z=center.z+sun.z*distance, length=Math.hypot(x,y,z);
  const distanceToRay = Math.sqrt(Math.max(0,center.lengthSq()-b*b));
  const fade = THREE.MathUtils.smoothstep(PLANET_RADIUS-distanceToRay, 0, 1.2);
  return out.set(x/length,y/length,z/length,strength*fade);
}
export const cloudShadowGLSL = `
uniform vec4 uCloudShadows[4];
uniform float uCloudShadowRadii[4];
float cloudShade(vec3 direction) {
  float shadow = 0.0;
  for (int i = 0; i < 4; i++) {
    shadow += uCloudShadows[i].w * exp((dot(direction, uCloudShadows[i].xyz) - 1.0) / max(0.001, uCloudShadowRadii[i]));
  }
  return 1.0 - min(shadow, 0.42);
}
`;
