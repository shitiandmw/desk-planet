/** A bounded, reproducible economic playthrough. Uses public player actions and time only; never grants stock or population. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { GameSimulation } from '../src/simulation';
import { BUILDINGS, TECHNOLOGIES, RESOURCE_KEYS, IRRIGATION_RADIUS, type BuildingType, type TechId } from '../src/game-data';
import { SITE_BY_ID, distanceOnPlanet } from '../src/world-layout';

export function playthrough(strategy:'irrigate'|'expand') {
  const game=new GameSimulation(),milestones:{name:string;seconds:number;population:number}[]=[],actions:string[]=[];
  const log=(name:string)=>milestones.push({name,seconds:Math.round(game.elapsed),population:game.population});
  const wait=(condition:()=>boolean,label:string,limit=600)=>{
    let seconds=0;while(!condition()&&seconds<limit){game.tick(1);seconds++;assert.ok(RESOURCE_KEYS.every(r=>game.resources[r]>=-1e-7&&Number.isFinite(game.resources[r])));assert.ok(game.people.filter(p=>p.job).length<=game.population);}
    assert.ok(condition(),`${strategy}: stalled on ${label}: ${JSON.stringify({elapsed:game.elapsed,stock:game.resources,rates:game.rates,jobs:game.people.map(p=>p.job),projects:game.projects.map(b=>[b.type,b.progress])})}`);
  };
  const afford=(cost:typeof game.resources,label:string)=>wait(()=>RESOURCE_KEYS.every(r=>game.resources[r]+1e-8>=cost[r]),label);
  const build=(type:BuildingType,siteId?:string)=>{
    afford(BUILDINGS[type].cost,`materials for ${type}`);const site=siteId||game.availableSites(type)[0]?.id;assert.ok(site,`no site for ${type}`);
    const result=game.build(type,site);assert.ok(result.ok,JSON.stringify(result));game.setBuilders(1);actions.push(`build:${type}:${site}`);
    wait(()=>game.building(result.id!)!.built,`construction ${type}`);return result.id!;
  };
  const staff=(id:string,n:number)=>{assert.ok(game.setWorkers(id,n).ok);actions.push(`staff:${id}:${n}`);};
  const research=(id:TechId)=>{
    afford(TECHNOLOGIES[id].cost,`research cost ${id}`);const result=game.startResearch(id);assert.ok(result.ok,JSON.stringify(result));
    const workshop=game.buildings.find(b=>b.type==='workshop')!;game.setPriority(workshop.id,2);actions.push(`research:${id}`);
    wait(()=>game.technologies.includes(id),`research ${id}`);assert.equal(game.workersAt(workshop.id),0);
  };
  build('house');const forager=build('forager');staff(forager,1);wait(()=>game.population>=8,'population 8');
  build('workshop');research('agriculture');assert.ok(game.claimChapter().ok);log('settlement');
  const farm=build('farm');staff(farm,2);wait(()=>game.building(farm)!.produced>=2,'first harvest');
  staff('b5',0);staff(forager,0);staff('b3',3);staff('b6',2);
  if(strategy==='irrigate'){
    const farmSite=SITE_BY_ID.get(game.building(farm)!.siteId)!;
    const site=game.availableSites('well').find(s=>distanceOnPlanet(s.direction,farmSite.direction)<=IRRIGATION_RADIUS);assert.ok(site,'no irrigation site');
    build('well',site.id);assert.ok(game.irrigated(game.building(farm)!));
  }else{const second=build('farm');staff(second,1);}
  build('granary');wait(()=>game.goals.every(g=>g.done),'farming goals');assert.ok(game.claimChapter().ok);log('farming');
  research('tools');research('metallurgy');build('house');
  const mine=build('mine');staff(mine,1);const smelter=build('smelter');staff(smelter,1);
  wait(()=>game.goals.every(g=>g.done),'metal goals');assert.ok(game.claimChapter().ok);log('metallurgy');
  wait(()=>game.population>=12,'population 12');const smithy=build('smithy');game.setLimit(smithy,6);staff(smithy,1);
  wait(()=>game.resources.tools>=6,'six tools');research('mechanics');
  const machine=build('machine');staff('b3',2);staff('b6',1);staff(mine,2);staff(smelter,2);staff(smithy,0);staff(machine,1);
  wait(()=>game.goals.every(g=>g.done),'mechanical goals');assert.ok(game.claimChapter().ok);log('industrial beginning');
  assert.equal(game.era,'industrial');assert.equal(game.chapter,4);assert.ok(!game.hungry);
  const before=game.save();assert.equal(game.claimChapter().ok,false);assert.deepEqual(game.save(),before);
  return {strategy,milestones,elapsed:Math.round(game.elapsed),population:game.population,buildings:game.buildings.length,stock:game.resources,rates:game.potentialRates,actions,save:game.save()};
}

const results=(['irrigate','expand'] as const).map(playthrough);
for(const result of results)console.log(JSON.stringify({...result,save:undefined},null,2));
if(process.argv.includes('--write-fixtures')){
  for(const result of results)writeFileSync(`/tmp/planet-${result.strategy}-v2.json`,JSON.stringify(result.save,null,2));
  writeFileSync('/tmp/planet-balance-results.json',JSON.stringify(results.map(({save,actions,...r})=>r),null,2));
}
