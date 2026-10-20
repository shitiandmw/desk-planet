import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const up = new THREE.Vector3(0, 1, 0);
export const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, position?: THREE.Vector3) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
  if (position) m.position.copy(position);
  parent.add(m); return m;
}
export const standard = (color: THREE.ColorRepresentation, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });

export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!; draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8; return texture;
}

export function woodMaterial(color = '#8e6742', bark = false) {
  const random = rng(bark ? 25 : 91);
  const texture = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = bark ? '#b7a18a' : '#e1c49c'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 720; i++) {
      const x = random() * s, y = random() * s;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + random() * 16 - 8, y + 30, x + random() * 12 - 6, y + 65, x + random() * 10 - 5, y + 130);
      ctx.lineWidth = bark ? .8 + random() * 2 : .3 + random();
      ctx.strokeStyle = random() > .3 ? `rgba(54,35,18,${.04 + random() * .17})` : 'rgba(255,246,212,.27)'; ctx.stroke();
    }
    if (!bark) for (let i = 0; i < 8; i++) {
      ctx.save(); ctx.translate(random() * s, random() * s); ctx.scale(1, 3);
      for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.ellipse(0, 0, k * 1.5, k * 2, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(65,42,22,.1)'; ctx.stroke(); }
      ctx.restore();
    }
  });
  return new THREE.MeshStandardMaterial({ color, map: texture, bumpMap: texture, bumpScale: bark ? .018 : .012, roughness: .92 });
}

export function beam(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, width: number, depth: number, mat: THREE.Material) {
  const m = mesh(new THREE.BoxGeometry(width, a.distanceTo(b), depth), mat, parent, a.clone().add(b).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); return m;
}

/** A tapered, curved branch with continuous UVs and fluted bark, including a flared root collar. */
export function branchGeometry(points: THREE.Vector3[], radii: number[], seed: number, segments = 22, sides = 18) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(segments, false);
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPointAt(t);
    const rIndex = t * (radii.length - 1), ix = Math.min(radii.length - 2, Math.floor(rIndex));
    const radius = THREE.MathUtils.lerp(radii[ix], radii[ix + 1], rIndex - ix);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const ridges = 1 + Math.sin(angle * 5 + seed) * .07 + Math.sin(angle * 9 + t * 12) * .025;
      const p1 = p.clone().addScaledVector(frames.normals[i], Math.cos(angle) * radius * ridges).addScaledVector(frames.binormals[i], Math.sin(angle) * radius * ridges);
      vertices.push(p1.x, p1.y, p1.z); uv.push(j / sides, t * curve.getLength() / 2);
      if (i < segments && j < sides) { const a = i * (sides + 1) + j, b = a + sides + 1; indices.push(a, a + 1, b, b, a + 1, b + 1); }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

/** Fill attributes some parts lack (white vertex colour, zero UV) so one material always merges into one draw call. */
function unifyAttributes(geos: THREE.BufferGeometry[]) {
  const names = new Set(geos.flatMap(g => Object.keys(g.attributes)));
  for (const g of geos) for (const name of names) if (!g.attributes[name]) {
    const count = g.attributes.position.count;
    if (name === 'color') g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
    else if (name === 'uv') g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    else if (name === 'normal') g.computeVertexNormals();
    else g.deleteAttribute(name);
  }
  for (const g of geos) for (const name of Object.keys(g.attributes)) if (!geos.every(o => o.attributes[name])) g.deleteAttribute(name);
}

