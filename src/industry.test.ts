import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from './simulation';
import { stock, BUILDINGS, IRRIGATION_RADIUS, type BuildingType } from './game-data';
import { SITE_BY_ID, distanceOnPlanet } from './world-layout';

function fixture(){const g=new GameSimulation();g.resources=stock({food:500,wood:1000,stone:1000});g.technologies=['agriculture','tools','metallurgy','mechanics'];g.growthEnabled=false;return g;}
function build(g:GameSimulation,type:BuildingType,siteId?:string){const site=siteId||g.availableSites(type)[0]?.id;assert.ok(site);const r=g.build(type,site);assert.ok(r.ok,JSON.stringify(r));g.setBuilders(1);g.tick(BUILDINGS[type].work);assert.ok(g.building(r.id!)!.built);return r.id!;}
function release(g:GameSimulation){for(const b of g.buildings)g.setWorkers(b.id,0);}

test('processing is atomic under competing workers, and missing inputs preserve work',()=>{
 const g=fixture(),id=build(g,'smelter');release(g);g.resources.ore=0;g.resources.wood=1;g.setWorkers(id,2);
 g.tick(12);assert.equal(g.resources.metal,0);assert.equal(g.resources.wood,1);
 g.resources.ore=2;g.tick(12);assert.equal(g.resources.metal,1);assert.equal(g.resources.ore,0);assert.equal(g.resources.wood,0);
 const restored=GameSimulation.load(g.save())!;assert.ok(restored);
 restored.resources.ore=2;restored.resources.wood=1;restored.tick(.25);
 assert.equal(restored.resources.metal,2);assert.equal(restored.totalProduced.metal,2);
 assert.equal(restored.resources.ore,0);assert.equal(restored.resources.wood,0);
});

test('production target stops consumption and resumes when stock is used',()=>{
 const g=fixture(),id=build(g,'smelter');release(g);g.resources.ore=20;g.resources.wood=20;g.setWorkers(id,2);g.setLimit(id,2);
 g.tick(60);assert.equal(g.resources.metal,2);assert.equal(g.resources.ore,16);assert.equal(g.resources.wood,18);
 assert.match(g.status(g.building(id)!),/目标库存/);g.resources.metal=1;g.tick(12);assert.equal(g.resources.metal,2);assert.equal(g.resources.ore,14);
});

test('water well improves only nearby farms and stacked wells do not compound',()=>{
 const g=fixture(),farm=build(g,'farm'),f=g.building(farm)!,site=SITE_BY_ID.get(f.siteId)!;
 const nearby=()=>g.availableSites('well').filter(s=>distanceOnPlanet(site.direction,s.direction)<=IRRIGATION_RADIUS);
 assert.ok(nearby().length>=2);const a=build(g,'well',nearby()[0].id);assert.equal(g.yieldFor(f),2.5);
 const b=build(g,'well',nearby()[0].id);assert.equal(g.yieldFor(f),2.5);
 g.toggleBuilding(a);assert.equal(g.yieldFor(f),2.5);g.toggleBuilding(b);assert.equal(g.yieldFor(f),2);
 const far=g.availableSites('farm').find(s=>distanceOnPlanet(s.direction,site.direction)>IRRIGATION_RADIUS*3);assert.ok(far);
 const distant=build(g,'farm',far.id);g.toggleBuilding(a);assert.equal(g.yieldFor(g.building(distant)!),2);
});

test('food storage never discards excess legacy stock and granaries raise the limit',()=>{
 const g=fixture();const before=g.resources.food;g.tick(1);assert.ok(g.resources.food>80);assert.equal(g.totalProduced.food,0);assert.ok(g.resources.food<before);
 build(g,'granary');assert.equal(g.foodCapacity,240);g.resources.food=239.9;g.tick(30);assert.ok(g.resources.food<=240+1e-7);assert.ok(g.totalProduced.food>0);
});

