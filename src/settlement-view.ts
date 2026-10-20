import * as THREE from 'three';
import { buildingModel, constructionModel, foodCargo, stoneCargo, industryCargo } from './building-models';
import { makePerson, type Person } from './props';
import { BUILDINGS, IRRIGATION_RADIUS, type BuildingType, type Direction } from './game-data';
import { ALL_SITES, FORESTS, SITE_BY_ID, directionVector, distanceOnPlanet } from './world-layout';
import { elevation, landField, NORTH, PLANET_RADIUS, SETTLEMENT_SCALE } from './planet-surface';
import { type Building, GameSimulation } from './simulation';
import { SmokePlumes, type SmokeEmitter, type SmokeKind } from './smoke';
import type { AnimSpec } from './building-kit';

export function onSurface(n:THREE.Vector3,offset=0){return n.clone().multiplyScalar(PLANET_RADIUS+Math.max(0,elevation(n))+offset);}
function orient(object:THREE.Object3D,n:THREE.Vector3,yaw=0){object.position.copy(onSurface(n));object.quaternion.setFromUnitVectors(NORTH,n);object.rotateY(yaw);object.scale.setScalar(SETTLEMENT_SCALE);}
interface Animated {node:THREE.Object3D;spec:Required<AnimSpec>;base:number;}
interface VisualBuilding {root:THREE.Group; built:boolean; frame?:THREE.Group; anims:Animated[]; glows:THREE.Object3D[];}
/** Facility footprint on the sphere, used to clear decorative trees under buildings. */
export interface Footprint {direction:Direction;radius:number;}
interface Actor extends Person {food:THREE.Group;stone:THREE.Group;industry:THREE.Group;}

