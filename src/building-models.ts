import * as THREE from 'three';
import { beam, mesh, mergeMeshes, standard, vec, woodMaterial } from './craft';
import { log, makeCottage, makeShed } from './props';
import { makeShrub } from './trees';
import { BUILDINGS, type BuildingType } from './game-data';
import { SETTLEMENT_SCALE } from './planet-surface';

const wood=woodMaterial('#b2936c'),dark=woodMaterial('#80694b');
const stone=standard('#a5a89b'),earth=standard('#9b8a5d'),canvas=standard('#d1c19a');
const leaves=standard('#8d9e51'),fruit=standard('#c09050'),metal=standard('#5b6866');
const templates=new Map<BuildingType,THREE.Group>();

function roof(group:THREE.Group,width:number,depth:number,eave:number,peak:number,material:THREE.Material){
  for(const sign of [-1,1])for(let i=0;i<9;i++)beam(group,vec(0,peak,-depth/2+(i+.5)*depth/9),vec(sign*width/2,eave,-depth/2+(i+.5)*depth/9),.06,depth/9+.012,material);
  for(const z of [-depth/2,depth/2])for(const sign of [-1,1])beam(group,vec(0,peak+.035,z),vec(sign*width/2,eave+.035,z),.08,.09,dark);
  beam(group,vec(0,peak+.045,-depth/2-.05),vec(0,peak+.045,depth/2+.05),.09,.09,dark);
}
function crate(group:THREE.Group,x:number,y:number,z:number,size=.36){
  mesh(new THREE.BoxGeometry(size,size,size),wood,group,vec(x,y+size/2,z));
  for(const side of [-1,1]){beam(group,vec(x-size/2,y+.05,z+side*(size/2+.006)),vec(x+size/2,y+size-.05,z+side*(size/2+.006)),.035,.025,dark);}
}
function basket(group:THREE.Group,x:number,y:number,z:number){
  mesh(new THREE.CylinderGeometry(.19,.14,.24,12),wood,group,vec(x,y+.12,z));
  for(let i=0;i<5;i++)mesh(new THREE.SphereGeometry(.065,8,5),fruit,group,vec(x+Math.cos(i*2.4)*.1,y+.25,z+Math.sin(i*2.4)*.1));
}
function base(group:THREE.Group,width:number,depth:number,material=earth){mesh(new THREE.BoxGeometry(width,.14,depth),material,group,vec(0,0,0));}