test('research frees workers on finish and cancellation, and dependencies are enforced',()=>{
 const g=new GameSimulation();g.resources=stock({wood:200,stone:200,food:60});const workshop=build(g,'workshop');
 assert.match(g.researchError('metallurgy')!,/农业改良/);assert.ok(g.startResearch('agriculture').ok);assert.equal(g.workersAt(workshop),1);
 g.tick(45);assert.equal(g.workersAt(workshop),0);assert.equal(g.building(workshop)!.desiredWorkers,1);
 assert.ok(g.startResearch('tools').ok);assert.equal(g.workersAt(workshop),1);g.cancelResearch();assert.equal(g.workersAt(workshop),0);
});

test('agricultural era requires an actual harvest and chapter rewards cannot be repeated',()=>{
 const g=fixture();assert.equal(g.stage,'采集时代');const farm=build(g,'farm');release(g);g.resources.food=30;g.setWorkers(farm,1);g.tick(12);assert.equal(g.era,'farming');
 g.chapter=3;g.totalProduced.tools=6;g.resources.parts=8;const wood=g.resources.wood;
 assert.ok(g.claimChapter().ok);assert.equal(g.resources.parts,0);assert.equal(g.era,'industrial');assert.equal(g.chapter,4);
 assert.equal(g.claimChapter().ok,false);assert.equal(g.resources.wood,wood);
 assert.ok(Math.abs(g.yieldFor(g.building('b3')!)-3.24)<1e-7);
});

test('v1 migration preserves the economy and rejects corrupted v2 fields',()=>{
 const original=new GameSimulation();original.resources.food=250;original.tick(3);
 const legacy=JSON.parse(JSON.stringify(original.save()));legacy.version=1;
 for(const key of ['ore','metal','tools','parts'])delete legacy.resources[key];
 delete legacy.totalProduced;delete legacy.era;delete legacy.chapter;for(const b of legacy.buildings){delete b.limit;delete b.produced;}
 const migrated=GameSimulation.load(legacy);assert.ok(migrated);assert.equal(migrated.resources.food,original.resources.food);assert.equal(migrated.resources.wood,original.resources.wood);assert.equal(migrated.resources.ore,0);assert.equal(migrated.save().version,2);
 const broken=migrated.save();broken.totalProduced.ore=-1;assert.equal(GameSimulation.load(broken),null);
 const unknown=migrated.save();unknown.chapter=99;assert.equal(GameSimulation.load(unknown),null);
});

test('pausing freezes an active factory including inputs, output and chapter state',()=>{
 const g=fixture(),id=build(g,'smelter');release(g);g.resources.ore=10;g.resources.wood=10;g.setWorkers(id,1);g.tick(8);g.paused=true;
 const snapshot=g.save();g.tick(120);assert.deepEqual(g.save(),snapshot);g.paused=false;g.tick(4);assert.equal(g.resources.metal,1);
});

test('a full granary does not prevent immigration when food production can support it',()=>{
 const g=new GameSimulation();build(g,'house');g.resources.food=g.foodCapacity;g.growthProgress=0;
 assert.ok(g.foodBalance>0);g.tick(35);assert.equal(g.population,7);assert.ok(!g.hungry);assert.ok(g.resources.food<=g.foodCapacity);
});

test('full-load forecasts expose missing upstream capacity even when the factory cannot run',()=>{
 const g=fixture(),mine=build(g,'mine'),smelter=build(g,'smelter');release(g);g.setWorkers(mine,1);g.setWorkers(smelter,2);g.resources.ore=0;
 assert.equal(g.productionRate(g.building(smelter)!),0);
 assert.equal(g.rates.ore,10);assert.equal(g.potentialRates.ore,-10);
 assert.equal(g.potentialRates.metal,10);assert.equal(g.resources.metal,0);
 g.toggleBuilding(smelter);assert.equal(g.potentialRates.ore,10);
});
