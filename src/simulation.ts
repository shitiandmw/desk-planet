import { BUILDINGS, TECHNOLOGIES, CHAPTERS, ERA_NAMES, RESOURCE_KEYS, RESOURCE_NAMES, FOOD_PER_PERSON_MINUTE, GROWTH_SECONDS, MAX_POPULATION, BASE_FOOD_CAPACITY, IRRIGATION_RADIUS, stock, emptyStock, type BuildingType, type Resource, type Stock, type TechId, type EraId } from './game-data';
import { BUILD_SITES, SITE_BY_ID, STARTING_SITES, distanceOnPlanet, groundRule } from './world-layout';

export interface Building {id:string;type:BuildingType;siteId:string;yaw:number;progress:number;built:boolean;desiredWorkers:number;priority:number;paused:boolean;initial:boolean;produced:number;limit:number;}
export interface Citizen {id:number;job:string|null;time:number;deliveries:number;}
export interface Research {id:TechId;progress:number;}
export interface GameEvent {id:number;text:string;buildingId?:string;}
export interface GameGoal {title:string;done:boolean;detail:string;action:string;}
export type ActionResult={ok:true;id?:string}|{ok:false;reason:string};
export interface SaveGame {version:2;resources:Stock;buildings:Building[];people:Citizen[];elapsed:number;growthProgress:number;growthEnabled:boolean;hungry:boolean;paused:boolean;speed:1|2|4;buildersWanted:number;technologies:TechId[];research:Research|null;nextId:number;totalProduced:Stock;chapter:number;era:EraId;sandbox?:boolean;}
/** Test planets staff facilities with up to this many residents so production animations run. */
export const SANDBOX_POPULATION=24;
const EPS=1e-8;

