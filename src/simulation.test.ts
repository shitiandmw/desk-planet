import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSimulation } from './simulation';
import { BUILDINGS, type BuildingType } from './game-data';

function build(game:GameSimulation,type:BuildingType){const site=game.availableSites(type)[0];assert.ok(site,`no site for ${type}`);const result=game.build(type,site.id);assert.ok(result.ok,JSON.stringify(result));return result.id!;}
function stopProduction(game:GameSimulation){for(const b of game.buildings)if(BUILDINGS[b.type].jobs)game.setWorkers(b.id,0);}

test('construction reserves once, finishes with labor, and only then adds housing',()=>{
 const g=new GameSimulation();const before={...g.resources};const id=build(g,'house');
 assert.equal(g.resources.wood,before.wood-20);assert.equal(g.capacity,6);assert.equal(g.reserved.wood,20);
 assert.equal(g.build('house',g.building(id)!.siteId).ok,false);
 g.tick(25);assert.equal(g.building(id)!.built,true);assert.equal(g.capacity,9);assert.equal(g.reserved.wood,0);
});

test('cancel returns only unused materials and cannot refund twice',()=>{
 const g=new GameSimulation();stopProduction(g);const id=build(g,'house');g.tick(10);
 assert.ok(g.cancelConstruction(id).ok);assert.ok(Math.abs(g.resources.wood-47)<1e-6);assert.ok(Math.abs(g.resources.stone-24.8)<1e-6);
 const wood=g.resources.wood;assert.equal(g.cancelConstruction(id).ok,false);assert.equal(g.resources.wood,wood);
 assert.deepEqual(GameSimulation.load(g.save())!.save(),g.save());
});

test('all jobs share one population pool; priority changes redistribute without duplication',()=>{
 const g=new GameSimulation();g.setWorkers('b3',3);g.setWorkers('b6',2);
 assert.equal(g.people.filter(p=>p.job).length,6);assert.equal(g.workersAt('b6'),1);
 g.setPriority('b6',3);assert.equal(g.workersAt('b6'),2);assert.equal(g.workersAt('b3'),2);
 assert.equal(new Set(g.people.map(p=>p.id)).size,g.population);
});

test('zero builders stalls construction and pause freezes every economic clock',()=>{
 const g=new GameSimulation();const id=build(g,'house');g.setBuilders(0);g.tick(10);assert.equal(g.building(id)!.progress,0);
 g.setBuilders(1);g.paused=true;const before=g.save();g.tick(80);assert.deepEqual(g.save(),before);
 g.paused=false;g.speed=2;g.tick(12.5);assert.equal(g.building(id)!.built,true);
});

test('housing alone cannot grow population without food',()=>{
 const g=new GameSimulation();const id=build(g,'house');g.tick(25);assert.equal(g.building(id)!.built,true);
 stopProduction(g);g.resources.food=0;g.tick(80);assert.equal(g.population,6);assert.equal(g.hungry,true);
});

test('food shortage is recoverable through existing food jobs',()=>{
 const g=new GameSimulation();g.resources.food=0;g.tick(.25);assert.equal(g.hungry,true);
 g.tick(150);assert.equal(g.population,6);assert.equal(g.hungry,false);assert.ok(g.resources.food>=10);
});

test('a complete opening loop supports housing, food, population and agriculture',()=>{
 const g=new GameSimulation();build(g,'house');g.tick(25);
 const food=build(g,'forager');g.tick(20);g.setWorkers(food,1);g.tick(80);
 assert.ok(g.population>=8);assert.ok(g.rates.food>0);
 build(g,'workshop');g.tick(40);
 assert.ok(g.startResearch('agriculture').ok);const stock={...g.resources};assert.equal(g.startResearch('tools').ok,false);assert.deepEqual(g.resources,stock);
 g.tick(45);assert.ok(g.technologies.includes('agriculture'));assert.ok(g.availableSites('farm').length>0);assert.ok(g.goals.every(goal=>goal.done));
});

test('farm remains locked before research and insufficient resources are not spent',()=>{
 const g=new GameSimulation();const site=g.availableSites('house')[0];const before={...g.resources};
 assert.equal(g.build('farm',site.id).ok,false);assert.deepEqual(g.resources,before);
 g.resources.wood=0;assert.equal(g.build('house',site.id).ok,false);assert.equal(g.resources.stone,before.stone);
});

test('tools improve material production after paid research completes',()=>{
 const g=new GameSimulation();const workshop=build(g,'workshop');g.tick(40);g.resources.wood=100;g.resources.stone=100;
 assert.ok(g.startResearch('tools').ok);g.tick(45);assert.ok(g.technologies.includes('tools'));
 assert.equal(g.yieldFor(g.building('b3')!),2.7);assert.equal(g.yieldFor(g.building('b5')!),1);assert.equal(g.building(workshop)!.built,true);
});

test('save roundtrip preserves reservations and rejects invalid data',()=>{
 const g=new GameSimulation();build(g,'house');g.tick(10);const saved=g.save();const restored=GameSimulation.load(saved);
 assert.ok(restored);assert.deepEqual(restored.save(),saved);restored.tick(15);assert.equal(restored.capacity,9);
 assert.equal(GameSimulation.load({...saved,resources:{...saved.resources,wood:-1}}),null);
 assert.equal(GameSimulation.load({...saved,version:99}),null);
 const invalid=structuredClone(saved);invalid.buildings[0].siteId='ocean';assert.equal(GameSimulation.load(invalid),null);
});

test('paused construction yields to the next project without spending twice',()=>{
 const g=new GameSimulation();const house=build(g,'house'),food=build(g,'forager');
 g.toggleBuilding(house);g.tick(20);
 assert.equal(g.building(food)!.built,true);assert.equal(g.building(house)!.progress,0);assert.equal(g.capacity,6);
 g.toggleBuilding(house);g.tick(25);assert.equal(g.building(house)!.built,true);assert.equal(g.capacity,9);assert.equal(g.projects.length,0);
});

test('research survives reload and cancellation refunds only unused materials once',()=>{
 const g=new GameSimulation();build(g,'workshop');g.tick(40);stopProduction(g);
 assert.ok(g.startResearch('tools').ok);g.tick(18);
 const restored=GameSimulation.load(g.save());assert.ok(restored);assert.equal(restored.research!.progress,18);
 const before={...restored.resources};restored.cancelResearch();
 assert.ok(Math.abs(restored.resources.wood-before.wood-12)<1e-7);
 assert.ok(Math.abs(restored.resources.stone-before.stone-6)<1e-7);
 const after={...restored.resources};restored.cancelResearch();assert.deepEqual(restored.resources,after);assert.equal(restored.technologies.length,0);
});
