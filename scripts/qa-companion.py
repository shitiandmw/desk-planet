"""Finite companion UI regression. Requires the existing workspace Vite service and agent-browser.
All changes use visible controls and pointer input; eval only observes DOM and game state.
"""
import argparse
import json
import os
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://localhost:5187/?test')
parser.add_argument('--session', default=f'companion-qa-{os.getpid()}')
parser.add_argument('--output', default='output/desktop-qa')
parser.add_argument('--keep-browser', action='store_true')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
checks = []

def run(*parts):
    result = subprocess.run(['agent-browser', '--session', args.session, '--json', *map(str, parts)], capture_output=True, text=True, timeout=45)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    data = json.loads(result.stdout)
    if not data.get('success'):
        raise RuntimeError(data)
    return data.get('data', {})

def read(expression):
    return run('eval', expression).get('result')

def ready():
    activate()
    run('wait', '--fn', 'window.__PLANET_GAME__?.ready === true')

def activate():
    active = next(tab for tab in run('tab')['tabs'] if tab.get('active'))
    run('tab', active['tabId'])
    run('wait', '--fn', '!document.hidden')

def globe():
    return read('document.querySelector("#world").getBoundingClientRect().toJSON()')

def center(rect):
    return (round(rect['x'] + rect['width'] / 2), round(rect['y'] + rect['height'] / 2))

def check(condition, description):
    assert condition, description
    checks.append(description)
    print('Verified:', description, flush=True)

def precise_input(mode, **params):
    cdp_url = run('get', 'cdp-url')['cdpUrl']
    target = next(tab for tab in run('tab')['tabs'] if tab.get('active'))['targetId']
    result = subprocess.run(['node', 'scripts/companion-cdp-input.mjs'], input=json.dumps({'cdpUrl': cdp_url, 'targetId': target, 'mode': mode, **params}), text=True, capture_output=True, check=True, timeout=15)
    return json.loads(result.stdout) if result.stdout.strip() else None

