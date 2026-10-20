import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation, SANDBOX_POPULATION } from './simulation';
import { BUILDINGS, BUILDING_ERAS, RESOURCE_KEYS, SANDBOX_BUILDABLE, type BuildingEra } from './game-data';
import { SITE_BY_ID, distanceOnPlanet } from './world-layout';
import { buildAllEras, buildEra, clearSandbox, eraProgress, ERA_DISTRICTS } from './sandbox';

const nearestDistrict = (siteId: string) => {
  const n = SITE_BY_ID.get(siteId)!.direction;
  return (Object.keys(ERA_DISTRICTS) as BuildingEra[]).reduce((best, era) => distanceOnPlanet(n, ERA_DISTRICTS[era]) < distanceOnPlanet(n, ERA_DISTRICTS[best]) ? era : best);
};

test('the test planet unlocks everything and builds instantly without spending materials', () => {
  const g = GameSimulation.createSandbox(), before = { ...g.resources };
  assert.ok(g.sandbox);
  for (const type of SANDBOX_BUILDABLE) assert.equal(g.buildingUnlockError(type), null, type);
  const site = g.availableSites('fusion')[0]; assert.ok(site);
  const result = g.build('fusion', site.id); assert.ok(result.ok, JSON.stringify(result));
  const b = g.building(result.id!)!;
  assert.equal(b.built, true); assert.equal(b.progress, BUILDINGS.fusion.work);
  assert.deepEqual(g.resources, before); assert.equal(g.status(b), '概念模型 · 测试展示');
});

test('one click places every model of every era inside its own district', () => {
  const g = GameSimulation.createSandbox(), report = buildAllEras(g);
  assert.deepEqual(report.skipped, []);
  for (const type of SANDBOX_BUILDABLE) assert.ok(g.buildings.some(b => b.type === type), `${type} missing`);
  for (const b of g.buildings.filter(b => !b.initial)) assert.equal(nearestDistrict(b.siteId), BUILDINGS[b.type].era, `${b.type} placed outside its district`);
  for (const era of BUILDING_ERAS) { const p = eraProgress(g, era.id); assert.equal(p.placed, p.total, era.id); }
  assert.deepEqual(buildEra(g, 'interstellar').built, [], 'a complete era builds nothing twice');
});

test('test saves and real saves never load into each other', () => {
  const sandbox = GameSimulation.createSandbox(); buildEra(sandbox, 'intelligence');
  const saved = sandbox.save();
  assert.equal(saved.sandbox, true);
  assert.equal(GameSimulation.load(saved), null);
  assert.equal(GameSimulation.load({ ...saved, sandbox: undefined }), null, 'concept facilities stay out of real saves');
  assert.equal(GameSimulation.load(saved, { sandbox: true })!.buildings.length, sandbox.buildings.length);
  assert.equal(GameSimulation.load(new GameSimulation().save(), { sandbox: true }), null);
});

test('concept models stay locked outside the test planet', () => {
  const g = new GameSimulation(), site = GameSimulation.createSandbox().availableSites('datacenter')[0];
  assert.equal(g.buildingUnlockError('datacenter'), '概念模型仅在测试模式中建造');
  assert.equal(g.build('datacenter', site.id).ok, false);
  assert.equal(g.removeBuilding('b2').ok, false);
});

test('test facilities can be removed, the founding settlement stays', () => {
  const g = GameSimulation.createSandbox(); buildEra(g, 'farming');
  const windmill = g.buildings.find(b => b.type === 'windmill')!;
  assert.ok(g.removeBuilding(windmill.id).ok); assert.equal(g.building(windmill.id), undefined);
  assert.equal(g.removeBuilding('b1').ok, false);
  assert.ok(clearSandbox(g) > 0); assert.equal(g.buildings.length, g.buildings.filter(b => b.initial).length);
});

test('the test planet keeps stocks topped up and staffs facilities within the actor budget', () => {
  const g = GameSimulation.createSandbox(); buildAllEras(g);
  g.tick(240);
  for (const r of RESOURCE_KEYS) if (r !== 'food') assert.ok(g.resources[r] >= 400, `${r} ran low`);
  assert.ok(g.resources.food >= g.foodCapacity * .4 - 1e-6 && g.resources.food <= g.foodCapacity * .9 + 1e-6);
  assert.ok(g.population <= SANDBOX_POPULATION); assert.ok(g.buildings.filter(b => BUILDINGS[b.type].output).every(b => g.workersAt(b.id) > 0));
});
