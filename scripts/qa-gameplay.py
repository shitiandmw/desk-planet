"""Finite UI playthrough using agent-browser. Requires an already-running workspace service.
Uses real clicks and read-only evaluations; never advances time or grants resources via JS.
"""
import argparse
import json
import os
import subprocess
import time
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--session', default=f'planet-qa-{os.getpid()}')
parser.add_argument('--url', default='http://localhost:5187')
parser.add_argument('--report', default='/tmp/planet-ui-playthrough.json')
parser.add_argument('--fresh', action='store_true')
parser.add_argument('--keep-browser', action='store_true')
args=parser.parse_args()
Path(args.report).parent.mkdir(parents=True, exist_ok=True)
report={'url':args.url,'method':'actual UI clicks; read-only state inspection; 4x game speed','steps':[]}
if not args.fresh and Path(args.report).exists():
    report=json.loads(Path(args.report).read_text())

def command(*parts):
    result=subprocess.run(['agent-browser','--session',args.session,'--json',*parts],capture_output=True,text=True,timeout=50)
    if result.returncode:
        raise RuntimeError(f'{parts[:2]}: {result.stderr or result.stdout}')
    data=json.loads(result.stdout)
    if not data.get('success'): raise RuntimeError(str(data))
    return data.get('data',{})

def state(expression):
    return command('eval',f'(()=>{{const g=window.__PLANET_GAME__.simulation,s=window.__PLANET_GAME__.scene;return ({expression});}})()').get('result')

def click(selector):
    command('scrollintoview',selector)
    command('click',selector)

def wait(expression,label,timeout=180):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        if state(expression):return
        if state('document.hidden'):raise RuntimeError('The QA browser page became hidden; bring its session to the foreground before resuming.')
        time.sleep(.6)
    raise AssertionError(label+': '+json.dumps(state('({stock:g.resources,rates:g.rates,jobs:g.people.map(p=>p.job),projects:g.projects.map(b=>[b.type,b.progress]),goals:g.goals})'),ensure_ascii=False))

def pause(value=True):
    if state('g.paused')!=value:click('#pause')

def run_until(expression,label,timeout=180):
    pause(False);wait(expression,label,timeout);pause()

def record(label):
    data=state('({elapsed:g.elapsed,population:g.population,chapter:g.chapter,era:g.era,buildings:g.buildings.length,stock:g.resources,rates:g.rates})')
    report['steps'].append({'name':label,**data})
    Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(f'UI verified: {label} | {data["elapsed"]:.1f} game seconds | {data["population"]} residents',flush=True)

def find_building(kind,index=0):
    return state(f'g.buildings.filter(b=>b.type==={json.dumps(kind)}&&!b.initial)[{index}]?.id')

def select(building):
    click('#nav-overview');click(f'[data-building="{building}"]')

def build(kind,index=0):
    existing=find_building(kind,index)
    if existing and state(f'g.building({json.dumps(existing)}).built'):return existing
    if not existing:
        click('#nav-catalog')
        # Always reveal all building cards, regardless of the player's last filter.
        click('[data-category="all"]');click(f'#build-{kind}')
        if kind=='well':
            for _ in range(130):
                if state('s.preview?.siteId && g.farmsCovered(s.preview.siteId).length>0'):break
                click('[data-action="next-site"]')
            else:raise AssertionError('No irrigation site visible through next-site UI')
        if state('!!s.preview.error'):
            assert '材料不足' in state('s.preview.error'),state('s.preview.error')
            run_until('!document.querySelector("#confirm-build").disabled','materials for '+kind)
        click('#confirm-build');existing=state('s.selected')
    else:select(existing)
    if state('g.builders===0'):
        click('[data-action="builders-plus"]')
        click('[data-action="builders-minus"]')
    run_until(f'g.building({json.dumps(existing)}).built','construction '+kind)
    record('built '+kind)
    return existing

def staff(building,wanted):
    select(building)
    for _ in range(5):
        current=state(f'g.building({json.dumps(building)}).desiredWorkers')
        if current==wanted:return
        click('[data-action="workers-plus"]' if current<wanted else '[data-action="workers-minus"]')
    raise AssertionError('Could not set workers')