try:
    run('set', 'viewport', 1440, 900)
    run('open', args.url)
    run('set', 'media', 'light')
    ready()
    activate()
    # Make reruns deterministic using the test planet's own controls (never the user's native save).
    assert read('window.__PLANET_GAME__.simulation.sandbox'), 'UI regression requires an isolated test planet'
    if read('document.querySelector("#companion-shell").hidden'):
        run('click', '#world canvas')
    run('click', '[data-companion="journal"]')
    run('scrollintoview', '.sandbox-links [data-action="sandbox-clear"]')
    run('click', '.sandbox-links [data-action="sandbox-clear"]')
    run('click', '[data-companion="tools"]')
    if read('window.__PLANET_GAME__.simulation.paused'):
        run('click', '#pause')
    run('click', '[data-companion="reset"]')
    run('reload'); ready()
    check(read('document.querySelector("#companion-shell").hidden && document.querySelector("#companion-body").hidden && !document.querySelector("#toast.visible")'), 'Only the planet is visible on startup')
    check(read('window.__PLANET_GAME__.scene.metrics.antialiasSamples') >= 4, 'The scene uses MSAA for transparent geometry edges')
    run('wait', '--fn', 'window.__PLANET_GAME__.scene.ao.reuses > 0')
    check(read('(()=>{const s=window.__PLANET_GAME__.scene;return [s.composer.renderTarget1,s.composer.renderTarget2].filter(t=>s.renderer.properties.get(t).__webglFramebuffer).length})()') == 1, 'Only one full-resolution MSAA framebuffer is allocated')
    check(read('window.__PLANET_GAME__.scene.ao.reuses') > 0, 'Ambient occlusion reuses its result while the view rests')
    run('screenshot', output / 'idle.png')
    run('click', '#world canvas')
    bounds = globe()
    dock = read('document.querySelector("#companion-shell").getBoundingClientRect().toJSON()')
    check(not read('document.querySelector("#companion-shell").hidden') and dock['top'] > center(bounds)[1] + bounds['height'] * .35, 'Click opens the entry dock below the planet')
    run('screenshot', output / 'selected.png')

    rotation = read('window.__PLANET_GAME__.scene.metrics.globeRotation')
    x, y = center(bounds)
    run('press', 'Escape')
    ao_before = read('window.__PLANET_GAME__.scene.ao.updates')
    precise_input('drag', x=x, y=y, dx=-70, dy=-30)
    run('wait', '--fn', f'window.__PLANET_GAME__.scene.ao.updates > {ao_before}')
    check(True, 'Rotation refreshes cached occlusion')
    check(globe() == bounds and read('window.__PLANET_GAME__.scene.metrics.globeRotation') != rotation, 'Ordinary dragging rotates the 3D planet without moving it')
    check(read('document.querySelector("#companion-shell").hidden'), 'Rotating does not accidentally select the planet')
    rotation = read('window.__PLANET_GAME__.scene.metrics.globeRotation')
    precise_input('drag', x=x, y=y, dx=-400, dy=70, shift=True)
    moved = globe()
    check(abs(moved['x'] - (bounds['x'] - 400)) < 1 and abs(moved['y'] - (bounds['y'] + 70)) < 1, 'Shift dragging moves the planet in desktop coordinates')
    check(read('document.querySelector("#companion-shell").hidden') and read('window.__PLANET_GAME__.scene.metrics.globeRotation') == rotation, 'Shift dragging neither selects nor rotates the globe')
    run('mouse', 'move', *center(moved))
    x, y = center(moved)
    probe = precise_input('zoom-probe', x=x, y=y, deltaY=-100)
    check(probe['resets'] == 0 and len({(s['width'], s['height']) for s in probe['samples']}) == 1, 'Zoom never clears or reallocates the canvas framebuffer')
    check(len({round(s['size'], 1) for s in probe['samples']}) >= 4, 'Wheel zoom interpolates through intermediate sizes')
    check(all(s['width'] >= s['size'] * 2 for s in probe['samples']), 'Zoom retains at least double-resolution rendering')
    run('wait', '--fn', f'document.querySelector("#world").clientWidth > {moved["width"] + 10}')
    zoomed = globe()
    check(zoomed['width'] > moved['width'], 'Wheel up enlarges the planet')
    precise_input('wheel', x=x, y=y, deltaY=100)
    run('wait', '--fn', f'Math.abs(document.querySelector("#world").clientWidth - {moved["width"]}) < 2')
    run('wait', '--fn', 'Math.abs(JSON.parse(localStorage.getItem("mini-planet-companion-layout-v1")).size - document.querySelector("#world").clientWidth) < 2')
    run('reload'); ready()
    restored = globe()
    check(abs(restored['x'] - moved['x']) < 1 and abs(restored['width'] - moved['width']) < 1, 'Position and size survive reload')

    x, y = center(restored)
    precise_input('wheel', x=x, y=y, deltaY=-100, count=4, followCenter=True)
    run('wait', '--fn', 'document.querySelector("#world").clientWidth > 560 && !window.__PLANET_GAME__.scene.companionInteracting')
    check(read('document.querySelector("canvas").width') >= 1120, 'Wheel zoom continues beyond the former 560-pixel limit with supersampling')
    run('screenshot', output / 'medium-size.png')
    restored = globe()

    run('click', '#world canvas')
    run('click', '#nav-catalog')
    run('wait', '--fn', '!document.querySelector("#companion-shell").hidden && !document.querySelector("#companion-body").hidden')
    sheet = read('document.querySelector("#companion-body").getBoundingClientRect().toJSON()')
    check(sheet['right'] < restored['left'] or sheet['left'] > restored['right'], 'Expanded management stays beside the planet for surface interaction')
    run('click', '#build-house')
    check(read('!!window.__PLANET_GAME__.scene.preview'), 'Construction opens a real placement preview')
    before = read('window.__PLANET_GAME__.simulation.buildings.length')
    run('click', '#confirm-build')
    check(read('window.__PLANET_GAME__.simulation.buildings.length') == before + 1 and not read('!!window.__PLANET_GAME__.scene.preview'), 'Confirm creates a building through the existing simulation')
    run('screenshot', output / 'building.png')
    run('click', '[data-companion="tools"]')
    run('click', '#weather-toggle')
    run('click', '[data-weather="rain"]')
    run('wait', '--fn', 'window.__PLANET_GAME__.scene.metrics.weather.rain > .2')
    alpha = read('''(()=>{
      const s=window.__PLANET_GAME__.scene,gl=s.renderer.getContext(),canvas=s.renderer.domElement;
      s.composer.render(); const pixels=new Uint8Array(canvas.width*canvas.height*4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let edges=0,invalid=0,opaque=0;
      for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3];if(a===255)opaque++;if(a>0&&a<255){edges++;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>a+2)invalid++;}}
      return {edges,invalid,opaque,corner:pixels[3]};
    })()''')
    check(alpha['corner'] == 0 and alpha['edges'] > 100 and alpha['opaque'] > 10000 and alpha['invalid'] == 0, 'Rain and antialiased silhouettes preserve valid premultiplied alpha')
    view_before = read('window.__PLANET_GAME__.scene.metrics.globeRotation')
    camera_before = read('window.__PLANET_GAME__.scene.metrics.camera')
    run('click', '#companion-tools [data-action="light"]')
    run('click', '#companion-tools [data-action="light"]')
    check(view_before == read('window.__PLANET_GAME__.scene.metrics.globeRotation') and camera_before == read('window.__PLANET_GAME__.scene.metrics.camera'), 'Lighting controls preserve the chosen planet view')
    run('click', '#pause')
    check(read('window.__PLANET_GAME__.simulation.paused'), 'Pause remains accessible from companion settings')
    run('click', '#companion-tools [data-action="help"]')
    check(read('document.querySelector("#help-dialog").open'), 'Help and save import/export remain accessible')
    run('click', '[data-action="close-help"]')
    run('press', 'Escape')
    check(read('document.querySelector("#companion-shell").hidden && document.querySelector("#companion-body").hidden'), 'Escape returns to the planet alone')

    run('set', 'viewport', 390, 700)
    activate()
    run('click', '#world canvas')
    run('click', '[data-companion="tools"]')
    run('click', '[data-companion="reset"]')
    run('click', '#world canvas')
    run('click', '#nav-catalog')
    run('wait', '--fn', '!document.querySelector("#companion-shell").hidden && !document.querySelector("#companion-body").hidden && getComputedStyle(document.querySelector("#companion-body")).opacity === "1"')
    small = read('({sheet:document.querySelector("#companion-body").getBoundingClientRect().toJSON(),dock:document.querySelector("#companion-shell").getBoundingClientRect().toJSON()})')
    check(small['sheet']['height'] > 150 and small['dock']['height'] > 100 and small['sheet']['top'] >= small['dock']['bottom'] and small['sheet']['bottom'] <= 700 and small['sheet']['left'] >= 0 and small['sheet']['right'] <= 390, 'Narrow screens stack a scrollable sheet below the globe and dock')
    run('screenshot', output / 'narrow.png')

    run('press', 'Escape')
    run('set', 'viewport', 1440, 1100)
    activate()
    before_frame = read('({size:document.querySelector("#world").clientWidth,pixels:document.querySelector("canvas").getBoundingClientRect().height/Math.tan(window.__PLANET_GAME__.scene.camera.fov*Math.PI/360)})')
    run('click', '#world canvas')
    run('click', '[data-companion="journal"]')
    run('wait', '--fn', '!document.querySelector("#companion-body").hidden && getComputedStyle(document.querySelector("#companion-body")).opacity === "1"')
    run('scrollintoview', '[data-action="sandbox-all"]')
    run('click', '[data-action="sandbox-all"]')
    run('wait', '--fn', 'window.__PLANET_GAME__.simulation.buildings.some(b=>b.type === "elevator" && b.built) && window.__PLANET_GAME__.scene.companionFrameScale >= 1.5')
    run('press', 'Escape')
    after_frame = read('({size:document.querySelector("#world").clientWidth,pixels:document.querySelector("canvas").getBoundingClientRect().height/Math.tan(window.__PLANET_GAME__.scene.camera.fov*Math.PI/360)})')
    check(before_frame['size'] == after_frame['size'] and abs(before_frame['pixels'] - after_frame['pixels']) < 1, 'Building the orbital elevator expands the frame without resizing the planet')
    envelope = read('''(()=>{
      const s=window.__PLANET_GAME__.scene, v=s.camera.position.clone();
      const reach=root=>{let max=0;root.updateWorldMatrix(true,true);root.traverse(o=>{
        const p=o.geometry?.attributes.position;if(!p||o.isInstancedMesh||!o.isMesh)return;
        for(let i=0;i<p.count;i++)max=Math.max(max,v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).length());
      });return max;};
      const parts=[];
      for(const [id,view] of s.settlement.buildings){
        const clone=view.root.clone(true),originals=[],copies=[];
        view.root.traverse(o=>originals.push(o));clone.traverse(o=>copies.push(o));
        const mapping=new Map(originals.map((o,i)=>[o,copies[i]]));let radius=0;
        for(let step=0;step<=8;step++){
          const f=step/8;
          for(const {node,spec,base}of view.anims){const n=mapping.get(node);if(!n)continue;
            if(spec.type==='slide')n.position[spec.axis]=base+f*spec.amount;
            if(spec.type==='bob')n.position[spec.axis]=base+(2*f-1)*spec.amount;
            if(spec.type==='spin')n.rotation[spec.axis]=base+f*Math.PI*2;
            if(spec.type==='swing')n.rotation[spec.axis]=base+Math.sin(f*Math.PI*2)*spec.amount;
            if(spec.type==='pulse')n.scale.setScalar(1+(2*f-1)*.06*spec.amount);
          }
          radius=Math.max(radius,reach(clone));
        }
        parts.push({type:s.simulation.building(id).type,radius});
      }
      const cloudRadius=s.weather.framingRadius;
      return {parts,cloudRadius,safeRadius:s.camera.position.length()*Math.sin(s.camera.fov*Math.PI/360),scale:s.companionFrameScale};
    })()''')
    (output / 'framing-envelope.json').write_text(json.dumps(envelope, ensure_ascii=False, indent=2)+'\n')
    check(all(p['radius'] < envelope['safeRadius'] for p in envelope['parts']) and envelope['cloudRadius'] < envelope['safeRadius'], 'Every building and maximum-size cloud fits all rotation directions across nine animation poses')
    elevator = read('window.__PLANET_GAME__.simulation.buildings.find(b=>b.type === "elevator").id')
    run('click', '#world canvas')
    run('click', '#nav-overview')
    run('click', f'[data-building="{elevator}"]')
    activate()
    run('wait', '--fn', '!window.__PLANET_GAME__.scene.cameraMove')
    run('press', 'Escape')
    run('screenshot', output / 'elevator-unclipped.png')

    x, y = center(globe())
    probe = precise_input('zoom-probe', x=x, y=y, deltaY=-100, count=34, followCenter=True)
    (output / 'fullscreen-zoom.json').write_text(json.dumps(probe, indent=2)+'\n')
    run('wait', '--fn', '(()=>{const s=window.__PLANET_GAME__.scene,c=s.renderer.domElement;return !s.companionInteracting && c.width === s.companionBuffer.width && c.height === s.companionBuffer.height})()')
    large = globe()
    check(large['width'] * .71 > (1440**2+1100**2)**.5, 'The planet can cover the full screen, including its corners')
    active_buffers = {(s['width'], s['height']) for s in probe['samples'] if s['interacting']}
    check(len(active_buffers) == 1, 'A continuous zoom gesture keeps one stable render allocation')
    check(len(probe['frames']) > 10 and all(f['alpha'] > 0 for f in probe['frames']), 'Every rendered zoom frame has a visible planet, including the resolution change')
    crop = read('document.querySelector("canvas").getBoundingClientRect().toJSON()')
    check(crop['left'] >= -.1 and crop['top'] >= -.1 and crop['right'] <= 1440.1 and crop['bottom'] <= 1100.1, 'Only the visible screen area is rendered for a close-up')
    pixels = read('window.__PLANET_GAME__.scene.metrics.renderSize')
    check(pixels[0] * pixels[1] <= 2048**2 and max(pixels) <= 2880, 'Full-screen rendering stays inside its GPU pixel budget')
    check(read('(()=>{const s=window.__PLANET_GAME__.scene;return s.ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.equals(s.camera.projectionMatrix)})()'), 'Occlusion projection follows the cropped camera')
    run('screenshot', output / 'fullscreen.png')
    x, y = center(large)
    rotation = read('window.__PLANET_GAME__.scene.metrics.globeRotation')
    precise_input('drag', x=x, y=y, dx=-100, dy=-45)
    check(read('window.__PLANET_GAME__.scene.metrics.globeRotation') != rotation, 'Dragging still rotates the full-screen planet')
    precise_input('drag', x=x, y=y, dx=120, dy=-50, shift=True)
    panned = globe()
    check(abs(panned['x']-large['x']-120) < 1 and abs(panned['y']-large['y']+50) < 1, 'Shift dragging pans a close-up without locking it to the screen center')
    run('click', '#world canvas')
    run('click', '#nav-catalog')
    run('wait', '--fn', 'getComputedStyle(document.querySelector("#companion-body")).opacity === "1"')
    panels = read('({dock:document.querySelector("#companion-shell").getBoundingClientRect().toJSON(),sheet:document.querySelector("#companion-body").getBoundingClientRect().toJSON()})')
    check(globe() == panned and all(r['left'] >= 0 and r['right'] <= 1440 and r['top'] >= 0 and r['bottom'] <= 1100 for r in panels.values()), 'Full-screen panels stay visible and do not shrink or move the planet')
    run('screenshot', output / 'fullscreen-panels.png')
    run('press', 'Escape')
    run('reload'); ready()
    check(abs(globe()['width']-panned['width']) < 1 and abs(globe()['x']-panned['x']) < 1, 'The close-up size and pan position survive reload')
    x, y = center(globe())
    precise_input('wheel', x=x, y=y, deltaY=100, count=40, followCenter=True)
    run('wait', '--fn', 'document.querySelector("#world").clientWidth === 200 && document.querySelector("canvas").width === 1728')
    check(True, 'Zooming back out restores the small companion and its original render budget')
    run('click', '#world canvas')
    run('click', '[data-companion="tools"]')
    run('click', '[data-companion="reset"]')
    check(globe()['width'] == 360, 'Restore position and size returns to the desktop companion')
    errors = run('errors')
    check(not errors.get('errors'), 'No browser runtime errors')
finally:
    (output / 'report.json').write_text(json.dumps({'checks': checks, 'url': args.url}, ensure_ascii=False, indent=2) + '\n')
    if not args.keep_browser:
        run('close')
