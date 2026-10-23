import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_ELEVATION, PLANET_RADIUS } from './planet-surface';
import {
  SEABED_RAY_REACH, SHORE_BREAK_DEPTH, SHORE_PERIOD, SHORE_SWASH_MAX, SWASH_DOWN_END, SWASH_UP, WATER_EXTINCTION,
  apparentSeaDepth, apparentSeaPointGLSL, shoreGLSL, shorePhase, shoreSet, swashProfile,
} from './shore';

/** Runs one of the scalar GLSL helpers in `source` as JavaScript, with its #defines substituted. */
function glslFunction(name: string, source = shoreGLSL): (...args: number[]) => number {
  const match = source.match(new RegExp(`float ${name}\\(([^)]*)\\) \\{([^}]*)\\}`));
  assert.ok(match, `${name} is missing from the shader source`);
  const params = match[1].split(',').map(p => p.trim().split(/\s+/)[1]);
  let body = match[2];
  for (const [, key, value] of source.matchAll(/#define (\w+) (\S+)/g)) body = body.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
  body = body.replace(/\b(sin|cos|sqrt|max|min|floor)\(/g, 'Math.$1(').replace(/\bfloat\b/g, 'let');
  const smoothstep = 'const smoothstep = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };';
  return new Function(...(name === 'shorePhase' ? ['uOceanTime', ...params] : params), smoothstep + body) as (...args: number[]) => number;
}

test('the shader copy of the shore waves matches the TypeScript model', () => {
  assert.match(shoreGLSL, new RegExp(`#define SHORE_PERIOD ${SHORE_PERIOD.toFixed(1)}\\b`));
  assert.match(shoreGLSL, new RegExp(`#define SHORE_BREAK_DEPTH ${SHORE_BREAK_DEPTH}\\b`));
  assert.match(shoreGLSL, new RegExp(`#define SHORE_SWASH_MAX ${SHORE_SWASH_MAX}\\b`));
  const extinction = shoreGLSL.match(/const vec3 WATER_EXTINCTION = vec3\(([^)]*)\)/)![1].split(',').map(Number);
  assert.deepEqual(extinction, WATER_EXTINCTION);
  assert.doesNotMatch(shoreGLSL, /NaN|undefined/);

  const phase = glslFunction('shorePhase'), profile = glslFunction('swashProfile'), set = glslFunction('shoreSet');
  for (let i = 0; i <= 200; i++) {
    const tau = i / 200, time = i * .37, depth = (i % 23) / 22 * .3 - .02, along = (i % 7) / 6;
    assert.ok(Math.abs(profile(tau) - swashProfile(tau)) < 1e-6, `swash differs at ${tau}`);
    assert.ok(Math.abs(phase(time, depth, along) - shorePhase(time, depth, along)) < 1e-9, `phase differs at ${time}, ${depth}`);
    assert.ok(Math.abs(set(i) - shoreSet(i)) < 1e-9);
  }
});

test('the swash runs up and drains without jumps, then leaves the sand bare until the next bore', () => {
  const eps = 1e-6;
  assert.equal(swashProfile(0), 0);
  assert.ok(Math.abs(swashProfile(SWASH_UP - eps) - 1) < 1e-4 && Math.abs(swashProfile(SWASH_UP + eps) - 1) < 1e-4);
  assert.ok(swashProfile(SWASH_DOWN_END - eps) < 1e-4 && swashProfile(SWASH_DOWN_END) < 1e-12);
  // The bare sand lies at rest until the next bore arrives at tau = 0 again.
  for (const tau of [.9, .95, .999]) assert.ok(swashProfile(tau) < 1e-12);
  let previous = -1;
  for (let tau = 0; tau <= SWASH_UP; tau += .01) { assert.ok(swashProfile(tau) >= previous); previous = swashProfile(tau); }
  previous = 1;
  for (let tau = SWASH_UP; tau <= SWASH_DOWN_END; tau += .01) { assert.ok(swashProfile(tau) <= previous + 1e-12); previous = swashProfile(tau); }
  // The uprush decelerates as the sheet climbs, the backwash accelerates as it drains.
  assert.ok(swashProfile(.05) - swashProfile(0) > swashProfile(SWASH_UP) - swashProfile(SWASH_UP - .05));
  assert.ok(swashProfile(SWASH_UP) - swashProfile(SWASH_UP + .05) < swashProfile(SWASH_DOWN_END - .05) - swashProfile(SWASH_DOWN_END));
});

test('bores slow down like shallow-water waves and arrive at the waterline as the run-up begins', () => {
  // A crest is a line of constant phase; it moves toward smaller depth as time goes on.
  const crestDepth = (time: number, wave: number, along = .4) => {
    let lo = 0, hi = 4;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (shorePhase(time, mid, along) < wave) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  const wave = 10, along = .4, arrival = (wave - shorePhase(0, 0, along)) * SHORE_PERIOD;
  const speedAt = (depth: number) => {
    // Time at which the crest passes `depth`, then the depth it has reached a moment later.
    const time = (wave - shorePhase(0, depth, along)) * SHORE_PERIOD, dt = 1e-3;
    return (depth - crestDepth(time + dt, wave, along)) / dt;
  };
  assert.ok(speedAt(.16) > 0, 'crests travel toward the beach');
  // Shallow-water waves travel at sqrt(g h): a quarter of the depth, half the speed.
  assert.ok(Math.abs(speedAt(.16) / speedAt(.04) - 2) < .02);
  assert.ok(Math.abs(speedAt(.04) / speedAt(.01) - 2) < .02);
  // The crest reaches depth 0 at the start of a swash cycle: the sheet begins to run up as the bore lands.
  const landPhase = shorePhase(arrival, 0, along);
  assert.ok(Math.abs(landPhase - wave) < 1e-9);
  assert.equal(Math.floor(shorePhase(arrival + .01, 0, along)), wave);
  assert.ok(swashProfile(shorePhase(arrival + .01, 0, along) - wave) > 0);
  // Sets: successive waves differ in size but always run up.
  for (let i = 0; i < 20; i++) assert.ok(shoreSet(i) >= .44 && shoreSet(i) <= 1);
});

test('things under water are drawn where the refracted view finds them: in order, and in view down a drop-off', () => {
  const shader = glslFunction('apparentSeaDepth', apparentSeaPointGLSL);
  for (let i = 0; i <= 140; i++) for (const cosI of [0, .05, .2, .5, .8, 1]) {
    assert.ok(Math.abs(shader(i / 100, cosI) - apparentSeaDepth(i / 100, cosI)) < 1e-12, `differs at ${i / 100}, ${cosI}`);
  }
  // Three quarters of the depth seen from straight above, never deeper than it really is, and at any angle deeper
  // things stay further down, so the bed's layers keep their order.
  assert.ok(Math.abs(apparentSeaDepth(.8, 1) - .8 / 1.333) < 1e-9);
  for (const cosI of [0, .1, .3, .6, 1]) for (let depth = .01; depth <= -MIN_ELEVATION; depth += .01) {
    assert.ok(apparentSeaDepth(depth, cosI) <= depth);
    assert.ok(apparentSeaDepth(depth, cosI) > apparentSeaDepth(depth - .01, cosI));
  }
  // At the rim the deepest floor is drawn within the reach a view ray needs before the sea shows the bed at all.
  assert.ok(apparentSeaDepth(-MIN_ELEVATION, 0) < SEABED_RAY_REACH[0]);

  // A cross-section through the planet: the bed falls off the beach at up to 45 degrees, steeper than a low straight
  // view ray but not than the refracted one. With the incidence taken where the view meets the water above each point
  // (as apparentSeaPoint does), every point farther out is drawn higher in view than the one before: none hides
  // behind the slope.
  const R = PLANET_RADIUS;
  for (const [height, front, slope] of [[.6, 1, 35], [1.24, 2.27, 33], [1.2, 1.5, 45], [2.5, 3, 40], [3, 2, 45]]) {
    let previous = -Infinity;
    for (let s = .01; s < 3; s += .01) {
      const angle = (front + s) / R, up = [Math.sin(angle), Math.cos(angle)], toEye = [-up[0] * R, R + height - up[1] * R];
      const cosI = (toEye[0] * up[0] + toEye[1] * up[1]) / Math.hypot(toEye[0], toEye[1]);
      if (R * (1 - Math.sqrt(1 - cosI * cosI)) < SEABED_RAY_REACH[0]) break;
      const r = R - apparentSeaDepth(Math.min(s * Math.tan(slope * Math.PI / 180), -MIN_ELEVATION), cosI);
      const elevation = Math.atan2(up[1] * r - R - height, up[0] * r);
      assert.ok(elevation > previous, `hidden ${s.toFixed(2)} past the waterline (eye ${height} up, ${slope} degrees)`);
      previous = elevation;
    }
  }
});

test('red is absorbed first, so shallow water over sand turns turquoise before it turns blue', () => {
  const [r, g, b] = WATER_EXTINCTION;
  assert.ok(r > g && g > b);
  // Through 0.05 units of water (seen from above, both ways) the sand keeps most of its green and blue but loses red.
  const through = WATER_EXTINCTION.map(k => Math.exp(-k * .05 * 2));
  assert.ok(through[0] < .6 && through[1] > .85 && through[2] > .9);
});
