import * as THREE from 'three';
import { canvasTexture, mesh, rng, vec } from './craft';
import { elevation, landField, PLANET_RADIUS, planetGeometry, surfacePoint } from './planet-surface';
import { HIDDEN_SEABED_DEPTH, Ocean } from './ocean';
import { cloudShadowGLSL, type CloudShadowUniform } from './cloud-shadows';
import { bakePlanetField, planetFieldSampleGLSL } from './planet-field-texture';
import { bakeDetailVolume, detailVolumeGLSL } from './detail-volume';
import { apparentSeaPointGLSL, seaSkyLightGLSL, shoreGLSL, waterColumnGLSL } from './shore';
import { setRockDetail } from './rock-material';

export const paths = [
  new THREE.CatmullRomCurve3([vec(.8, 0, 5.4), vec(.2, 0, 3.9), vec(.35, 0, 2.7), vec(-.05, 0, 1.35), vec(.6, 0, -.15), vec(.7, 0, -1.8), vec(.95, 0, -4.9)]),
  new THREE.CatmullRomCurve3([vec(.1, 0, 1.4), vec(-.7, 0, .65), vec(-1.7, 0, .2), vec(-2.8, 0, -.6)]),
  new THREE.CatmullRomCurve3([vec(.55, 0, -.5), vec(1.6, 0, -.8), vec(2.7, 0, -1.3), vec(3.6, 0, -.4)]),
  new THREE.CatmullRomCurve3([vec(.3, 0, 3.7), vec(-1.2, 0, 3.4), vec(-2.6, 0, 2.8)]),
];
const samples = paths.flatMap(p => p.getPoints(100));
export function pathDistance(x: number, z: number) { let min = 100; for (const p of samples) min = Math.min(min, Math.hypot(x - p.x, z - p.z)); return min; }
export function facilityDistance(x: number, z: number) { return Math.min(Math.hypot((x - 1.7) * .8, (z - 2.5) * .95) - 1.1, Math.hypot(x + 3.2, z - 2) - 1.05, Math.hypot(x + 1, z - 2.1) - .8); }

/**
 * Splits the ground by the sea. The ground keeps every triangle that reaches the waterline, in order; the sea bed under
 * the water (only ever seen through the sea, which covers it in the AO prepass, and never shading anything above) and
 * the deep floor the water always hides (every corner deeper than `hiddenDepth`) come back as geometries sharing the
 * same vertices, so they can skip the passes and the shading they do not need.
 */
export function splitSeabed(geometry: THREE.BufferGeometry, hiddenDepth: number) {
  const index = geometry.index!, position = geometry.attributes.position, height = new Float32Array(position.count);
  const land: number[] = [], bed: number[] = [], hidden: number[] = [];
  for (let i = 0; i < position.count; i++) height[i] = Math.hypot(position.getX(i), position.getY(i), position.getZ(i)) - PLANET_RADIUS;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2), top = Math.max(height[a], height[b], height[c]);
    (top >= 0 ? land : top > -hiddenDepth ? bed : hidden).push(a, b, c);
  }
  geometry.setIndex(land);
  const part = (triangles: number[]) => {
    const g = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) g.setAttribute(name, attribute);
    g.setIndex(triangles); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), PLANET_RADIUS);
    return g;
  };
  return { seabed: part(bed), deep: part(hidden) };
}

/**
 * Derivative bumps for heights already computed per pixel, so they cost no extra texture fetches: `groundBump` is
 * three's perturbNormalArb (the grass keeps its look), `reliefBump` takes heights in planet units (Mikkelsen's
 * surface gradient) so sand ripples keep their real scale at any zoom.
 */
const groundBumpGLSL = `
vec3 groundBump(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDirection) {
  vec3 sigmaX = normalize(dFdx(surfPos)), sigmaY = normalize(dFdy(surfPos));
  vec3 r1 = cross(sigmaY, surfNorm), r2 = cross(surfNorm, sigmaX);
  float det = dot(sigmaX, r1) * faceDirection;
  return normalize(abs(det) * surfNorm - sign(det) * (dHdxy.x * r1 + dHdxy.y * r2));
}
vec3 reliefBump(vec3 p, vec3 n, float height) {
  vec3 dpx = dFdx(p), dpy = dFdy(p), r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (r1 * dFdx(height) + r2 * dFdy(height));
  return normalize(abs(det) * n - grad * min(1., abs(det) * 1.2 / max(length(grad), 1e-12)));
}
`;