function buildTemplate(type:BuildingType){
  if(type==='house')return makeCottage();
  if(type==='lumber')return makeShed();
  const g=new THREE.Group();
  if(type==='forager'){
    base(g,1.65,1.4);
    for(const x of [-.65,.65])for(const z of [-.5,.5])beam(g,vec(x,.06,z),vec(x,1.2,z),.085,.085,wood);
    roof(g,1.8,1.6,1.22,1.62,canvas);
    mesh(new THREE.BoxGeometry(1.2,.07,.45),wood,g,vec(0,.52,.24));
    basket(g,-.35,.56,.25);basket(g,.25,.56,.25);basket(g,.55,.07,.65);
    crate(g,-.55,.07,-.35,.4);
    mergeMeshes(g);
    for(let i=0;i<3;i++){const bush=makeShrub(500+i,.24);bush.position.set((i-1)*.6,.02,-.82);g.add(bush);}
    return g;
  }
  if(type==='warehouse'){
    base(g,2.2,1.65,stone);
    for(const x of [-.9,.9])for(const z of [-.6,.6])beam(g,vec(x,.06,z),vec(x,1.35,z),.12,.12,wood);
    roof(g,2.45,1.9,1.37,1.9,wood);
    for(let i=0;i<3;i++)crate(g,-.6+i*.48,.07,-.3,.43);
    crate(g,-.35,.5,-.3,.43);basket(g,.6,.07,.35);
    for(let i=0;i<3;i++)log(g,vec(-.5+i*.2,.17,.35),.7,.095);
    for(let i=0;i<4;i++)mesh(new THREE.BoxGeometry(.25,.22,.24),stone,g,vec(.7+i%2*.27,.18+Math.floor(i/2)*.23,-.65));
  }else if(type==='quarry'){
    base(g,2.0,1.8,stone);
    for(let i=0;i<8;i++){const r=mesh(new THREE.DodecahedronGeometry(.23+(i%3)*.05),stone,g,vec(Math.sin(i*2.2)*.68,.18+Math.floor(i/5)*.2,Math.cos(i*2.2)*.5));r.scale.set(1,.7,1);}
    for(const x of [-.7,.7])beam(g,vec(x,.06,-.45),vec(x,1.55,-.45),.11,.11,dark);
    beam(g,vec(-.88,1.55,-.45),vec(.88,1.55,-.45),.13,.13,wood);
    beam(g,vec(.15,.35,-.45),vec(.15,1.55,-.45),.022,.022,metal);
    for(let i=0;i<3;i++)mesh(new THREE.BoxGeometry(.35,.24,.32),stone,g,vec(-.5+i*.39,.19,.55));
    crate(g,.65,.08,.55,.32);
  }else if(type==='workshop'){
    base(g,1.85,1.6,stone);
    mesh(new THREE.BoxGeometry(1.4,1.0,1.2),standard('#c3baa1'),g,vec(0,.57,-.08));
    for(const x of [-.7,.7])for(const z of [-.68,.52])beam(g,vec(x,.07,z),vec(x,1.2,z),.08,.08,dark);
    roof(g,1.95,1.75,1.18,1.95,woodMaterial('#758681'));
    mesh(new THREE.BoxGeometry(.48,.73,.04),dark,g,vec(-.3,.45,.55));
    mesh(new THREE.BoxGeometry(.58,.06,.36),wood,g,vec(.43,.55,.78));
    for(const x of [.2,.65])beam(g,vec(x,.07,.78),vec(x,.55,.78),.06,.06,dark);
    mesh(new THREE.BoxGeometry(.24,.1,.18),metal,g,vec(.43,.63,.78));
    for(let i=0;i<3;i++){beam(g,vec(.84,.2,-.3+i*.23),vec(.84,.9,-.3+i*.23),.025,.025,wood);mesh(new THREE.BoxGeometry(.12,.07,.04),metal,g,vec(.84,.85,-.3+i*.23));}
    crate(g,-.72,.07,.75,.34);
  }else if(type==='farm'){
    base(g,2.2,2.2,earth);
    for(let row=0;row<5;row++){
      mesh(new THREE.BoxGeometry(.17,.06,1.8),standard('#6e633f'),g,vec(-.8+row*.4,.09,0));
      for(let j=0;j<6;j++){
        const x=-.8+row*.4,z=-.76+j*.3;
        mesh(new THREE.CylinderGeometry(.012,.016,.3,5),leaves,g,vec(x,.26,z));
        const head=mesh(new THREE.SphereGeometry(.065,6,4),fruit,g,vec(x,.44,z));head.scale.y=1.7;
      }
    }
    for(const x of [-1.1,1.1])for(const z of [-1.1,1.1])beam(g,vec(x,.06,z),vec(x,.45,z),.06,.06,wood);
    for(const x of [-1.1,1.1])beam(g,vec(x,.32,-1.1),vec(x,.32,1.1),.045,.045,wood);
    for(const z of [-1.1,1.1])beam(g,vec(-1.1,.32,z),vec(1.1,.32,z),.045,.045,wood);
  }else if(type==='well'){
    const water=standard('#6b9b94',.3);
    mesh(new THREE.CylinderGeometry(.61,.66,.12,20),stone,g,vec(0,.04,0));
    mesh(new THREE.CylinderGeometry(.39,.39,.025,24),water,g,vec(0,.19,0));
    for(let level=0;level<3;level++)for(let i=0;i<12;i++){
      const a=(i+(level%2)*.5)/12*Math.PI*2;
      const block=mesh(new THREE.BoxGeometry(.28,.14,.17),stone,g,vec(Math.sin(a)*.48,.15+level*.14,Math.cos(a)*.48));block.rotation.y=a;
    }
    for(const x of [-.5,.5])beam(g,vec(x,.02,0),vec(x,1.38,0),.075,.075,dark);
    roof(g,1.2,.9,1.35,1.7,wood);
    beam(g,vec(-.57,1.08,0),vec(.57,1.08,0),.07,.07,wood);
    beam(g,vec(0,.3,0),vec(0,1.1,0),.018,.018,dark);
    mesh(new THREE.CylinderGeometry(.12,.09,.19,10),wood,g,vec(.18,.55,.1));
    for(let i=0;i<4;i++)mesh(new THREE.BoxGeometry(.15,.06,.28),stone,g,vec(0,.025,.65+i*.18));
  }else if(type==='granary'){
    for(const x of [-.6,.6])for(const z of [-.5,.5]){
      mesh(new THREE.CylinderGeometry(.14,.19,.22,8),stone,g,vec(x,.1,z));
      beam(g,vec(x,.12,z),vec(x,.48,z),.12,.12,dark);
    }
    base(g,1.65,1.4,stone);
    mesh(new THREE.BoxGeometry(1.5,1.15,1.25),wood,g,vec(0,1.0,0));
    for(let i=0;i<10;i++)for(const side of [-1,1])mesh(new THREE.BoxGeometry(.055,1.12,.035),dark,g,vec(-.7+i*.155,1.0,side*.64));
    for(const z of [-.66,.66])beam(g,vec(-.77,.52,z),vec(.77,.52,z),.07,.07,dark);
    roof(g,1.85,1.65,1.62,2.12,woodMaterial('#baa27b'));
    mesh(new THREE.BoxGeometry(.48,.68,.035),dark,g,vec(0,.88,.65));
    for(let i=0;i<3;i++)mesh(new THREE.BoxGeometry(.62,.13,.21),wood,g,vec(0,.11+i*.13,1.05-i*.18));
    for(const x of [-.58,.58]){const sack=mesh(new THREE.SphereGeometry(.19,10,7),canvas,g,vec(x,.63,.73));sack.scale.set(.75,1.25,.7);}
  }else if(type==='mine'){
    base(g,2.05,1.5,earth);
    const ore=standard('#6f7774');
    for(let i=0;i<7;i++){const a=i/7*Math.PI;const rock=mesh(new THREE.DodecahedronGeometry(.34+(i%2)*.1),ore,g,vec(Math.cos(a)*.7,.25+Math.sin(a)*.7,-.45));rock.scale.z=.8;}
    mesh(new THREE.BoxGeometry(.75,1.05,.05),standard('#39433b'),g,vec(0,.57,-.4));
    for(const x of [-.48,.48])beam(g,vec(x,.04,-.26),vec(x,1.19,-.26),.14,.14,wood);
    beam(g,vec(-.64,1.19,-.26),vec(.64,1.19,-.26),.16,.15,dark);
    for(const x of [-.3,.3])beam(g,vec(x,.06,-.27),vec(x,.06,.91),.035,.04,metal);
    for(let i=0;i<5;i++)mesh(new THREE.BoxGeometry(.85,.045,.09),wood,g,vec(0,.03,-.17+i*.24));
    mesh(new THREE.BoxGeometry(.58,.32,.55),metal,g,vec(0,.3,.42));
    for(const x of [-.31,.31])for(const z of [.23,.6]){const wheel=mesh(new THREE.CylinderGeometry(.11,.11,.035,12),dark,g,vec(x,.13,z));wheel.rotation.z=Math.PI/2;}
    for(let i=0;i<4;i++)mesh(new THREE.DodecahedronGeometry(.14),ore,g,vec(Math.sin(i*2.4)*.17,.5,Math.cos(i*2.4)*.13+.42));
    crate(g,.8,.05,.42,.3);
  }else if(type==='smelter'){
    base(g,1.9,1.55,stone);
    const brick=standard('#99775e'),rim=standard('#6e6d5c');
    mesh(new THREE.CylinderGeometry(.43,.65,1.55,14),brick,g,vec(-.15,.8,0));
    for(let level=0;level<5;level++){
      const ring=mesh(new THREE.TorusGeometry(.63-level*.043,.024,5,18),rim,g,vec(-.15,.2+level*.28,0));ring.rotation.x=Math.PI/2;
    }
    mesh(new THREE.CylinderGeometry(.22,.32,1.1,10),brick,g,vec(-.15,1.92,0));
    mesh(new THREE.CylinderGeometry(.27,.27,.09,10),rim,g,vec(-.15,2.46,0));
    mesh(new THREE.BoxGeometry(.46,.43,.055),standard('#343e36'),g,vec(-.15,.37,.61));
    mesh(new THREE.BoxGeometry(.58,.08,.47),stone,g,vec(-.15,.11,.76));
    for(let i=0;i<4;i++)log(g,vec(.64+(i%2)*.14,.15+Math.floor(i/2)*.13,.12),.7,.065);
    mesh(new THREE.BoxGeometry(.38,.35,.4),metal,g,vec(.72,.22,-.51));
  }else if(type==='smithy'){
    base(g,1.85,1.65,stone);
    for(const x of [-.72,.72])for(const z of [-.58,.58])beam(g,vec(x,.07,z),vec(x,1.3,z),.09,.09,dark);
    roof(g,1.95,1.75,1.3,1.92,woodMaterial('#887b65'));
    mesh(new THREE.BoxGeometry(1.25,.07,.48),wood,g,vec(0,.58,-.36));
    mesh(new THREE.BoxGeometry(.4,.2,.26),metal,g,vec(.18,.74,-.36));
    const horn=mesh(new THREE.ConeGeometry(.1,.3,6),metal,g,vec(.48,.78,-.36));horn.rotation.z=-Math.PI/2;
    for(const x of [-.45,.45])beam(g,vec(x,.07,-.36),vec(x,.58,-.36),.08,.08,dark);
    for(let i=0;i<4;i++){beam(g,vec(-.64,.65,-.4+i*.2),vec(-.64,1.1,-.4+i*.2),.025,.025,wood);mesh(new THREE.BoxGeometry(.16,.055,.07),metal,g,vec(-.64,1.08,-.4+i*.2));}
    crate(g,.62,.07,.43,.4);basket(g,-.52,.07,.52);
  }else if(type==='machine'){
    base(g,2.3,2.0,stone);
    mesh(new THREE.BoxGeometry(1.7,1.25,1.5),standard('#c0b99f'),g,vec(-.1,.7,-.15));
    for(const x of [-.95,.75])for(const z of [-.9,.6])beam(g,vec(x,.07,z),vec(x,1.38,z),.09,.09,dark);
    roof(g,2.3,2.2,1.42,2.15,woodMaterial('#76847b'));
    mesh(new THREE.BoxGeometry(.66,.86,.05),dark,g,vec(-.35,.5,.62));
    mesh(new THREE.BoxGeometry(.44,.36,.05),metal,g,vec(.4,.98,.62));
    beam(g,vec(.18,.98,.66),vec(.62,.98,.66),.035,.035,wood);
    beam(g,vec(.4,.8,.66),vec(.4,1.16,.66),.035,.035,wood);
    mesh(new THREE.BoxGeometry(.55,.45,.9),metal,g,vec(1.0,.3,0));
    mesh(new THREE.BoxGeometry(.18,.18,.12),metal,g,vec(.8,.83,.64));
    beam(g,vec(.8,.83,.55),vec(.8,.83,.91),.1,.1,metal);
    for(let i=0;i<3;i++)crate(g,-.75+i*.37,.07,.9,.29);
  }
  mergeMeshes(g);
  if(type==='machine'){
    const wheel=new THREE.Group();wheel.name='mechanism';wheel.position.set(.8,.83,.87);
    mesh(new THREE.TorusGeometry(.38,.035,6,24),metal,wheel);
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;beam(wheel,vec(0,0,0),vec(Math.cos(a)*.37,Math.sin(a)*.37,0),.035,.035,dark);const tooth=mesh(new THREE.BoxGeometry(.09,.11,.07),metal,wheel,vec(Math.cos(a)*.42,Math.sin(a)*.42,0));tooth.rotation.z=a-Math.PI/2;}
    mesh(new THREE.CylinderGeometry(.1,.1,.14,12),wood,wheel).rotation.x=Math.PI/2;g.add(wheel);
  }
  if(type==='smelter'){
    const glow=mesh(new THREE.SphereGeometry(.2,12,8),new THREE.MeshBasicMaterial({color:'#e9a24d'}),g,vec(-.15,.32,.65));glow.scale.set(1,.7,.18);glow.name='furnace-glow';glow.castShadow=false;
  }
  return g;
}

