import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3, Vector4 } from 'three';
import { CLOUD_PROFILES, CLOUD_MAX_HEIGHT, CLOUD_MAX_WIDTH, CLOUD_MAX_DEPTH, CLOUD_MAX_THICKNESS, createCloudMotion, updateCloudMotion } from './cloud-motion';
import { projectCloudShadow } from './cloud-shadows';
import { COMPANION_CLOUD_RADIUS } from './companion-framing';
import { PLANET_RADIUS, elevation } from './planet-surface';
import { PlanetWeather } from './weather';

test('clouds share a prevailing wind but drift apart, with bounded smooth paths', () => {
  const displacements: number[] = [];
  for (let i=0;i<CLOUD_PROFILES.length;i++) {
    const motion=createCloudMotion();updateCloudMotion(i,0,1,1,motion);
    const start=motion.longitude;let previous=motion.longitude;
    for(let time=1;time<=3600;time++) {
      updateCloudMotion(i,time,1,1,motion);
      const speed=motion.longitude-previous;previous=motion.longitude;
      assert.ok(speed>.004 && speed<.008);
      assert.ok(motion.height<=CLOUD_MAX_HEIGHT && motion.width<=CLOUD_MAX_WIDTH && motion.depth<=CLOUD_MAX_DEPTH && motion.thickness<=CLOUD_MAX_THICKNESS);
    }
    displacements.push(motion.longitude-start);
  }
  assert.ok(Math.max(...displacements)-Math.min(...displacements)>2);
});

test('clouds form and dissipate gradually, with fewer clouds in clear weather and no rain from an absent cloud', () => {
  let clearAmount=0,rainAmount=0;
  for(let i=0;i<CLOUD_PROFILES.length;i++) {
    const dry=createCloudMotion(),wet=createCloudMotion();let previous=0,low=false,high=false;
    for(let time=0;time<1800;time+=.5) {
      updateCloudMotion(i,time,.08,0,dry);updateCloudMotion(i,time,1,1,wet);
      if(time>0)assert.ok(Math.abs(wet.opacity-previous)<.025);
      previous=wet.opacity;clearAmount+=dry.opacity;rainAmount+=wet.opacity;
      low ||= wet.opacity<.001;high ||= wet.opacity>.99;
      assert.equal(dry.rain,0);
      if(wet.opacity<.1)assert.equal(wet.rain,0);
    }
    assert.ok(low && high);
  }
  assert.ok(clearAmount<rainAmount*.35);
});

test('recycled cloud slots remain invisible at life boundaries without a position jump', () => {
  CLOUD_PROFILES.forEach((p,i)=>{
    const boundary=(1-p.phase)*p.period;
    const a=updateCloudMotion(i,boundary-.001,1,1,createCloudMotion());
    const b=updateCloudMotion(i,boundary+.001,1,1,createCloudMotion());
    assert.ok(a.opacity<1e-8 && b.opacity<1e-8);
    assert.equal(a.rain+b.rain,0);
    assert.ok(Math.abs(a.longitude-b.longitude)<.00002 && Math.abs(a.height-b.height)<.00001);
  });
});

test('cloud shadows follow the sun projection and fade continuously across the horizon', () => {
  const sun=new Vector3(0,1,0),center=new Vector3(),shadow=new Vector4(),point=new Vector3();
  let previous=.3;
  for(let angle=0;angle<=Math.PI;angle+=.001) {
    center.set(Math.sin(angle),Math.cos(angle),0).multiplyScalar(11);
    projectCloudShadow(center,sun,.3,shadow);
    assert.ok(Math.abs(shadow.w-previous)<.005);previous=shadow.w;
    if(shadow.w>0) {
      point.set(shadow.x,shadow.y,shadow.z);
      assert.ok(Math.abs(point.length()-1)<1e-10);
      point.multiplyScalar(PLANET_RADIUS).sub(center);
      assert.ok(point.clone().cross(sun).length()<1e-8 && point.dot(sun)<0);
    }
  }
  assert.equal(shadow.w,0);
});

test('real cloud geometry stays inside the camera envelope throughout its life and shares one mesh buffer', () => {
  const root=new Group(),weather=new PlanetWeather(root),point=new Vector3(),sun=new Vector3(-1,1,1).normalize();
  weather.state.setMode('rain');weather.state.update(60);
  assert.ok(weather.framingRadius<=COMPANION_CLOUD_RADIUS);
  assert.equal(new Set(weather.banks.map(b=>b.core.geometry)).size,1);
  for(const time of [0,17,63,150,222,268,400,900]) {
    weather.update(0,time,sun,false);root.updateMatrixWorld(true);
    for(const bank of weather.banks) {
      const p=bank.core.geometry.attributes.position;
      for(let j=0;j<p.count;j++)assert.ok(point.fromBufferAttribute(p,j).applyMatrix4(bank.core.matrixWorld).length()<=weather.framingRadius+1e-6);
    }
  }
  weather.dispose();
});

test('rain and splashes follow their own clouds, stay above terrain, and reuse fixed buffers', () => {
  const weather=new PlanetWeather(new Group()),sun=new Vector3(0,1,0),point=new Vector3();
  weather.state.setMode('rain');weather.state.update(60);
  const positions=weather.rain.geometry.attributes.position,amounts=weather.rain.geometry.attributes.aRain;
  assert.equal(positions.count,1120);
  let absentDrops=0;
  for(const time of [0,20,80,150,240,300]) {
    weather.update(.05,time,sun,false);
    assert.equal(weather.rain.geometry.attributes.position,positions);
    for(let i=0;i<560;i++) {
      const bank=weather.banks[Math.floor(i/140)];
      assert.ok(Math.abs(amounts.getX(i*2)-bank.motion.rain)<1e-6);
      if(bank.motion.opacity<.1){assert.equal(amounts.getX(i*2),0);absentDrops++;}
      point.fromBufferAttribute(positions,i*2);const radius=point.length();point.normalize();
      assert.ok(radius>=PLANET_RADIUS+Math.max(0,elevation(point))+.0249);
      assert.ok(point.dot(bank.normal)>.995);
    }
  }
  assert.ok(absentDrops>0);
  weather.state.setMode('clear');weather.state.update(60);weather.update(.05,360,sun,false);
  assert.equal(weather.rain.visible,false);
  weather.dispose();
});

test('reduced motion holds the cloud paths and life phases still', () => {
  const weather=new PlanetWeather(new Group()),sun=new Vector3(0,1,0);
  weather.update(0,0,sun,true);
  const before=weather.banks.map(b=>JSON.stringify(b.motion));
  weather.update(0,600,sun,true);
  assert.deepEqual(weather.banks.map(b=>JSON.stringify(b.motion)),before);
  weather.dispose();
});
