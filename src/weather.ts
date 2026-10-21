import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { rng, vec } from './craft';
import { createCloudShadowUniform, projectCloudShadow } from './cloud-shadows';
import { elevation, PLANET_RADIUS } from './planet-surface';
import { WeatherState } from './weather-state';
import { CLOUD_MAX_DEPTH, CLOUD_MAX_HEIGHT, CLOUD_MAX_THICKNESS, CLOUD_MAX_WIDTH, CLOUD_PROFILES, createCloudMotion, updateCloudMotion, type CloudMotion } from './cloud-motion';

interface CloudBank { normal: THREE.Vector3; group: THREE.Group; x: THREE.Vector3; z: THREE.Vector3; motion: CloudMotion; core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; }
interface Drop { bank: number; x: number; z: number; phase: number; seed: number; speed: number; }

export class PlanetWeather {
  readonly state = new WeatherState();
  readonly shadowUniform = createCloudShadowUniform();
  readonly group = new THREE.Group();
  readonly banks: CloudBank[] = [];
  readonly rain: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private drops: Drop[] = [];
  private rainPositions: Float32Array;
  private rainStrengths: Float32Array;
  private splashes: THREE.InstancedMesh;
  private splashLife = new Float32Array(64);
  private splashRain = new Float32Array(64);
  private dummy = new THREE.Object3D();
  private cloudBasis = new THREE.Matrix4();
  private direction = new THREE.Vector3();
  private point = new THREE.Vector3();
  private forward = vec(0,0,1);
  private white = new THREE.Color('#f5f4ec');
  private coreDark = new THREE.Color('#85909a');
  private previousCloudiness = -1;
  private cloudGeometry: THREE.BufferGeometry;
  private cloudBottom: number;
  readonly framingRadius: number;
  minimumRainClearance = 0;

