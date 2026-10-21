import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLayout, dockLayout, fitLayout, restoreLayout, smoothLayout, zoomLayout } from './companion-layout';
import { COMPANION_PLANET_DIAMETER } from './companion-framing';

test('a saved planet returns on screen after moving to a smaller monitor', () => {
  const viewport = { width: 800, height: 600 };
  const layout = restoreLayout('{"x":2400,"y":1400,"size":900}', viewport);
  assert.ok(layout.x >= 64 && layout.x <= viewport.width - 64);
  assert.ok(layout.y >= 64 && layout.y <= viewport.height - 64);
  const dock = dockLayout(layout, viewport);
  assert.ok(dock.left >= 12 && dock.left + dock.width <= viewport.width - 12);
  assert.ok(dock.top + 128 <= viewport.height - 12);
});

test('smooth zoom is monotonic, does not overshoot, and converges at different refresh rates', () => {
  const start = { x: 500, y: 400, size: 300 }, target = { x: 530, y: 370, size: 500 };
  for (const fps of [30, 60, 120]) {
    let current = { ...start };
    for (let i = 0; i < fps; i++) {
      const next = smoothLayout(current, target, 1 / fps);
      assert.ok(next.size >= current.size && next.size <= target.size);
      assert.ok(next.x >= current.x && next.x <= target.x);
      assert.ok(next.y <= current.y && next.y >= target.y);
      current = next;
    }
    assert.deepEqual(current, target);
  }
});

test('a wheel step makes a restrained size change and inverse input restores scale', () => {
  const viewport = { width: 1440, height: 900 }, start = { x: 720, y: 350, size: 360 };
  const zoomed = zoomLayout(start, -100, viewport);
  assert.ok(zoomed.size > start.size && zoomed.size < start.size * 1.15);
  assert.ok(Math.abs(zoomLayout(zoomed, 100, viewport).size - start.size) < 1e-9);
});

test('invalid geometry never propagates NaN, Infinity or strings into CSS', () => {
  const viewport = { width: 1440, height: 900 };
  for (const raw of [null, '{', '{}', '{"x":null,"y":100,"size":300}', '{"x":"1","y":100,"size":300}', '{"x":1e999,"y":100,"size":300}']) {
    assert.deepEqual(restoreLayout(raw, viewport), defaultLayout(viewport));
  }
});

test('repeated zoom and edge drags keep globe and dock accessible', () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 700 }, { width: 800, height: 600 }, { width: 3840, height: 2160 }]) {
    let layout = defaultLayout(viewport);
    for (let i = 0; i < 60; i++) layout = zoomLayout(layout, -120, viewport);
    assert.ok(layout.size * COMPANION_PLANET_DIAMETER > Math.hypot(viewport.width, viewport.height));
    for (const [x, y] of [[-500, -500], [3000, 3000], [0, 3000]]) {
      const fitted = fitLayout({ ...layout, x, y }, viewport);
      assert.ok(fitted.x >= 64 && fitted.y >= 64);
      assert.ok(fitted.x <= viewport.width - 64 && fitted.y <= viewport.height - 64);
      const dock = dockLayout(fitted, viewport);
      assert.ok(dock.top >= 12 && dock.top + 128 <= viewport.height - 12);
    }
    for (let i = 0; i < 40; i++) layout = zoomLayout(layout, 120, viewport);
    assert.equal(layout.size, 200);
  }
});

test('small companions keep their complete padded scene on screen, and zoom transitions have no position jump', () => {
  const viewport = { width: 1440, height: 900 };
  for (const scale of [1.125, 1.5]) {
    const small = fitLayout({x: 9999, y: 9999, size: 360}, viewport, scale);
    assert.ok(small.x + small.size * scale / 2 <= viewport.width - 12);
    assert.ok(small.y + small.size * scale / 2 <= viewport.height - 12);
    let previous = small;
    for (let size = 361; size < 2000; size++) {
      const next = fitLayout({...previous, size}, viewport, scale);
      assert.ok(Math.abs(next.x - previous.x) <= scale && Math.abs(next.y - previous.y) <= scale);
      previous = next;
    }
  }
});
