import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANET_RADIUS, planetGeometry } from './planet-surface';
import { HIDDEN_SEABED_DEPTH } from './ocean';
import { SEABED_FADE } from './shore';
import { splitSeabed } from './terrain';

test('the ground splits by the sea: land to the waterline, the sea bed, and the deep floor the water always hides', () => {
  const geometry = planetGeometry(192, 96), position = geometry.attributes.position;
  const original = Array.from(geometry.index!.array);
  const height = (i: number) => Math.hypot(position.getX(i), position.getY(i), position.getZ(i)) - PLANET_RADIUS;
  const { seabed, deep } = splitSeabed(geometry, HIDDEN_SEABED_DEPTH);
  const parts = { land: geometry.index!.array, seabed: seabed.index!.array, deep: deep.index!.array };
  assert.equal(parts.land.length + parts.seabed.length + parts.deep.length, original.length);
  assert.ok(parts.deep.length > original.length * .1, 'a real share of the ground lies under deep water');
  assert.ok(parts.seabed.length > original.length * .1, 'and a real share is sea bed that shows through the water');

  // Each part keeps the original triangles in their original order; anything reaching the waterline stays land.
  const next = { land: 0, seabed: 0, deep: 0 };
  for (let i = 0; i < original.length; i += 3) {
    const triangle = original.slice(i, i + 3), top = Math.max(...triangle.map(height));
    const part = top >= 0 ? 'land' : top > -HIDDEN_SEABED_DEPTH ? 'seabed' : 'deep';
    assert.deepEqual(Array.from(parts[part].slice(next[part], next[part] += 3)), triangle);
  }
  for (const part of ['land', 'seabed', 'deep'] as const) assert.equal(next[part], parts[part].length);
  // All three draw the same vertices.
  for (const name of Object.keys(geometry.attributes)) {
    assert.equal(seabed.attributes[name], geometry.attributes[name]);
    assert.equal(deep.attributes[name], geometry.attributes[name]);
  }

  // The deep floor sits deeper than the depth where the water has hidden the bed completely, with a margin for the
  // mesh's flat triangles against the per-pixel depth, and below the lowest wave trough (0.0133, 65% more in rain).
  assert.ok(HIDDEN_SEABED_DEPTH >= SEABED_FADE[1] + .05 && HIDDEN_SEABED_DEPTH > .0133 * 1.65);
  geometry.dispose(); seabed.dispose(); deep.dispose();
});
