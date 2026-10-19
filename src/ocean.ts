import * as THREE from 'three';
import { canvasTexture } from './craft';
import { cloudShadowGLSL, type CloudShadowUniform } from './cloud-shadows';
import { elevation, PLANET_RADIUS } from './planet-surface';

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
varying float vWaterDepth;
varying vec3 vOceanX;
varying vec3 vOceanY;
varying vec3 vOceanZ;
`;

/** A closed dielectric water shell with world-space swells, sky reflection, shoals and moving foam. */
export class Ocean {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>;
  uniforms = {
    uOceanTime: { value: 0 }, uRain: { value: 0 },
    uDeepWater: { value: new THREE.Color('#12556f') },
    uShallowWater: { value: new THREE.Color('#4bb2a3') },
    uFoam: { value: new THREE.Color('#d8ebe0') },
  };
  private reflection: THREE.WebGLRenderTarget;

  constructor(renderer: THREE.WebGLRenderer, cloudShadows: CloudShadowUniform) {
    const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 256, 128);
    const position = geometry.attributes.position, depths = new Float32Array(position.count), normal = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      normal.fromBufferAttribute(position, i).normalize(); depths[i] = Math.max(0, -elevation(normal));
    }
    geometry.setAttribute('aWaterDepth', new THREE.BufferAttribute(depths, 1));

    // An embedded sky environment gives dielectric reflections without external HDR downloads.
    const sky = canvasTexture(512, (ctx, size) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, '#9dbed6'); gradient.addColorStop(.32, '#bdd4df');
      gradient.addColorStop(.49, '#f1eee0'); gradient.addColorStop(.53, '#c3cec3'); gradient.addColorStop(1, '#5b787d');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
      for (const [x,y,w,h] of [[110,100,130,14],[370,160,150,18],[240,205,190,9]]) {
        const glow = ctx.createRadialGradient(x,y,0,x,y,w*.5); glow.addColorStop(0,'rgba(255,255,247,.8)');glow.addColorStop(1,'rgba(255,255,247,0)');
        ctx.save();ctx.translate(x,y);ctx.scale(1,h/w);ctx.translate(-x,-y);ctx.fillStyle=glow;ctx.fillRect(x-w,y-w,w*2,w*2);ctx.restore();
      }
    });
    sky.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer); this.reflection = pmrem.fromEquirectangular(sky); pmrem.dispose(); sky.dispose();

    const material = new THREE.MeshPhysicalMaterial({
      color: '#ffffff', metalness: 0, roughness: .18, ior: 1.333,
      envMap: this.reflection.texture, envMapIntensity: 1.0,
      clearcoat: .08, clearcoatRoughness: .3,
    });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms, { uCloudShadows: cloudShadows });
      shader.vertexShader = `attribute float aWaterDepth;\n${oceanVaryings}\n${waveGLSL}\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vOceanPoint = position; vWaterDepth = aWaterDepth;
        vOceanX = normalMatrix * vec3(1.,0.,0.);
        vOceanY = normalMatrix * vec3(0.,1.,0.);
        vOceanZ = normalMatrix * vec3(0.,0.,1.);
        transformed += normalize(position) * oceanHeight(position) * smoothstep(0.,.25,aWaterDepth);
      `);
      shader.fragmentShader = `${oceanVaryings}\n${waveGLSL}\n${cloudShadowGLSL}\n
        uniform vec3 uDeepWater; uniform vec3 uShallowWater; uniform vec3 uFoam;
        float oceanHash(vec3 p) { p=fract(p*.3183099+vec3(.1,.3,.7));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float oceanNoise(vec3 p) {
          vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(mix(oceanHash(i),oceanHash(i+vec3(1,0,0)),f.x),mix(oceanHash(i+vec3(0,1,0)),oceanHash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(oceanHash(i+vec3(0,0,1)),oceanHash(i+vec3(1,0,1)),f.x),mix(oceanHash(i+vec3(0,1,1)),oceanHash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float shoal = exp(-vWaterDepth * 4.5);
        float detail = oceanNoise(vOceanPoint * 6.0);
        diffuseColor.rgb = mix(uDeepWater, uShallowWater, shoal);
        diffuseColor.rgb *= .96 + .07 * detail;
        float ripples = pow(.5+.5*sin(dot(vOceanPoint,swellA)*37.0+oceanNoise(vOceanPoint*7.0)*5.0-uOceanTime*2.2),12.0);
        ripples *= smoothstep(.55,.85,oceanNoise(vOceanPoint*14.0)) * smoothstep(.02,.18,vWaterDepth);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.28,.48,.51),ripples*(.025+uRain*.035));
        float coast = 1.0-smoothstep(.02,.13,vWaterDepth);
        float wash = .5+.5*sin(vWaterDepth*105.0-uOceanTime*1.5+detail*5.0);
        float foam = smoothstep(.8,.99,wash)*coast*smoothstep(.25,.65,detail)*.42;
        diffuseColor.rgb = mix(diffuseColor.rgb,uFoam,foam);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        vec3 radial = normalize(vOceanPoint);
        vec3 waveSlope = oceanGradient(vOceanPoint);
        waveSlope -= radial * dot(waveSlope,radial);
        waveSlope *= smoothstep(0.,.22,vWaterDepth);
        normal = normalize(normal - (vOceanX*waveSlope.x+vOceanY*waveSlope.y+vOceanZ*waveSlope.z));
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        float cloudShadow = cloudShade(normalize(vOceanPoint));
        reflectedLight.directDiffuse *= cloudShadow;
        reflectedLight.directSpecular *= cloudShadow;
      `);
    };
    material.customProgramCacheKey = () => 'planet-ocean-swell-v1';
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = 'continuous-ocean-sphere';
    this.mesh.castShadow = this.mesh.receiveShadow = false;
  }

  update(time: number, rain: number, cloudiness: number) {
    this.uniforms.uOceanTime.value = time; this.uniforms.uRain.value = rain;
    this.mesh.material.roughness = .22 + rain * .14;
    this.mesh.material.envMapIntensity = .9 - cloudiness * .3;
  }

  dispose() { this.reflection.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
