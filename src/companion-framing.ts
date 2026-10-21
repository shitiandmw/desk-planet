import { Matrix4, Vector3, type Object3D, type Mesh, type InstancedMesh } from 'three';
import { PLANET_RADIUS } from './planet-surface';

export const COMPANION_BASE_FOV = 36;
export const COMPANION_CAMERA_DISTANCE = PLANET_RADIUS * 4.4;
// Projected silhouette diameter as a fraction of the logical (unpadded) canvas.
export const COMPANION_PLANET_DIAMETER = PLANET_RADIUS / Math.sqrt(COMPANION_CAMERA_DISTANCE ** 2 - PLANET_RADIUS ** 2)
  / Math.tan(COMPANION_BASE_FOV * Math.PI / 360);
export const COMPANION_MIN_FRAME_SCALE = 1.125;
// Includes the full cloud geometry at maximum cloudiness, before the additional framing margin.
export const COMPANION_CLOUD_RADIUS = 12.2;

export function companionFrameScale(radius: number) {
  const reach = Math.min(COMPANION_CAMERA_DISTANCE * .9, Math.max(COMPANION_CLOUD_RADIUS, radius) + .35);
  const tangent = reach / Math.sqrt(COMPANION_CAMERA_DISTANCE ** 2 - reach ** 2);
  const scale = tangent / Math.tan(COMPANION_BASE_FOV * Math.PI / 360);
  return Math.max(COMPANION_MIN_FRAME_SCALE, Math.ceil(scale * 8) / 8);
}

/** Enlarge the viewing cone in exactly the same proportion as the CSS canvas: the planet keeps its pixel size. */
export function companionFrameFov(scale: number) {
  return Math.atan(Math.tan(COMPANION_BASE_FOV * Math.PI / 360) * scale) * 360 / Math.PI;
}

/** Bounding-box corners enclose every vertex, including thin cables, solar panels and transparent beams. */
export function radialExtent(root: Object3D, offset = new Vector3()) {
  root.updateWorldMatrix(true, true);
  const point = new Vector3(), instance = new Matrix4(), transform = new Matrix4();
  let radius = 0;
  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.geometry.attributes.position?.count) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const instanced = mesh as InstancedMesh;
    for (let i = 0; i < (instanced.isInstancedMesh ? instanced.count : 1); i++) {
      transform.copy(mesh.matrixWorld);
      if (instanced.isInstancedMesh) { instanced.getMatrixAt(i, instance); transform.multiply(instance); }
      for (let corner = 0; corner < 8; corner++) {
        point.set(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z);
        radius = Math.max(radius, point.applyMatrix4(transform).add(offset).length());
      }
    }
  });
  return radius;
}
