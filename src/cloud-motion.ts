import { PLANET_RADIUS } from './planet-surface';

const smooth = (lo: number, hi: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
const anchors = [[-.42,.77,.48],[.49,.75,.45],[.25,-.45,-.86],[-.85,-.25,.38]];
const speeds = [.0055, .0067, .0049, .0061];
export const CLOUD_PROFILES = anchors.map(([x,y,z], i) => ({
  longitude: Math.atan2(z,x), latitude: Math.asin(y / Math.hypot(x,y,z)),
  speed: speeds[i], period: [222,268,244,286][i], phase: [.24,.57,.39,.81][i],
  coverage: [.03,.22,.42,.62][i], width: [.95,.82,1.02,.9][i], depth: [.95,.88,.84,1][i],
  thickness: [.88,.96,.86,.92][i], yaw: [-.2,.12,.3,-.14][i], seed: 1.7 + i * 2.3,
}));

// Conservative bounds used by the desktop camera, independent of life phase and viewing direction.
export const CLOUD_MAX_HEIGHT = PLANET_RADIUS + 2.62;
export const CLOUD_MAX_WIDTH = 1.24;
export const CLOUD_MAX_DEPTH = 1.18;
export const CLOUD_MAX_THICKNESS = 1;

export interface CloudMotion {
  longitude: number; latitude: number; height: number;
  width: number; depth: number; thickness: number; opacity: number; rain: number;
}
export const createCloudMotion = (): CloudMotion => ({longitude:0,latitude:0,height:0,width:1,depth:1,thickness:1,opacity:0,rain:0});

/** Four reusable cloud slots advect with one prevailing wind, with staggered lifetimes measured in minutes. */
export function updateCloudMotion(index: number, time: number, cloudiness: number, rain: number, out: CloudMotion) {
  const p = CLOUD_PROFILES[index];
  const age = Math.max(0,time) / p.period + p.phase, cycle = Math.floor(age), phase = age - cycle;
  const life = smooth(0,.18,phase) * (1-smooth(.64,.94,phase));
  const coverage = smooth(p.coverage-.16,p.coverage+.12,cloudiness);
  // A new shape is chosen only while the slot is invisible at its life boundary.
  const shape = 1 + .025*Math.sin((cycle+1)*p.seed);
  const growth = .66 + .34*smooth(0,.8,life);
  out.longitude = p.longitude + p.speed*(time + 6*(Math.sin(time/85+p.seed)-Math.sin(p.seed)));
  out.latitude = p.latitude + .016*Math.sin(time/130+p.seed);
  out.height = PLANET_RADIUS + 2.34 + index*.07 + .035*Math.sin(time/91+p.seed);
  out.width = p.width*(.85+.3*cloudiness)*growth*shape;
  out.depth = p.depth*(.85+.25*cloudiness)*growth/shape;
  out.thickness = p.thickness*(.4+.6*cloudiness)*(.72+.28*life);
  out.opacity = coverage*life;
  out.rain = rain*smooth(.32,.85,out.opacity)*(.85+.15*smooth(.5,1,cloudiness));
  return out;
}
