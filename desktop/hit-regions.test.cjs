const test = require('node:test');
const assert = require('node:assert/strict');
const { validRegions, containsPoint } = require('./hit-regions.cjs');

test('transparent corners and the gap below the globe pass mouse events through', () => {
  const regions = [{ kind: 'circle', x: 300, y: 300, radius: 120 }, { kind: 'rect', x: 140, y: 440, width: 320, height: 114 }];
  assert.equal(containsPoint(regions, { x: 300, y: 300 }), true);
  assert.equal(containsPoint(regions, { x: 185, y: 185 }), false);
  assert.equal(containsPoint(regions, { x: 300, y: 430 }), false);
  assert.equal(containsPoint(regions, { x: 200, y: 500 }), true);
  assert.equal(containsPoint(regions, { x: 200, y: 560 }), false);
  assert.equal(containsPoint([], { x: 300, y: 300 }), false);
});

test('untrusted IPC cannot register arbitrary or unbounded hit areas', () => {
  assert.deepEqual(validRegions(null), []);
  assert.deepEqual(validRegions(Array(33).fill({ kind: 'circle', x: 1, y: 1, radius: 20 })), []);
  assert.deepEqual(validRegions([
    { kind: 'circle', x: NaN, y: 1, radius: 20 },
    { kind: 'rect', x: 0, y: 0, width: -1, height: 1 },
    { kind: 'circle', x: 0, y: 0, radius: Infinity },
    { kind: 'circle', x: 0, y: 0, radius: 100000 },
    { kind: 'unknown', x: 0, y: 0 },
  ]), []);
});

test('a close-up on a 4K monitor remains interactive even when its radius exceeds 2000 pixels', () => {
  const regions = validRegions([{kind:'circle', x:1920, y:1080, radius:3200}]);
  assert.equal(regions.length, 1);
  assert.equal(containsPoint(regions, {x:0,y:0}), true);
  assert.equal(containsPoint(regions, {x:3840,y:2160}), true);
});
