import * as THREE from 'three';
import { BUILDINGS, BUILDING_ERAS, buildingsOfEra, type BuildingEra, type BuildingType, type Direction } from './game-data';
import { rng } from './craft';
import { BUILD_SITES, directionVector, distanceOnPlanet, type Site } from './world-layout';
import { BACK_LAND, NORTH, plotDirection } from './planet-surface';
import type { GameSimulation } from './simulation';

/**
 * District centres for a test planet: the founding settlement, the southern meadows, the ore ridge, the
 * western continent, the far shore and the open north-western plain where the largest complexes fit.
 * Placing each era together keeps the models comparable side by side.
 */
export const ERA_DISTRICTS: Record<BuildingEra, Direction> = {
  gathering: plotDirection(0, 0).toArray() as Direction,
  farming: plotDirection(.6, 8.6).toArray() as Direction,
  industrial: plotDirection(8.6, -1.2).toArray() as Direction,
  information: new THREE.Vector3(-.86, -.4, .32).normalize().toArray() as Direction,
  intelligence: BACK_LAND.toArray() as Direction,
  interstellar: new THREE.Vector3(-.6, .62, -.5).normalize().toArray() as Direction,
};

/** Yaw that turns a facility's front (+z) toward `target` along the sphere. */
export function facingYaw(site: Direction, target: Direction) {
  const n = directionVector(site), t = directionVector(target), q = new THREE.Quaternion().setFromUnitVectors(NORTH, n);
  const tangent = t.sub(n.clone().multiplyScalar(n.dot(t)));
  if (tangent.lengthSq() < 1e-8) return 0;
  return Math.atan2(tangent.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(q)), tangent.dot(new THREE.Vector3(0, 0, 1).applyQuaternion(q)));
}

const districtOf = (direction: Direction) => (Object.keys(ERA_DISTRICTS) as BuildingEra[]).reduce((best, era) => distanceOnPlanet(direction, ERA_DISTRICTS[era]) < distanceOnPlanet(direction, ERA_DISTRICTS[best]) ? era : best);

/**
 * Places one facility at the free site nearest the anchor, facing it. Sites closer to another district's centre
 * are used only when the own district is full, and never inside the founding village. Requires a sandbox simulation.
 */
export function placeNear(game: GameSimulation, type: BuildingType, anchor: Direction) {
  const sites = BUILD_SITES.filter(s => !game.placementError(type, s.id)).sort((a, b) => distanceOnPlanet(a.direction, anchor) - distanceOnPlanet(b.direction, anchor));
  const site = sites.find(s => ERA_DISTRICTS[districtOf(s.direction)] === anchor) ?? sites.find(s => anchor === ERA_DISTRICTS.gathering || districtOf(s.direction) !== 'gathering') ?? sites[0];
  if (!site) return null;
  const result = game.build(type, site.id, facingYaw(site.direction, anchor));
  return result.ok ? result.id ?? null : null;
}

/**
 * Packs an era's missing facilities into its own district: many shuffled greedy passes over the free sites,
 * keeping the plan that fits the most facilities closest to the centre. Facilities that do not fit fall back to `placeNear`.
 */
function planDistrict(game: GameSimulation, era: BuildingEra, types: BuildingType[]) {
  const anchor = ERA_DISTRICTS[era], random = rng(91);
  const near = (s: Site) => distanceOnPlanet(s.direction, anchor);
  const free = new Map(types.map(type => [type, BUILD_SITES.filter(s => districtOf(s.direction) === era && !game.placementError(type, s.id)).sort((a, b) => near(a) - near(b))]));
  let best: { plan: [BuildingType, Site][]; score: number } | null = null;
  for (let trial = 0; trial < 120; trial++) {
    const order = [...types].sort((a, b) => BUILDINGS[b].radius - BUILDINGS[a].radius);
    if (trial) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const plan: [BuildingType, Site][] = [];
    for (const type of order) {
      const site = free.get(type)!.find(s => plan.every(([other, p]) => p.id !== s.id && distanceOnPlanet(s.direction, p.direction) >= BUILDINGS[type].radius + BUILDINGS[other].radius + .06));
      if (site) plan.push([type, site]);
    }
    const score = (types.length - plan.length) * 100 + plan.reduce((n, [, s]) => n + near(s), 0);
    if (!best || score < best.score) best = { plan, score };
  }
  return best?.plan ?? [];
}

export interface SandboxReport { built: string[]; skipped: BuildingType[] }
/** Builds every facility of an era the planet does not have yet, grouped around the era's district centre. */
export function buildEra(game: GameSimulation, era: BuildingEra, report: SandboxReport = { built: [], skipped: [] }) {
  if (!game.sandbox) throw new Error('buildEra needs a sandbox simulation');
  const anchor = ERA_DISTRICTS[era], missing = buildingsOfEra(era).filter(type => !game.buildings.some(b => b.type === type));
  const plan = planDistrict(game, era, missing);
  for (const [type, site] of plan) { const result = game.build(type, site.id, facingYaw(site.direction, anchor)); if (result.ok) report.built.push(result.id!); }
  for (const type of missing.filter(type => !game.buildings.some(b => b.type === type)).sort((a, b) => BUILDINGS[b].radius - BUILDINGS[a].radius)) {
    const id = placeNear(game, type, anchor); if (id) report.built.push(id); else report.skipped.push(type);
  }
  return report;
}
/** Builds every era; each district is packed before any facility spills over into a neighbour. */
export function buildAllEras(game: GameSimulation) {
  if (!game.sandbox) throw new Error('buildAllEras needs a sandbox simulation');
  const report: SandboxReport = { built: [], skipped: [] };
  const plans = BUILDING_ERAS.map(era => ({ era: era.id, plan: planDistrict(game, era.id, buildingsOfEra(era.id).filter(type => !game.buildings.some(b => b.type === type))) }));
  for (const { era, plan } of plans) for (const [type, site] of plan) { const result = game.build(type, site.id, facingYaw(site.direction, ERA_DISTRICTS[era])); if (result.ok) report.built.push(result.id!); }
  for (const era of BUILDING_ERAS) buildEra(game, era.id, report);
  return report;
}
/** Removes everything except the starting settlement. */
export function clearSandbox(game: GameSimulation) {
  let removed = 0;
  for (const b of [...game.buildings]) if (!b.initial && game.removeBuilding(b.id).ok) removed++;
  return removed;
}
export const eraProgress = (game: GameSimulation, era: BuildingEra) => {
  const types = buildingsOfEra(era);
  return { total: types.length, placed: types.filter(type => game.buildings.some(b => b.type === type)).length };
};