export function makeTerrain(parent: THREE.Object3D, renderer: THREE.WebGLRenderer, cloudShadows: CloudShadowUniform) {
  // Twice the former resolution keeps the geometric coastline close to the per-pixel shoreline below.
  const geometry = planetGeometry(512, 256), position = geometry.attributes.position;
  const colors: number[] = [], n = new THREE.Vector3();
  const grass = new THREE.Color('#78984d'), lightGrass = new THREE.Color('#9ba859'), rock = new THREE.Color('#969e8e');
  for (let i = 0; i < position.count; i++) {
    n.fromBufferAttribute(position, i).normalize();
    const h = elevation(n), field = landField(n);
    const variation = .5 + .3 * Math.sin(n.x * 38 + n.z * 24) * Math.cos(n.y * 28);
    const c = grass.clone().lerp(lightGrass, variation);
    // Darker, lusher grass where the land is moist near forests and low ground; beaches are shaded per pixel.
    c.multiplyScalar(.97 + .05 * THREE.MathUtils.smoothstep(field, .05, .35));
    c.lerp(rock, THREE.MathUtils.smoothstep(h, .3, .6));
    c.multiplyScalar(.96 + .04 * Math.sin(n.z * 140 + n.x * 89)); colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const { seabed: seabedGeometry, deep: deepGeometry } = splitSeabed(geometry, HIDDEN_SEABED_DEPTH);
  const textureRandom = rng(445);
  const grassTexture = canvasTexture(512, (ctx, size) => {
    const s = size / 2; ctx.save(); ctx.scale(2, 2);
    ctx.fillStyle = '#ebeada'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 13000; i++) {
      ctx.fillStyle = textureRandom() > .5 ? 'rgba(95,108,66,.13)' : 'rgba(255,255,237,.19)';
      ctx.fillRect(textureRandom() * s, textureRandom() * s, 1 + textureRandom() * 2, 1 + textureRandom() * 3);
    }
    ctx.restore();
    // Fine, evenly balanced blades at full resolution: texture in close-ups, the same average tone from afar.
    for (let i = 0; i < 14000; i++) {
      const x = textureRandom() * size, y = textureRandom() * size, lean = (textureRandom() - .5) * .9, length = 2 + textureRandom() * 4;
      ctx.strokeStyle = i % 2 ? 'rgba(78,94,50,.17)' : 'rgba(255,255,235,.17)'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(lean) * length, y - Math.cos(lean) * length); ctx.stroke();
    }
  });
  grassTexture.repeat.set(24, 12);
  // The grass texture doubles as its own bump height (derived per pixel in the shader below).
  const terrain = mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: grassTexture, roughness: .97 }), parent);
  terrain.name = 'closed-planet-terrain';
  const groundMaterial = terrain.material as THREE.MeshStandardMaterial;
  // The sea bed shares the ground's shading; drawn only in the colour pass (see splitSeabed).
  const seabed = new THREE.Mesh(seabedGeometry, groundMaterial);
  seabed.name = 'sea-bed'; seabed.receiveShadow = true; seabed.userData.skipAO = true; parent.add(seabed);

  const bakedField = bakePlanetField(renderer), detail = bakeDetailVolume(renderer);
  const oceanSurface = new Ocean(renderer, cloudShadows, bakedField.texture, detail.texture);
  // Under the water the sky lights the bed and the rocks as it lights the sea itself (seaSkyLightGLSL).
  groundMaterial.envMap = oceanSurface.environment;
  setRockDetail(detail.texture, bakedField.texture, oceanSurface);
  const ocean = oceanSurface.mesh; parent.add(ocean);
  const water = oceanSurface.uniforms;
  // The hidden deep floor as plain sand, lit and dimmed by its water like the bed. Looking on past the visible bed
  // toward deeper water (where the bed seen through the water lies further out), a view ray ends there instead of on
  // the empty inside, and the two meet without a seam.
  const deepMaterial = new THREE.MeshLambertMaterial({ color: water.uSeabed.value });
  deepMaterial.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vDeepUp;\nvarying float vDeepDepth;\n${apparentSeaPointGLSL}` + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vDeepUp = normalMatrix * position; vDeepDepth = ${PLANET_RADIUS.toFixed(4)} - length(position);
      mvPosition.xyz = apparentSeaPoint(mvPosition.xyz, modelViewMatrix[3].xyz, vDeepDepth);
      gl_Position = projectionMatrix * mvPosition;`);
    shader.fragmentShader = `varying vec3 vDeepUp;\nvarying float vDeepDepth;\n${waterColumnGLSL}` + shader.fragmentShader.replace('#include <opaque_fragment>', `
      outgoingLight *= seenThroughWater(vDeepDepth, vViewPosition, vDeepUp);
      #include <opaque_fragment>`);
  };
  deepMaterial.customProgramCacheKey = () => 'deep-sea-floor-v2';
  const deepFloor = new THREE.Mesh(deepGeometry, deepMaterial);
  deepFloor.name = 'deep-sea-floor'; deepFloor.userData.skipAO = true; parent.add(deepFloor);
  const groundUniforms = {
    uSand: water.uSand, uSeabed: water.uSeabed, uFoam: water.uFoam, uDeepWater: water.uDeepWater, uOceanTime: water.uOceanTime, uRain: water.uRain,
    uReflection: water.uReflection, uPlanetField: { value: bakedField.texture }, uDetail: { value: detail.texture },
    // The sky the swash sheet reflects: the horizon band of the sea's environment.
    uSkySheen: { value: new THREE.Color('#c4dbe6') },
  };
  groundMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, groundUniforms, { uCloudShadows: cloudShadows, uCloudShadowRadii: cloudShadows.radii });
    shader.vertexShader = `varying vec3 vGroundPoint;\nvarying vec3 vGroundUp;\n${apparentSeaPointGLSL}` + shader.vertexShader;
    // The radial direction in view space is "up" for the water above the bed.
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundPoint = position;\nvGroundUp = normalMatrix * position;');
    // The sea bed is drawn where it is seen through the water (shore.ts).
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      float groundSeaDepth = ${PLANET_RADIUS.toFixed(4)} - length(position);
      if (groundSeaDepth > 0.) { mvPosition.xyz = apparentSeaPoint(mvPosition.xyz, modelViewMatrix[3].xyz, groundSeaDepth); gl_Position = projectionMatrix * mvPosition; }`);
    shader.fragmentShader = `varying vec3 vGroundPoint;
      varying vec3 vGroundUp;
      uniform vec3 uSand; uniform vec3 uSeabed; uniform vec3 uFoam; uniform vec3 uDeepWater; uniform vec3 uSkySheen;
      uniform float uOceanTime; uniform float uRain; uniform float uReflection;
      ${cloudShadowGLSL}${planetFieldSampleGLSL}${detailVolumeGLSL}${shoreGLSL}${groundBumpGLSL}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat grassHeight = sampledDiffuseColor.r;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 groundDir = normalize(vGroundPoint);
      vec4 baked = planetFieldSample(groundDir);
      float groundField = planetFieldValue(baked), meadow = baked.b;
      float groundFootprint = length(fwidth(vGroundPoint)), fieldWidth = fwidth(groundField);
      float grainK = DETAIL_FADE(groundFootprint, .0074);
      // Broad sun-dried patches and fine mottling keep large meadows from reading as flat colour.
      diffuseColor.rgb *= .93 + .14 * meadow;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.07, 1.05, .84), baked.a * .5);
      // Sand follows the coastline per pixel, with grain and soft drifts of paler and warmer sand.
      float beach = 1. - smoothstep(.01, .05, groundField + (meadow - .5) * .014);
      // Detail volume at a 0.48-unit tile: drifts and mottling (B), grain cells of 0.0074 units (A). Only the beach
      // reads it (an explicit LOD, so the fetch can sit in a branch).
      vec4 sandDetail = vec4(.5);
      if (beach > 0.) sandDetail = textureLod(uDetail, vGroundPoint * 2.1, 0.);
      vec3 drySand = uSand * (.95 + .1 * meadow) * (.95 + .1 * sandDetail.b) * (1. + (sandDetail.a - .5) * .14 * grainK);
      // Under the water surface the sea is drawn over this (ocean.ts); the bed is dimmed by the water it is seen through
      // after lighting (opaque_fragment, below).
      float seaDepth = ${PLANET_RADIUS.toFixed(4)} - length(vGroundPoint), above = step(seaDepth, 0.), under = smoothstep(0., .06, seaDepth);
      // The swash (shore.ts): each bore runs up as a thin sheet, drains back and leaves wet sand drying from the top.
      // Below the water surface the sea itself carries it.
      float landPhase = shorePhase(0., meadow), tau = fract(landPhase), waveSize = shoreSet(floor(landPhase));
      float reach = SHORE_SWASH_MAX * waveSize * swashProfile(tau), running = step(.01, reach / SHORE_SWASH_MAX) * above;
      float edge = fieldWidth * 1.5 + 1e-5, mottle = (sandDetail.b - .5) * .003;
      float wet = 1. - smoothstep(SHORE_SWASH_MAX * .6, SHORE_SWASH_MAX * 1.1, groundField + mottle);
      float damp = 1. - smoothstep(SHORE_SWASH_MAX, SHORE_SWASH_MAX * 2.8, groundField + mottle * 2.);
      // Sand the backwash has just uncovered still holds a film of water: glossy for a moment.
      float uncovered = .3 + .3692 * acos(clamp(groundField / (SHORE_SWASH_MAX * waveSize), 0., 1.));
      float fresh = step(uncovered, tau) * (1. - smoothstep(0., .3, tau - uncovered)) * step(groundField, SHORE_SWASH_MAX * waveSize) * above;
      float sheet = (1. - smoothstep(reach - edge, reach + edge, groundField)) * running;
      vec3 wetSand = shoreWetSand(drySand);
      vec3 sand = mix(mix(drySand, mix(drySand, wetSand, .45), damp), wetSand, wet);
      // The sea bed: past the waterline the wet sand turns into the paler sand of the shallows, in soft drifts of
      // lighter and darker sand. The water above gives it its colour (opaque_fragment, below).
      if (seaDepth > 0.) sand = mix(sand, uSeabed * (.92 + .16 * meadow) * (.94 + .12 * sandDetail.b), under);
      // The sheet is the sea's water column, a film of water over the wet sand (below the waterline the bed is dimmed
      // by the same film and the sea adds its colour, see ocean.ts).
      sand = mix(sand, mix(uDeepWater, wetSand, exp(-WATER_EXTINCTION * max(reach - groundField, 0.) * 2. * shorePath(vViewPosition, vNormal))), sheet);
      // Its rounded front catches the sky in a thin bright rim; a bead of foam rides the front while the sheet runs
      // up and sinks into the sand as it drains.
      float frontDistance = (reach - groundField) / max(edge, 1e-5);
      float rim = smoothstep(.5, 1.5, frontDistance) * (1. - smoothstep(2., 5., frontDistance)) * running;
      float bead = (1. - smoothstep(edge * .5, edge * .5 + .0007, abs(groundField - reach + .0004))) * running * mix(1., .25, smoothstep(.3, .5, tau));
      float beachFoam = 0.;
      if (bead * beach > 0.) beachFoam = shoreFoam(vGroundPoint, bead * (.6 + .35 * waveSize), groundFootprint) * beach;
      sand = mix(sand, uFoam, beachFoam);
      diffuseColor.rgb = mix(diffuseColor.rgb, sand, beach);
      float groundCloud = cloudShade(groundDir);
      diffuseColor.rgb *= groundCloud;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, mix(.86, .5, wet), max(damp, wet) * beach);
      roughnessFactor = mix(roughnessFactor, .14, max(sheet, fresh * .75) * beach);
      roughnessFactor = mix(roughnessFactor, .8, beachFoam);
      // Under water the sea surface does the reflecting; the bed itself is matte.
      roughnessFactor = mix(roughnessFactor, .92, under);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Grass blades from the colour texture already sampled (no fetches of their own; bumpMap took three) on the
      // meadow, sand grain on the beach; the swash sheet is smooth.
      float grassBump = grassHeight * .009 * (1. - beach);
      normal = groundBump(-vViewPosition, normal, vec2(dFdx(grassBump), dFdy(grassBump)), faceDirection);
      // Wind ripples on the dry sand (~0.035 units apart), fading out before they would alias, and fine grain. Under
      // water the current lays longer ripples (~0.045 units) across the bare sand.
      float ripplePhase = dot(vGroundPoint, vec3(.62, .18, .76)) * 180. + sandDetail.b * 14.;
      float ripples = (pow(.5 + .5 * sin(ripplePhase), 1.6) - .4) * (1. - smoothstep(.8, 2.2, fwidth(ripplePhase))) * (1. - max(wet, damp * .6));
      float bedPhase = dot(vGroundPoint, vec3(-.41, .52, .75)) * 140. + sandDetail.b * 20.;
      float bedRipples = (pow(.5 + .5 * sin(bedPhase), 1.6) - .4) * (1. - smoothstep(.8, 2.2, fwidth(bedPhase))) * under;
      float sandRelief = (ripples * .0011 + bedRipples * .0013 + sandDetail.a * .0006 * grainK) * beach * (1. - sheet);
      normal = reliefBump(-vViewPosition, normal, sandRelief);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', seaSkyLightGLSL('seaDepth', 'vGroundUp', 'under'));
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      // Under water the waves gather the sunlight into a moving web on the bed (shore.ts).
      if (seaDepth > 0.) reflectedLight.directDiffuse *= underwaterCaustics(vGroundPoint, seaDepth, groundFootprint);
      // The sheet and the freshly drained sand reflect the sky like the sea does (Schlick, water F0 = 0.02).
      float sheen = .02 + .98 * pow(1. - clamp(dot(normalize(vViewPosition), normal), 0., 1.), 5.);
      reflectedLight.indirectSpecular += uSkySheen * uReflection * (sheen * (sheet * .9 + fresh * .3) + rim * .22) * beach * (1. - beachFoam) * groundCloud;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      // Seen through the sea: the bed loses light on the way down and back up, red first; the swash thickens the film
      // at the waterline as it does on the beach. The sea layer adds the light the water scatters back (ocean.ts).
      if (seaDepth > 0.) outgoingLight *= seenThroughWater(seaDepth + reach * 2. * (1. - smoothstep(0., .04, seaDepth)), vViewPosition, vGroundUp);
      #include <opaque_fragment>`);
  };
  groundMaterial.customProgramCacheKey = () => 'planet-ground-shore-v6';

  const random = rng(245);
  const dirtMap = canvasTexture(512, (ctx, size) => {
    const s = size / 2; ctx.scale(2, 2);
    ctx.fillStyle = '#c8b486'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 11000; i++) { ctx.globalAlpha = .1 + random() * .12; ctx.fillStyle = random() > .5 ? '#7b704b' : '#eee0ae'; ctx.fillRect(random() * s, random() * s, 1 + random() * 2, 1 + random() * 2); }
    // Grit and small pebbles at full resolution.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = 0; i < 9000; i++) { ctx.globalAlpha = .12 + random() * .14; ctx.fillStyle = i % 2 ? '#6f6444' : '#f4e8bd'; ctx.fillRect(random() * size, random() * size, 1, 1); }
    for (let i = 0; i < 160; i++) { const x = random() * size, y = random() * size, r = 1.2 + random() * 2.2; ctx.globalAlpha = .35; ctx.fillStyle = '#e9dcb4'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .75, random() * 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = .22; ctx.fillStyle = '#5f553a'; ctx.fillRect(x - r * .8, y + r * .55, r * 1.6, .8); }
    ctx.globalAlpha = 1;
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
  return { terrain, seabed, deepFloor, ocean, oceanSurface, detail };
}