export function buildingModel(type:BuildingType){if(!templates.has(type))templates.set(type,buildTemplate(type));return templates.get(type)!.clone(true);}

export function constructionModel(type:BuildingType){
  const root=new THREE.Group(),frame=new THREE.Group();root.add(frame);
  const half=BUILDINGS[type].radius/SETTLEMENT_SCALE*.68;
  mesh(new THREE.BoxGeometry(half*2,.12,half*2),stone,root,vec(0,0,0));
  for(const x of [-half,half])for(const z of [-half,half])beam(frame,vec(x,0,z),vec(x,1.5,z),.07,.07,wood);
  for(const z of [-half,half])beam(frame,vec(-half,1.45,z),vec(half,1.45,z),.065,.065,wood);
  for(const x of [-half,half])beam(frame,vec(x,1.45,-half),vec(x,1.45,half),.065,.065,wood);
  beam(frame,vec(-half,0,-half),vec(half,1.45,-half),.05,.05,dark);
  for(let i=0;i<4;i++)mesh(new THREE.BoxGeometry(.65,.035,.12),wood,root,vec(-half*.3,.1+i*.035,half*.7));
  return {root,frame};
}

export function foodCargo(){const g=new THREE.Group();basket(g,0,0,0);mergeMeshes(g);g.scale.setScalar(.55);return g;}
export function stoneCargo(){const g=new THREE.Group();mesh(new THREE.DodecahedronGeometry(.12),stone,g);return g;}

export function industryCargo(){const g=new THREE.Group();crate(g,0,0,0,.23);for(let i=0;i<2;i++)mesh(new THREE.BoxGeometry(.16,.05,.065),metal,g,vec(0,.25,i*.08-.04));mergeMeshes(g);return g;}
