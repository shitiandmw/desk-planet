import * as THREE from 'three';
import { PLANET_RADIUS } from './planet-surface';
import type { Footprint } from './settlement-view';

interface Entry { mesh: THREE.InstancedMesh; matrices: THREE.Matrix4[]; directions: THREE.Vector3[]; sizes: number[]; hidden: boolean[] }

/** Instanced scenery — boulders, flowers — that steps aside wherever a facility now stands, and returns when it goes. */
export class SceneryClearance {
  private entries: Entry[] = [];
  private empty = new THREE.Matrix4().makeScale(0, 0, 0);

  /** `extent` converts an instance's horizontal scale into its radius on the ground. */
  register(mesh: THREE.InstancedMesh, extent = 1) {
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    const entry: Entry = { mesh, matrices: [], directions: [], sizes: [], hidden: [] };
    for (let i = 0; i < mesh.count; i++) {
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); matrix.decompose(position, rotation, scale);
      entry.matrices.push(matrix); entry.directions.push(position.clone().normalize()); entry.sizes.push(Math.max(scale.x, scale.z) * extent); entry.hidden.push(false);
    }
    this.entries.push(entry);
  }

  apply(footprints: Footprint[]) {
    const areas = footprints.map(f => ({ n: new THREE.Vector3(...f.direction), radius: f.radius }));
    for (const e of this.entries) {
      let changed = false;
      e.directions.forEach((n, i) => {
        const hide = areas.some(a => Math.acos(Math.min(1, n.dot(a.n))) * PLANET_RADIUS < a.radius + e.sizes[i] * .7 + .05);
        if (hide === e.hidden[i]) return;
        e.hidden[i] = hide; e.mesh.setMatrixAt(i, hide ? this.empty : e.matrices[i]); changed = true;
      });
      if (changed) e.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
