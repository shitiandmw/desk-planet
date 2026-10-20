export type Resource = 'wood' | 'stone' | 'food' | 'ore' | 'metal' | 'tools' | 'parts';
export type Stock = Record<Resource, number>;
export type BuildingType = 'warehouse' | 'house' | 'forager' | 'lumber' | 'quarry' | 'workshop' | 'farm' | 'well' | 'granary' | 'mine' | 'smelter' | 'smithy' | 'machine'
  | 'windmill' | 'townhouse' | 'market'
  | 'power' | 'factory' | 'tenement' | 'depot'
  | 'apartment' | 'telecom' | 'lab' | 'chipfab' | 'windfarm'
  | 'datacenter' | 'robotics' | 'autofactory' | 'fusion' | 'ecotower'
  | 'launchpad' | 'spaceport' | 'elevator' | 'deepradar' | 'shipyard';
/** Visual era of a facility; the six long-term civilisation stages of the development plan. */
export type BuildingEra = 'gathering' | 'farming' | 'industrial' | 'information' | 'intelligence' | 'interstellar';
export type TechId = 'agriculture' | 'tools' | 'metallurgy' | 'mechanics';
export type Direction = [number, number, number];
export type EraId = 'gathering' | 'farming' | 'industrial';
export const RESOURCE_KEYS: Resource[] = ['food','wood','stone','ore','metal','tools','parts'];
export const BASIC_RESOURCES: Resource[] = ['food','wood','stone'];
export const INDUSTRY_RESOURCES: Resource[] = ['ore','metal','tools','parts'];
export const RESOURCE_NAMES: Record<Resource,string> = {wood:'木材',stone:'石材',food:'食物',ore:'矿石',metal:'金属',tools:'金属工具',parts:'机械零件'};
export const stock = (values:Partial<Stock>={}):Stock => ({food:0,wood:0,stone:0,ore:0,metal:0,tools:0,parts:0,...values});
export const emptyStock = ():Stock => stock();
const cost=(wood=0,stone=0,extra:Partial<Stock>={}):Stock=>stock({wood,stone,...extra});
export interface BuildingDefinition {
  name:string;description:string;cost:Stock;work:number;jobs:number;radius:number;
  category:'living'|'production'|'discovery';era:BuildingEra;
  capacity?:number;storage?:number;output?:Resource;yield?:number;cycle?:number;technology?:TechId;inputs?:Partial<Stock>;defaultLimit?:number;
  /** Model-only facility from the long-term plan: no economy yet, placeable only in test mode. */
  concept?:boolean;
  /** Tall silhouette that needs the wider tree-canopy clearance when choosing a site. */
  tall?:boolean;
}
/** Future-era facilities are visual previews; their rules follow the development backlog. */
const concept=(name:string,description:string,era:BuildingEra,radius:number,category:BuildingDefinition['category'],tall=false):BuildingDefinition=>({name,description,cost:cost(),work:40,jobs:0,radius,category,era,concept:true,tall});
export const BUILDINGS:Record<BuildingType,BuildingDefinition>={
  warehouse:{name:'中央储物点',description:'全星球共享库存，查看资源收支与产业来源。',cost:cost(),work:0,jobs:0,radius:.85,category:'living',era:'gathering'},
  house:{name:'草顶住宅',description:'增加 3 个居住名额。食物充足时，新居民会加入聚落。',cost:cost(20,8),work:25,jobs:0,radius:.65,capacity:3,category:'living',era:'gathering'},
  forager:{name:'采食小屋',description:'采集野果，支持居民生活。适合草地和林缘。',cost:cost(14,4),work:20,jobs:2,radius:.65,output:'food',yield:1,cycle:12,category:'production',era:'gathering'},
  lumber:{name:'伐木棚',description:'在林地附近采集木材，供建设、工具制作和冶炼燃料使用。',cost:cost(18,6),work:28,jobs:3,radius:.96,output:'wood',yield:2,cycle:12,category:'production',era:'gathering'},
  quarry:{name:'采石工地',description:'在岩丘附近开采石材，用于地基、粮仓与工厂。',cost:cost(16,8),work:28,jobs:2,radius:.72,output:'stone',yield:1,cycle:12,category:'production',era:'gathering'},
  workshop:{name:'工具工坊',description:'提供研究岗位。研究结束后，人手自动回到空闲居民中。',cost:cost(30,14),work:40,jobs:1,radius:.72,category:'discovery',era:'gathering'},
  farm:{name:'农田',description:'每岗基础产能是采食的两倍。附近有运行中的水井时，产量再增加 25%。',cost:cost(22,8),work:30,jobs:2,radius:.95,output:'food',yield:2,cycle:12,technology:'agriculture',category:'production',era:'farming'},
  well:{name:'灌溉水井',description:'覆盖附近农田，产量 +25%，不占用常驻岗位。同一农田不会叠加多口井的收益。',cost:cost(16,12),work:25,jobs:0,radius:.42,technology:'agriculture',category:'living',era:'farming'},
  granary:{name:'高脚粮仓',description:'食物储存容量增加 160。保留粮食余量，为工人和新居民做好准备。',cost:cost(26,10),work:30,jobs:0,radius:.72,storage:160,technology:'agriculture',category:'living',era:'farming'},
  mine:{name:'矿石采掘场',description:'在岩丘附近开采矿石，为冶炼提供原料。',cost:cost(24,10),work:35,jobs:2,radius:.72,output:'ore',yield:2,cycle:12,technology:'metallurgy',category:'production',era:'industrial'},
  smelter:{name:'冶炼炉',description:'用木材作燃料，把矿石炼成金属。原料不足会暂停生产。',cost:cost(26,18),work:40,jobs:2,radius:.72,inputs:{ore:2,wood:1},output:'metal',yield:1,cycle:12,technology:'metallurgy',category:'production',era:'industrial',tall:true},
  smithy:{name:'锻造工坊',description:'将金属与木材制作成金属工具，用于机械研究和建设。可设置目标库存。',cost:cost(24,12,{metal:2}),work:35,jobs:2,radius:.72,inputs:{metal:1,wood:1},output:'tools',yield:1,cycle:12,technology:'metallurgy',defaultLimit:12,category:'production',era:'industrial'},
  machine:{name:'机械工坊',description:'加工金属和木材，制造机械零件。为聚落装配第一套机械动力。',cost:cost(36,20,{metal:10,tools:6}),work:55,jobs:2,radius:.95,inputs:{metal:2,wood:1},output:'parts',yield:1,cycle:16,technology:'mechanics',defaultLimit:12,category:'production',era:'industrial',tall:true},
  windmill:concept('风车磨坊','把收获的谷物磨成面粉，四片风帆随风转动。','farming',.72,'production',true),
  townhouse:concept('瓦顶民居','砖石墙与陶瓦屋顶的两层民居，村镇成形后的住宅。','farming',.68,'living'),
  market:concept('乡间集市','带布篷的摊位与货车，农产品在这里交换。','farming',.85,'living'),
  power:concept('燃煤电站','砖砌厂房与四座高耸烟囱，运煤栈桥和变电场把电力送往工厂与城镇。','industrial',1.02,'production',true),
  factory:concept('制造工厂','锯齿形采光屋顶的机械厂房，带时钟的山墙办公楼、铆接水塔与行车吊运钢材。','industrial',.98,'production',true),
  tenement:concept('红砖公寓','四层红砖工人住宅，铁制消防梯、底层商铺与屋顶水箱。','industrial',.72,'living',true),
  depot:concept('运输车站','蒸汽机车进出的铁路货运站，月台装卸连接矿区、工厂与仓储。','industrial',.95,'production'),
  apartment:concept('现代公寓','玻璃幕墙的高层住宅，裙楼屋顶花园、楼顶停机坪与信号桅杆。','information',.72,'living',true),
  telecom:concept('通信塔','混凝土塔身托起观景舱，微波天线与红白天线杆覆盖全星球通信。','information',.6,'discovery',true),
  lab:concept('研究中心','弧形实验楼、天文台与射电天线，承担专业科研。','information',.95,'discovery',true),
  chipfab:concept('电子工厂','洁净厂房、特气储罐与彩色管廊，生产芯片与精密电子元件。','information',1.02,'production'),
  windfarm:concept('风力发电场','风机与光伏组成的清洁能源场，储能柜和变电站并网送电。','information',1.02,'production',true),
  datacenter:concept('数据中心','暗色玻璃机房托起神经核心，液冷管线与数据光缆提供星球级算力。','intelligence',1.02,'discovery'),
  robotics:concept('机器人装配厂','白色拱壳下的机器人装配线，机械臂组装人形机器人，成品在充电环上待命。','intelligence',1.02,'production',true),
  autofactory:concept('自治工厂','无人运转的穹顶工厂，无人机塔与磁悬浮管道往返配送。','intelligence',1.05,'production',true),
  fusion:concept('聚变电站','十六组线圈约束紫色等离子体，三座能量塔为算力与机器人供能。','intelligence',1.05,'production',true),
  ecotower:concept('生态塔楼','螺旋退台种满植物的智慧住宅，塔顶是空中花园与螺旋风机。','intelligence',.78,'living',true),
  launchpad:concept('火箭发射台','发射塔旁矗立两级不锈钢火箭，导流槽与推进剂储罐就绪，首次飞向轨道。','interstellar',1.08,'discovery',true),
  spaceport:concept('星港','透镜形航站楼与六边形起降坪，穿梭机在着陆光束中悬停。','interstellar',1.18,'production',true),
  elevator:concept('轨道电梯','三道拱肋汇成缆绳锚塔，缆绳直通轨道站，升降舱往返运输。','interstellar',.92,'production',true),
  deepradar:concept('深空雷达','巨型射电天线与阵列天线，向深空发出信号并侦听回音。','interstellar',1.02,'discovery',true),
  shipyard:concept('星舰船坞','反重力托架托起半成品舰体，龙门吊与焊接臂正在组装星际舰船。','interstellar',1.18,'production',true),
};
export const BUILDABLE:BuildingType[]=['house','forager','lumber','quarry','workshop','farm','well','granary','mine','smelter','smithy','machine'];
export const BUILDING_ERAS:{id:BuildingEra;name:string;short:string;summary:string}[]=[
  {id:'gathering',name:'采集时代',short:'采集',summary:'草顶住宅、木棚与林间小路'},
  {id:'farming',name:'农耕时代',short:'农耕',summary:'农田、水井、粮仓与村镇'},
  {id:'industrial',name:'工业时代',short:'工业',summary:'炉火、工坊、工厂与车辆'},
  {id:'information',name:'信息时代',short:'信息',summary:'现代城市、通信设施与研究中心'},
  {id:'intelligence',name:'人工智能时代',short:'智能',summary:'数据中心、机器人与自治工厂'},
  {id:'interstellar',name:'星际时代',short:'星际',summary:'航天、星港与轨道设施'},
];
/** Every facility a test planet can place: all eras, excluding the unique central store. */
export const SANDBOX_BUILDABLE=(Object.keys(BUILDINGS) as BuildingType[]).filter(type=>type!=='warehouse');
export const buildingsOfEra=(era:BuildingEra)=>SANDBOX_BUILDABLE.filter(type=>BUILDINGS[type].era===era);
export interface TechnologyDefinition{name:string;description:string;cost:Stock;work:number;requires?:TechId[];producedTools?:number;}
export const TECHNOLOGIES:Record<TechId,TechnologyDefinition>={
  agriculture:{name:'农业改良',description:'解锁农田、水井与粮仓，安排土地和粮食储备。',cost:cost(15,6),work:45},
  tools:{name:'工具改良',description:'木材、石材产出 +35%，施工效率 +25%。',cost:cost(20,10),work:45},
  metallurgy:{name:'金属冶炼',description:'解锁采掘、冶炼与锻造，建立第一条加工链。',cost:cost(24,12),work:60,requires:['agriculture','tools']},
  mechanics:{name:'机械制造',description:'解锁机械工坊，为第一套机械动力制造零件。',cost:cost(20,0,{metal:8,tools:6}),work:75,requires:['metallurgy'],producedTools:4},
};
export const ERA_NAMES:Record<EraId,string>={gathering:'采集时代',farming:'农耕时代',industrial:'工业起步'};
export const CIVILIZATION_ERAS=['采集','农耕','工业','信息','人工智能','星际'];
export const CHAPTERS=[
  {name:'林间安家',title:'从一片林地，\n到一处家园。',description:'安顿居民，找到发展的第一步。',reward:cost(18,8),rewardText:'18 木材 · 8 石材'},
  {name:'田野丰收',title:'让一方土地，\n养育更多人。',description:'耕作、灌溉与储粮，为新产业留出人手。',reward:cost(24,14),rewardText:'24 木材 · 14 石材'},
  {name:'炉火初燃',title:'让山间矿石，\n化作新力量。',description:'协调矿石、燃料和冶炼，打通第一条加工链。',reward:cost(20,10),rewardText:'20 木材 · 10 石材'},
  {name:'机械初鸣',title:'从手中工具，\n到机械动力。',description:'制造工具和零件，将机械动力投入聚落。',reward:cost(),rewardText:'消耗 8 零件，木石产出永久 +20%'},
];
export const FOOD_PER_PERSON_MINUTE=1.4;
export const GROWTH_SECONDS=35;
export const MAX_POPULATION=36;
export const BASE_FOOD_CAPACITY=80;
export const IRRIGATION_RADIUS=2.8;
