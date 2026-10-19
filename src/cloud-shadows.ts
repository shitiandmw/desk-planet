import * as THREE from 'three';

export const createCloudShadowUniform = () => ({ value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 1, 0, 0)) });
export type CloudShadowUniform = ReturnType<typeof createCloudShadowUniform>;
export const cloudShadowGLSL = `
uniform vec4 uCloudShadows[4];
float cloudShade(vec3 direction) {
  float shadow = 0.0;
  for (int i = 0; i < 4; i++) {
    shadow += uCloudShadows[i].w * exp((dot(direction, uCloudShadows[i].xyz) - 1.0) / 0.007);
  }
  return 1.0 - min(shadow, 0.42);
}
`;
