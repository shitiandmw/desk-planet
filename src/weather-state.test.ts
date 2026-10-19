import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WeatherState, WEATHER_CYCLE_SECONDS } from './weather-state';

test('clouds gather before rain, then rain leaves the ground wet', () => {
  const state = new WeatherState(); state.setMode('rain');
  state.update(1); assert.equal(state.rain, 0);
  for (let i = 0; i < 25; i++) state.update(1);
  assert.ok(state.cloudiness > .95 && state.rain > .95 && state.wetness > .7);
});

test('clear weather stops rain and dries gradually', () => {
  const state = new WeatherState(); state.setMode('rain');
  for (let i = 0; i < 30; i++) state.update(1);
  state.setMode('clear');
  for (let i = 0; i < 12; i++) state.update(1);
  assert.ok(state.rain < .01 && state.cloudiness < .15 && state.wetness > .5);
  for (let i = 0; i < 70; i++) state.update(1);
  assert.ok(state.wetness < .01);
});

test('automatic weather includes clear, gathering clouds, rain, and recovery', () => {
  const state = new WeatherState(); const labels = new Set<string>();
  for (let i = 0; i < WEATHER_CYCLE_SECONDS; i++) { state.update(1); labels.add(state.label); }
  assert.deepEqual([...labels], ['晴间多云', '多云', '阵雨']);
  assert.ok(state.rain < .01 && state.cloudiness < .18);
});

test('fixed cloudy mode remains rain-free across multiple automatic cycles', () => {
  const state = new WeatherState(); state.setMode('cloudy');
  for (let i = 0; i < 250; i++) state.update(1);
  assert.equal(state.rain, 0); assert.ok(state.cloudiness > .7);
});