/** One authoritative clock owns resources, jobs, recipes, construction and progression. */
export class GameSimulation {
  resources:Stock=stock({wood:55,stone:28,food:36});
  buildings:Building[]=STARTING_SITES.map((s,i)=>({id:`b${i+1}`,type:s.type,siteId:s.id,yaw:s.yaw,progress:BUILDINGS[s.type].work,built:true,desiredWorkers:s.workers,priority:s.type==='forager'?3:1,paused:false,initial:true,produced:0,limit:0}));
  people:Citizen[]=Array.from({length:6},(_,id)=>({id,job:null,time:0,deliveries:0}));
  elapsed=0;growthProgress=0;growthEnabled=true;hungry=false;
  paused=false;speed:1|2|4=1;buildersWanted=1;
  technologies:TechId[]=[];research:Research|null=null;
  totalProduced:Stock=emptyStock();chapter=0;era:EraId='gathering';
  events:GameEvent[]=[];revision=0;
  /** Test mode: everything unlocked, construction instant and free, stocks topped up; never shares the real save. */
  sandbox=false;
  private nextId=7;private eventId=0;
  constructor(){this.reconcile();}
  static createSandbox(){
    const game=new GameSimulation();game.sandbox=true;game.technologies=Object.keys(TECHNOLOGIES) as TechId[];game.chapter=CHAPTERS.length;game.era='industrial';game.growthEnabled=false;
    for(const b of game.buildings)b.limit=0;game.topUp();game.reconcile();return game;
  }
  get population(){return this.people.length;}
  get capacity(){return Math.min(MAX_POPULATION,this.buildings.filter(b=>b.built).reduce((sum,b)=>sum+(BUILDINGS[b.type].capacity||0),0));}
  get foodCapacity(){return BASE_FOOD_CAPACITY+this.buildings.filter(b=>b.built).reduce((n,b)=>n+(BUILDINGS[b.type].storage||0),0);}
  get idle(){return this.people.filter(p=>!p.job).length;}
  get builders(){return this.people.filter(p=>p.job==='construction').length;}
  get projects(){return this.buildings.filter(b=>!b.built);}
  get efficiency(){return this.hungry?.55:1;}
  get foodConsumption(){return this.population*(this.hungry?.4:FOOD_PER_PERSON_MINUTE);}
  get foodBalance(){return this.buildings.filter(b=>b.built&&!b.paused&&BUILDINGS[b.type].output==='food').reduce((n,b)=>n+this.workersAt(b.id)*this.yieldFor(b)*60/(BUILDINGS[b.type].cycle||12),0)-this.foodConsumption;}
  get stage(){return ERA_NAMES[this.era];}
  get currentChapter(){return CHAPTERS[Math.min(this.chapter,CHAPTERS.length-1)];}
  get finished(){return this.chapter>=CHAPTERS.length;}
  get foodMinutes(){return this.resources.food/Math.max(.01,this.foodConsumption);}
  get foodRunoutMinutes(){return this.rates.food<0?this.resources.food/-this.rates.food:Infinity;}
  get goals():GameGoal[]{
    const built=(type:BuildingType)=>this.buildings.filter(b=>b.type===type&&b.built);
    if(this.chapter===0)return [
      {title:'为新居民建一座住宅',done:built('house').some(b=>!b.initial),detail:'增加 3 个居住名额。',action:'build:house'},
      {title:'让 8 位居民衣食无忧',done:this.population>=8&&this.foodBalance>=0&&!this.hungry,detail:`当前 ${this.population} 人；维持食物盈余。`,action:'growth'},
      {title:'完成第一项生产改良',done:this.technologies.length>0,detail:'工坊可先研究农业或工具。',action:'research:any'},
    ];
    if(this.chapter===1)return [
      {title:'让农田真正结出粮食',done:built('farm').reduce((n,b)=>n+b.produced,0)>=12,detail:`农田累计产粮 ${Math.floor(built('farm').reduce((n,b)=>n+b.produced,0))} / 12。`,action:'produce:food'},
      {title:'选择田野的发展方式',done:built('farm').some(b=>this.irrigated(b)&&this.workersAt(b.id)>0)||built('farm').filter(b=>this.workersAt(b.id)>0).length>=2,detail:'灌溉一座工作的农田，或让两座农田生产。',action:'irrigate'},
      {title:'把丰收留在粮仓',done:built('granary').length>0&&this.resources.food>=60,detail:`建造粮仓，并储备 60 食物；当前 ${Math.floor(this.resources.food)}。`,action:'reserve'},
    ];
    if(this.chapter===2)return [
      {title:'掌握金属冶炼',done:this.technologies.includes('metallurgy'),detail:'农业与工具改良后研究冶炼。',action:'research:metallurgy'},
      {title:'从岩丘采出矿石',done:this.totalProduced.ore>=10,detail:`累计开采 ${Math.floor(this.totalProduced.ore)} / 10 矿石。`,action:'produce:ore'},
      {title:'点亮第一炉金属',done:this.totalProduced.metal>=8,detail:`矿石 + 木材 → 金属；累计 ${Math.floor(this.totalProduced.metal)} / 8。`,action:'produce:metal'},
    ];
    return [
      {title:'锻造趁手的工具',done:this.totalProduced.tools>=6,detail:`累计锻造 ${Math.floor(this.totalProduced.tools)} / 6 金属工具。`,action:'produce:tools'},
      {title:'理解机械的构造',done:this.technologies.includes('mechanics'),detail:'投入金属与工具，研究机械制造。',action:'research:mechanics'},
      {title:'装配第一套机械动力',done:this.finished||this.resources.parts>=8,detail:this.finished?'机械动力已投入木石生产。':`储备机械零件 ${Math.floor(this.resources.parts)} / 8，完成后投入使用。`,action:'produce:parts'},
    ];
  }
  claimChapter():ActionResult {
    if(this.finished)return {ok:false,reason:'当前四个章节已经完成'};
    if(!this.goals.every(g=>g.done))return {ok:false,reason:'还需要完成本章的三项目标'};
    const chapter=this.currentChapter;
    if(this.chapter===3){this.resources.parts-=8;this.era='industrial';}
    for(const r of RESOURCE_KEYS)this.resources[r]+=chapter.reward[r];
    this.chapter++;this.revision++;
    this.emit(this.finished?'机械动力投入使用，木石产出永久 +20%':`${chapter.name}完成，进入「${this.currentChapter.name}」`);
    return {ok:true};
  }
  get growthReason(){
    if(!this.growthEnabled)return '已暂停接纳新居民';
    if(this.population>=this.capacity)return '居住名额已满，需要新住宅';
    if(this.hungry||this.resources.food<12)return '至少储备 12 份食物';
    if(this.foodBalance<=0)return '需要食物净增长，增加采食或农业岗位';
    return '食物与住房充足，新居民正在准备迁入';
  }
  workersAt(id:string){return this.people.filter(p=>p.job===id).length;}
  building(id:string){return this.buildings.find(b=>b.id===id);}
  irrigated(b:Building){return b.type==='farm'&&this.irrigatedAt(b.siteId);}
  irrigatedAt(siteId:string){return this.buildings.some(w=>w.type==='well'&&w.built&&!w.paused&&distanceOnPlanet(SITE_BY_ID.get(w.siteId)!.direction,SITE_BY_ID.get(siteId)!.direction)<=IRRIGATION_RADIUS);}
  farmsCovered(siteId:string){const site=SITE_BY_ID.get(siteId);return site?this.buildings.filter(b=>b.type==='farm'&&b.built&&distanceOnPlanet(site.direction,SITE_BY_ID.get(b.siteId)!.direction)<=IRRIGATION_RADIUS):[];}
  yieldFor(b:Building){
    const d=BUILDINGS[b.type],raw=d.output==='wood'||d.output==='stone';
    return (d.yield||0)*(raw&&this.technologies.includes('tools')?1.35:1)*(raw&&this.finished?1.2:1)*(this.irrigated(b)?1.25:1);
  }
  productionReason(b:Building):string|null {
    const d=BUILDINGS[b.type];if(!d.output)return null;
    if(b.limit>0&&this.resources[d.output]+this.yieldFor(b)>b.limit+EPS)return `已达到目标库存 ${b.limit}`;
    if(d.output==='food'&&this.resources.food+this.yieldFor(b)>this.foodCapacity+EPS)return `食物储备已满（${this.foodCapacity}），可扩建粮仓`;
    const missing=RESOURCE_KEYS.filter(r=>this.resources[r]+EPS<(d.inputs?.[r]||0));
    return missing.length?`缺少原料：${missing.map(r=>RESOURCE_NAMES[r]).join('、')}`:null;
  }
  potentialRate(b:Building){const d=BUILDINGS[b.type];return b.built&&!b.paused&&d.output?this.workersAt(b.id)*60/(d.cycle||12)*(d.output==='food'?1:this.efficiency):0;}
  productionRate(b:Building){return this.productionReason(b)?0:this.potentialRate(b);}
  private estimateRates(fullLoad:boolean):Stock {
    const rates=emptyStock();
    for(const b of this.buildings){const d=BUILDINGS[b.type],cycles=fullLoad?this.potentialRate(b):this.productionRate(b);if(!d.output||cycles===0)continue;rates[d.output]+=cycles*this.yieldFor(b);for(const r of RESOURCE_KEYS)rates[r]-=cycles*(d.inputs?.[r]||0);}
    rates.food-=this.foodConsumption;return rates;
  }
  get rates(){return this.estimateRates(false);}
  get potentialRates(){return this.estimateRates(true);}
  get reserved():Stock {
    const result=emptyStock();
    for(const b of this.projects)for(const r of RESOURCE_KEYS)result[r]+=BUILDINGS[b.type].cost[r]*(1-b.progress/BUILDINGS[b.type].work);
    if(this.research)for(const r of RESOURCE_KEYS)result[r]+=TECHNOLOGIES[this.research.id].cost[r]*(1-this.research.progress/TECHNOLOGIES[this.research.id].work);
    return result;
  }
  status(b:Building){
    if(!b.built)return b.paused?'施工已暂停':this.builders===0?'等待建造工':this.projects.find(p=>!p.paused)?.id!==b.id?'施工排队中':`施工中 · ${Math.floor(b.progress/BUILDINGS[b.type].work*100)}%`;
    if(b.paused)return '已暂停';
    if(BUILDINGS[b.type].concept)return '概念模型 · 测试展示';
    if(BUILDINGS[b.type].capacity)return `提供 ${BUILDINGS[b.type].capacity} 个居住名额`;
    if(b.type==='warehouse')return '资源全星球共享';
    if(b.type==='well')return `灌溉范围内 ${this.farmsCovered(b.siteId).length} 座农田`;
    if(b.type==='granary')return `食物容量 +${BUILDINGS[b.type].storage}`;
    if(b.type==='workshop'&&!this.research)return '等待研究 · 人手已释放';
    if(!b.desiredWorkers)return '待分配岗位';
    if(!this.workersAt(b.id))return '缺少人手';
    const reason=this.productionReason(b);if(reason)return reason;
    if(this.workersAt(b.id)<b.desiredWorkers)return '部分岗位缺工';
    if(b.type==='workshop')return '研究进行中';
    return this.hungry&&BUILDINGS[b.type].output!=='food'?'缺粮 · 效率降低':this.irrigated(b)?'灌溉中 · 产量 +25%':'正常生产';
  }
  private emit(text:string,buildingId?:string){this.events.push({id:++this.eventId,text,buildingId});if(this.events.length>25)this.events.shift();}
  private pay(cost:Partial<Stock>){for(const r of RESOURCE_KEYS)this.resources[r]=Math.max(0,this.resources[r]-(cost[r]||0));}
  private costError(cost:Stock){const missing=RESOURCE_KEYS.filter(r=>this.resources[r]+EPS<cost[r]);return missing.length?`材料不足：还需要 ${missing.map(r=>`${Math.ceil(cost[r]-this.resources[r])} ${RESOURCE_NAMES[r]}`).join('、')}`:null;}
  buildingUnlockError(type:BuildingType){if(this.sandbox)return null;if(BUILDINGS[type].concept)return '概念模型仅在测试模式中建造';const tech=BUILDINGS[type].technology;return tech&&!this.technologies.includes(tech)?`需要先完成${TECHNOLOGIES[tech].name}`:null;}
  placementError(type:BuildingType,siteId:string,includeCost=true):string|null {
    if(type==='warehouse')return '储物点已经建成';
    const d=BUILDINGS[type],site=SITE_BY_ID.get(siteId);if(!site)return '请选择标记的可建位置';
    const locked=this.buildingUnlockError(type);if(locked)return locked;
    const terrain=groundRule(type,site.direction);if(terrain)return terrain;
    for(const b of this.buildings){const other=SITE_BY_ID.get(b.siteId)!;if(b.siteId===siteId||distanceOnPlanet(site.direction,other.direction)<d.radius+BUILDINGS[b.type].radius+.06)return `占地与${BUILDINGS[b.type].name}重叠`;}
    if(this.buildings.length>=80)return '当前聚落的建设数量已达上限';
    return includeCost&&!this.sandbox?this.costError(d.cost):null;
  }
  availableSites(type:BuildingType){return BUILD_SITES.filter(s=>!this.placementError(type,s.id,false));}
  build(type:BuildingType,siteId:string,yaw=0):ActionResult {
    const reason=this.placementError(type,siteId);if(reason)return {ok:false,reason};
    const d=BUILDINGS[type],sandbox=this.sandbox;
    if(!sandbox)this.pay(d.cost);
    const b:Building={id:`b${this.nextId++}`,type,siteId,yaw:Number.isFinite(yaw)?yaw:0,progress:sandbox?d.work:0,built:sandbox,desiredWorkers:sandbox&&d.jobs&&type!=='workshop'?1:0,priority:d.output==='food'?3:1,paused:false,initial:false,produced:0,limit:sandbox?0:d.defaultLimit||0};
    this.buildings.push(b);this.revision++;if(sandbox)this.staffSandbox();this.reconcile();this.emit(sandbox?`${d.name}已建成（测试模式）`:`${d.name}已安排施工`,b.id);return {ok:true,id:b.id};
  }
  /** Test mode only: removes a placed facility; the six starting facilities stay so the save remains valid. */
  removeBuilding(id:string):ActionResult {
    const b=this.building(id);if(!this.sandbox)return {ok:false,reason:'拆除尚未开放，仅测试模式可以移除建筑'};
    if(!b||b.initial)return {ok:false,reason:'初始聚落设施保留，不能移除'};
    this.buildings=this.buildings.filter(x=>x.id!==id);this.revision++;this.reconcile();this.emit(`${BUILDINGS[b.type].name}已移除（测试模式）`);return {ok:true};
  }
  /** Adds residents for staffed jobs on a test planet, capped for rendering cost. */
  private staffSandbox(){
    const wanted=Math.min(SANDBOX_POPULATION,this.buildings.filter(b=>b.built&&!b.paused&&(b.type!=='workshop'||!!this.research)).reduce((n,b)=>n+b.desiredWorkers,0));
    while(this.people.length<wanted){const id=Math.max(...this.people.map(p=>p.id))+1;this.people.push({id,job:null,time:0,deliveries:0});}
  }
  /** Keeps test-planet stocks away from shortages so every chain keeps animating. */
  private topUp(){
    for(const r of RESOURCE_KEYS)if(r!=='food')this.resources[r]=Math.max(this.resources[r],400);
    this.resources.food=Math.min(Math.max(this.resources.food,this.foodCapacity*.4),this.foodCapacity*.9);
  }
  cancelConstruction(id:string):ActionResult {
    const b=this.building(id);if(!b||b.built)return {ok:false,reason:'只能取消尚未完工的建设'};
    const remaining=1-b.progress/BUILDINGS[b.type].work;
    for(const r of RESOURCE_KEYS)this.resources[r]+=BUILDINGS[b.type].cost[r]*remaining;
    this.buildings=this.buildings.filter(x=>x.id!==id);this.revision++;this.reconcile();this.emit('建设已取消，未使用材料已返还');return {ok:true};
  }
  setWorkers(id:string,wanted:number):ActionResult {
    const b=this.building(id);if(!b||!b.built||!Number.isFinite(wanted))return {ok:false,reason:'设施尚未建成'};
    b.desiredWorkers=Math.max(0,Math.min(BUILDINGS[b.type].jobs,Math.round(wanted)));this.reconcile();return {ok:true};
  }
  setLimit(id:string,limit:number){const b=this.building(id);if(b&&Number.isFinite(limit)){b.limit=Math.max(0,Math.min(1000,Math.round(limit)));}}
  setPriority(id:string,priority:number){const b=this.building(id);if(b&&Number.isFinite(priority)){b.priority=Math.max(1,Math.min(3,Math.round(priority)));this.reconcile(true);}}
  setBuilders(wanted:number){if(Number.isFinite(wanted)){this.buildersWanted=Math.max(0,Math.min(4,Math.round(wanted)));this.reconcile(true);}}
  toggleBuilding(id:string){const b=this.building(id);if(b){b.paused=!b.paused;this.reconcile();}}
  researchError(id:TechId):string|null {
    if(this.technologies.includes(id))return '这项改良已经完成';
    if(this.research)return '已有一项研究正在进行';
    if(!this.buildings.some(b=>b.type==='workshop'&&b.built))return '需要先建造工具工坊';
    const d=TECHNOLOGIES[id],missing=(d.requires||[]).filter(t=>!this.technologies.includes(t));
    if(missing.length)return `先完成${missing.map(t=>TECHNOLOGIES[t].name).join('、')}`;
    if(d.producedTools&&this.totalProduced.tools<d.producedTools)return `先累计制造 ${d.producedTools} 件金属工具`;
    return this.costError(d.cost);
  }
  startResearch(id:TechId):ActionResult {
    const reason=this.researchError(id);if(reason)return {ok:false,reason};
    this.pay(TECHNOLOGIES[id].cost);this.research={id,progress:0};
    const workshop=this.buildings.find(b=>b.type==='workshop'&&b.built)!;
    workshop.desiredWorkers=1;workshop.paused=false;this.reconcile();this.emit(`开始研究${TECHNOLOGIES[id].name}`,workshop.id);return {ok:true};
  }
  cancelResearch(){if(!this.research)return;const r=this.research,d=TECHNOLOGIES[r.id];for(const k of RESOURCE_KEYS)this.resources[k]+=d.cost[k]*(1-r.progress/d.work);this.research=null;this.reconcile();this.emit('研究已取消，未使用材料已返还');}
  reconcile(preempt=false){
    const requests=this.buildings.filter(b=>b.built&&!b.paused&&b.desiredWorkers>0&&(b.type!=='workshop'||!!this.research)).map(b=>({id:b.id,wanted:b.desiredWorkers,priority:b.priority}));
    if(this.projects.some(b=>!b.paused)&&this.buildersWanted>0)requests.push({id:'construction',wanted:this.buildersWanted,priority:2});
    requests.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
    const previous=new Map(this.people.map(p=>[p.id,{job:p.job,time:p.time}])),counts=new Map<string,number>();
    if(preempt)for(const p of this.people)p.job=null;
    else for(const p of this.people){const request=requests.find(r=>r.id===p.job);if(!request||(counts.get(request.id)||0)>=request.wanted){p.job=null;p.time=0;}else counts.set(request.id,(counts.get(request.id)||0)+1);}
    for(const request of requests){
      const idle=this.people.filter(p=>!p.job).sort((a,b)=>Number(previous.get(b.id)?.job===request.id)-Number(previous.get(a.id)?.job===request.id));let count=counts.get(request.id)||0;
      for(const p of idle){if(count>=request.wanted)break;p.job=request.id;p.time=previous.get(p.id)?.job===request.id?previous.get(p.id)!.time:0;count++;}counts.set(request.id,count);
    }
  }
  tick(realDelta:number){if(this.paused||!Number.isFinite(realDelta)||realDelta<=0)return;let remaining=Math.min(realDelta,3600)*this.speed;while(remaining>EPS){const dt=Math.min(.25,remaining);this.step(dt);remaining-=dt;}}
  private step(dt:number){
    this.elapsed+=dt;this.reconcile();
    for(const p of this.people){
      if(!p.job)continue;if(p.job==='construction'){p.time+=dt;continue;}
      const b=this.building(p.job)!,d=BUILDINGS[b.type];
      if(!d.output){if(b.type==='workshop'&&this.research)p.time+=dt;continue;}
      if(this.productionReason(b))continue;
      const cycle=d.cycle||12,before=Math.floor((p.time+EPS)/cycle);p.time+=dt*(d.output==='food'?1:this.efficiency);
      const delivered=Math.floor((p.time+EPS)/cycle)-before;
      // A simulation step is shorter than a cycle. Completing workers pay in sequence, so inputs cannot be spent twice.
      if(delivered>0){const quantity=this.yieldFor(b);this.pay(d.inputs||{});p.deliveries++;b.produced+=quantity;this.resources[d.output]+=quantity;this.totalProduced[d.output]+=quantity;}
    }
    this.resources.food=Math.max(0,this.resources.food-this.foodConsumption*dt/60);
    if(!this.hungry&&this.resources.food<=EPS){this.hungry=true;this.emit('口粮不足：已节制消耗，优先恢复采食岗位');}
    else if(this.hungry&&this.resources.food>=10){this.hungry=false;this.emit('口粮恢复，生产与施工回到正常效率');}
    const project=this.projects.find(b=>!b.paused);
    if(project&&this.builders>0){
      project.progress=Math.min(BUILDINGS[project.type].work,project.progress+this.builders*dt*this.efficiency*(this.technologies.includes('tools')?1.25:1));
      if(project.progress>=BUILDINGS[project.type].work-EPS){project.built=true;this.revision++;this.emit(`${BUILDINGS[project.type].name}已建成${BUILDINGS[project.type].jobs?'，可以分配岗位':''}`,project.id);for(const p of this.people)if(p.job==='construction')p.time=0;this.reconcile();}
    }
    if(this.research){
      const researchers=this.buildings.filter(b=>b.type==='workshop'&&b.built&&!b.paused).reduce((sum,b)=>sum+this.workersAt(b.id),0),r=this.research;
      r.progress=Math.min(TECHNOLOGIES[r.id].work,r.progress+researchers*dt*this.efficiency);
      if(r.progress>=TECHNOLOGIES[r.id].work-EPS){this.technologies.push(r.id);this.research=null;this.revision++;this.reconcile();this.emit(`${TECHNOLOGIES[r.id].name}完成：${TECHNOLOGIES[r.id].description}`);}
    }
    if(this.growthEnabled&&this.population<this.capacity&&!this.hungry&&this.resources.food>=12&&this.foodBalance>0){
      this.growthProgress+=dt;if(this.growthProgress>=GROWTH_SECONDS-EPS){this.growthProgress=0;this.resources.food-=6;const id=Math.max(...this.people.map(p=>p.id))+1;this.people.push({id,job:null,time:0,deliveries:0});this.reconcile();this.emit(`一位新居民加入聚落，人口达到 ${this.population} 人`);}
    }
    if(this.era==='gathering'&&this.technologies.includes('agriculture')&&this.buildings.some(b=>b.type==='farm'&&b.produced>0)){this.era='farming';this.emit('田野开始供粮，聚落进入农耕时代');}
    if(this.sandbox)this.topUp();
  }
  save():SaveGame{return JSON.parse(JSON.stringify({version:2,resources:this.resources,buildings:this.buildings,people:this.people,elapsed:this.elapsed,growthProgress:this.growthProgress,growthEnabled:this.growthEnabled,hungry:this.hungry,paused:this.paused,speed:this.speed,buildersWanted:this.buildersWanted,technologies:this.technologies,research:this.research,nextId:this.nextId,totalProduced:this.totalProduced,chapter:this.chapter,era:this.era,...(this.sandbox?{sandbox:true}:{})}));}
  /** Validates a save. Test-planet saves only load as sandboxes, and real saves never contain concept facilities. */
  static load(raw:unknown,options:{sandbox?:boolean}={}):GameSimulation|null {
    try{
      const data=JSON.parse(JSON.stringify(raw)) as Omit<SaveGame,'version'>&{version:number};
      const number=(n:unknown,max=1e8)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
      if(!data||![1,2].includes(data.version)||!data.resources)return null;
      const sandbox=data.sandbox===true;if(sandbox!==!!options.sandbox)return null;
      const legacy=data.version===1;
      if(legacy){for(const r of ['ore','metal','tools','parts'] as Resource[])data.resources[r]??=0;data.totalProduced=emptyStock();data.chapter=0;data.era='gathering';}
      if(!RESOURCE_KEYS.every(r=>number(data.resources[r]))||!data.totalProduced||!RESOURCE_KEYS.every(r=>number(data.totalProduced[r])))return null;
      if(!Number.isInteger(data.chapter)||data.chapter<0||data.chapter>CHAPTERS.length||!Object.hasOwn(ERA_NAMES,data.era))return null;
      if(!Array.isArray(data.buildings)||data.buildings.length<STARTING_SITES.length||data.buildings.length>80)return null;
      if(!Array.isArray(data.people)||data.people.length<1||data.people.length>MAX_POPULATION)return null;
      const ids=new Set<string>(),sites=new Set<string>();
      for(const b of data.buildings){
        if(!b||typeof b.id!=='string'||!/^b\d+$/.test(b.id)||ids.has(b.id)||!Object.hasOwn(BUILDINGS,b.type)||!SITE_BY_ID.has(b.siteId)||sites.has(b.siteId))return null;
        const d=BUILDINGS[b.type];if(d.concept&&!sandbox)return null;if(legacy){b.produced??=0;b.limit??=d.defaultLimit||0;}
        if(!number(b.progress,d.work)||!number(b.produced)||!number(b.limit,1000)||!Number.isInteger(b.limit)||typeof b.built!=='boolean'||typeof b.paused!=='boolean'||typeof b.initial!=='boolean'||!Number.isFinite(b.yaw))return null;
        if(!Number.isInteger(b.desiredWorkers)||b.desiredWorkers<0||b.desiredWorkers>d.jobs||![1,2,3].includes(b.priority))return null;
        if(b.built&&Math.abs(b.progress-d.work)>EPS)return null;if(!b.built&&(b.initial||d.work===0||b.progress>=d.work))return null;
        ids.add(b.id);sites.add(b.siteId);
      }
      if(!STARTING_SITES.every((s,i)=>data.buildings.some(b=>b.id===`b${i+1}`&&b.siteId===s.id&&b.type===s.type&&b.built&&b.initial)))return null;
      const citizenIds=new Set<number>();
      for(const p of data.people){if(!number(p.id,10000)||!Number.isInteger(p.id)||citizenIds.has(p.id)||!number(p.time)||!number(p.deliveries)||!(p.job===null||p.job==='construction'||ids.has(p.job)))return null;citizenIds.add(p.id);}
      if(!Array.isArray(data.technologies)||data.technologies.some(t=>!Object.hasOwn(TECHNOLOGIES,t))||new Set(data.technologies).size!==data.technologies.length)return null;
      if(data.research&&(!Object.hasOwn(TECHNOLOGIES,data.research.id)||data.technologies.includes(data.research.id)||!number(data.research.progress,TECHNOLOGIES[data.research.id].work)))return null;
      if(!number(data.elapsed)||!number(data.growthProgress,GROWTH_SECONDS)||![1,2,4].includes(data.speed)||!Number.isInteger(data.buildersWanted)||data.buildersWanted<0||data.buildersWanted>4)return null;
      if(typeof data.paused!=='boolean'||typeof data.growthEnabled!=='boolean'||typeof data.hungry!=='boolean')return null;
      const game=new GameSimulation();game.sandbox=sandbox;
      for(const key of ['resources','buildings','people','elapsed','growthProgress','growthEnabled','hungry','paused','speed','buildersWanted','technologies','research','totalProduced','chapter','era'] as const)Object.assign(game,{[key]:data[key]});
      const minimumId=Math.max(...game.buildings.map(b=>Number(b.id.slice(1))))+1;game.nextId=Number.isSafeInteger(data.nextId)&&data.nextId>=minimumId&&data.nextId<=1e8?data.nextId:minimumId;
      if(!sandbox&&game.population>game.capacity)return null;game.reconcile();return game;
    }catch{return null;}
  }
}
