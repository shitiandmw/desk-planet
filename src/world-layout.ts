import * as THREE from 'three';
import { BACK_LAND, elevation, landField, NORTH, PLANET_RADIUS, plotDirection } from './planet-surface';
import { BUILDINGS, type BuildingType, type Direction } from './game-data';

export const TREE_LOCATIONS = [
  {x:-3.45,z:-.85,scale:1.02,seed:11}, {x:-2.45,z:-3.35,scale:1.08,seed:24},
  {x:-.15,z:-2.65,scale:.94,seed:38}, {x:2.6,z:-2.8,scale:1.04,seed:47}, {x:3.8,z:-.45,scale:.92,seed:56},
];
export interface Site { id: string; direction: Direction; region: string; }
export const directionVector = (n: Direction) => new THREE.Vector3(...n);
export const distanceOnPlanet = (a: Direction, b: Direction) => Math.acos(THREE.MathUtils.clamp(a[0]*b[0]+a[1]*b[1]+a[2]*b[2],-1,1))*PLANET_RADIUS;
export const regionName = (n: THREE.Vector3) => n.y>.4 ? '初生大陆' : n.dot(BACK_LAND)>.6 ? '远岸林地' : '西部草原';
const site = (id:string,x:number,z:number): Site => ({id,direction:plotDirection(x,z).toArray() as Direction,region:'初生大陆'});
export const STARTING_SITES: (Site & {type:BuildingType;workers:number;yaw:number})[] = [
  {...site('home-a',-3.2,2),type:'house',workers:0,yaw:.2},
  {...site('home-b',-1.15,2.05),type:'house',workers:0,yaw:.12},
  {...site('woodcamp',1.6,2.25),type:'lumber',workers:2,yaw:-.12},
  {...site('store',.8,5.7),type:'warehouse',workers:0,yaw:0},
  {...site('berries',-4.8,4.8),type:'forager',workers:2,yaw:.35},
  {...site('stonepit',6,-2),type:'quarry',workers:1,yaw:0},
];

export const BACKGROUND_TREES: {normal:Direction; seed:number}[] = [];
for(let i=0;i<900 && BACKGROUND_TREES.length<32;i++) {
  const index=(i*337)%900, y=1-2*(index+.5)/900, a=index*Math.PI*(3-Math.sqrt(5));
  const n=new THREE.Vector3(Math.cos(a)*Math.sqrt(1-y*y),y,Math.sin(a)*Math.sqrt(1-y*y));
  if(n.y>.81 || landField(n)<.08 || elevation(n)>.4 || Math.sin(n.x*13+n.y*11)<-.1) continue;
  BACKGROUND_TREES.push({normal:n.toArray() as Direction,seed:200+i});
}
export const FORESTS: Direction[] = [...TREE_LOCATIONS.map(t=>plotDirection(t.x,t.z).toArray() as Direction),...BACKGROUND_TREES.map(t=>t.normal)];
export const ROCKS: Direction[] = [new THREE.Vector3(.48,.8,-.35).normalize().toArray() as Direction,BACK_LAND.toArray() as Direction];

export function groundRule(type:BuildingType, n:Direction):string|null {
  const normal=directionVector(n), height=elevation(normal), radius=BUILDINGS[type].radius;
  if(landField(normal)<=.025) return '这里是海面或潮湿岸线，请选择内陆草地';
  if(height>.34) return '岩坡过高，请选择较平缓的土地';
  const rotation=new THREE.Quaternion().setFromUnitVectors(NORTH,normal);
  const x=new THREE.Vector3(1,0,0).applyQuaternion(rotation), z=new THREE.Vector3(0,0,1).applyQuaternion(rotation);
  for(let i=0;i<8;i++) {
    const a=i/8*Math.PI*2, edge=normal.clone().addScaledVector(x,Math.cos(a)*radius/PLANET_RADIUS).addScaledVector(z,Math.sin(a)*radius/PLANET_RADIUS).normalize();
    if(landField(edge)<=.018) return '建筑占地伸入岸线，请向内陆移动';
    if(Math.abs(elevation(edge)-height)>radius*.24) return '地面起伏较大，请选择平坦区域';
  }
  if(type==='lumber' && Math.min(...FORESTS.map(f=>distanceOnPlanet(n,f)))>2.4) return '伐木棚需要靠近树木资源';
  if((type==='quarry'||type==='mine') && Math.min(...ROCKS.map(f=>distanceOnPlanet(n,f)))>2.65) return '采掘设施需要靠近岩丘';
  const treeClearance=(type==='smelter'||type==='machine')?.65:.22;
  if(FORESTS.some(f=>distanceOnPlanet(n,f)<radius+treeClearance)) return treeClearance>.22?'请为高大设施留出树冠间距，选择开阔地':'占地与树干重叠，请在林间空地选址';
  return null;
}

const manual: Site[] = [[-2,6.5],[-5.5,8],[3.8,6.5],[1,9],[-2,10],[-5,11],[6.5,6],[7.8,2],[8.5,-1],[8,-4.8],[4.7,9],[1.8,12],[-7,4.7],[-7.5,1]].map(([x,z],i)=>site(`meadow-${i+1}`,x,z));
export const BUILD_SITES: Site[] = [...manual];
for(let i=0;i<440;i++) {
  const y=1-2*(i+.5)/440, a=i*Math.PI*(3-Math.sqrt(5));
  const n=new THREE.Vector3(Math.cos(a)*Math.sqrt(1-y*y),y,Math.sin(a)*Math.sqrt(1-y*y));
  if(landField(n)<.055 || elevation(n)>.34) continue;
  const direction=n.toArray() as Direction;
  if([...BUILD_SITES,...STARTING_SITES].some(s=>distanceOnPlanet(s.direction,direction)<1.25))continue;
  BUILD_SITES.push({id:`land-${i}`,direction,region:regionName(n)});
}
export const ALL_SITES: Site[] = [...STARTING_SITES,...BUILD_SITES];
export const SITE_BY_ID = new Map(ALL_SITES.map(s=>[s.id,s]));

export function nearestSite(n:Direction,maximumDistance=1.15):Site|null {
  let best:Site|null=null,bestDistance=maximumDistance;
  for(const site of ALL_SITES) { const d=distanceOnPlanet(n,site.direction); if(d<bestDistance){best=site;bestDistance=d;} }
  return best;
}
