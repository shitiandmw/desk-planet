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
  for (let i = 0; i < WEATHER_CYCLE_SECONDS*3; i++) state.update(1);
  assert.equal(state.rain, 0); assert.ok(state.cloudiness > .7);
});

test('automatic weather develops over minutes without abrupt cloud or rain changes', () => {
  const state=new WeatherState();let rainySeconds=0;
  for(let i=0;i<WEATHER_CYCLE_SECONDS*2;i++) {
    const cloudiness=state.cloudiness,rain=state.rain;
    state.update(1);
    assert.ok(Math.abs(state.cloudiness-cloudiness)<.025);
    assert.ok(Math.abs(state.rain-rain)<.08);
    if(i<80)assert.ok(state.cloudiness<.2 && state.rain===0);
    if(state.rain>.5)rainySeconds++;
  }
  assert.ok(rainySeconds>100 && rainySeconds<180);
});
