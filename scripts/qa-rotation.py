"""Finite rotation/lighting regression in an isolated agent-browser test session.
Captures normal output versus a fresh shadow/AO render at exactly the same model pose.
"""
import argparse
import base64
import json
import math
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--session', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--expect-synchronized', action='store_true')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)

def run(*parts):
    p = subprocess.run(['agent-browser', '--session', args.session, '--json', *parts], text=True, capture_output=True, check=True, timeout=30)
    result = json.loads(p.stdout)
    assert result['success'], result
    return result['data']

def read(expression):
    return run('eval', expression)['result']

def activate():
    active = next(tab for tab in run('tab')['tabs'] if tab.get('active'))
    run('tab', active['tabId'])
    run('wait', '--fn', '!document.hidden')

activate()
assert read('window.__PLANET_GAME__.simulation.sandbox'), 'Use an isolated test planet'
if read('document.querySelector("#companion-shell").hidden'):
    run('click', '#world canvas')
run('click', '[data-companion="journal"]')
run('scrollintoview', '[data-action="sandbox-all"]')
run('click', '[data-action="sandbox-all"]')
run('wait', '--fn', '!window.__PLANET_GAME__.scene.cameraMove')
run('click', '[data-companion="tools"]')
if not read('window.__PLANET_GAME__.scene.autoRotate'):
    run('click', '#companion-tools [data-action="auto-rotate"]')
run('press', 'Escape')
activate()

result = read('''new Promise(resolve => {
  const s=window.__PLANET_GAME__.scene, frames=[];
  let last=-1, aoUpdate=-1, aoPose=s.world.quaternion.clone();
  const sample=()=>{
    if(s.previous!==last){
      last=s.previous;
      const refreshed=s.ao.updates!==aoUpdate;
      if(refreshed){aoUpdate=s.ao.updates;aoPose.copy(s.world.quaternion);}
      frames.push({time:s.previous,aoRefreshed:refreshed,shadowLag:s.shadowRotation.angleTo(s.world.quaternion),aoLag:aoPose.angleTo(s.world.quaternion),rotation:s.world.quaternion.toArray(),shadowFit:s.shadowFit});
    }
    if(frames.length<46)requestAnimationFrame(sample);else resolve({frames});
  };requestAnimationFrame(sample);
})''')

capture = read('''new Promise(resolve => {
  const s=window.__PLANET_GAME__.scene, started=performance.now();let last=s.previous;
  const capture=()=>{
    if(s.previous===last){requestAnimationFrame(capture);return;}last=s.previous;
    if(PREFER_STALE && s.shadowRotation.angleTo(s.world.quaternion)<1e-5 && performance.now()-started<1500){requestAnimationFrame(capture);return;}
    const canvas=s.renderer.domElement,gl=s.renderer.getContext();
    const before=new Uint8Array(canvas.width*canvas.height*4),after=new Uint8Array(before.length);
    const preview=document.createElement('canvas');preview.width=preview.height=640;
    const ctx=preview.getContext('2d');
    const png=()=>{ctx.clearRect(0,0,640,640);ctx.drawImage(canvas,0,0,640,640);return preview.toDataURL('image/png').split(',')[1];};
    // Read inside the same animation frame as the scene's normal draw, before the compositor clears the canvas.
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,before);
    const normal=png(),shadowLag=s.shadowRotation.angleTo(s.world.quaternion);
    s.renderer.shadowMap.needsUpdate=true;s.ao.invalidate();s.composer.render();
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,after);
    const fresh=png();let error=0,changed=0,pixels=0,maxError=0;
    for(let i=0;i<before.length;i+=4){
      if(before[i+3]<250||after[i+3]<250)continue;
      const d=Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]));
      error+=d;maxError=Math.max(maxError,d);pixels++;if(d>8)changed++;
    }
    resolve({normal,fresh,shadowLag,pixels,changed,meanError:error/Math.max(1,pixels),maxError});
  };requestAnimationFrame(capture);
})'''.replace('PREFER_STALE', 'false' if args.expect_synchronized else 'true'))
for name in ['normal', 'fresh']:
    (output / f'{name}.png').write_bytes(base64.b64decode(capture.pop(name)))

frames = result['frames'][1:]
angles = []
for a, b in zip(result['frames'], result['frames'][1:]):
    dot = min(1, abs(sum(x*y for x,y in zip(a['rotation'],b['rotation']))))
    angles.append(2*math.acos(dot))
seconds = (frames[-1]['time']-result['frames'][0]['time'])/1000
summary = {
    'frames': len(frames),
    'staleShadows': sum(f['shadowLag']>1e-5 for f in frames),
    'staleAO': sum(f['aoLag']>1e-5 for f in frames),
    'radiansPerSecond': sum(angles)/seconds,
    'shadowFrusta': len({f['shadowFit'] for f in frames}),
    'referenceRender': capture,
}
run('click', '#world canvas')
run('click', '[data-companion="tools"]')
run('click', '#companion-tools [data-action="auto-rotate"]')
run('press', 'Escape')
activate()
reuses = read('window.__PLANET_GAME__.scene.ao.reuses')
run('wait', '--fn', f'window.__PLANET_GAME__.scene.ao.reuses > {reuses}')
before = read('window.__PLANET_GAME__.scene.world.quaternion.toArray()')
rect = read('document.querySelector("#world").getBoundingClientRect().toJSON()')
target = next(tab for tab in run('tab')['tabs'] if tab.get('active'))['targetId']
subprocess.run(['node', 'scripts/companion-cdp-input.mjs'], input=json.dumps({
    'cdpUrl':run('get','cdp-url')['cdpUrl'],'targetId':target,'mode':'drag',
    'x':rect['x']+rect['width']/2,'y':rect['y']+rect['height']/2,'dx':rect['width']*.4*.65,'dy':0,
}), text=True, check=True, timeout=15)
after = read('window.__PLANET_GAME__.scene.world.quaternion.toArray()')
dot = min(1,abs(sum(x*y for x,y in zip(before,after))))
summary['dragGain'] = 2*math.acos(dot)/math.asin(.65)
result['summary'] = summary
(output / 'report.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(summary, indent=2), flush=True)
if args.expect_synchronized:
    assert summary['staleShadows']==0, summary
    assert summary['staleAO']==0, summary
    assert .055 < summary['radiansPerSecond'] < .075, summary
    assert summary['shadowFrusta']==1, summary
    assert capture['pixels']>10000 and capture['changed']==0 and capture['meanError']<.1, summary
    assert .64 < summary['dragGain'] < .66, summary
    assert not run('errors').get('errors')
    print('Verified: 8 rotation checks (shadow sync, AO sync, speed, stable frustum, fresh-render agreement, idle reuse, drag sensitivity, runtime errors)')
