"""Cloud lifecycle render inspection in an isolated test browser.
Weather is chosen through UI; only the visual animation clock is advanced to inspect minute-long lifetimes.
"""
import argparse
import json
import subprocess
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--session',required=True)
parser.add_argument('--output',default='output/desktop-qa/clouds/lifecycle')
args=parser.parse_args();output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
checks=[]

def run(*parts):
    p=subprocess.run(['agent-browser','--session',args.session,'--json',*map(str,parts)],capture_output=True,text=True,check=True,timeout=35)
    result=json.loads(p.stdout);assert result['success'],result
    return result['data']
def read(expression):return run('eval',expression)['result']
def activate():
    tab=next(t for t in run('tab')['tabs'] if t.get('active'));run('tab',tab['tabId'])
    run('wait','--fn','!document.hidden')
def check(condition,label):
    assert condition,label
    checks.append(label);print('Verified:',label,flush=True)
def weather(mode):
    if read('document.querySelector("#companion-shell").hidden'):run('click','#world canvas')
    run('click','[data-companion="tools"]');run('click','#weather-toggle');run('click',f'[data-weather="{mode}"]')
    run('press','Escape');activate()
def moment(time):
    stamp=read(f'(()=>{{const s=window.__PLANET_GAME__.scene;const before=s.previous;s.phase={time};s.invalidate();return before;}})()')
    run('wait','--fn',f'window.__PLANET_GAME__.scene.previous > {stamp}')
    return read('''(()=>{const s=window.__PLANET_GAME__.scene,w=s.weather;return {
      phase:s.phase,clouds:w.banks.map((b,i)=>({...b.motion,visible:b.group.visible,rainVertex:w.rain.geometry.attributes.aRain.getX(i*280)})),
      geometryIds:w.banks.map(b=>b.core.geometry.uuid),rainVertices:w.rain.geometry.attributes.position.count,
      memory:{...s.renderer.info.memory},buffer:s.metrics.renderSize,frameScale:s.companionFrameScale,
      cloudRadius:w.framingRadius,rainVisible:w.rain.visible};})()''')

activate();assert read('window.__PLANET_GAME__.simulation.sandbox'),'Use an isolated test planet'
if read('document.querySelector("#companion-shell").hidden'):run('click','#world canvas')
run('click','[data-companion="tools"]')
if read('window.__PLANET_GAME__.scene.autoRotate'):run('click','#companion-tools [data-action="auto-rotate"]')
if not read('window.__PLANET_GAME__.simulation.paused'):run('click','#pause')
run('click','[data-companion="reset"]');activate()
tab=next(t for t in run('tab')['tabs'] if t.get('active'))
subprocess.run(['node','scripts/companion-cdp-input.mjs'],input=json.dumps({'cdpUrl':run('get','cdp-url')['cdpUrl'],'targetId':tab['targetId'],'mode':'wheel','deltaY':-100,'count':5,'followCenter':True}),text=True,check=True,timeout=15)
run('wait','--fn','!window.__PLANET_GAME__.scene.companionInteracting')

weather('rain');run('wait','--fn','window.__PLANET_GAME__.scene.weather.state.rain > .98')
moments=[]
for time in [0,60,150,240,480,720]:
    moments.append(moment(time))
    run('screenshot',output/f'rain-{time:03d}.png')
    if time==0:
        occlusion=read('''(()=>{
          const s=window.__PLANET_GAME__.scene,w=s.weather,canvas=s.renderer.domElement,gl=s.renderer.getContext();
          s.world.updateMatrixWorld(true);
          const candidates=w.banks.filter(b=>b.motion.opacity>.999).map(b=>({bank:b,point:b.core.getWorldPosition(s.camera.position.clone())}));
          candidates.sort((a,b)=>a.point.distanceToSquared(s.camera.position)-b.point.distanceToSquared(s.camera.position));
          const p=candidates[0].point.project(s.camera),x=Math.round((p.x+1)*canvas.width/2)-2,y=Math.round((p.y+1)*canvas.height/2)-2;
          const before=new Uint8Array(100),after=new Uint8Array(100),rain=w.rain.visible,splash=w.splashes.visible;
          s.composer.render();gl.readPixels(x,y,5,5,gl.RGBA,gl.UNSIGNED_BYTE,before);
          w.rain.visible=false;w.splashes.visible=false;s.composer.render();gl.readPixels(x,y,5,5,gl.RGBA,gl.UNSIGNED_BYTE,after);
          w.rain.visible=rain;w.splashes.visible=splash;s.invalidate();
          return {pixels:25,maxDifference:Math.max(...before.map((v,i)=>Math.abs(v-after[i]))),minAlpha:Math.min(...Array.from({length:25},(_,i)=>before[i*4+3]))};
        })()''')
check(occlusion['maxDifference']==0 and occlusion['minAlpha']==255,'An opaque foreground cloud correctly covers rain behind it')
check(all(len(set(m['geometryIds']))==1 and m['rainVertices']==1120 for m in moments),'Clouds share one geometry and rain retains its 560-drop budget')
check(all(m['memory']==moments[0]['memory'] and m['buffer']==moments[0]['buffer'] for m in moments),'Multiple weather lifetimes allocate no additional geometry, textures or framebuffers')
check(len({tuple(round(c['opacity'],2) for c in m['clouds']) for m in moments})>=3
      and all(max(m['clouds'][i]['opacity'] for m in moments)-min(m['clouds'][i]['opacity'] for m in moments)>.3 for i in range(4)),
      'Clouds form and dissipate at different times')
check(all(abs(c['rainVertex']-c['rain'])<1e-6 and (c['opacity']>.1 or c['rainVertex']==0) for m in moments for c in m['clouds']),'Rain buffers follow each cloud and stop under absent clouds')
check(all(m['cloudRadius']<=12.2 and m['frameScale']==moments[0]['frameScale'] for m in moments),'Cloud evolution fits the existing frame without canvas resizing')
changes=[moments[-1]['clouds'][i]['longitude']-moments[0]['clouds'][i]['longitude'] for i in range(4)]
check(min(changes)>0 and max(changes)-min(changes)>.5,'The rendered clouds share a wind direction with different drift speeds')
weather('clear');run('wait','--fn','window.__PLANET_GAME__.scene.weather.state.cloudiness < .1 && window.__PLANET_GAME__.scene.weather.state.rain < .01')
clear=moment(0);run('screenshot',output/'clear.png')
check(sum(c['opacity'] for c in clear['clouds'])<sum(c['opacity'] for c in moments[0]['clouds'])*.35 and not clear['rainVisible'],'Clear weather leaves fewer clouds and no visible rain')
check(not run('errors').get('errors'),'No runtime or shader errors')
(output/'report.json').write_text(json.dumps({'checks':checks,'occlusion':occlusion,'rain':moments,'clear':clear},indent=2)+'\n')
