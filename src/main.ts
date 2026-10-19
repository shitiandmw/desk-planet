import './style.css';
import { GameSimulation, type ActionResult } from './simulation';
import { BUILDABLE, BUILDINGS, TECHNOLOGIES, RESOURCE_KEYS, BASIC_RESOURCES, INDUSTRY_RESOURCES, RESOURCE_NAMES, CIVILIZATION_ERAS, GROWTH_SECONDS, type BuildingType, type Stock, type Resource, type TechId } from './game-data';
import { SITE_BY_ID } from './world-layout';
import { WoodlandScene, type ViewName } from './scene';
import type { WeatherMode } from './weather-state';

const icons: Record<string,string> = {
  well:'<path d="M5 12h14v9H5ZM4 6l8-4 8 4M6 6v6m12-6v6m-8-5h6m-3 0v7"/>',
  granary:'<path d="m3 8 9-5 9 5M5 8h14v11H5ZM7 19v3m10-3v3M8 11h8m-8 3h8m-8 3h8"/>',
  mine:'<path d="m2 18 6-13 7-2 7 15H2Zm6 0v-7h8v7M7 10h10"/>',
  smelter:'<path d="M7 20h11l-2-12V3h-6v5ZM9 20v-5h6v5m-4-12h4"/>',
  smithy:'<path d="M3 12h17l-4 4H9l-4-2ZM9 16v4m-3 0h11M5 3l9 7m-2-7 4 4"/>',
  machine:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/>',
  ore:'<path d="m3 17 4-11 8-3 6 12-4 6H7Zm4-11 6 9 8 0m-8 0 4 6"/>',
  metal:'<path d="m3 15 5-8h9l4 8-3 5H7Zm0 0h18M8 7l-1 13m10-13 1 13"/>',
  parts:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/>',
  tree:'<path d="M12 21V11m0 6-5-5m5 2 5-5"/><path d="M12 3C5 1 1 10 7 13M13 4c7-3 11 5 5 9"/>',
  food:'<path d="M12 21V9m0 5C5 14 3 9 4 5c5 0 8 3 8 7m0 5c7 0 9-5 8-9-5 0-8 3-8 7M12 9c-3-3-2-6 0-8 2 2 3 5 0 8"/>',
  wood:'<ellipse cx="17" cy="14" rx="4" ry="6"/><path d="m17 8-9-4C1 2 0 13 5 16l12 4M5 8l8 4m-8 1 8 4"/>',
  stone:'<path d="m3 16 4-10 8-3 6 11-4 7H7Zm4-10 6 8 8 0M3 16l10-2 4 7"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5"/>',
  house:'<path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-8h4v8"/>',
  forager:'<path d="m3 10 3-7h12l3 7ZM5 10v11m14-11v11M5 18h14M9 14h6"/>',
  lumber:'<path d="M3 21V9l9-6 9 6v12M3 10h18M8 13v8m5-8v8m5-8v8"/>',
  quarry:'<path d="M4 21V4h16M8 4l-4 7M17 4v7m-3 0h6l1 7h-8ZM2 21h10"/>',
  workshop:'<path d="M3 21V10l7-6 7 6v11M14 7V3h4v7M3 21h18M7 21v-7h6v7m5-4h3v4"/>',
  farm:'<path d="M2 21h20M4 18l4-4m1 4 4-4m1 4 4-4M12 12V3m0 5C7 8 6 5 6 3c4 0 6 2 6 5m0 2c5 0 6-3 6-5-4 0-6 2-6 5"/>',
  warehouse:'<path d="M3 21V8l9-5 9 5v13ZM7 21V11h10v10M7 15h10m-10 3h10"/>',
  tools:'<path d="m4 21 10-10M13 4a6 6 0 0 0 7 8l-4-4 4-5a6 6 0 0 0-7 1ZM3 3l6 6M2 2l4 1-3 3Z"/>',
  cloud:'<path d="M5 17a4 4 0 0 1-.5-8 6 6 0 0 1 11.5-1 4.5 4.5 0 0 1 1 9Z"/><path d="m8 20-.5 1m5-1-.5 1m5-1-.5 1"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  camera:'<path d="M3 6h4l2-3h6l2 3h4v14H3Z"/><circle cx="12" cy="13" r="4"/>',
  reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-1 .6-1 1.2-1 2.2m0 3h.01"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  check:'<path d="m5 12 4 4L19 6"/>', pause:'<path d="M8 5v14m8-14v14"/>', play:'<path d="m8 5 11 7-11 7Z"/>',
};
const icon=(name:string,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.tree}</svg>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const amount=(n:number)=>Math.floor(n+1e-6).toLocaleString();
const rate=(n:number)=>(n>0?'+':'')+n.toFixed(1);
const cost=(value:Partial<Stock>)=>RESOURCE_KEYS.filter(r=>(value[r]||0)>0).map(r=>`<span>${icon(r,14)} ${Math.round((value[r]||0)*10)/10} ${RESOURCE_NAMES[r]}</span>`).join('');
const stockText=(value:Partial<Stock>,factor=1)=>RESOURCE_KEYS.filter(r=>(value[r]||0)>0).map(r=>`${Math.round((value[r]||0)*factor*10)/10} ${RESOURCE_NAMES[r]}`).join(' · ');
const resourceChip=(r:Resource,n?:number)=>`<button class="resource-chip" data-resource="${r}">${icon(r,13)}${n===undefined?'':n+' '}${RESOURCE_NAMES[r]}</button>`;
const recipe=(type:BuildingType)=>{const d=BUILDINGS[type];return d.output?`<div class="recipe">${RESOURCE_KEYS.filter(r=>(d.inputs?.[r]||0)>0).map(r=>resourceChip(r,d.inputs![r])).join('+')}${d.inputs?'<span>→</span>':''}${resourceChip(d.output,d.yield)}</div><small class="recipe-time">基础每岗周期 ${d.cycle} 游戏秒${d.inputs?'；配方完成时扣除原料。':'。'}</small>`:'';};
const buildingSummary=(type:BuildingType)=>{const d=BUILDINGS[type];return d.capacity?'住房 +'+d.capacity:d.storage?'食物容量 +'+d.storage:type==='well'?'附近农田产量 +25%':type==='workshop'?'科研与生产改良':`${d.jobs} 个${RESOURCE_NAMES[d.output!]}岗位`;};
const meter=(id:string)=>`<div class="meter"><span id="${id}"></span></div>`;
const button=(action:string,label:string,cls='secondary')=>`<button class="${cls}" data-action="${action}">${label}</button>`;
const counter=(kind:string,label:string)=>`<div class="counter"><button data-action="${kind}-minus" aria-label="减少${label}">${icon('minus',14)}</button><b id="${kind}-count"></b><button data-action="${kind}-plus" aria-label="增加${label}">${icon('plus',14)}</button></div>`;
const STORAGE='mini-planet-game-v1';
let sim=new GameSimulation(),restored=false,storageFailed=false,invalidSave=false;
try{const raw=localStorage.getItem(STORAGE);if(raw){let parsed:unknown;try{parsed=JSON.parse(raw);}catch{invalidSave=true;}const saved=GameSimulation.load(parsed);if(saved){sim=saved;restored=true;if((parsed as {version:number}).version===1&&!localStorage.getItem(STORAGE+'-v1-backup'))localStorage.setItem(STORAGE+'-v1-backup',raw);}else{invalidSave=true;localStorage.setItem(STORAGE+'-unreadable-backup',raw);}}}catch{storageFailed=true;}
let scene:WoodlandScene,panel:'overview'|'catalog'|'building'|'research'|'placement'|'economy'='overview';
let restarting=false,selectedResource:Resource='food',catalogCategory='all',lastChapter=-1;
let selected:string|null=null,panelKey='',toastTimer=0,lastRender=0,lastSave=0,lastEvent=0,warm=false;
function save(){if(restarting)return;try{localStorage.setItem(STORAGE,JSON.stringify(sim.save()));storageFailed=false;lastSave=performance.now();}catch{storageFailed=true;}setText('save-status',storageFailed?'浏览器未允许保存':'已保存到此浏览器');}
function toast(message:string){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').classList.remove('visible'),3600);}
function setText(id:string,text:string){const el=$(id);if(el&&el.textContent!==text)el.textContent=text;}
function disable(id:string,value:boolean){$(id)?.toggleAttribute('disabled',value);}
function progress(id:string,percent:number){const el=$(id);if(el)el.style.width=`${Math.max(0,Math.min(100,percent))}%`;}
function act(result:ActionResult){if(!result.ok)toast(result.reason);save();updateUI(true);}

$('app').innerHTML=`
<main aria-label="微缩星球游戏"><div id="world"></div>
<div class="ui" id="interface">
  <header class="topbar">
    <button class="brand" data-action="planet" aria-label="星球全景"><span class="brand-icon">${icon('tree',25)}</span><span>微缩星球<small>MINI PLANET</small></span></button>
    <div class="resources" role="group" aria-label="共享资源与人口">
      ${BASIC_RESOURCES.map(r=>`<button class="resource ${r}" data-resource="${r}" title="${RESOURCE_NAMES[r]}：点击查看收支；显示岗位满负荷预估">${icon(r,22)}<div><span class="resource-name">${RESOURCE_NAMES[r]}</span><strong id="stock-${r}"></strong></div><span class="rate" id="rate-${r}"></span></button>`).join('')}
      <button class="resource population" data-action="overview" title="人口 / 居住名额">${icon('people',22)}<div><span class="resource-name">居民 / 住房</span><strong id="population"></strong></div></button>
    </div>
    <div class="toolbar">${button('light',icon('sun'),'tool')}${button('photo',icon('camera'),'tool')}${button('help',icon('help'),'tool')}</div>
  </header>
  <div class="industry-stock" id="industry-stock" role="group" aria-label="产业资源" hidden>${INDUSTRY_RESOURCES.map(r=>`<button data-resource="${r}" title="查看${RESOURCE_NAMES[r]}的来源与用途">${icon(r,15)}<span>${RESOURCE_NAMES[r]}</span><strong id="stock-${r}">0</strong><small id="rate-${r}"></small></button>`).join('')}</div>
  <aside class="journey" aria-label="聚落目标">
    <div class="eyebrow">CHAPTER <span id="chapter-number">01</span> · <span id="stage">采集时代</span></div>
    <h1 id="chapter-title">从一片林地<span>，</span><br>到一处家园<span>。</span></h1>
    <p class="journey-intro" id="chapter-description">在小小的星球上，<br>安顿每一份生活。</p>
    <div class="goals" id="goals">${sim.goals.map((g,i)=>`<div class="goal" id="goal-${i}"><span class="goal-number" id="goal-mark-${i}">0${i+1}</span><div><strong id="goal-title-${i}">${g.title}</strong><p id="goal-detail-${i}">${g.detail}</p></div></div>`).join('')}</div>
    <button class="primary goal-action" id="goal-action" data-action="goal">建造第一座住宅 ${icon('arrow',16)}</button>
    <p class="chapter-foot" id="goal-foot">完成三件小事，让聚落站稳脚跟。</p>
  </aside>
  <div class="scene-label"><span class="dot"></span><span id="scene-label">星球 01 · 林间聚落</span></div>
  <aside class="management" id="management" aria-label="聚落管理">
    <div class="panel-heading"><span class="eyebrow" id="panel-kicker">SETTLEMENT</span><button class="tool small" data-action="close-panel" aria-label="收起管理面板">${icon('close',16)}</button></div>
    <div id="panel-content"></div><div id="placement-actions" hidden><button class="primary" id="confirm-build" data-action="confirm-build">${icon('check',17)} 确认建造</button>${button('cancel-build','取消选址','quiet')}</div>
  </aside>
  <button class="panel-reopen secondary" id="panel-reopen" data-action="overview" hidden>${icon('people',16)} 聚落管理</button>
  <div class="food-alert" id="food-alert" hidden><span id="food-warning"></span><button data-action="food-help">安排采食 ${icon('arrow',14)}</button></div>
  <div class="weather-dock">
    <button id="weather-toggle" data-action="weather" aria-expanded="false" aria-controls="weather-menu">${icon('cloud',18)}<span id="weather-label">自动 · 晴间多云</span><span>⌄</span></button>
    <div id="weather-menu" role="group" aria-label="选择天气" hidden>${(['auto','clear','cloudy','rain'] as const).map((m,i)=>`<button data-weather="${m}" aria-pressed="${i===0}">${['自动变化','晴间多云','多云','阵雨'][i]}</button>`).join('')}</div>
  </div>
  <div class="activity" role="group" aria-label="聚落近况"><div class="eyebrow">SETTLEMENT JOURNAL</div><p id="activity-text">${restored?`${sim.population} 位居民的聚落，正在继续生长。`:'六位居民，在这颗星球安家。'}</p><small id="save-status">${restored?'已恢复聚落进度':'进度自动保存在此浏览器'}</small></div>
  <footer class="bottom-bar">
    <div class="view-controls">${button('planet',`${icon('globe',17)}<span>全景</span>`,'view')}${button('grove',`${icon('house',17)}<span>聚落</span>`,'view')}${button('back','背面','view')}</div>
    <nav class="game-controls" aria-label="游戏操作"><button data-action="overview" id="nav-overview">${icon('people',18)}聚落</button><button data-action="catalog" id="nav-catalog">${icon('plus',19)}建设</button><button data-action="research" id="nav-research">${icon('tools',18)}科技</button></nav>
    <div class="time-controls"><button id="pause" data-action="pause" aria-label="暂停游戏">${icon('pause',16)}</button>${[1,2,4].map(s=>`<button data-speed="${s}" aria-pressed="${sim.speed===s}">${s}×</button>`).join('')}</div>
  </footer>
  <div class="navigation-hint" id="navigation-hint">拖动转动星球 · 滚轮 / 双指缩放 · 点击建筑管理</div>
</div></main>
<div id="toast" role="status" aria-live="polite"></div>
<div id="loading" role="status"><span>${icon('tree',40)}</span><p>一颗星球，正在苏醒</p><div class="loading-line"></div></div>
<dialog id="help-dialog" aria-labelledby="help-title"><button class="dialog-close tool" data-action="close-help" aria-label="关闭操作说明">${icon('close')}</button><div class="eyebrow">A SMALL WORLD, ALIVE</div><h2 id="help-title">让聚落慢慢生长</h2><dl>
<dt>建造</dt><dd>从「建设」选一座建筑。点击球面选址，绿色圆点可以建造；R 旋转，确认后开始施工，Esc 取消预览。</dd>
<dt>人手</dt><dd>所有设施共用居民。新设施建成后，点击它分配岗位；提高优先级可以调配人手。食物岗位默认优先。</dd>
<dt>生活</dt><dd>居民持续消耗食物。住房有空位、储粮至少 12 且食物产能有盈余时，每 35 游戏秒接纳一位新居民，消耗 6 份食物。</dd>
<dt>建设与研究</dt><dd>确认时预留材料，施工和研究逐步消耗；取消会返还未使用部分。建造工共用，按队列施工。</dd>
<dt>产业</dt><dd>点击顶部资源查看来源和消耗。加工设施缺料时停工，完成一轮后扣除原料。目标库存达到后停止生产，库存降低后恢复。</dd><dt>农业</dt><dd>水井覆盖附近农田，产量 +25%；粮仓增加 160 食物容量。同一农田不叠加多口井的收益。</dd><dt>节奏与存档</dt><dd>暂停和倍速同时控制建设、生产、消费与迁入。切到后台暂停推进，关闭后没有离线收益；进度只保存在当前浏览器。</dd>
<dt>天气与观察</dt><dd>拖动球体，滚轮或双指缩放。天气自然交替，也可手动选择；天气目前不影响产量。</dd>
</dl><div class="help-actions">${button('auto-rotate','星球自转')}${button('wind','树冠微风')}${button('export-save','导出存档')}${button('import-save','导入存档')}<button class="secondary" id="restore-save" data-action="restore-save" hidden>撤销上次导入</button>${button('reset-request','重新开始','danger')}</div><p class="note" id="help-save"></p>${button('close-help','回到聚落','primary full')}</dialog>
<input id="save-file" type="file" accept=".json,application/json" aria-label="选择聚落存档" hidden>
<dialog id="reset-dialog" aria-labelledby="reset-title"><div class="eyebrow">A NEW BEGINNING</div><h2 id="reset-title">重新安家？</h2><p>当前浏览器中的聚落进度会被替换，回到六位居民的开局。</p><div class="actions">${button('reset-cancel','保留聚落')}${button('reset-confirm','重新开始','danger')}</div></dialog>
`;
for(const [action,label]of [['light','切换晨光与夕照'],['photo','保存场景图片'],['help','操作说明']])document.querySelector(`[data-action="${action}"]`)?.setAttribute('aria-label',label);

function showPanel(next:typeof panel){panel=next;$('management').hidden=false;$('panel-reopen').hidden=true;updateUI(true);}
function openPanel(next:typeof panel){if(next!=='placement'&&scene.preview)scene.cancelBuild();showPanel(next);}
function build(type:BuildingType){scene.beginBuild(type);showPanel('placement');}
function renderPanel(){
  const b=selected?sim.building(selected):undefined;
  if(panel==='building'&&!b)panel='overview';
  if(panel==='placement'&&!scene.preview)panel='catalog';
  const key=[panel,selected,b?.built,sim.buildings.length,sim.technologies.join(','),sim.research?.id,scene.preview?.type,selectedResource,catalogCategory,sim.chapter].join('|');
  if(key===panelKey)return;panelKey=key;
  let html='';
  const heading=(title:string,description:string)=>`<h2>${title}</h2><p class="panel-description">${description}</p>`;
  if(panel==='overview'){
    setText('panel-kicker','SETTLEMENT · 聚落');
    html=heading(sim.currentChapter.name,'把土地、人手与资源，用在下一步发展上。')+`
    <div class="stat-pair"><div><span>空闲居民</span><strong id="idle-count"></strong></div><div><span>居住名额</span><strong id="housing-count"></strong></div></div>
    <div class="section-title">接纳新居民 <span id="growth-percent"></span></div>${meter('growth-bar')}<p class="note" id="growth-reason"></p>
    <div class="line-item"><span>建造岗位 <small id="builder-actual"></small></span>${counter('builders','建造岗位')}</div>
    <p class="note">调高建造岗位会重新安排人手，食物岗位仍然优先。</p>
    <button class="supply-summary" data-resource="food"><span>粮食储备 <b id="food-reserve"></b></span><small id="food-buffer"></small><span>查看收支与来源 ↗</span></button>
    <div class="section-title">聚落设施 <span id="facility-count"></span></div>
    <div class="facility-list">${sim.buildings.map(b=>`<button class="facility" data-building="${b.id}"><span class="facility-icon">${icon(b.type,20)}</span><span><strong>${BUILDINGS[b.type].name}</strong><small id="facility-${b.id}"></small></span><span class="facility-arrow">↗</span></button>`).join('')}</div>
    <p class="note reserve-note" id="reserved"></p>`;
  }else if(panel==='catalog'){
    setText('panel-kicker','BUILD · 建设');
    html=heading('给生活一点空间','选择建筑，再在球面上寻找落脚处。')+`<div class="segmented catalog-tabs">${[['all','全部'],['living','生活'],['production','生产'],['discovery','研究']].map(([id,name])=>`<button data-category="${id}" aria-pressed="${catalogCategory===id}">${name}</button>`).join('')}</div><div class="catalog">${BUILDABLE.filter(type=>catalogCategory==='all'||BUILDINGS[type].category===catalogCategory).map(type=>`<button class="build-card" data-build="${type}" id="build-${type}"><span class="build-icon">${icon(type,29)}</span><span class="build-copy"><strong>${BUILDINGS[type].name}</strong><small>${buildingSummary(type)}</small><span class="cost">${cost(BUILDINGS[type].cost)}</span></span><span class="build-state" id="build-state-${type}"></span></button>`).join('')}</div><p class="note">伐木靠近林地，采掘靠近岩丘。水井覆盖附近农田；锁定设施的科技条件会显示在卡片中。</p>${button('research','查看科技解锁','secondary full')}`;
  }else if(panel==='placement'){
    const p=scene.preview!,d=BUILDINGS[p.type];setText('panel-kicker','PLACE · 选址');
    html=`<div class="feature-icon">${icon(p.type,34)}</div>`+heading(d.name,d.description)+`
    <div class="cost large">${cost(d.cost)}</div><p class="note">确认后预留材料 · 基础施工 ${d.work} 工秒</p>
    <div class="placement-status" id="placement-status"></div><p class="placement-benefit" id="placement-benefit"></p><div class="line-item"><span>所在区域</span><strong id="placement-region"></strong></div><div class="line-item"><span>朝向</span><strong id="placement-yaw"></strong></div>
    <div class="actions">${button('rotate',`${icon('reset',16)} 旋转 90°`)}${button('next-site','换一处')}</div><p class="note">点击圆点选址，拖动查看周围。确认后才会开工。</p>`;
  }else if(panel==='building'&&b){
    const d=BUILDINGS[b.type];setText('panel-kicker',b.built?'BUILDING · 设施':'CONSTRUCTION · 施工');
    html=`<div class="feature-icon">${icon(b.type,32)}</div>`+heading(d.name,d.description)+`<div class="status-pill" id="building-status"></div>`;
    if(!b.built){
      html+=`<div class="section-title">施工进度 <span id="construction-percent"></span></div>${meter('construction-bar')}<p class="note" id="construction-eta"></p><div class="line-item"><span>建造岗位 <small id="builder-actual"></small></span>${counter('builders','建造岗位')}</div><p class="note" id="refund"></p><div class="actions">${button('toggle-building','暂停施工')}${button('cancel-construction','取消建设','danger')}</div>`;
    }else if(d.jobs){
      html+=`<div class="line-item staff-line"><span>分配岗位<small id="worker-actual"></small></span>${counter('workers','设施岗位')}</div><p class="note" id="worker-shortage"></p><div class="section-title">人手优先级</div><div class="segmented">${[1,2,3].map((n,i)=>`<button data-priority="${n}" aria-pressed="${b.priority===n}">${['普通','较高','优先'][i]}</button>`).join('')}</div>`;
      if(d.output)html+=`${recipe(b.type)}<p class="note" id="input-status"></p><p class="production-output" id="production-output"></p><label class="limit-label">目标库存<select id="production-limit" aria-label="生产目标库存">${[...new Set([0,6,12,24,48,100,b.limit])].sort((a,b)=>a-b).map(n=>`<option value="${n}" ${b.limit===n?'selected':''}>${n===0?'不限制':n+' '+RESOURCE_NAMES[d.output!]}</option>`).join('')}</select></label><small class="note">达到目标后停产，库存降低后继续。0 表示不限制。</small>`;
      else html+=`<p class="production-output" id="production-output"></p>`;
      html+=`<div class="actions">${button('toggle-building','暂停生产')}${b.type==='workshop'?button('research','选择研究','primary'):button('building-economy','查看供需')}</div>`;
    }else if(b.type==='house'){
      html+=`<div class="stat-pair"><div><span>这座住宅提供</span><strong>3 <small>个名额</small></strong></div><div><span>聚落人口</span><strong id="house-population"></strong></div></div><div class="section-title">下一位居民 <span id="growth-percent"></span></div>${meter('growth-bar')}<p class="note" id="growth-reason"></p>${button('growth','暂停接纳新居民','secondary full')}`;
    }else if(b.type==='well'){
      html+=`<p class="production-output" id="well-coverage"></p><p class="note">浅绿色轮廓表示灌溉范围。只对范围内农田有效；收益不叠加。</p>${button('toggle-building','暂停灌溉','secondary full')}`;
    }else if(b.type==='granary'){
      html+=`<div class="section-title">食物储备 <span id="food-reserve"></span></div>${meter('food-storage-bar')}<p class="note" id="food-buffer"></p>${button('building-economy','查看食物收支','secondary full')}`;
    }else html+=`<p class="note" id="reserved"></p>${button('economy','查看资源收支','primary full')}`;
    html+=`<div class="panel-bottom">${button('focus',`${icon('globe',15)} 定位建筑`,'quiet')}${button('overview','返回聚落','quiet')}</div>`;
  }else if(panel==='research'){
    setText('panel-kicker','DISCOVER · 科技');html=heading('让日子更从容','新的能力，需要研究，也需要真正的生产。');
    const eraIndex=sim.era==='industrial'?2:sim.era==='farming'?1:0;
    html+=`<div class="era-strip" role="group" aria-label="文明发展">${CIVILIZATION_ERAS.map((e,i)=>`<span class="${i<=eraIndex?'reached':''}" title="${i>2?'未来篇章':e+'时代'}">${e}</span>`).join('')}</div><p class="note">当前篇章通往工业起步；信息、智能与星际属于未来篇章。</p>`;
    if(!sim.buildings.some(b=>b.type==='workshop'&&b.built))html+=`<div class="research-requirement">先建一座工具工坊，居民才有研究的地方。${button('build-workshop','建造工具工坊','primary full')}</div>`;
    html+=`<div class="research-list">${(Object.keys(TECHNOLOGIES) as TechId[]).map(id=>{const d=TECHNOLOGIES[id];return `<article class="research-card" id="tech-card-${id}"><span class="feature-icon">${icon(id==='agriculture'?'food':id==='metallurgy'?'smelter':id==='mechanics'?'parts':'tools',27)}</span><h3>${d.name}</h3><p>${d.description}</p>${d.requires?`<small>前置：${d.requires.map(t=>TECHNOLOGIES[t].name).join('、')}</small>`:''}<div class="cost">${cost(d.cost)}</div><small>基础研究 ${d.work} 工秒</small><p class="note" id="research-reason-${id}"></p><button class="secondary full" id="research-${id}" data-research="${id}">开始研究</button></article>`;}).join('')}</div>`;
    if(sim.research)html+=`<div class="section-title">${TECHNOLOGIES[sim.research.id].name} <span id="research-percent"></span></div>${meter('research-bar')}<p class="note" id="research-staff"></p><p class="note" id="research-refund"></p><div class="actions">${button('locate-workshop','分配研究人手')}${button('cancel-research','取消研究','quiet')}</div>`;
    html+=button('economy','查看材料来源','quiet full');
  }else if(panel==='economy'){
    setText('panel-kicker','SUPPLY · 收支');const r=selectedResource;
    const producers=sim.buildings.filter(b=>BUILDINGS[b.type].output===r),consumers=sim.buildings.filter(b=>(BUILDINGS[b.type].inputs?.[r]||0)>0);
    const available=sim.technologies.includes('metallurgy')?RESOURCE_KEYS:BASIC_RESOURCES;
    html=heading(`${RESOURCE_NAMES[r]}的来与去`,'按当前岗位估算满负荷供需；实际产出受原料、仓储与目标库存影响。')+`<div class="resource-tabs">${available.map(k=>`<button data-resource="${k}" class="${k===r?'active':''}">${icon(k,14)}${RESOURCE_NAMES[k]}</button>`).join('')}</div>
    <div class="stat-pair"><div><span>可用库存</span><strong id="economy-stock"></strong></div><div><span>满负荷收支 / 分</span><strong id="economy-net"></strong></div></div>
    <p class="capacity-balance" id="economy-capacity"></p><p class="note" id="economy-note"></p><div class="section-title">生产来源</div>
    ${producers.map(b=>`<button class="facility" data-building="${b.id}"><span class="facility-icon">${icon(b.type,20)}</span><span><strong>${BUILDINGS[b.type].name}</strong><small id="eco-prod-${b.id}"></small></span><span class="facility-arrow">↗</span></button>`).join('')||'<p class="note">还没有生产设施。</p>'}
    <div class="source-options">${Object.entries(BUILDINGS).filter(([,d])=>d.output===r).map(([type,d])=>`<button class="secondary" data-guide-building="${type}">${icon(type,15)} 建设${d.name}</button>`).join('')}</div>
    <div class="section-title">持续消耗</div>${r==='food'?'<p class="note" id="food-consumption"></p>':''}
    ${(consumers.map(b=>`<button class="facility" data-building="${b.id}"><span class="facility-icon">${icon(b.type,20)}</span><span><strong>${BUILDINGS[b.type].name}</strong><small id="eco-use-${b.id}"></small></span><span class="facility-arrow">↗</span></button>`).join(''))||(r==='food'?'': '<p class="note">当前没有加工设施消耗此材料。</p>')}
    <div class="section-title">可以用于</div><div class="uses-list">${Object.entries(BUILDINGS).filter(([,d])=>d.cost[r]>0).map(([type,d])=>`<button data-guide-building="${type}">${d.name}<span>${d.cost[r]} ${RESOURCE_NAMES[r]} ↗</span></button>`).join('')}${Object.entries(TECHNOLOGIES).filter(([,d])=>d.cost[r]>0).map(([id,d])=>`<button data-guide-research="${id}">${d.name}<span>${d.cost[r]} ${RESOURCE_NAMES[r]} ↗</span></button>`).join('')}${r==='parts'?'<p class="note">8 零件用于装配第一套机械动力。</p>':''}</div>`;
  }
  $('panel-content').innerHTML=html;$('panel-content').scrollTop=0;$('placement-actions').hidden=panel!=='placement';$('management').dataset.panel=panel;
}

function updateUI(force=false){
  if(!scene)return;if(!force&&performance.now()-lastRender<200)return;lastRender=performance.now();if(force)scene.invalidate();renderPanel();
  $('interface').classList.toggle('inspecting',scene.camera.position.length()<32);
  const industry=sim.technologies.includes('metallurgy')||INDUSTRY_RESOURCES.some(r=>sim.resources[r]>0);$('industry-stock').hidden=!industry;$('interface').classList.toggle('has-industry',industry);
  const rates=sim.potentialRates;
  for(const r of RESOURCE_KEYS){setText(`stock-${r}`,amount(sim.resources[r]));setText(`rate-${r}`,sim.paused?'暂停':`${rate(rates[r])}/分`);$(`rate-${r}`)?.classList.toggle('negative',rates[r]<0);}
  setText('population',`${sim.population} / ${sim.capacity}`);setText('stage',sim.stage);
  if(lastChapter!==sim.chapter){lastChapter=sim.chapter;setText('chapter-number',String(Math.min(sim.chapter+1,4)).padStart(2,'0'));$('chapter-title').innerHTML=sim.currentChapter.title.split('\n').join('<br>');setText('chapter-description',sim.currentChapter.description);}
  $('food-alert').hidden=!(sim.hungry||sim.foodBalance<0);setText('food-warning',sim.hungry?'口粮不足，材料生产与施工效率降低。':`食物产能不足 ${Math.abs(sim.foodBalance).toFixed(1)}/分，需要增加食物岗位。`);
  const goals=sim.goals,index=goals.findIndex(g=>!g.done);
  goals.forEach((g,i)=>{$(`goal-${i}`).classList.toggle('complete',g.done);$(`goal-${i}`).classList.toggle('current',i===index);setText(`goal-mark-${i}`,g.done?'✓':`0${i+1}`);setText(`goal-title-${i}`,g.title);setText(`goal-detail-${i}`,g.detail);});
  setText('goal-action',sim.finished?'查看产业收支 →':index<0?`完成「${sim.currentChapter.name}」 →`:`${goals[index].title} →`);
  setText('goal-foot',sim.finished?'四个篇章已完成，继续优化你的聚落。':`本章 ${goals.filter(g=>g.done).length} / 3 · 成果：${sim.currentChapter.rewardText}`);
  setText('scene-label',scene.preview?'选址中 · 点击圆点，确认后建造':sim.paused?'聚落已暂停 · 可以继续查看与规划':`星球 01 · ${sim.currentChapter.name}`);
  setText('navigation-hint',scene.preview?'点击地面选址 · R 旋转 · Esc 取消 · 拖动转动星球':'拖动转动星球 · 滚轮 / 双指缩放 · 点击建筑或资源管理');
  const pause=$('pause');if(pause.getAttribute('aria-pressed')!==String(sim.paused)){pause.setAttribute('aria-pressed',String(sim.paused));pause.innerHTML=icon(sim.paused?'play':'pause',16);pause.setAttribute('aria-label',sim.paused?'继续游戏':'暂停游戏');}
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.speed)===sim.speed)));
  for(const mode of ['overview','catalog','research'])$(`nav-${mode}`).classList.toggle('active',!$('management').hidden&&(panel===mode||mode==='catalog'&&panel==='placement'||mode==='overview'&&(panel==='building'||panel==='economy')));
  const weather=scene.weather.state;setText('weather-label',`${weather.mode==='auto'?'自动 · ':''}${weather.label}`);document.querySelectorAll('[data-weather]').forEach(el=>el.setAttribute('aria-pressed',String((el as HTMLElement).dataset.weather===weather.mode)));
  setText('idle-count',`${sim.idle} 人`);setText('housing-count',`${sim.population} / ${sim.capacity}`);setText('house-population',`${sim.population} / ${sim.capacity}`);
  setText('builders-count',`${sim.buildersWanted}`);setText('builder-actual',`实际 ${sim.builders} 人`);document.querySelector('[data-action="builders-minus"]')?.toggleAttribute('disabled',sim.buildersWanted===0);document.querySelector('[data-action="builders-plus"]')?.toggleAttribute('disabled',sim.buildersWanted===4);
  setText('growth-percent',`${Math.floor(sim.growthProgress/GROWTH_SECONDS*100)}%`);progress('growth-bar',sim.growthProgress/GROWTH_SECONDS*100);setText('growth-reason',sim.growthReason);setText('facility-count',`${sim.buildings.length} 座`);
  setText('food-reserve',`${amount(sim.resources.food)} / ${sim.foodCapacity}`);setText('food-buffer',`停产后可支撑约 ${sim.foodMinutes.toFixed(1)} 游戏分钟 · 产能余量 ${rate(sim.foodBalance)}/分`);progress('food-storage-bar',sim.resources.food/sim.foodCapacity*100);
  for(const b of sim.buildings)setText(`facility-${b.id}`,sim.status(b));
  const reserved=sim.reserved;setText('reserved',RESOURCE_KEYS.some(r=>reserved[r]>0)?`仍在预留：${stockText(reserved)}。取消返还未使用部分。`:'资源由全星球共享，当前没有预留材料。');
  if(panel==='catalog')for(const type of BUILDABLE){const d=BUILDINGS[type],locked=sim.buildingUnlockError(type);disable(`build-${type}`,!!locked);setText(`build-state-${type}`,locked?`需${TECHNOLOGIES[d.technology!].name}`:RESOURCE_KEYS.some(r=>sim.resources[r]<d.cost[r])?'材料不足':'选址 ↗');}
  if(panel==='placement'&&scene.preview){
    scene.updatePreview();const p=scene.preview;setText('placement-status',p.error||'位置合适，可以建造');$('placement-status').classList.toggle('invalid',!!p.error);setText('placement-region',p.siteId?SITE_BY_ID.get(p.siteId)!.region:'未选地块');setText('placement-yaw',`${Math.round(p.yaw/Math.PI*180)}°`);disable('confirm-build',!!p.error);
    setText('placement-benefit',p.siteId?(p.type==='well'?`范围内有 ${sim.farmsCovered(p.siteId).length} 座已建农田；产量 +25%，同田不叠加。`:p.type==='farm'?(sim.irrigatedAt(p.siteId)?'此处已有灌溉覆盖 · 农田产量 +25%':'此处未被水井覆盖，可之后安排灌溉。'):''):'');
  }
  const b=selected?sim.building(selected):undefined;
  if(panel==='building'&&b){
    const d=BUILDINGS[b.type];setText('building-status',sim.paused?'游戏已暂停':sim.status(b));
    if(!b.built){const f=b.progress/d.work;setText('construction-percent',`${Math.floor(f*100)}%`);progress('construction-bar',f*100);setText('construction-eta',sim.paused?'游戏已暂停':b.paused?'施工已暂停':sim.builders===0?'没有建造工；增加建造岗位或释放其他人手。':sim.projects.find(p=>!p.paused)?.id!==b.id?'等待前一项工程完成':`${sim.builders} 位居民施工 · 约剩 ${Math.ceil((d.work-b.progress)/(sim.builders*sim.efficiency*(sim.technologies.includes('tools')?1.25:1)))} 游戏秒`);setText('refund',`现在取消可返还：${stockText(d.cost,1-f)}`);}
    if(b.built&&d.jobs){
      const actual=sim.workersAt(b.id);setText('workers-count',`${b.desiredWorkers} / ${d.jobs}`);setText('worker-actual',`实际 ${actual} 人 · 聚落空闲 ${sim.idle} 人`);
      setText('worker-shortage',b.type==='workshop'&&!sim.research?'等待选择研究，研究岗位暂不占人手。':b.paused?'设施暂停，居民已释放。':actual<b.desiredWorkers?'岗位缺工：释放其他岗位，或提高此处优先级。':b.desiredWorkers===0?'分配一位居民，让设施开始工作。':'居民自动作业，完成一轮后资源入库。');
      document.querySelector('[data-action="workers-minus"]')?.toggleAttribute('disabled',b.desiredWorkers===0);document.querySelector('[data-action="workers-plus"]')?.toggleAttribute('disabled',b.desiredWorkers===d.jobs);document.querySelectorAll('[data-priority]').forEach(el=>el.setAttribute('aria-pressed',String(Number((el as HTMLElement).dataset.priority)===b.priority)));
      setText('input-status',sim.productionReason(b)||`已累计生产 ${amount(b.produced)} ${d.output?RESOURCE_NAMES[d.output]:''}${sim.irrigated(b)?' · 灌溉 +25%':''}`);
      setText('production-output',d.output?`当前产能 ${rate(sim.productionRate(b)*sim.yieldFor(b))} ${RESOURCE_NAMES[d.output]} / 游戏分钟`:sim.research?`正在研究：${TECHNOLOGIES[sim.research.id].name}`:'选择下一项研究，空闲居民会自动补岗。');
    }
    const toggle=document.querySelector('[data-action="toggle-building"]');if(toggle)toggle.textContent=b.paused?'恢复运行':b.type==='well'?'暂停灌溉':b.built?'暂停生产':'暂停施工';
    const growth=document.querySelector('[data-action="growth"]');if(growth)growth.textContent=sim.growthEnabled?'暂停接纳新居民':'恢复接纳新居民';setText('well-coverage',`${sim.farmsCovered(b.siteId).length} 座农田在范围内${b.paused?' · 水井暂停中':' · 每座产量 +25%'}`);
  }
  if(panel==='research'){
    for(const id of Object.keys(TECHNOLOGIES) as TechId[]){const done=sim.technologies.includes(id),active=sim.research?.id===id,reason=sim.researchError(id);setText(`research-reason-${id}`,done?'已应用到聚落':active?'研究进行中':reason||'准备就绪，开始时预留材料');disable(`research-${id}`,!!reason);setText(`research-${id}`,done?'已完成 ✓':active?'研究中':'开始研究');}
    if(sim.research){const r=sim.research,d=TECHNOLOGIES[r.id],f=r.progress/d.work,workers=sim.buildings.filter(b=>b.type==='workshop').reduce((n,b)=>n+sim.workersAt(b.id),0);progress('research-bar',f*100);setText('research-percent',`${Math.floor(f*100)}%`);setText('research-staff',sim.paused?'游戏已暂停':workers?`${workers} 位居民研究 · 约剩 ${Math.ceil((d.work-r.progress)/(workers*sim.efficiency))} 游戏秒`:'缺少研究人手，请释放其他岗位或调整工坊优先级。');setText('research-refund',`取消可返还 ${stockText(d.cost,1-f)}`);}
  }
  if(panel==='economy'){
    const r=selectedResource;const supply=sim.buildings.filter(b=>BUILDINGS[b.type].output===r).reduce((n,b)=>n+sim.potentialRate(b)*sim.yieldFor(b),0);setText('economy-capacity',`每分钟供给 ${supply.toFixed(1)} · 需求 ${(supply-rates[r]).toFixed(1)}`);setText('economy-stock',amount(sim.resources[r]));setText('economy-net',rate(rates[r]));
    setText('economy-note',r==='food'?`食物容量 ${sim.foodCapacity}。${sim.resources.food>sim.foodCapacity?'超出容量的原有库存已保留。':''}目前停止生产后可支撑 ${sim.foodMinutes.toFixed(1)} 分钟。`:`库存已扣除预留材料；当前仍预留 ${reserved[r].toFixed(1)} ${RESOURCE_NAMES[r]}。`);
    setText('food-consumption',`${sim.population} 位居民 · ${sim.foodConsumption.toFixed(1)} 食物 / 游戏分钟${sim.hungry?'（节粮中）':''}`);
    for(const b of sim.buildings){const d=BUILDINGS[b.type];setText(`eco-prod-${b.id}`,`${sim.status(b)} · 岗位产能 ${rate(sim.potentialRate(b)*sim.yieldFor(b))}/分`);setText(`eco-use-${b.id}`,`${sim.status(b)} · 需求 ${(sim.potentialRate(b)*(d.inputs?.[r]||0)).toFixed(1)}/分`);}
  }
  const event=sim.events.at(-1);if(event&&event.id!==lastEvent){lastEvent=event.id;setText('activity-text',event.text);toast(event.text);save();}if(performance.now()-lastSave>10000)save();
}

