import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BACK_LAND, dragRotation, elevation, landField, MIN_ELEVATION, NORTH, PLANET_RADIUS, planetGeometry, placeOnPlanet, surfacePoint } from './planet-surface';

test('terrain covers all six directions and never has the old cutaway base', () => {
  const geometry = planetGeometry(96, 48);
  const globe = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  globe.updateMatrixWorld();
  for (const direction of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), NORTH, NORTH.clone().negate(), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
    const ray = new THREE.Raycaster(direction.clone().multiplyScalar(20), direction.clone().negate());
    const hit = ray.intersectObject(globe)[0];
    assert.ok(hit, `missing hemisphere at ${direction.toArray()}`);
    assert.ok(hit.point.length() > PLANET_RADIUS + MIN_ELEVATION - .02 && hit.point.length() < PLANET_RADIUS + 1);
  }
  geometry.dispose();
});

test('the globe has both sea and land on its far side', () => {
  assert.ok(landField(BACK_LAND) > .1);
  assert.ok(landField(new THREE.Vector3(0, -1, 0)) < 0);
  assert.ok(landField(NORTH) > .1);
});

test('objects and walking points stay on the curved surface with radial up', () => {
  for (const [x, z] of [[0, 0], [-3.45, -.85], [3.8, -.45], [.5, 3.65], [-3.07, -.5]]) {
    const object = new THREE.Object3D(); placeOnPlanet(object, x, z, 1.7);
    const normal = object.position.clone().normalize();
    assert.ok(NORTH.clone().applyQuaternion(object.quaternion).dot(normal) > .999999);
    assert.ok(Math.abs(object.position.length() - PLANET_RADIUS - elevation(normal)) < 1e-8);
    assert.ok(object.position.distanceTo(surfacePoint(x, z)) < 1e-8);
  }
});

test('rotation can reveal the underside and complete a full turn without translating the center', () => {
  const globe = new THREE.Group(), child = new THREE.Object3D(); globe.add(child); placeOnPlanet(child, 1, 2);
  const before = child.position.clone();
  for (let i = 0; i < 4; i++) globe.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  globe.updateMatrixWorld(true);
  assert.ok(child.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 1e-8);
  assert.equal(globe.position.length(), 0);
  const drag = dragRotation(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Quaternion());
  assert.ok(new THREE.Vector3(0, 0, 1).applyQuaternion(drag).distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-8);
});
