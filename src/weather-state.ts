export type WeatherMode = 'auto' | 'clear' | 'cloudy' | 'rain';
export const WEATHER_CYCLE_SECONDS = 90;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

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
    const target = this.mode === 'auto'
      ? phase < 22 ? .15 : phase < 36 ? .74 : phase < 62 ? 1 : phase < 73 ? .64 : .15
      : this.mode === 'clear' ? .08 : this.mode === 'cloudy' ? .72 : 1;
    this.cloudiness += (target - this.cloudiness) * (1 - Math.exp(-dt / 3.5));
    const wantsRain = this.mode === 'rain' || (this.mode === 'auto' && phase >= 36 && phase < 62);
    // Rain only starts after the cloud bank is visibly dense and dark.
    const rainTarget = wantsRain ? clamp((this.cloudiness - .66) / .24) : 0;
    this.rain += (rainTarget - this.rain) * (1 - Math.exp(-dt / 2.3));
    this.wetness = clamp(this.wetness + this.rain * dt * .085 - (1 - this.rain) * dt * .018);
  }

  get label() { return this.rain > .16 ? '阵雨' : this.cloudiness > .52 ? '多云' : '晴间多云'; }
}