function goView(view:ViewName){if(scene.preview)scene.cancelBuild();scene.setView(view);openPanel('overview');}
function selectBuilding(id:string,focus=true){if(scene.preview)scene.cancelBuild();if(focus)scene.focusBuilding(id);else scene.selectBuilding(id);showPanel('building');}
function openEconomy(resource:Resource='food'){selectedResource=resource;openPanel('economy');}
function guideResearch(id:TechId){
  const d=TECHNOLOGIES[id],missing=d.requires?.find(t=>!sim.technologies.includes(t));
  if(missing){guideResearch(missing);return;}
  if(d.producedTools&&sim.totalProduced.tools<d.producedTools){guideProduction('tools');return;}
  const workshop=sim.buildings.find(b=>b.type==='workshop');
  if(!workshop){build('workshop');return;}if(!workshop.built){selectBuilding(workshop.id);return;}
  openPanel('research');requestAnimationFrame(()=>$(`tech-card-${id}`)?.scrollIntoView({block:'nearest'}));
}
function guideBuilding(type:BuildingType,existing=true){
  const locked=sim.buildingUnlockError(type);if(locked){guideResearch(BUILDINGS[type].technology!);return;}
  const facility=sim.buildings.find(b=>b.type===type&&!b.built)||sim.buildings.find(b=>b.type===type);
  if(existing&&facility){selectBuilding(facility.id);return;}build(type);
}
function guideProduction(resource:Resource){
  const type:BuildingType=resource==='food'?'farm':resource==='ore'?'mine':resource==='metal'?'smelter':resource==='tools'?'smithy':resource==='parts'?'machine':resource==='wood'?'lumber':'quarry';
  guideBuilding(type);
}
function foodHelp(){
  const food=sim.buildings.filter(b=>b.built&&BUILDINGS[b.type].output==='food').find(b=>sim.workersAt(b.id)<b.desiredWorkers||b.desiredWorkers<BUILDINGS[b.type].jobs||b.paused);
  if(food)selectBuilding(food.id);else build(sim.technologies.includes('agriculture')?'farm':'forager');
}
function goalAction(){
  if(sim.finished){openEconomy('parts');return;}
  const goal=sim.goals.find(g=>!g.done);if(!goal){act(sim.claimChapter());return;}
  const [kind,value]=goal.action.split(':');
  if(kind==='build'){const project=sim.projects.find(b=>b.type===value);if(project)selectBuilding(project.id);else build(value as BuildingType);}
  else if(kind==='growth'){if(sim.foodBalance<=0)foodHelp();else if(sim.population>=sim.capacity)build('house');else openPanel('overview');}
  else if(kind==='research')guideResearch(value==='any'?'agriculture':value as TechId);
  else if(kind==='produce')guideProduction(value as Resource);
  else if(kind==='reserve'){const granary=sim.buildings.find(b=>b.type==='granary');if(!granary||!granary.built)guideBuilding('granary');else openEconomy('food');}
  else if(kind==='irrigate'){
    if(sim.buildingUnlockError('well')){guideResearch('agriculture');return;}
    const project=sim.projects.find(b=>b.type==='well'||b.type==='farm');if(project){selectBuilding(project.id);return;}
    const well=sim.buildings.find(b=>b.type==='well'&&sim.farmsCovered(b.siteId).length>0);if(well){selectBuilding(well.id);return;}
    const sites=sim.availableSites('well').filter(s=>sim.farmsCovered(s.id).length>0).sort((a,b)=>sim.farmsCovered(b.id).length-sim.farmsCovered(a.id).length);
    if(sites[0]){build('well');scene.chooseBuildSite(sites[0].id);scene.focusDirection(sites[0].direction);}else{toast('附近没有合适井位，也可以扩建第二座农田');build('farm');}
  }
}
function exportSave(){
  const blob=new Blob([JSON.stringify(sim.save(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`微缩星球-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('聚落存档已导出');
}

function handleAction(action:string){
  const b=selected?sim.building(selected):undefined;
  switch(action){
    case 'overview':case 'catalog':case 'research':openPanel(action);break;
    case 'economy':openEconomy(selectedResource);break;
    case 'building-economy':openEconomy(b?BUILDINGS[b.type].output||'food':'food');break;
    case 'export-save':exportSave();break;
    case 'import-save':$('save-file').click();break;
    case 'restore-save':try{const loaded=GameSimulation.load(JSON.parse(localStorage.getItem(STORAGE+'-before-import')||'null'));if(!loaded){toast('没有可恢复的导入前存档');break;}localStorage.setItem(STORAGE+'-before-restore',JSON.stringify(sim.save()));localStorage.setItem(STORAGE,JSON.stringify(loaded.save()));localStorage.removeItem(STORAGE+'-before-import');restarting=true;location.reload();}catch{toast('恢复失败，当前聚落未改变。');}return;
    case 'close-panel':$('management').hidden=true;$('panel-reopen').hidden=false;break;
    case 'planet':case 'grove':case 'back':goView(action);break;
    case 'goal':goalAction();break;
    case 'food-help':foodHelp();break;
    case 'pause':sim.paused=!sim.paused;break;
    case 'builders-minus':sim.setBuilders(sim.buildersWanted-1);break;
    case 'builders-plus':sim.setBuilders(sim.buildersWanted+1);break;
    case 'workers-minus':if(b)act(sim.setWorkers(b.id,b.desiredWorkers-1));break;
    case 'workers-plus':if(b)act(sim.setWorkers(b.id,b.desiredWorkers+1));break;
    case 'toggle-building':if(b)sim.toggleBuilding(b.id);break;
    case 'growth':sim.growthEnabled=!sim.growthEnabled;break;
    case 'cancel-construction':if(b){act(sim.cancelConstruction(b.id));scene.selectBuilding(null);showPanel('overview');}break;
    case 'focus':if(b)scene.focusBuilding(b.id);break;
    case 'rotate':scene.rotatePreview();break;
    case 'next-site':scene.nextBuildSite();break;
    case 'confirm-build':act(scene.confirmBuild());break;
    case 'cancel-build':scene.cancelBuild();showPanel('catalog');break;
    case 'build-workshop':build('workshop');break;
    case 'locate-workshop':{const w=sim.buildings.find(b=>b.type==='workshop'&&b.built);if(w)selectBuilding(w.id);break;}
    case 'cancel-research':sim.cancelResearch();break;
    case 'weather':$('weather-menu').hidden=!$('weather-menu').hidden;$('weather-toggle').setAttribute('aria-expanded',String(!$('weather-menu').hidden));break;
    case 'light':warm=!warm;scene.setLight(warm);toast(warm?'夕照落在聚落上':'晨光回到星球');break;
    case 'photo':void scene.capture().then(()=>toast('已保存当前星球视角'));break;
    case 'auto-rotate':scene.autoRotate=!scene.autoRotate;toast(scene.autoRotate?'星球开始缓缓转动':'已停止自转');break;
    case 'wind':scene.wind=!scene.wind;toast(scene.wind?'树冠微风已开启':'树冠微风已关闭');break;
    case 'help':try{$('restore-save').hidden=!GameSimulation.load(JSON.parse(localStorage.getItem(STORAGE+'-before-import')||'null'));}catch{$('restore-save').hidden=true;}setText('help-save',storageFailed?'浏览器未允许保存，请保留当前页面。':'聚落已自动保存到当前浏览器。');$<HTMLDialogElement>('help-dialog').showModal();break;
    case 'close-help':$<HTMLDialogElement>('help-dialog').close();break;
    case 'reset-request':$<HTMLDialogElement>('help-dialog').close();$<HTMLDialogElement>('reset-dialog').showModal();break;
    case 'reset-cancel':$<HTMLDialogElement>('reset-dialog').close();break;
    case 'reset-confirm':try{localStorage.setItem(STORAGE,JSON.stringify(new GameSimulation().save()));restarting=true;location.reload();}catch{toast('浏览器无法写入存档，暂时无法重新开始。');}return;
  }
  save();updateUI(true);
}

requestAnimationFrame(()=>setTimeout(()=>{
  try{
    scene=new WoodlandScene($('world'),sim);
    scene.onSelect=id=>{selected=id;if(!scene.preview)showPanel(id?'building':'overview');};
    scene.onPreview=()=>{if(scene.preview)showPanel('placement');};
    scene.onFrame=()=>updateUI();
    document.addEventListener('click',event=>{
      const target=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!target||target.disabled)return;
      if(target.dataset.action)handleAction(target.dataset.action);
      else if(target.dataset.build)build(target.dataset.build as BuildingType);
      else if(target.dataset.building)selectBuilding(target.dataset.building);
      else if(target.dataset.resource)openEconomy(target.dataset.resource as Resource);
      else if(target.dataset.guideBuilding)guideBuilding(target.dataset.guideBuilding as BuildingType,false);
      else if(target.dataset.guideResearch)guideResearch(target.dataset.guideResearch as TechId);
      else if(target.dataset.category){catalogCategory=target.dataset.category;showPanel('catalog');}
      else if(target.dataset.speed){sim.speed=Number(target.dataset.speed) as 1|2|4;save();updateUI(true);}
      else if(target.dataset.priority&&selected){sim.setPriority(selected,Number(target.dataset.priority));save();updateUI(true);}
      else if(target.dataset.research)act(sim.startResearch(target.dataset.research as TechId));
      else if(target.dataset.weather){scene.setWeather(target.dataset.weather as WeatherMode);$('weather-menu').hidden=true;$('weather-toggle').setAttribute('aria-expanded','false');updateUI(true);}
    });
    document.addEventListener('change',event=>{if((event.target as HTMLElement).id==='production-limit'&&selected){sim.setLimit(selected,Number((event.target as HTMLSelectElement).value));save();updateUI(true);}});
    $('save-file').addEventListener('change',async()=>{
      const input=$<HTMLInputElement>('save-file'),file=input.files?.[0];if(!file)return;
      try{
        if(file.size>2_000_000)throw new Error('too large');const loaded=GameSimulation.load(JSON.parse(await file.text()));if(!loaded)throw new Error('invalid save');
        localStorage.setItem(STORAGE+'-before-import',JSON.stringify(sim.save()));localStorage.setItem(STORAGE,JSON.stringify(loaded.save()));restarting=true;location.reload();
      }catch{toast('无法导入此存档，当前聚落进度已保留。');input.value='';}
    });
    document.addEventListener('pointerdown',event=>{if(!(event.target as HTMLElement).closest('.weather-dock')){$('weather-menu').hidden=true;$('weather-toggle').setAttribute('aria-expanded','false');}});
    document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]'))return;if(event.key==='Escape'){if(scene.preview){scene.cancelBuild();showPanel('catalog');}$('weather-menu').hidden=true;$('weather-toggle').setAttribute('aria-expanded','false');}if(event.key.toLowerCase()==='r'&&scene.preview&&!(event.target instanceof HTMLInputElement)){scene.rotatePreview();updateUI(true);}});
    window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
    Object.assign(window,{__PLANET_GAME__:{scene,simulation:sim,ready:true},__WOODLAND__:{scene,simulation:sim,ready:true}});
    $('loading').classList.add('loaded');setTimeout(()=>$('loading').remove(),600);updateUI(true);
    if(restored)toast('欢迎回来，聚落进度已恢复');else if(invalidSave)toast('旧存档无法读取，已保留副本并开启新聚落');
  }catch(error){console.error(error);$('loading').innerHTML=`${icon('tree',40)}<h2>暂时无法打开三维场景</h2><p>请使用支持 WebGL 2 的浏览器，并开启硬件加速。</p><button class="primary" id="retry">重新加载</button>`;$('retry').addEventListener('click',()=>location.reload());}
},60));
