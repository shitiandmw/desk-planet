import * as THREE from 'three';
import { canvasTexture } from './craft';
import { cloudShadowGLSL, type CloudShadowUniform } from './cloud-shadows';
import { PLANET_RADIUS } from './planet-surface';
import { planetNoiseGLSL } from './planet-glsl';
import { planetFieldSampleGLSL } from './planet-field-texture';

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
 * shallows, caustics and the foam line are smooth at any zoom instead of following mesh triangles. Caustics and surf
 * are only evaluated in the shallow band where they can be seen.
 */
export class Ocean {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>;
  uniforms = {
    uOceanTime: { value: 0 }, uRain: { value: 0 },
    uDeepWater: { value: new THREE.Color('#14609a') },
    uMidWater: { value: new THREE.Color('#1f97bf') },
    uShallowWater: { value: new THREE.Color('#41c3c2') },
    // Darker than the beach sand: the water is also lit by the sky environment, which the ground is not.
    uSeabed: { value: new THREE.Color('#bfb27e') },
    uFoam: { value: new THREE.Color('#f4f8f2') },
    uPlanetField: { value: null as THREE.Texture | null },
  };
  private reflection: THREE.WebGLRenderTarget;
  /** The embedded sky environment, shared with glass and metal on buildings. */
  get environment() { return this.reflection.texture; }

  constructor(renderer: THREE.WebGLRenderer, cloudShadows: CloudShadowUniform, field: THREE.Texture) {
    this.uniforms.uPlanetField.value = field;
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
      Object.assign(shader.uniforms, this.uniforms, { uCloudShadows: cloudShadows });
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
      shader.fragmentShader = `${oceanVaryings}\n${waveGLSL}\n${cloudShadowGLSL}\n${planetFieldSampleGLSL}\n${planetNoiseGLSL}\n
        uniform vec3 uDeepWater; uniform vec3 uMidWater; uniform vec3 uShallowWater; uniform vec3 uSeabed; uniform vec3 uFoam;
        float oceanDepth;
        // Two drifting noise layers meet in thin bright ridges: the familiar caustic web over a sandy bed.
        float caustics(vec3 p) {
          vec3 q = p * 7.5;
          float a = planetNoise(q + vec3(uOceanTime * .32, 0., uOceanTime * .23));
          float b = planetNoise(q * 1.63 - vec3(uOceanTime * .21, uOceanTime * .27, 0.));
          return pow(clamp(1. - abs(a - b) * 2.6, 0., 1.), 6.);
        }
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec4 oceanField = planetFieldSample(normalize(vOceanPoint));
        oceanDepth = planetSeaDepth(oceanField);
        vec3 water = mix(uShallowWater, uMidWater, smoothstep(.02, .45, oceanDepth));
        water = mix(water, uDeepWater, smoothstep(.3, 1.3, oceanDepth));
        water *= .965 + .07 * oceanField.b;
        float ripples = pow(.5 + .5 * sin(dot(vOceanPoint, swellA) * 37. + oceanField.b * 5. - uOceanTime * 2.2), 12.);
        water = mix(water, water * vec3(.82, .92, .96), ripples * smoothstep(.45, .8, oceanField.a) * smoothstep(.04, .2, oceanDepth) * (.06 + uRain * .08));
        if (oceanDepth < .5) {
          // Beer-Lambert style clarity: the sandy bed shows through the shallows and caustics play across it.
          float clarity = exp(-oceanDepth * 30.), light = caustics(vOceanPoint);
          water = mix(water, uSeabed * (.9 + .32 * light), clarity * .8);
          water += vec3(.10, .16, .14) * light * exp(-oceanDepth * 8.) * (1. - clarity * .6) * .6;
        }
        diffuseColor.rgb = water;
        if (oceanDepth < .11) {
          // Foam: a thin, broken line just offshore plus faint wave fronts rolling in; the waterline itself stays sandy
          // so the mesh intersection with the terrain is never outlined.
          float breakup = planetNoise(vOceanPoint * 17. + uOceanTime * .18);
          float line = smoothstep(.014, .024, oceanDepth) * (1. - smoothstep(.032, .046, oceanDepth));
          float fronts = .5 + .5 * sin(oceanDepth * 130. + uOceanTime * 1.7 + breakup * 3.);
          float rolling = smoothstep(.9, .98, fronts) * smoothstep(.03, .05, oceanDepth) * (1. - smoothstep(.07, .11, oceanDepth));
          float foam = max(line * smoothstep(.3, .65, breakup + .1), rolling * smoothstep(.45, .75, breakup) * .5) * (.75 + uRain * .15);
          diffuseColor.rgb = mix(water, uFoam, foam);
        }
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        vec3 radial = normalize(vOceanPoint);
        vec3 waveSlope = oceanGradient(vOceanPoint);
        // Fine capillary ripples break the sun highlight into glints offshore.
        vec3 q = vOceanPoint * 42. + vec3(uOceanTime * .6, 0., -uOceanTime * .5);
        waveSlope += vec3(sin(dot(q, vec3(.83, .21, .52))), sin(dot(q, vec3(-.31, .78, .55)) + 1.7), sin(dot(q, vec3(.42, -.47, .78)) + 3.1)) * .022;
        waveSlope -= radial * dot(waveSlope,radial);
        waveSlope *= smoothstep(0., .22, oceanDepth);
        normal = normalize(normal - (vOceanX*waveSlope.x+vOceanY*waveSlope.y+vOceanZ*waveSlope.z));
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        float cloudShadow = cloudShade(normalize(vOceanPoint));
        reflectedLight.directDiffuse *= cloudShadow;
        reflectedLight.directSpecular *= cloudShadow;
      `);
    };
    material.customProgramCacheKey = () => 'planet-ocean-baked-v4';
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = 'continuous-ocean-sphere';
    this.mesh.castShadow = this.mesh.receiveShadow = false;
  }

  update(time: number, rain: number, cloudiness: number) {
    this.uniforms.uOceanTime.value = time; this.uniforms.uRain.value = rain;
    this.mesh.material.roughness = .12 + rain * .16;
    this.mesh.material.envMapIntensity = .95 - cloudiness * .3;
  }

  dispose() { this.reflection.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
