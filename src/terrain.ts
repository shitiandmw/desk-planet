import * as THREE from 'three';
import { canvasTexture, mesh, rng, vec } from './craft';
import { elevation, landField, planetGeometry, surfacePoint } from './planet-surface';
import { Ocean } from './ocean';
import { cloudShadowGLSL, type CloudShadowUniform } from './cloud-shadows';

export const paths = [
  new THREE.CatmullRomCurve3([vec(.8, 0, 5.4), vec(.2, 0, 3.9), vec(.35, 0, 2.7), vec(-.05, 0, 1.35), vec(.6, 0, -.15), vec(.7, 0, -1.8), vec(.95, 0, -4.9)]),
  new THREE.CatmullRomCurve3([vec(.1, 0, 1.4), vec(-.7, 0, .65), vec(-1.7, 0, .2), vec(-2.8, 0, -.6)]),
  new THREE.CatmullRomCurve3([vec(.55, 0, -.5), vec(1.6, 0, -.8), vec(2.7, 0, -1.3), vec(3.6, 0, -.4)]),
  new THREE.CatmullRomCurve3([vec(.3, 0, 3.7), vec(-1.2, 0, 3.4), vec(-2.6, 0, 2.8)]),
];
const samples = paths.flatMap(p => p.getPoints(100));
export function pathDistance(x: number, z: number) { let min = 100; for (const p of samples) min = Math.min(min, Math.hypot(x - p.x, z - p.z)); return min; }
export function facilityDistance(x: number, z: number) { return Math.min(Math.hypot((x - 1.7) * .8, (z - 2.5) * .95) - 1.1, Math.hypot(x + 3.2, z - 2) - 1.05, Math.hypot(x + 1, z - 2.1) - .8); }

export function makeTerrain(parent: THREE.Object3D, renderer: THREE.WebGLRenderer, cloudShadows: CloudShadowUniform) {
  const geometry = planetGeometry(), position = geometry.attributes.position;
  const colors: number[] = [], n = new THREE.Vector3();
  const grass = new THREE.Color('#78984d'), lightGrass = new THREE.Color('#9ba859'), sand = new THREE.Color('#cabe94'), rock = new THREE.Color('#969e8e');
  for (let i = 0; i < position.count; i++) {
    n.fromBufferAttribute(position, i).normalize();
    const h = elevation(n), field = landField(n);
    const variation = .5 + .3 * Math.sin(n.x * 38 + n.z * 24) * Math.cos(n.y * 28);
    const c = grass.clone().lerp(lightGrass, variation);
    c.lerp(sand, 1 - THREE.MathUtils.smoothstep(field, .005, .052));
    c.lerp(rock, THREE.MathUtils.smoothstep(h, .3, .6));
    c.multiplyScalar(.96 + .04 * Math.sin(n.z * 140 + n.x * 89)); colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const textureRandom = rng(445);
  const grassTexture = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#ebeada'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 13000; i++) {
      ctx.fillStyle = textureRandom() > .5 ? 'rgba(95,108,66,.13)' : 'rgba(255,255,237,.19)';
      ctx.fillRect(textureRandom() * size, textureRandom() * size, 1 + textureRandom() * 2, 1 + textureRandom() * 3);
    }
  });
  grassTexture.repeat.set(24, 12);
  const terrain = mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: grassTexture, bumpMap: grassTexture, bumpScale: .009, roughness: .97 }), parent);
  terrain.name = 'closed-planet-terrain';

  const groundMaterial = terrain.material as THREE.MeshStandardMaterial;
  groundMaterial.onBeforeCompile = shader => {
    shader.uniforms.uCloudShadows = cloudShadows;
    shader.vertexShader = 'varying vec3 vGroundDirection;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundDirection = normalize(position);');
    shader.fragmentShader = 'varying vec3 vGroundDirection;\n' + cloudShadowGLSL + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= cloudShade(normalize(vGroundDirection));');
  };
  groundMaterial.customProgramCacheKey = () => 'planet-cloud-shadows-v1';
  const oceanSurface = new Ocean(renderer, cloudShadows);
  const ocean = oceanSurface.mesh; parent.add(ocean);

  const random = rng(245);
  const dirtMap = canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#c8b486'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 11000; i++) { ctx.globalAlpha = .1 + random() * .12; ctx.fillStyle = random() > .5 ? '#7b704b' : '#eee0ae'; ctx.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2); }
  });
  const dirt = new THREE.MeshStandardMaterial({ map: dirtMap, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  for (const path of paths) {
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, p = path.getPoint(t), tangent = path.getTangent(t);
      const w = .29 + .025 * Math.sin(i * .71);
      for (const sign of [-1, 1]) {
        surfacePoint(p.x + tangent.z * w * sign, p.z - tangent.x * w * sign, .013).toArray(positions, positions.length);
        uv.push(sign === -1 ? 0 : 1, t * 12);
      }
      if (i < 120) { const j = i * 2; indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
    }
    const road = new THREE.BufferGeometry(); road.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); road.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); road.setIndex(indices); road.computeVertexNormals();
    mesh(road, dirt, parent).castShadow = false;
  }
  const apronPositions: number[] = [], apronUV: number[] = [], apronIndices: number[] = [];
  for (let r = 0; r <= 14; r++) for (let j = 0; j <= 64; j++) {
    const angle = j / 64 * Math.PI * 2, x = 1.7 + Math.cos(angle) * r / 14 * 1.6, z = 2.5 + Math.sin(angle) * r / 14 * 1.3;
    surfacePoint(x, z, .014).toArray(apronPositions, apronPositions.length); apronUV.push(x, z);
    if (r < 14 && j < 64) { const i = r * 65 + j; apronIndices.push(i, i + 1, i + 65, i + 1, i + 66, i + 65); }
  }
  const apron = new THREE.BufferGeometry(); apron.setAttribute('position', new THREE.Float32BufferAttribute(apronPositions, 3)); apron.setAttribute('uv', new THREE.Float32BufferAttribute(apronUV, 2)); apron.setIndex(apronIndices); apron.computeVertexNormals();
  mesh(apron, dirt, parent).castShadow = false;
  return { terrain, ocean, oceanSurface };
}