def limit(building,wanted):
    select(building);command('select','#production-limit',str(wanted))
    assert state(f'g.building({json.dumps(building)}).limit')==wanted

def research(tech):
    if state(f'g.technologies.includes({json.dumps(tech)})'):return
    click('#nav-research')
    if not state('g.research'):
        reason=state(f'g.researchError({json.dumps(tech)})')
        if reason:
            assert '材料不足' in reason,reason
            run_until(f'g.researchError({json.dumps(tech)})===null','research materials '+tech)
        click('#research-'+tech)
    workshop=find_building('workshop');select(workshop);click('[data-priority="2"]')
    click('#nav-research')
    run_until(f'g.technologies.includes({json.dumps(tech)})','research '+tech)
    assert state(f'g.workersAt({json.dumps(workshop)})')==0
    record('researched '+tech)

def claim(chapter):
    if state('g.chapter')>chapter:return
    run_until('g.goals.every(goal=>goal.done)','chapter '+str(chapter))
    click('#goal-action');assert state('g.chapter')==chapter+1
    record('claimed chapter '+str(chapter+1))

def capture(name,building=None):
    if building:select(building)
    wait('s.cameraMove===null','camera settle')
    command('screenshot',str(Path('docs/assets/demo')/name))

try:
    command('open',args.url);command('set','viewport','1440','1000')
    command('wait','--fn','window.__PLANET_GAME__?.ready && !document.querySelector("#loading")')
    if args.fresh:
        click('[data-action="help"]');click('[data-action="reset-request"]');click('[data-action="reset-confirm"]')
        command('wait','--fn','window.__PLANET_GAME__?.ready && !document.querySelector("#loading")')
    pause();click('[data-speed="4"]')
    record('start / resume')
    if state('g.chapter')==0:
        build('house');forager=build('forager');staff(forager,1)
        run_until('g.population>=8','population 8')
        build('workshop');research('agriculture');claim(0)
    if state('g.chapter')==1:
        farm=build('farm');staff(farm,2)
        run_until(f'g.building({json.dumps(farm)}).produced>=2','first harvest')
        staff('b5',0);staff(find_building('forager'),0);staff('b3',3);staff('b6',2)
        well=build('well');assert state(f'g.irrigated(g.building({json.dumps(farm)}))')
        capture('planet-iteration-irrigation.png',well)
        build('granary');claim(1)
    if state('g.chapter')==2:
        research('tools');research('metallurgy');build('house',1)
        mine=build('mine');staff(mine,1);smelter=build('smelter');staff(smelter,1)
        claim(2);capture('planet-iteration-smelting.png',smelter)
    if state('g.chapter')==3:
        run_until('g.population>=12','population 12')
        smithy=build('smithy');limit(smithy,6);staff(smithy,1)
        run_until('g.resources.tools>=6','six tools');research('mechanics')
        # Increase upstream capacity before investing in a downstream machine.
        staff('b3',2);staff('b6',1);staff(find_building('mine'),2);staff(find_building('smelter'),2)
        machine=build('machine');staff(smithy,0);staff(machine,1)
        claim(3);capture('planet-iteration-industry.png',machine)
    assert state('g.finished && g.era==="industrial" && !g.hungry')
    assert state('g.people.filter(p=>p.job).length<=g.population')
    before=state('g.save()');command('reload');command('wait','--fn','window.__PLANET_GAME__?.ready && !document.querySelector("#loading")')
    assert before==state('g.save()'),'Reload changed a paused save'
    record('final reload matched exactly')
    report['errors']=command('errors');assert not report['errors'].get('errors'),report['errors'];report['complete']=True
except Exception as error:
    report['complete']=False;report['failure']=str(error)
    try:command('screenshot','/tmp/planet-ui-failure.png')
    except Exception:pass
    raise
finally:
    Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    if not args.keep_browser:
        try: command('close')
        except Exception: pass
