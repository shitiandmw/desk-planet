import * as THREE from 'three';
import { canvasTexture } from './craft';
import { cloudShadowGLSL, type CloudShadowUniform } from './cloud-shadows';
import { PLANET_RADIUS } from './planet-surface';
import { planetFieldSampleGLSL } from './planet-field-texture';
import { detailVolumeGLSL } from './detail-volume';
import { SHORE_BREAK_DEPTH, shoreGLSL } from './shore';

const waveGLSL = `
uniform float uOceanTime;
uniform float uRain;
vec3 swellA = normalize(vec3(0.12,0.95,0.30));
vec3 swellB = normalize(vec3(-0.45,0.18,0.87));
vec3 swellC = normalize(vec3(0.72,0.55,-0.42));
float oceanHeight(vec3 p) {
  float warp = sin(dot(p,swellB)*1.3+uOceanTime*.12)*1.2+sin(dot(p,swellC)*.8)*1.8;
  return (sin(dot(p,swellA)*4.5-uOceanTime*1.15+warp)*0.008
    +sin(dot(p,swellB)*8.2-uOceanTime*1.8+warp)*0.0035
    +sin(dot(p,swellC)*23.0+uOceanTime*2.1+warp)*0.0018)*(1.0+uRain*0.65);
}
vec3 oceanGradient(vec3 p) {
  float warp = sin(dot(p,swellB)*1.3+uOceanTime*.12)*1.2+sin(dot(p,swellC)*.8)*1.8;
  return (swellA*cos(dot(p,swellA)*4.5-uOceanTime*1.15+warp)*0.036
    +swellB*cos(dot(p,swellB)*8.2-uOceanTime*1.8+warp)*0.0287
    +swellC*cos(dot(p,swellC)*23.0+uOceanTime*2.1+warp)*0.0414)*(1.0+uRain*0.65);
}
`;
const oceanVaryings = `
varying vec3 vOceanPoint;
varying vec3 vOceanX;
varying vec3 vOceanY;
varying vec3 vOceanZ;
`;

/**
 * A closed dielectric water shell. Depth comes from the baked terrain field per pixel, so the shoreline, the sandy
 * shallows, caustics and the surf are smooth at any zoom instead of following mesh triangles. The colour is a water
 * column rather than painted bands: light that reaches the sea bed and returns is absorbed per channel along the
 * refracted view path, so the shallows over pale sand turn turquoise, deepen to blue and stay clear when seen from
 * above. Caustics and foam come from the shared detail volume and are only evaluated in the band where they show.
 */
export class Ocean {
  reflectionStrength = 1;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>;
  uniforms = {
    uOceanTime: { value: 0 }, uRain: { value: 0 },
    /** Strength of the sky reflection, shared with the beach's swash sheet. */
    uReflection: { value: 1 },
    // What an endless column of water looks like: the light it scatters back once the bed is out of sight.
    uDeepWater: { value: new THREE.Color('#11599a') },
    // Pale sand under clear water; the bed blends into the beach's wet sand at the waterline.
    uSeabed: { value: new THREE.Color('#d9d8c4') },
    uSand: { value: new THREE.Color('#e4d6a6') },
    uFoam: { value: new THREE.Color('#f4f8f2') },
    uPlanetField: { value: null as THREE.Texture | null },
    uDetail: { value: null as THREE.Texture | null },
  };
  private reflection: THREE.WebGLRenderTarget;
  /** The embedded sky environment, shared with glass and metal on buildings. */
  get environment() { return this.reflection.texture; }

  constructor(renderer: THREE.WebGLRenderer, cloudShadows: CloudShadowUniform, field: THREE.Texture, detail: THREE.Texture) {
    this.uniforms.uPlanetField.value = field;
    this.uniforms.uDetail.value = detail;
    const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 256, 128);

