import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANET_RADIUS, planetGeometry } from './planet-surface';
import { HIDDEN_SEABED_DEPTH } from './ocean';
import { SHORE_BREAK_DEPTH } from './shore';
import { cullHiddenSeabed } from './terrain';

test('the hidden seabed is left out of the ground mesh, and only ever below the opaque sea', () => {
  const geometry = planetGeometry(192, 96), position = geometry.attributes.position;
  const original = Array.from(geometry.index!.array);
  const height = (i: number) => Math.hypot(position.getX(i), position.getY(i), position.getZ(i)) - PLANET_RADIUS;
  const kept = cullHiddenSeabed(geometry, HIDDEN_SEABED_DEPTH), index = geometry.index!.array;
  assert.equal(index.length, kept * 3);
  assert.ok(kept < original.length / 3 * .9, 'a real share of the ground lies under deep water');

  // The kept triangles are the original ones in their original order: every triangle reaching above the cut stays.
  let k = 0;
  for (let i = 0; i < original.length; i += 3) {
    const reaches = Math.max(height(original[i]), height(original[i + 1]), height(original[i + 2])) > -HIDDEN_SEABED_DEPTH;
    if (reaches) {
      assert.deepEqual([index[k], index[k + 1], index[k + 2]], original.slice(i, i + 3));
      k += 3;
    }
  }
  assert.equal(k, index.length);

  // Dropped ground sits deeper than the lowest wave trough (the swell sums to 0.0133, 65% more in rain), and below the
  // surf zone the water shades on its own.
  assert.ok(HIDDEN_SEABED_DEPTH > .0133 * 1.65 && HIDDEN_SEABED_DEPTH >= SHORE_BREAK_DEPTH);
  geometry.dispose();
});
