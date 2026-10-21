export type WeatherMode = 'auto' | 'clear' | 'cloudy' | 'rain';
export const WEATHER_CYCLE_SECONDS = 360;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (lo: number, hi: number, value: number) => { const t=clamp((value-lo)/(hi-lo));return t*t*(3-2*t); };

/** Visual weather clock; intentionally independent of production speed and pause. */
export class WeatherState {
  mode: WeatherMode = 'auto';
  elapsed = 0;
  cloudiness = .15;
  rain = 0;
  wetness = 0;

  setMode(mode: WeatherMode) { this.mode = mode; }
  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    const phase = this.elapsed % WEATHER_CYCLE_SECONDS;
    const automaticClouds = phase < 185 ? .12+.88*smooth(80,185,phase) : 1-.88*smooth(245,325,phase);
    const target = this.mode === 'auto'
      ? automaticClouds
      : this.mode === 'clear' ? .08 : this.mode === 'cloudy' ? .72 : 1;
    this.cloudiness += (target - this.cloudiness) * (1 - Math.exp(-dt / 3.5));
    const rainEnvelope = this.mode === 'rain' ? 1 : this.mode === 'auto' ? smooth(180,200,phase)*(1-smooth(235,265,phase)) : 0;
    // Rain only starts after the cloud bank is visibly dense and dark.
    const rainTarget = rainEnvelope * clamp((this.cloudiness - .66) / .24);
    this.rain += (rainTarget - this.rain) * (1 - Math.exp(-dt / 2.3));
    this.wetness = clamp(this.wetness + this.rain * dt * .085 - (1 - this.rain) * dt * .018);
  }

  get label() { return this.rain > .16 ? '阵雨' : this.cloudiness > .52 ? '多云' : '晴间多云'; }
}
