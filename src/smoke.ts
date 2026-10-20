import * as THREE from 'three';
import { SETTLEMENT_SCALE } from './planet-surface';

export type SmokeKind = 'chimney' | 'industry' | 'steam';
export interface SmokeEmitter { position: THREE.Vector3; kind: SmokeKind; size: number; buildingId: string; seed: number }

/** Rise, growth and lifetime are in model units / seconds; colour separates hearth smoke, soot and white steam. */
const STYLE: Record<SmokeKind, { color: THREE.Color; rise: number; grow: number; life: number; drift: number; alpha: number }> = {
  chimney: { color: new THREE.Color('#efede6'), rise: 1.05, grow: .2, life: 4.6, drift: .28, alpha: .58 },
  industry: { color: new THREE.Color('#b9b7b0'), rise: 1.7, grow: .28, life: 6, drift: .5, alpha: .55 },
  steam: { color: new THREE.Color('#fbfbf8'), rise: 1.1, grow: .28, life: 3.4, drift: .22, alpha: .45 },
};
const PUFFS = 6;

/** Soft rising puffs for every chimney marker, drawn as one instanced mesh that rotates with the planet. */
export class SmokePlumes {
  readonly mesh: THREE.InstancedMesh;
  private emitters: SmokeEmitter[] = [];
  private alpha: Float32Array;
  private dummy = new THREE.Object3D();
  private up = new THREE.Vector3();
  private side = new THREE.Vector3();
  private wind = new THREE.Vector3(.6, 0, .8).normalize();

  constructor(parent: THREE.Object3D, private max = 720) {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    this.alpha = new Float32Array(max);
    geometry.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, depthWrite: false, emissive: '#d9d6cf', emissiveIntensity: .25 });
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float aAlpha;\nvarying float vSmokeAlpha;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSmokeAlpha = aAlpha;');
      // Edges fade with the view angle so each puff reads as a soft volume instead of a ball.
      shader.fragmentShader = 'varying float vSmokeAlpha;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vSmokeAlpha * smoothstep(0.0, 0.65, abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))));');
    };
    material.customProgramCacheKey = () => 'smoke-puffs-v1';
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false; this.mesh.renderOrder = 4;
    this.mesh.name = 'chimney-smoke';
    parent.add(this.mesh);
  }

  setEmitters(emitters: SmokeEmitter[]) { this.emitters = emitters.slice(0, Math.floor(this.max / PUFFS)); }
  get emitterCount() { return this.emitters.length; }

  /** `active` decides per building whether its stacks are burning; returns whether anything is visible. */
  update(time: number, active: (buildingId: string) => boolean) {
    let n = 0;
    for (const e of this.emitters) {
      if (!active(e.buildingId)) continue;
      const style = STYLE[e.kind], s = e.size * SETTLEMENT_SCALE;
      this.up.copy(e.position).normalize();
      this.side.copy(this.wind).addScaledVector(this.up, -this.wind.dot(this.up)).normalize();
      for (let k = 0; k < PUFFS; k++) {
        const t = ((time / style.life) + k / PUFFS + e.seed) % 1;
        this.dummy.position.copy(e.position).addScaledVector(this.up, t * style.rise * s).addScaledVector(this.side, t * t * style.drift * s);
        this.dummy.scale.setScalar((.05 + t * style.grow) * s * (1 + .15 * Math.sin(k * 2.7 + e.seed * 9)));
        this.dummy.updateMatrix(); this.mesh.setMatrixAt(n, this.dummy.matrix); this.mesh.setColorAt(n, style.color);
        this.alpha[n] = style.alpha * Math.min(1, t / .12) * Math.pow(1 - t, 1.4);
        n++;
      }
    }
    this.mesh.count = n;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; (this.mesh.geometry.attributes.aAlpha as THREE.InstancedBufferAttribute).needsUpdate = true; }
    return n > 0;
  }

  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