export class SettlementView {
  readonly buildings=new Map<string,VisualBuilding>();
  readonly actors=new Map<number,Actor>();
  readonly markers:THREE.InstancedMesh;
  private roads=new THREE.Group();
  private coverageKey='';
  private coverage=new THREE.LineLoop(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#88c5af',transparent:true,opacity:.85,depthWrite:false}));
  private revision=-1;
  private roadMaterial=new THREE.MeshStandardMaterial({color:'#bba875',roughness:1});
  private markerMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.66,depthWrite:false,side:THREE.DoubleSide});
  private ghostMaterial=new THREE.MeshStandardMaterial({color:'#9fb875',transparent:true,opacity:.45,depthWrite:false,roughness:.9});
  private preview:THREE.Group|null=null;
  private footprint:THREE.Mesh|null=null;
  private previewType:BuildingType|null=null;
  readonly smoke:SmokePlumes;
  private active=new Map<string,boolean>();
  /** Called after facilities change so the scene can keep scenery clear of footprints. */
  onLayout?:(footprints:Footprint[])=>void;
  constructor(private world:THREE.Group,private game:GameSimulation){
    this.markers=new THREE.InstancedMesh(new THREE.RingGeometry(.17,.2,28),this.markerMaterial,ALL_SITES.length);
    this.markers.visible=false;this.markers.frustumCulled=false;this.coverage.visible=false;this.world.add(this.markers,this.roads,this.coverage);
    this.smoke=new SmokePlumes(this.world);this.sync();
  }
  get pickables(){return [...this.buildings.values()].map(b=>b.root);}
  get footprints():Footprint[]{return this.game.buildings.map(b=>({direction:SITE_BY_ID.get(b.siteId)!.direction,radius:BUILDINGS[b.type].radius}));}
  private makeVisual(b:Building){
    const root=new THREE.Group();root.userData.buildingId=b.id;
    const visual:VisualBuilding={root,built:b.built,anims:[],glows:[]};
    if(b.built){
      const model=buildingModel(b.type);root.add(model);
      model.traverse(o=>{
        if(o.userData.anim){const spec={type:'spin',axis:'y',speed:1,amount:1,phase:0,always:false,...o.userData.anim} as Required<AnimSpec>;const base=spec.type==='bob'||spec.type==='slide'?o.position[spec.axis]:o.rotation[spec.axis];visual.anims.push({node:o,spec,base});}
        if(o.userData.activeOnly)visual.glows.push(o);
      });
    }else{const scaffold=constructionModel(b.type);root.add(scaffold.root);visual.frame=scaffold.frame;}
    orient(root,directionVector(SITE_BY_ID.get(b.siteId)!.direction),b.yaw);this.world.add(root);this.buildings.set(b.id,visual);
  }
  /** Working state drives furnace glow, gears and stacks; homes and concept models are always lived in. */
  isActive(b:Building){
    if(!b.built||b.paused)return false;
    const d=BUILDINGS[b.type];
    if(d.output)return this.game.productionRate(b)>0;
    if(b.type==='workshop')return !!this.game.research&&this.game.workersAt(b.id)>0;
    return true;
  }
  /** Chimney markers in planet coordinates; rebuilt only when facilities change. */
  private collectSmoke(){
    this.world.updateMatrixWorld(true);
    const inverse=this.world.matrixWorld.clone().invert(),emitters:SmokeEmitter[]=[],p=new THREE.Vector3();
    for(const [id,view]of this.buildings){
      if(!view.built)continue;
      view.root.traverse(o=>{if(o.name==='smoke'&&o.userData.smoke){p.setFromMatrixPosition(o.matrixWorld).applyMatrix4(inverse);const spec=o.userData.smoke as {kind:SmokeKind;size:number};emitters.push({position:p.clone(),kind:spec.kind,size:spec.size,buildingId:id,seed:(emitters.length*.618)%1});}});
    }
    this.smoke.setEmitters(emitters);
  }
  /** Rebuilds changed facilities and advances their animations; returns whether anything moved this frame. */
  sync(time=this.game.elapsed){
    if(this.revision!==this.game.revision){
      for(const [id,view]of this.buildings){const b=this.game.building(id);if(!b||b.built!==view.built){view.root.removeFromParent();if(!view.built)view.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.buildings.delete(id);}}
      for(const b of this.game.buildings)if(!this.buildings.has(b.id))this.makeVisual(b);
      this.updateRoads();this.revision=this.game.revision;if(this.previewType)this.updateMarkers(this.previewType);
      this.collectSmoke();
      this.onLayout?.(this.footprints);
    }
    for(const b of this.game.projects){const view=this.buildings.get(b.id);if(view?.frame)view.frame.scale.y=.3+.7*b.progress/BUILDINGS[b.type].work;}
    let moving=false;
    for(const b of this.game.buildings){
      const view=this.buildings.get(b.id);if(!view||!b.built)continue;
      const active=this.isActive(b),concept=!!BUILDINGS[b.type].concept;this.active.set(b.id,active);
      for(const glow of view.glows)glow.visible=active;
      for(const {node,spec,base}of view.anims){
        const always=spec.always||concept;if(!always&&!active)continue;moving=true;
        const t=(always?time:this.game.elapsed)*spec.speed+spec.phase;
        if(spec.type==='spin')node.rotation[spec.axis]=base+t;
        else if(spec.type==='swing')node.rotation[spec.axis]=base+Math.sin(t)*spec.amount;
        else if(spec.type==='bob')node.position[spec.axis]=base+Math.sin(t)*spec.amount;
        else if(spec.type==='slide')node.position[spec.axis]=base+(.5-.5*Math.cos(t))*spec.amount;
        else if(spec.type==='blink')node.visible=Math.sin(t)>.2;
        else if(spec.type==='pulse')node.scale.setScalar(1+Math.sin(t)*.06*spec.amount);
      }
    }
    if(this.smoke.update(time,id=>this.active.get(id)??false))moving=true;
    for(const citizen of this.game.people){
      if(!this.actors.has(citizen.id)){
        const person=makePerson(citizen.id) as Actor;person.food=foodCargo();person.food.position.set(0,.32,.17);person.body.add(person.food);
        person.stone=stoneCargo();person.stone.position.set(0,.35,.14);person.body.add(person.stone);person.industry=industryCargo();person.industry.position.set(0,.3,.18);person.body.add(person.industry);this.world.add(person.root);this.actors.set(citizen.id,person);
      }
      this.animateCitizen(citizen.id);
    }
    return moving;
  }
  private animateCitizen(id:number){
    const p=this.game.people.find(p=>p.id===id)!,actor=this.actors.get(id)!;
    const building=p.job==='construction'?this.game.projects.find(b=>!b.paused):this.game.building(p.job||'');
    let n:THREE.Vector3, heading:THREE.Vector3, moving=false,working=false,carrying=false;
    let output=building?BUILDINGS[building.type].output:undefined;
    if(!building){
      const center=directionVector(SITE_BY_ID.get('store')!.direction),q=new THREE.Quaternion().setFromUnitVectors(NORTH,center);
      n=center.clone().addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(q),(.9+(id%3)*.23)/PLANET_RADIUS).addScaledVector(new THREE.Vector3(0,0,1).applyQuaternion(q),(.85+Math.floor(id/3)*.15)/PLANET_RADIUS).normalize();heading=new THREE.Vector3(0,0,1).applyQuaternion(q);
    }else{
      const center=directionVector(SITE_BY_ID.get(building.siteId)!.direction),q=new THREE.Quaternion().setFromUnitVectors(NORTH,center).multiply(new THREE.Quaternion().setFromAxisAngle(NORTH,building.yaw));
      const forward=new THREE.Vector3(0,0,1).applyQuaternion(q),right=new THREE.Vector3(1,0,0).applyQuaternion(q),radius=BUILDINGS[building.type].radius;
      const start=center.clone().addScaledVector(forward,(radius+.25)/PLANET_RADIUS).addScaledVector(right,((id%3)-1)*.14/PLANET_RADIUS).normalize();
      const corner=center.clone().addScaledVector(right,(radius+.35)/PLANET_RADIUS).addScaledVector(forward,.12/PLANET_RADIUS).normalize();
      let target=center.clone().addScaledVector(right,(radius+.12)/PLANET_RADIUS).normalize();
      if(building.type==='lumber'){
        const candidates=FORESTS.map(f=>({f,d:distanceOnPlanet(f,SITE_BY_ID.get(building.siteId)!.direction)})).sort((a,b)=>a.d-b.d);
        for(const candidate of candidates){const tree=directionVector(candidate.f),end=tree.clone().lerp(center,Math.min(.45,.3/Math.max(candidate.d,.3))).normalize();let land=true;for(let j=1;j<7;j++)if(landField(corner.clone().lerp(end,j/7).normalize())<.02)land=false;if(land){target=end;break;}}
      }
      const cycle=BUILDINGS[building.type].cycle||12,t=(p.time%cycle)/cycle*12;
      const progress=t<3?t/3:t<7?1:t<11?1-(t-7)/4:0;
      moving=!!output&&(t<3||(t>=7&&t<11));working=(!!output&&t>=3&&t<7)||p.job==='construction'||building.type==='workshop';carrying=!!output&&t>=7;
      if(p.job==='construction'||building.type==='workshop'){
        n=start.clone().lerp(corner,Math.min(1,p.time/2)).normalize();heading=center.clone().sub(n);moving=p.job==='construction'&&p.time<2;
      }else{
        n=progress<.32?start.clone().lerp(corner,progress/.32).normalize():corner.clone().lerp(target,(progress-.32)/.68).normalize();
        heading=(t>=7?start:target).clone().sub(n);if(heading.length()<1e-5)heading=center.clone().sub(n);
      }
      if(landField(n)<0)n=start;
    }
    orient(actor.root,n);
    const localHeading=heading.clone().applyQuaternion(actor.root.quaternion.clone().invert());actor.root.rotateY(Math.atan2(localHeading.x,localHeading.z));
    const gait=moving?Math.sin(p.time*10):0;actor.leftLeg.rotation.x=gait*.5;actor.rightLeg.rotation.x=-gait*.5;actor.body.position.y=moving?Math.abs(gait)*.018:0;
    actor.carried.visible=carrying&&output==='wood';actor.food.visible=carrying&&output==='food';actor.stone.visible=carrying&&(output==='stone'||output==='ore');actor.industry.visible=carrying&&!!output&&['metal','tools','parts'].includes(output);
    actor.axe.visible=working&&!!output&&['wood','stone','ore'].includes(output);actor.leftArm.rotation.x=carrying?-1.3:-gait*.4;
    actor.rightArm.rotation.x=working&&output!=='food'?-1.2+Math.sin(p.time*5)*.65:carrying?-1.3:gait*.4;
  }
  private updateRoads(){
    this.roads.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.roads.clear();
    for(const b of this.game.buildings){
      if(b.initial&&['house','lumber'].includes(b.type))continue;
      const site=SITE_BY_ID.get(b.siteId)!,neighbors=this.game.buildings.filter(other=>other.id!==b.id&&(other.initial||Number(other.id.slice(1))<Number(b.id.slice(1)))).map(other=>({other,d:distanceOnPlanet(site.direction,SITE_BY_ID.get(other.siteId)!.direction)})).sort((a,b)=>a.d-b.d);
      if(!neighbors[0]||neighbors[0].d>3.8)continue;
      const a=directionVector(site.direction),end=directionVector(SITE_BY_ID.get(neighbors[0].other.siteId)!.direction);
      const points:number[]=[],indices:number[]=[];let valid=true;
      for(let i=0;i<=35;i++){
        const n=a.clone().lerp(end,i/35).normalize();if(landField(n)<.02){valid=false;break;}
        const side=new THREE.Vector3().crossVectors(n,end.clone().sub(a)).normalize();
        for(const sign of [-1,1])onSurface(n.clone().addScaledVector(side,sign*.11/PLANET_RADIUS).normalize(),.014).toArray(points,points.length);
        if(i<35){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
      }
      if(!valid)continue;
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();
      const m=new THREE.Mesh(geo,this.roadMaterial);m.material.side=THREE.DoubleSide;m.receiveShadow=true;this.roads.add(m);
    }
  }
  updateMarkers(type:BuildingType){
    const dummy=new THREE.Object3D();
    ALL_SITES.forEach((site,i)=>{const n=directionVector(site.direction);dummy.position.copy(onSurface(n,.04));dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),n);dummy.scale.setScalar(1);dummy.updateMatrix();this.markers.setMatrixAt(i,dummy.matrix);this.markers.setColorAt(i,new THREE.Color(this.game.placementError(type,site.id,false)?'#ac9475':'#b6d889'));});
    this.markers.instanceMatrix.needsUpdate=true;if(this.markers.instanceColor)this.markers.instanceColor.needsUpdate=true;
  }
  showPreview(type:BuildingType,direction:Direction,yaw:number,valid:boolean){
    if(this.previewType!==type||!this.preview){
      this.hidePreview();this.previewType=type;this.preview=new THREE.Group();
      const model=buildingModel(type);model.traverse(o=>{if(o instanceof THREE.Mesh){o.material=this.ghostMaterial;o.castShadow=o.receiveShadow=false;}});this.preview.add(model);
      this.footprint=new THREE.Mesh(new THREE.RingGeometry(BUILDINGS[type].radius/SETTLEMENT_SCALE*.96,BUILDINGS[type].radius/SETTLEMENT_SCALE,64),new THREE.MeshBasicMaterial({color:'#bad18e',side:THREE.DoubleSide,transparent:true,opacity:.95,depthWrite:false}));
      this.footprint.rotation.x=-Math.PI/2;this.footprint.position.y=.05;this.preview.add(this.footprint);this.world.add(this.preview);this.updateMarkers(type);
    }
    orient(this.preview,directionVector(direction),yaw);this.preview.position.copy(onSurface(directionVector(direction),.025));
    this.setCoverage(type==='well'?direction:null);
    this.ghostMaterial.color.set(valid?'#a1c38a':'#d39a80');(this.footprint!.material as THREE.MeshBasicMaterial).color.copy(this.ghostMaterial.color);this.markers.visible=true;
  }
  setCoverage(direction:Direction|null){
    this.coverage.visible=!!direction;const key=direction?.join(',')||'';if(key===this.coverageKey)return;this.coverageKey=key;if(!direction)return;
    const normal=directionVector(direction),q=new THREE.Quaternion().setFromUnitVectors(NORTH,normal),points:THREE.Vector3[]=[];
    for(let i=0;i<128;i++){const a=i/128*Math.PI*2;const tangent=new THREE.Vector3(Math.cos(a),0,Math.sin(a)).applyQuaternion(q);const n=normal.clone().multiplyScalar(Math.cos(IRRIGATION_RADIUS/PLANET_RADIUS)).addScaledVector(tangent,Math.sin(IRRIGATION_RADIUS/PLANET_RADIUS));points.push(onSurface(n,.035));}
    this.coverage.geometry.dispose();this.coverage.geometry=new THREE.BufferGeometry().setFromPoints(points);
  }
  hidePreview(){
    this.setCoverage(null);
    this.preview?.removeFromParent();if(this.footprint){this.footprint.geometry.dispose();(this.footprint.material as THREE.Material).dispose();}
    this.preview=null;this.footprint=null;this.previewType=null;this.markers.visible=false;
  }
}
