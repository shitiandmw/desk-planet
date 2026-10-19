import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { rng, vec } from './craft';
import { createCloudShadowUniform } from './cloud-shadows';
import { elevation, NORTH, PLANET_RADIUS } from './planet-surface';
import { WeatherState } from './weather-state';

interface CloudBank { normal: THREE.Vector3; base: THREE.Vector3; group: THREE.Group; x: THREE.Vector3; z: THREE.Vector3; core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; }
interface Drop { bank: number; x: number; z: number; phase: number; speed: number; }

export class PlanetWeather {
  readonly state = new WeatherState();
  readonly shadowUniform = createCloudShadowUniform();
  readonly group = new THREE.Group();
  readonly banks: CloudBank[] = [];
  readonly rain: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private drops: Drop[] = [];
  private rainPositions: Float32Array;
  private splashes: THREE.InstancedMesh;
  private splashLife = new Float32Array(64);
  private splashUniform = { value: 0 };
  private dummy = new THREE.Object3D();
  private direction = new THREE.Vector3();
  private point = new THREE.Vector3();
  private forward = vec(0,0,1);
  private white = new THREE.Color('#f5f4ec');
  private coreDark = new THREE.Color('#85909a');
  private previousCloudiness = -1;
  private cloudGeometry: THREE.BufferGeometry;
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
    this.cloudGeometry.computeBoundingSphere(); field.geometry.dispose(); (field.material as THREE.Material).dispose();
    const directions = [vec(-.42,.77,.48),vec(.49,.75,.45),vec(.25,-.45,-.86),vec(-.85,-.25,.38)];
    directions.forEach((base, bank) => {
      base.normalize(); const group = new THREE.Group(); this.group.add(group);
      const core = new THREE.Mesh(this.cloudGeometry, new THREE.MeshStandardMaterial({ color: '#f0f0e7', roughness: 1, emissive: '#9ca8af', emissiveIntensity: .16 }));
      core.position.y = .16; core.rotation.y = bank * .8; group.add(core);
      this.banks.push({ base, normal: base.clone(), group, x: vec(1,0,0), z: vec(0,0,1), core });
      for (let i = 0; i < 140; i++) {
        const a = random()*Math.PI*2, r = Math.sqrt(random());
        this.drops.push({ bank, x: Math.cos(a)*r*.78, z: Math.sin(a)*r*.48, phase: random(), speed: 2.0+random()*1.2 });
      }
    });
    this.rainPositions = new Float32Array(this.drops.length * 6);
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#c3d7e0', transparent: true, opacity: 0, depthWrite: false }));
    this.rain.name = 'radial-raindrops'; this.rain.frustumCulled = false; this.rain.renderOrder = 3; this.group.add(this.rain);
    const splashGeometry = new THREE.RingGeometry(.72, 1, 20);
    splashGeometry.setAttribute('aLife', new THREE.InstancedBufferAttribute(this.splashLife, 1));
    const splashMaterial = new THREE.ShaderMaterial({
      uniforms: { uRain: this.splashUniform },
      vertexShader: 'attribute float aLife; varying float vLife; void main(){ vLife=aLife;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform float uRain; varying float vLife; void main(){ gl_FragColor=vec4(.67,.82,.84,uRain*(1.-vLife)*.32); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.splashes = new THREE.InstancedMesh(splashGeometry, splashMaterial, 64); this.splashes.frustumCulled = false; this.splashes.renderOrder = 2; this.group.add(this.splashes);
  }

  update(dt: number, time: number, sunLocal: THREE.Vector3, reducedMotion: boolean) {
    this.state.update(dt);
    const { cloudiness, rain } = this.state;
    const drift = reducedMotion ? 0 : time * .006;
    const darken = THREE.MathUtils.smoothstep(cloudiness, .32, .92);
    for (let i = 0; i < this.banks.length; i++) {
      const bank = this.banks[i];
      bank.normal.copy(bank.base).applyAxisAngle(NORTH, drift);
      bank.group.position.copy(bank.normal).multiplyScalar(PLANET_RADIUS + 2.65);
      bank.group.quaternion.setFromUnitVectors(NORTH, bank.normal);
      bank.group.scale.setScalar(.84 + cloudiness * .27);
      bank.x.set(1,0,0).applyQuaternion(bank.group.quaternion); bank.z.set(0,0,1).applyQuaternion(bank.group.quaternion);
      bank.core.material.color.copy(this.white).lerp(this.coreDark,darken);
      // Project the cloud along the actual sun direction onto the spherical receiver.
      const p = bank.group.position, b = p.dot(sunLocal), discriminant = b*b - (p.lengthSq()-PLANET_RADIUS*PLANET_RADIUS);
      const shadow = this.shadowUniform.value[i];
      if (b > 0 && discriminant > 0) {
        this.point.copy(p).addScaledVector(sunLocal,-b+Math.sqrt(discriminant)).normalize();
        shadow.set(this.point.x,this.point.y,this.point.z,.13+cloudiness*.22);
      } else shadow.w = 0;
    }

    this.rain.visible = rain > .015; this.splashes.visible = rain > .04;
    this.rain.material.opacity = rain * .34; this.splashUniform.value = rain;
    this.minimumRainClearance = Infinity;
    if (this.rain.visible) {
      for (let i = 0; i < this.drops.length; i++) {
        const drop = this.drops[i], bank = this.banks[drop.bank];
        this.direction.copy(bank.normal).addScaledVector(bank.x,drop.x*bank.group.scale.x/(PLANET_RADIUS+2.65)).addScaledVector(bank.z,drop.z*bank.group.scale.x/(PLANET_RADIUS+2.65)).normalize();
        const floor = PLANET_RADIUS + Math.max(0,elevation(this.direction)) + .025;
        const ceiling = PLANET_RADIUS + 2.48;
        const speed = drop.speed * (reducedMotion ? .55 : 1);
        const phase = (time*speed/(ceiling-floor)+drop.phase)%1;
        const radius = THREE.MathUtils.lerp(ceiling,floor,phase);
        const tailRadius = Math.min(ceiling,radius+.09+rain*.1);
        this.point.copy(this.direction).multiplyScalar(radius).toArray(this.rainPositions,i*6);
        this.point.copy(this.direction).multiplyScalar(tailRadius).toArray(this.rainPositions,i*6+3);
        this.minimumRainClearance = Math.min(this.minimumRainClearance,radius-floor+.025);
        if (i < 64) {
          const splashDrop = this.drops[(i*13)%this.drops.length], splashBank = this.banks[splashDrop.bank];
          this.point.copy(splashBank.normal).addScaledVector(splashBank.x,splashDrop.x*splashBank.group.scale.x/(PLANET_RADIUS+2.65)).addScaledVector(splashBank.z,splashDrop.z*splashBank.group.scale.x/(PLANET_RADIUS+2.65)).normalize();
          const surface = PLANET_RADIUS + Math.max(0,elevation(this.point)) + .032;
          const life = (time*1.4+splashDrop.phase)%1; this.splashLife[i] = life;
          this.dummy.position.copy(this.point).multiplyScalar(surface);
          this.dummy.quaternion.setFromUnitVectors(this.forward,this.point); this.dummy.scale.setScalar(.018+life*.075);
          this.dummy.updateMatrix(); this.splashes.setMatrixAt(i,this.dummy.matrix);
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.splashes.instanceMatrix.needsUpdate = true; this.splashes.geometry.attributes.aLife.needsUpdate = true;
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
