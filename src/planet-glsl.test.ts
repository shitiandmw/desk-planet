import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { evaluatePlanetField, planetFieldGLSL } from './planet-glsl';
import { elevation, landField } from './planet-surface';
import { rng } from './craft';

test('the per-pixel shader field matches the authoritative land field and elevation', () => {
  const random = rng(5);
  for (let i = 0; i < 2000; i++) {
    const n = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
    const mirrored = evaluatePlanetField(n);
    assert.ok(Math.abs(mirrored.field - landField(n)) < 1e-6, `field differs at ${n.toArray()}`);
    assert.ok(Math.abs(mirrored.elevation - elevation(n)) < 1e-6, `elevation differs at ${n.toArray()}`);
  }
  assert.match(planetFieldGLSL, /float planetElevation\(vec3 n\)/);
  assert.doesNotMatch(planetFieldGLSL, /NaN|undefined/);
});
