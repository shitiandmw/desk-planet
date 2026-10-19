export type Resource = 'wood' | 'stone' | 'food' | 'ore' | 'metal' | 'tools' | 'parts';
export type Stock = Record<Resource, number>;
export type BuildingType = 'warehouse' | 'house' | 'forager' | 'lumber' | 'quarry' | 'workshop' | 'farm' | 'well' | 'granary' | 'mine' | 'smelter' | 'smithy' | 'machine';
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
  category:'living'|'production'|'discovery';
  capacity?:number;storage?:number;output?:Resource;yield?:number;cycle?:number;technology?:TechId;inputs?:Partial<Stock>;defaultLimit?:number;
}
export const BUILDINGS:Record<BuildingType,BuildingDefinition>={
  warehouse:{name:'中央储物点',description:'全星球共享库存，查看资源收支与产业来源。',cost:cost(),work:0,jobs:0,radius:.85,category:'living'},
  house:{name:'草顶住宅',description:'增加 3 个居住名额。食物充足时，新居民会加入聚落。',cost:cost(20,8),work:25,jobs:0,radius:.65,capacity:3,category:'living'},
  forager:{name:'采食小屋',description:'采集野果，支持居民生活。适合草地和林缘。',cost:cost(14,4),work:20,jobs:2,radius:.65,output:'food',yield:1,cycle:12,category:'production'},
  lumber:{name:'伐木棚',description:'在林地附近采集木材，供建设、工具制作和冶炼燃料使用。',cost:cost(18,6),work:28,jobs:3,radius:.96,output:'wood',yield:2,cycle:12,category:'production'},
  quarry:{name:'采石工地',description:'在岩丘附近开采石材，用于地基、粮仓与工厂。',cost:cost(16,8),work:28,jobs:2,radius:.72,output:'stone',yield:1,cycle:12,category:'production'},
  workshop:{name:'工具工坊',description:'提供研究岗位。研究结束后，人手自动回到空闲居民中。',cost:cost(30,14),work:40,jobs:1,radius:.72,category:'discovery'},
  farm:{name:'农田',description:'每岗基础产能是采食的两倍。附近有运行中的水井时，产量再增加 25%。',cost:cost(22,8),work:30,jobs:2,radius:.95,output:'food',yield:2,cycle:12,technology:'agriculture',category:'production'},
  well:{name:'灌溉水井',description:'覆盖附近农田，产量 +25%，不占用常驻岗位。同一农田不会叠加多口井的收益。',cost:cost(16,12),work:25,jobs:0,radius:.42,technology:'agriculture',category:'living'},
  granary:{name:'高脚粮仓',description:'食物储存容量增加 160。保留粮食余量，为工人和新居民做好准备。',cost:cost(26,10),work:30,jobs:0,radius:.72,storage:160,technology:'agriculture',category:'living'},
  mine:{name:'矿石采掘场',description:'在岩丘附近开采矿石，为冶炼提供原料。',cost:cost(24,10),work:35,jobs:2,radius:.72,output:'ore',yield:2,cycle:12,technology:'metallurgy',category:'production'},
  smelter:{name:'冶炼炉',description:'用木材作燃料，把矿石炼成金属。原料不足会暂停生产。',cost:cost(26,18),work:40,jobs:2,radius:.72,inputs:{ore:2,wood:1},output:'metal',yield:1,cycle:12,technology:'metallurgy',category:'production'},
  smithy:{name:'锻造工坊',description:'将金属与木材制作成金属工具，用于机械研究和建设。可设置目标库存。',cost:cost(24,12,{metal:2}),work:35,jobs:2,radius:.72,inputs:{metal:1,wood:1},output:'tools',yield:1,cycle:12,technology:'metallurgy',defaultLimit:12,category:'production'},
  machine:{name:'机械工坊',description:'加工金属和木材，制造机械零件。为聚落装配第一套机械动力。',cost:cost(36,20,{metal:10,tools:6}),work:55,jobs:2,radius:.95,inputs:{metal:2,wood:1},output:'parts',yield:1,cycle:16,technology:'mechanics',defaultLimit:12,category:'production'},
};
export const BUILDABLE:BuildingType[]=['house','forager','lumber','quarry','workshop','farm','well','granary','mine','smelter','smithy','machine'];
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
