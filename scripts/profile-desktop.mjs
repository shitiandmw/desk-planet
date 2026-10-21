// Finite macOS resource measurement for an already-running Electron workspace service.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const session = option('--session', 'planet-v021-final');
const output = option('--output', 'output/desktop-qa/resources.json');
const browser = (...parts) => {
  const result = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', ...parts], { encoding: 'utf8', timeout: 15000 }));
  if (!result.success) throw new Error(result.error);
  return result.data;
};
const { cdpUrl } = browser('get', 'cdp-url');
const socket = new WebSocket(cdpUrl), pending = new Map(); let nextId = 1;
const timeout = setTimeout(() => { console.error('Resource measurement timed out'); process.exit(1); }, 25000);
socket.addEventListener('message', event => {
  const data = JSON.parse(event.data), waiter = pending.get(data.id);
  if (waiter) { pending.delete(data.id); data.error ? waiter.reject(new Error(data.error.message)) : waiter.resolve(data.result); }
});
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const snapshot = () => browser('eval', `(()=>{
  const s=window.__PLANET_GAME__.scene;
  return {metrics:s.metrics, programs:s.renderer.info.programs.length, memory:s.renderer.info.memory,
    interacting:s.companionInteracting, autoRotate:s.autoRotate, hidden:document.hidden, paused:s.simulation.paused,
    ao:s.ao.enabled, aoUpdates:s.ao.updates, aoReuses:s.ao.reuses, phase:s.phase,
    layout:localStorage.getItem('mini-planet-companion-layout-v1'), size:document.querySelector('canvas').clientWidth,
    buffers:[s.composer.renderTarget1,s.composer.renderTarget2].map(t=>({size:t.width,samples:t.samples,allocated:!!s.renderer.properties.get(t).__webglFramebuffer}))};
})()`).result;
try {
  const before = snapshot(), start = performance.now(), first = await send('SystemInfo.getProcessInfo');
  await new Promise(resolve => setTimeout(resolve, 6000));
  const last = await send('SystemInfo.getProcessInfo'), seconds = (performance.now() - start) / 1000;
  const processes = last.processInfo.map(p => {
    const old = first.processInfo.find(q => q.id === p.id);
    return { pid: p.id, type: p.type, cpuPercent: old ? +(100 * (p.cpuTime - old.cpuTime) / seconds).toFixed(2) : null };
  });
  const after = snapshot();
  let footprint = null;
  if (process.platform === 'darwin') {
    footprint = execFileSync('footprint', ['--noCategories', '-f', 'bytes', ...processes.flatMap(p => ['-p', String(p.pid)])], { encoding: 'utf8', timeout: 10000 });
  }
  const report = { measuredAt: new Date().toISOString(), seconds, cpuPercent: +processes.reduce((n,p)=>n+(p.cpuPercent||0),0).toFixed(2),
    processes, before, after, footprint };
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ cpuPercent: report.cpuPercent, programs: after.programs, buffers: after.buffers,
    aoUpdates: after.aoUpdates === undefined ? null : after.aoUpdates - before.aoUpdates,
    aoReuses: after.aoReuses === undefined ? null : after.aoReuses - before.aoReuses,
    interacting: before.interacting || after.interacting, autoRotate: after.autoRotate,
    memory: footprint?.match(/Summary Footprint:[^\n]+/)?.[0], output }, null, 2));
} finally { clearTimeout(timeout); socket.close(); }