/** Merges static meshes per material. Children flagged `userData.anim` or `userData.separate` keep their own transform. */
export function mergeMeshes(group: THREE.Group) {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  const children: THREE.Mesh[] = [], nested: THREE.Object3D[] = [];
  const visit = (parent: THREE.Object3D) => {
    for (const obj of parent.children) {
      if (obj.userData.anim || obj.userData.separate) { nested.push(obj); continue; }
      if (obj instanceof THREE.Mesh && !(obj instanceof THREE.InstancedMesh) && !Array.isArray(obj.material)) { const m = new THREE.Matrix4().multiplyMatrices(inverse, obj.matrixWorld); const g = (obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone()).applyMatrix4(m); const list = buckets.get(obj.material) || []; list.push(g); buckets.set(obj.material, list); children.push(obj); }
      visit(obj);
    }
  };
  visit(group);
  for (const c of children) { c.removeFromParent(); c.geometry.dispose(); }
  for (const [mat, geos] of buckets) { unifyAttributes(geos); const combined = mergeGeometries(geos, false); if (combined) mesh(combined, mat, group); geos.forEach(g => g.dispose()); }
  for (const n of nested) if (n instanceof THREE.Group) mergeMeshes(n);
}

export function leafGeometry(divisions = 40) {
  // Curved, lobed oak leaf. A raised midrib gives readable soft specular variation; `divisions` sets the outline detail.
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const outline = new THREE.CatmullRomCurve3([[0, 0], [-.16, .16], [-.32, .27], [-.28, .36], [-.39, .48], [-.29, .58], [-.33, .7], [-.2, .8], [0, 1], [.2, .8], [.33, .7], [.29, .58], [.39, .48], [.28, .36], [.32, .27], [.16, .16]].map(([x,y])=>vec(x,y,0)), true).getPoints(divisions).slice(0,-1).map(p=>[p.x,p.y]);
  positions.push(0, .52, .08); uvs.push(.5, .52);
  for (const [x, y] of outline) { positions.push(x, y, .08 * Math.sin(y * Math.PI) - Math.abs(x) * .16 + y * y * .13); uvs.push(x + .5, y); }
  for (let i = 0; i < outline.length; i++) indices.push(0, i + 1, (i + 1) % outline.length + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

export function leafMaterial() {
  // Drawn on a 128-unit leaf at twice the density, so veins stay crisp in close-ups.
  const map = canvasTexture(256, ctx => {
    const s = 128; ctx.scale(2, 2);
    const gradient = ctx.createLinearGradient(0, 0, s, 0);
    gradient.addColorStop(0, '#bac590'); gradient.addColorStop(.45, '#edf0ce'); gradient.addColorStop(.53, '#d0d8a0'); gradient.addColorStop(1, '#9bb17c');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(247,242,195,.3)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2, s); ctx.stroke();
    for (let i = 1; i < 7; i++) for (const sign of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s / 2, i * s / 8); ctx.lineTo(s / 2 + sign * s * .35, i * s / 8 + s * .16); ctx.stroke(); }
  });
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map, side: THREE.DoubleSide, roughness: .9 });
  // Broad crown normals soften isolated leaf-plane contrast, retaining a small local midrib response.
  mat.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec3 canopyNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\ntransformedNormal = normalize(mix(transformedNormal, normalize(normalMatrix * canopyNormal), 0.78));');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.emissive.set('#70844b'); mat.emissiveIntensity = .08;
  mat.customProgramCacheKey = () => 'soft-broadleaf-v2';
  return mat;
}

/**
 * Foliage baked into one geometry per tree: leaf colours live in vertex colours and the broad crown normal in a
 * vertex attribute. When the baked crown is itself instanced across the globe, the instance rotation turns it too.
 */
export function crownMaterial(map: THREE.Texture | null) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', map, vertexColors: true, side: THREE.DoubleSide, roughness: .9 });
  mat.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec3 canopyNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
      vec3 canopy = canopyNormal;
      #ifdef USE_INSTANCING
        canopy = mat3(instanceMatrix) * canopy;
      #endif
      transformedNormal = normalize(mix(transformedNormal, normalize(normalMatrix * canopy), 0.78));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.emissive.set('#70844b'); mat.emissiveIntensity = .08;
  mat.customProgramCacheKey = () => 'baked-crown-v1';
  return mat;
}