  constructor(parent: THREE.Object3D) {
    this.group.name = 'clouds-and-local-rain'; parent.add(this.group);
    const random = rng(714);
    // A continuous cloud volume with a clean three-dimensional silhouette.
    const resolution = 40;
    const field = new MarchingCubes(resolution, new THREE.MeshBasicMaterial(), false, false, 18000);
    field.isolation = .58;
    const lobes = [
      [-.54,-.03,0,.28,.2,.27],[-.22,.08,.02,.34,.29,.32],
      [.12,.18,-.02,.34,.35,.3],[.43,.05,.02,.28,.25,.29],
      [.64,-.04,.02,.22,.16,.23],[-.05,-.08,.18,.4,.19,.29],
      [.12,-.09,-.18,.42,.18,.26],[-.3,.1,-.18,.23,.21,.23],
      [-.4,.22,.04,.18,.18,.2],[-.08,.38,.01,.19,.18,.2],[.3,.28,.05,.18,.19,.2],
    ];
    for(let z=0;z<resolution;z++) for(let y=0;y<resolution;y++) for(let x=0;x<resolution;x++) {
      const px=x/resolution*2-1,py=y/resolution*2-1,pz=z/resolution*2-1;
      let density=0;
      for(const [cx,cy,cz,sx,sy,sz] of lobes) density+=Math.exp(-2*((px-cx)**2/sx**2+(py-cy)**2/sy**2+(pz-cz)**2/sz**2));
      field.field[x+y*resolution+z*resolution*resolution]=density*(1+.06*Math.sin(px*24)*Math.sin(py*23)*Math.sin(pz*27));
    }
    field.update();
    const count = field.geometry.drawRange.count;
    this.cloudGeometry = new THREE.BufferGeometry();
    this.cloudGeometry.setAttribute('position',new THREE.BufferAttribute((field.geometry.attributes.position.array as Float32Array).slice(0,count*3),3));
    this.cloudGeometry.setAttribute('normal',new THREE.BufferAttribute((field.geometry.attributes.normal.array as Float32Array).slice(0,count*3),3));
    this.cloudGeometry.scale(1.55,1.45,1.55);
    this.cloudGeometry.computeBoundingSphere(); this.cloudGeometry.computeBoundingBox();
    this.cloudBottom = this.cloudGeometry.boundingBox!.min.y + .16;
    const cloudPositions = this.cloudGeometry.attributes.position;
    let reach = 0;
    for (let i=0;i<cloudPositions.count;i++) reach=Math.max(reach,Math.hypot(
      Math.hypot(cloudPositions.getX(i),cloudPositions.getZ(i))*Math.max(CLOUD_MAX_WIDTH,CLOUD_MAX_DEPTH),
      CLOUD_MAX_HEIGHT+Math.max(0,(cloudPositions.getY(i)+.16)*CLOUD_MAX_THICKNESS),
    ));
    this.framingRadius = reach;
    field.geometry.dispose(); (field.material as THREE.Material).dispose();
    CLOUD_PROFILES.forEach((profile, bank) => {
      const group = new THREE.Group(); this.group.add(group);
      const core = new THREE.Mesh(this.cloudGeometry, new THREE.MeshStandardMaterial({ color: '#f0f0e7', roughness: 1, emissive: '#9ca8af', emissiveIntensity: .16, transparent: true, depthWrite: false, opacity: 0 }));
      core.position.y = .16; core.rotation.y = profile.yaw; group.add(core);
      this.banks.push({ normal: vec(0,1,0), group, motion:createCloudMotion(), x: vec(1,0,0), z: vec(0,0,1), core });
      for (let i = 0; i < 140; i++) {
        const a = random()*Math.PI*2, r = Math.sqrt(random()), seed=random();
        this.drops.push({ bank, x: Math.cos(a)*r*.78, z: Math.sin(a)*r*.48, phase: seed, seed, speed: 2.0+random()*1.2 });
      }
    });
    this.rainPositions = new Float32Array(this.drops.length * 6);
    this.rainStrengths = new Float32Array(this.drops.length * 2);
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
    rainGeometry.setAttribute('aRain',new THREE.BufferAttribute(this.rainStrengths,1).setUsage(THREE.DynamicDrawUsage));
    const rainMaterial = new THREE.LineBasicMaterial({ color: '#c3d7e0', transparent: true, opacity: .34, depthWrite: false });
    rainMaterial.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float aRain; varying float vRain;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRain=aRain;');
      shader.fragmentShader = 'varying float vRain;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vRain;');
    };
    rainMaterial.customProgramCacheKey = () => 'local-cloud-rain-v1';
    this.rain = new THREE.LineSegments(rainGeometry, rainMaterial);
    // Share the normal transparent depth sort with clouds, so foreground clouds cover rain behind them.
    this.rain.name = 'radial-raindrops'; this.rain.frustumCulled = false; this.group.add(this.rain);
    const splashGeometry = new THREE.RingGeometry(.72, 1, 20);
    splashGeometry.setAttribute('aLife', new THREE.InstancedBufferAttribute(this.splashLife, 1));
    splashGeometry.setAttribute('aRain', new THREE.InstancedBufferAttribute(this.splashRain, 1));
    const splashMaterial = new THREE.ShaderMaterial({
      vertexShader: 'attribute float aLife; attribute float aRain; varying float vLife; varying float vRain; void main(){ vLife=aLife;vRain=aRain;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }',
      fragmentShader: 'varying float vLife; varying float vRain; void main(){ gl_FragColor=vec4(.67,.82,.84,vRain*(1.-vLife)*.32); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.splashes = new THREE.InstancedMesh(splashGeometry, splashMaterial, 64); this.splashes.frustumCulled = false; this.group.add(this.splashes);
  }

  update(dt: number, time: number, sunLocal: THREE.Vector3, reducedMotion: boolean) {
    this.state.update(dt);
    const { cloudiness, rain } = this.state;
    const darken = THREE.MathUtils.smoothstep(cloudiness, .32, .92);
    let maximumRain = 0;
    for (let i = 0; i < this.banks.length; i++) {
      const bank = this.banks[i];
      const motion=updateCloudMotion(i,reducedMotion ? 0 : time,cloudiness,rain,bank.motion);
      const cosLat=Math.cos(motion.latitude),sinLon=Math.sin(motion.longitude),cosLon=Math.cos(motion.longitude);
      bank.normal.set(cosLat*cosLon,Math.sin(motion.latitude),cosLat*sinLon);
      bank.group.position.copy(bank.normal).multiplyScalar(motion.height);
      // An eastward tangent gives all clouds a common prevailing wind without tying their speeds together.
      bank.x.set(-sinLon,0,cosLon);bank.z.crossVectors(bank.x,bank.normal);
      bank.group.quaternion.setFromRotationMatrix(this.cloudBasis.makeBasis(bank.x,bank.normal,bank.z));
      bank.group.scale.set(motion.width,motion.thickness,motion.depth);
      bank.group.visible = motion.opacity > .002;
      bank.core.material.opacity = motion.opacity;
      bank.core.material.color.copy(this.white).lerp(this.coreDark,darken*THREE.MathUtils.smoothstep(motion.opacity,.2,.85));
      projectCloudShadow(bank.group.position,sunLocal,(.1+cloudiness*.2)*motion.opacity,this.shadowUniform.value[i]);
      this.shadowUniform.radii.value[i]=.007*motion.width*motion.depth;
      maximumRain=Math.max(maximumRain,motion.rain);
    }

    this.rain.visible = maximumRain > .015; this.splashes.visible = maximumRain > .04;
    this.minimumRainClearance = Infinity;
    if (this.rain.visible) {
      for (let i = 0; i < this.drops.length; i++) {
        const drop = this.drops[i], bank = this.banks[drop.bank];
        this.direction.copy(bank.normal).addScaledVector(bank.x,drop.x*bank.motion.width/bank.motion.height).addScaledVector(bank.z,drop.z*bank.motion.depth/bank.motion.height).normalize();
        const floor = PLANET_RADIUS + Math.max(0,elevation(this.direction)) + .025;
        const ceiling = bank.motion.height + this.cloudBottom*bank.motion.thickness + .04;
        const speed = drop.speed * (reducedMotion ? .55 : 1);
        // Integrate the fall distance: varying cloud height must not multiply the entire elapsed time.
        drop.phase = (drop.phase+Math.max(0,dt)*speed/(ceiling-floor))%1;
        const radius = THREE.MathUtils.lerp(ceiling,floor,drop.phase);
        const tailRadius = Math.min(ceiling,radius+.09+rain*.1);
        this.point.copy(this.direction).multiplyScalar(radius).toArray(this.rainPositions,i*6);
        this.point.copy(this.direction).multiplyScalar(tailRadius).toArray(this.rainPositions,i*6+3);
        this.rainStrengths[i*2]=this.rainStrengths[i*2+1]=bank.motion.rain;
        this.minimumRainClearance = Math.min(this.minimumRainClearance,radius-floor+.025);
      }
      for (let i=0;i<64;i++) {
        const splashDrop = this.drops[(i*13)%this.drops.length], splashBank = this.banks[splashDrop.bank];
        this.point.copy(splashBank.normal).addScaledVector(splashBank.x,splashDrop.x*splashBank.motion.width/splashBank.motion.height).addScaledVector(splashBank.z,splashDrop.z*splashBank.motion.depth/splashBank.motion.height).normalize();
        const surface = PLANET_RADIUS + Math.max(0,elevation(this.point)) + .032;
        const life = (time*1.4+splashDrop.seed)%1; this.splashLife[i] = life;
        this.splashRain[i]=splashBank.motion.rain;
        this.dummy.position.copy(this.point).multiplyScalar(surface);
        this.dummy.quaternion.setFromUnitVectors(this.forward,this.point); this.dummy.scale.setScalar(.018+life*.075);
        this.dummy.updateMatrix(); this.splashes.setMatrixAt(i,this.dummy.matrix);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.geometry.attributes.aRain.needsUpdate = true;
      this.splashes.instanceMatrix.needsUpdate = true; this.splashes.geometry.attributes.aLife.needsUpdate = true; this.splashes.geometry.attributes.aRain.needsUpdate = true;
    }
    const changed = Math.abs(cloudiness-this.previousCloudiness) > .00001;
    this.previousCloudiness = cloudiness;
    return changed || !reducedMotion || rain > .015;
  }

  dispose() {
    this.rain.geometry.dispose(); this.rain.material.dispose();
    this.cloudGeometry.dispose();
    this.splashes.geometry.dispose(); (this.splashes.material as THREE.Material).dispose();
    for (const bank of this.banks) bank.core.material.dispose();
  }
}
