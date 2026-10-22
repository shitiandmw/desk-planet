import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHORE_BREAK_DEPTH, SHORE_PERIOD, SHORE_SWASH_MAX, SWASH_DOWN_END, SWASH_UP, WATER_EXTINCTION,
  shoreGLSL, shorePhase, shoreSet, swashProfile,
} from './shore';

/** Runs one of the scalar GLSL helpers in shoreGLSL as JavaScript, with its #defines substituted. */
function glslFunction(name: string): (...args: number[]) => number {
  const match = shoreGLSL.match(new RegExp(`float ${name}\\(([^)]*)\\) \\{([^}]*)\\}`));
  assert.ok(match, `${name} is missing from shoreGLSL`);
  const params = match[1].split(',').map(p => p.trim().split(/\s+/)[1]);
  let body = match[2];
  for (const [, key, value] of shoreGLSL.matchAll(/#define (\w+) (\S+)/g)) body = body.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
  body = body.replace(/\b(sin|cos|sqrt|max|min|floor)\(/g, 'Math.$1(');
  return new Function(...(name === 'shorePhase' ? ['uOceanTime', ...params] : params), body) as (...args: number[]) => number;
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

test('red is absorbed first, so shallow water over sand turns turquoise before it turns blue', () => {
  const [r, g, b] = WATER_EXTINCTION;
  assert.ok(r > g && g > b);
  // Through 0.05 units of water (seen from above, both ways) the sand keeps most of its green and blue but loses red.
  const through = WATER_EXTINCTION.map(k => Math.exp(-k * .05 * 2));
  assert.ok(through[0] < .6 && through[1] > .85 && through[2] > .9);
});
