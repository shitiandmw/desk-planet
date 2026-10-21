// agent-browser 0.39's wheel helper does not dispatch DOM wheel events in this environment.
// Send the native CDP input to its existing page; do not mutate game state from tests.
const input = JSON.parse(await new Promise(resolve => {
  let data = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => data += chunk);
  process.stdin.on('end', () => resolve(data));
}));
const socket = new WebSocket(input.cdpUrl);
const pending = new Map(); let nextId = 1;
const timeout = setTimeout(() => { console.error('Timed out sending companion input'); process.exit(1); }, 10000);
socket.addEventListener('message', event => {
  const data = JSON.parse(event.data), waiter = pending.get(data.id);
  if (waiter) { pending.delete(data.id); data.error ? waiter.reject(new Error(data.error.message)) : waiter.resolve(data.result); }
});
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
function send(method, params, sessionId) {
  return new Promise((resolve, reject) => {
    const id = nextId++; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
try {
  const { sessionId } = await send('Target.attachToTarget', { targetId: input.targetId, flatten: true });
  await send('Page.bringToFront', {}, sessionId);
  const mouse = params => send('Input.dispatchMouseEvent', params, sessionId);
  const wheel = async () => {
    for (let i = 0; i < (input.count ?? 1); i++) {
      let x = input.x, y = input.y;
      if (input.followCenter) {
        const result = await send('Runtime.evaluate', {returnByValue:true, expression:'(()=>{const r=document.querySelector("#world").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()'}, sessionId);
        ({x,y} = result.result.value);
      }
      await mouse({ type: 'mouseWheel', x, y, deltaX: 0, deltaY: input.deltaY });
      if (input.count > 1) await new Promise(resolve => setTimeout(resolve, 16));
    }
  };
  if (input.mode === 'wheel') {
    await wheel();
  } else if (input.mode === 'zoom-probe') {
    const probe = send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `new Promise(resolve => {
      const scene = window.__PLANET_GAME__.scene, canvas = scene.renderer.domElement, samples = [], frames = [], start = performance.now(); let resets = 0;
      const render = scene.composer.render.bind(scene.composer), gl = scene.renderer.getContext(), pixel = new Uint8Array(4);
      scene.composer.render = (...args) => {
        render(...args);
        gl.readPixels(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
        frames.push({alpha:pixel[3],width:canvas.width,height:canvas.height,interacting:scene.companionInteracting});
      };
      const observer = new MutationObserver(records => resets += records.length);
      observer.observe(canvas, {attributes:true, attributeFilter:['width','height']});
      const sample = time => {
        samples.push({at: time-start, size: canvas.getBoundingClientRect().width, logicalSize:scene.host.getBoundingClientRect().width, width: canvas.width, height: canvas.height, interacting:scene.companionInteracting});
        if(time-start < ${input.count > 1 ? 4500 : 1100}) requestAnimationFrame(sample);
        else { observer.disconnect(); scene.composer.render = render; resolve({samples, frames, resets}); }
      }; requestAnimationFrame(sample);
    })` }, sessionId);
    await wheel();
    const result = await probe;
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    console.log(JSON.stringify(result.result.value));
  } else if (input.mode === 'drag') {
    const modifiers = input.shift ? 8 : 0, dx = input.dx ?? 64, dy = input.dy ?? 24;
    if (input.shift) await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', modifiers, windowsVirtualKeyCode: 16 }, sessionId);
    await mouse({ type: 'mousePressed', x: input.x, y: input.y, button: 'left', buttons: 1, clickCount: 1, modifiers });
    for (let i = 1; i <= 12; i++) await mouse({ type: 'mouseMoved', x: input.x + dx * i / 12, y: input.y + dy * i / 12, button: 'left', buttons: 1, modifiers });
    await mouse({ type: 'mouseReleased', x: input.x + dx, y: input.y + dy, button: 'left', buttons: 0, clickCount: 1, modifiers });
    if (input.shift) await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', modifiers: 0, windowsVirtualKeyCode: 16 }, sessionId);
  } else throw new Error('Unknown companion input');
  await send('Target.detachFromTarget', { sessionId });
} finally { clearTimeout(timeout); socket.close(); }