    // An embedded sky environment gives dielectric reflections without external HDR downloads.
    const sky = canvasTexture(512, (ctx, size) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, '#8fb9da'); gradient.addColorStop(.32, '#b9d4e3');
      gradient.addColorStop(.49, '#f3f0e2'); gradient.addColorStop(.53, '#c3d2cb'); gradient.addColorStop(1, '#4f7a86');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
      for (const [x,y,w,h] of [[110,100,130,14],[370,160,150,18],[240,205,190,9]]) {
        const glow = ctx.createRadialGradient(x,y,0,x,y,w*.5); glow.addColorStop(0,'rgba(255,255,247,.8)');glow.addColorStop(1,'rgba(255,255,247,0)');
        ctx.save();ctx.translate(x,y);ctx.scale(1,h/w);ctx.translate(-x,-y);ctx.fillStyle=glow;ctx.fillRect(x-w,y-w,w*2,w*2);ctx.restore();
      }
    });
    sky.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer); this.reflection = pmrem.fromEquirectangular(sky); pmrem.dispose(); sky.dispose();

    const material = new THREE.MeshPhysicalMaterial({
      color: '#ffffff', metalness: 0, roughness: .12, ior: 1.333,
      envMap: this.reflection.texture, envMapIntensity: 1.0,
    });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms, { uCloudShadows: cloudShadows, uCloudShadowRadii: cloudShadows.radii });
      shader.vertexShader = `${oceanVaryings}\n${waveGLSL}\n${planetFieldSampleGLSL}\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vOceanPoint = position;
        vOceanX = normalMatrix * vec3(1.,0.,0.);
        vOceanY = normalMatrix * vec3(0.,1.,0.);
        vOceanZ = normalMatrix * vec3(0.,0.,1.);
        float vertexDepth = planetSeaDepth(planetFieldSample(normalize(position)));
        transformed += normalize(position) * oceanHeight(position) * smoothstep(0.,.25,vertexDepth);
      `);
      shader.fragmentShader = `${oceanVaryings}\n${waveGLSL}\n${cloudShadowGLSL}\n${planetFieldSampleGLSL}\n${detailVolumeGLSL}\n${shoreGLSL}\n
        uniform vec3 uDeepWater; uniform vec3 uSeabed; uniform vec3 uSand; uniform vec3 uFoam;
        float oceanDepth, oceanFoam, oceanFootprint, oceanGust;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec4 oceanField = planetFieldSample(normalize(vOceanPoint));
        oceanDepth = planetSeaDepth(oceanField);
        oceanFootprint = length(fwidth(vOceanPoint));
        // Gusts: broad patches of rougher water drift across the sea; they carry more ripples and reflect less sky.
        oceanGust = texture(uDetail, vOceanPoint * .045 + vec3(.0021, 0., .0013) * uOceanTime).b;
        // The water column: light reaches the bed and returns along the refracted view ray, losing red first.
        // At the waterline the column also holds the swash sheet running up the beach, exactly as the beach shades it,
        // so the water and the sand agree where the two meshes meet.
        float landPhase = shorePhase(0., oceanField.b);
        float surge = SHORE_SWASH_MAX * shoreSet(floor(landPhase)) * swashProfile(fract(landPhase)) * (1. - smoothstep(0., .04, oceanDepth));
        vec3 transmit = exp(-WATER_EXTINCTION * (oceanDepth + surge * 2.) * shorePath(vViewPosition, vNormal));
        vec3 bed = mix(shoreWetSand(uSand * (.95 + .1 * oceanField.b)), uSeabed * (.92 + .16 * oceanField.b), smoothstep(0., .05, oceanDepth));
        // Shore waves (shore.ts): swells shoal and steepen, break into a bore of white water and run up the sand.
        float wavePhase = shorePhase(oceanDepth, oceanField.b), phaseWidth = fwidth(wavePhase);
        float waveU = fract(wavePhase + .5) - .5;
        float breaking = smoothstep(SHORE_BREAK_DEPTH * 1.2, SHORE_BREAK_DEPTH * .75, oceanDepth) * shoreSet(floor(wavePhase));
        float swell = (1. - smoothstep(0., .1 + phaseWidth, abs(waveU))) * (1. - breaking) * (1. - smoothstep(.05, .14, oceanDepth));
        if (oceanDepth < .45) {
          // Caustics: two drifting slices of the warped cell network; light gathers on their edges and crossings.
          // Lines are drawn at least a pixel and a half wide (edge distance per pixel ~ footprint / 0.06), then fade.
          float causticK = DETAIL_FADE(oceanFootprint, .016) * smoothstep(.0, .02, oceanDepth) * (1. - smoothstep(.05, .45, oceanDepth));
          if (causticK > .002) {
            vec3 q = vOceanPoint * 1.6;
            float a = textureLod(uDetail, q + vec3(.021, .013, -.017) * uOceanTime, 0.).r;
            float b = textureLod(uDetail, q * 1.37 + vec3(-.015, .019, .011) * uOceanTime + .5, 0.).r;
            float line = max(.13, oceanFootprint * 25.);
            float web = (1. - smoothstep(0., line, a)) + (1. - smoothstep(0., line * 1.3, b)) * .6;
            bed *= 1. + (web * web * .32 - .08) * causticK;
          }
        }
        vec3 water = mix(uDeepWater, bed, transmit);
        // The thin crest of a shoaling swell lets light through: a brighter, greener band rolls toward the beach.
        water *= 1. + swell * vec3(.05, .16, .13);
        float ripples = pow(.5 + .5 * sin(dot(vOceanPoint, swellA) * 37. + oceanField.b * 5. - uOceanTime * 2.2), 12.);
        water = mix(water, water * vec3(.82, .92, .96), ripples * DETAIL_FADE(oceanFootprint, .05) * smoothstep(.45, .8, oceanField.a) * smoothstep(.04, .2, oceanDepth) * (.06 + uRain * .08));
        diffuseColor.rgb = water;
        oceanFoam = 0.;
        if (oceanDepth < SHORE_BREAK_DEPTH * 1.4) {
          // The bore: a dense roller of white water with lace trailing behind it, plus lace lingering in the surf
          // zone. The waterline itself stays foam-free, so the mesh intersection with the beach is never outlined.
          float roller = smoothstep(-.025 - phaseWidth, phaseWidth, waveU) * (1. - smoothstep(0., .035 + phaseWidth, waveU));
          float bore = max(roller * .95, smoothstep(-.02, .02, waveU) * (1. - smoothstep(0., .22, waveU)) * .55) * breaking;
          float lace = (1. - smoothstep(0., SHORE_BREAK_DEPTH, oceanDepth)) * .28;
          float coverage = max(bore, lace) * smoothstep(0., .006, oceanDepth) * (.85 + uRain * .2);
          oceanFoam = shoreFoam(vOceanPoint, coverage, oceanFootprint);
          diffuseColor.rgb = mix(water, uFoam, oceanFoam);
        }
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        vec3 radial = normalize(vOceanPoint);
        vec3 waveSlope = oceanGradient(vOceanPoint);
        // Fine capillary ripples break the sun highlight into glints offshore; stronger in gusts, faded out once a
        // pixel spans their wavelength.
        float rippleK = DETAIL_FADE(oceanFootprint, .05) * (.55 + .9 * oceanGust);
        vec3 q = vOceanPoint * 42. + vec3(uOceanTime * .6, 0., -uOceanTime * .5);
        waveSlope += vec3(sin(dot(q, vec3(.83, .21, .52))), sin(dot(q, vec3(-.31, .78, .55)) + 1.7), sin(dot(q, vec3(.42, -.47, .78)) + 3.1)) * .022 * rippleK;
        waveSlope -= radial * dot(waveSlope,radial);
        waveSlope *= smoothstep(0., .22, oceanDepth);
        normal = normalize(normal - (vOceanX*waveSlope.x+vOceanY*waveSlope.y+vOceanZ*waveSlope.z));
        // Specular anti-aliasing: slopes a pixel can't resolve widen the highlight instead of sparkling.
        vec3 normalSpread = abs(dFdx(normal)) + abs(dFdy(normal));
        roughnessFactor = sqrt(roughnessFactor * roughnessFactor + dot(normalSpread, normalSpread) * .5 + (1. - rippleK) * .012);
        roughnessFactor = min(mix(roughnessFactor * mix(.8, 1.3, oceanGust), .6, oceanFoam), 1.);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        // The sky environment also lights the water column; the bed seen through the last of the water is lit like the
        // beach beside it instead, so the water fades into the wet sand rather than outlining the mesh intersection.
        iblIrradiance *= smoothstep(0., .03, oceanDepth);
        #include <lights_fragment_end>
        float cloudShadow = cloudShade(normalize(vOceanPoint));
        reflectedLight.directDiffuse *= cloudShadow;
        reflectedLight.directSpecular *= cloudShadow * (1. - oceanFoam);
        reflectedLight.indirectSpecular *= 1. - oceanFoam * .7;
      `);
    };
    material.customProgramCacheKey = () => 'planet-ocean-column-v5';
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = 'continuous-ocean-sphere';
    this.mesh.castShadow = this.mesh.receiveShadow = false;
  }

  update(time: number, rain: number, cloudiness: number) {
    this.uniforms.uOceanTime.value = time; this.uniforms.uRain.value = rain;
    this.mesh.material.roughness = .12 + rain * .16;
    this.mesh.material.envMapIntensity = this.uniforms.uReflection.value = (.95 - cloudiness * .3) * this.reflectionStrength;
  }

  dispose() { this.reflection.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

/** Sea depth beyond which the beach terrain is always under opaque water, so the ground mesh can leave it out. */
export const HIDDEN_SEABED_DEPTH = SHORE_BREAK_DEPTH * 1.25;
