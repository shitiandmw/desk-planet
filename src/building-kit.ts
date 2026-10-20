import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, rng, up, vec, woodMaterial } from './craft';

/**
 * Shared kit for the miniature buildings: procedural textures, a small material palette and part helpers.
 * Every material is a module singleton so `mergeMeshes` collapses each building to a handful of draw calls;
 * untextured coloured parts share one vertex-coloured material.
 */
type Painter = (ctx: CanvasRenderingContext2D, s: number, r: () => number) => void;
/** Painters draw in tile units of `size`; the canvas is twice as dense, so roofs and walls stay crisp in close-ups. */
const hiRes = (size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) => canvasTexture(size * 2, ctx => { ctx.scale(2, 2); draw(ctx, size); });
const texture = (size: number, seed: number, draw: Painter) => { const r = rng(seed); return hiRes(size, (ctx, s) => draw(ctx, s, r)); };
/** Draws a soft blob, repeated across the tile border so repeated textures stay seamless. */
function blob(ctx: CanvasRenderingContext2D, s: number, x: number, y: number, radius: number, color: string, alpha: number) {
  for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
    const cx = x + dx, cy = y + dy; if (cx < -radius || cy < -radius || cx > s + radius || cy > s + radius) continue;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius); g.addColorStop(0, `rgba(${color},${alpha})`); g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g; ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
}
const speckle = (ctx: CanvasRenderingContext2D, s: number, r: () => number, count: number, dark: string, light: string, alpha = .1) => {
  for (let i = 0; i < count; i++) { ctx.fillStyle = `rgba(${r() > .5 ? dark : light},${alpha * (.4 + r())})`; ctx.fillRect(r() * s, r() * s, 1 + r() * 1.6, 1 + r() * 1.6); }
};
const jitter = (base: [number, number, number], r: () => number, amount: number) => base.map(v => Math.max(0, Math.min(255, Math.round(v + (r() - .5) * amount)))).join(',');

const plasterMap = texture(256, 11, (ctx, s, r) => {
  ctx.fillStyle = '#f2e8d6'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 70; i++) blob(ctx, s, r() * s, r() * s, 12 + r() * 46, r() > .45 ? '176,152,118' : '255,253,244', .05 + r() * .08);
  speckle(ctx, s, r, 2600, '120,96,70', '255,255,250', .08);
});
/** Irregular coursed stone with recessed mortar. Rows and widths sum to the tile so it repeats cleanly. */
const stoneMap = texture(256, 23, (ctx, s, r) => {
  ctx.fillStyle = '#8c877a'; ctx.fillRect(0, 0, s, s);
  const rows = [36, 30, 42, 34, 40, 30, 44]; let y = 0; const scale = s / rows.reduce((a, b) => a + b, 0);
  for (const row of rows) {
    const h = row * scale; let x = -r() * 40;
    while (x < s) {
      const w = 34 + r() * 46, color = jitter([176, 170, 152], r, 34);
      for (const dx of [0, s]) { // wrap the last stone into the first column
        ctx.fillStyle = `rgb(${color})`; ctx.beginPath(); ctx.roundRect(x - dx + 2, y + 2, w - 4, h - 4, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,240,.18)'; ctx.fillRect(x - dx + 5, y + 3, w - 10, 3);
        ctx.fillStyle = 'rgba(40,36,28,.16)'; ctx.fillRect(x - dx + 4, y + h - 6, w - 8, 3);
      }
      x += w;
    }
    y += h;
  }
  speckle(ctx, s, r, 3000, '60,56,48', '240,236,220', .12);
});
const brickMap = texture(256, 31, (ctx, s, r) => {
  ctx.fillStyle = '#d8cbb2'; ctx.fillRect(0, 0, s, s);
  const rows = 12, h = s / rows, w = s / 4;
  for (let row = 0; row < rows; row++) for (let i = -1; i < 5; i++) {
    const x = i * w + (row % 2) * w / 2;
    ctx.fillStyle = `rgb(${jitter([178, 92, 62], r, 40)})`; ctx.fillRect(x + 1.5, row * h + 1.5, w - 3, h - 3);
    ctx.fillStyle = 'rgba(255,220,190,.14)'; ctx.fillRect(x + 2, row * h + 2, w - 4, 2);
  }
  speckle(ctx, s, r, 2400, '70,30,20', '255,230,210', .12);
});
/** Golden straw with layer edges; vertical in the texture runs down the roof slope. */
const thatchMap = texture(256, 41, (ctx, s, r) => {
  ctx.fillStyle = '#c9a052'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 4200; i++) {
    const x = r() * s, y = r() * s, len = 10 + r() * 22, tone = r();
    ctx.strokeStyle = tone > .66 ? `rgba(255,232,160,${.25 + r() * .3})` : tone > .25 ? `rgba(180,130,55,${.25 + r() * .3})` : `rgba(110,74,32,${.2 + r() * .25})`;
    ctx.lineWidth = .6 + r() * 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - .5) * 3, y + len); ctx.stroke();
    if (y + len > s) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x, y - s + len); ctx.stroke(); }
  }
  for (let band = 0; band < 4; band++) { const y = band * s / 4; const g = ctx.createLinearGradient(0, y, 0, y + 14); g.addColorStop(0, 'rgba(80,52,20,.35)'); g.addColorStop(1, 'rgba(80,52,20,0)'); ctx.fillStyle = g; ctx.fillRect(0, y, s, 14); }
});
/** Overlapping clay tiles: each row darkens under the row above and catches light on its rounded lower edge. */
function tilePainter(base: [number, number, number], rounded: boolean): Painter {
  return (ctx, s, r) => {
    const rows = 8, h = s / rows, cols = 8, w = s / cols;
    ctx.fillStyle = `rgb(${base.map(v => v * .55).join(',')})`; ctx.fillRect(0, 0, s, s);
    for (let row = 0; row < rows; row++) for (let i = -1; i <= cols; i++) {
      const x = i * w + (row % 2) * w / 2, y = row * h, color = jitter(base, r, 34);
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(${color},.75)`); g.addColorStop(.75, `rgb(${color})`); g.addColorStop(1, `rgba(255,236,214,.95)`);
      ctx.fillStyle = g; ctx.beginPath();
      if (rounded) { ctx.moveTo(x + 1, y); ctx.lineTo(x + w - 1, y); ctx.lineTo(x + w - 1, y + h * .8); ctx.quadraticCurveTo(x + w / 2, y + h * 1.12, x + 1, y + h * .8); }
      else ctx.roundRect(x + 1, y, w - 2, h - 1, 2);
      ctx.fill();
      const shade = ctx.createLinearGradient(x, 0, x + w, 0); shade.addColorStop(0, 'rgba(0,0,0,.12)'); shade.addColorStop(.5, 'rgba(255,255,255,.06)'); shade.addColorStop(1, 'rgba(0,0,0,.14)');
      ctx.fillStyle = shade; ctx.fillRect(x + 1, y, w - 2, h * .85);
    }
    speckle(ctx, s, r, 1600, '50,30,20', '255,240,220', .1);
  };
}
const tileMap = texture(256, 53, tilePainter([196, 98, 58], true));
const slateMap = texture(256, 59, tilePainter([96, 108, 116], false));
const corrugatedMap = texture(128, 61, (ctx, s, r) => {
  for (let x = 0; x < s; x++) { const v = 150 + Math.sin(x / s * Math.PI * 16) * 34; ctx.fillStyle = `rgb(${v},${v + 4},${v + 8})`; ctx.fillRect(x, 0, 1, s); }
  speckle(ctx, s, r, 500, '60,60,60', '255,255,255', .08);
});
const concreteMap = texture(256, 67, (ctx, s, r) => {
  ctx.fillStyle = '#d9d8d1'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 50; i++) blob(ctx, s, r() * s, r() * s, 14 + r() * 40, r() > .5 ? '150,150,140' : '255,255,250', .05 + r() * .06);
  ctx.fillStyle = 'rgba(110,110,104,.22)'; ctx.fillRect(0, 0, s, 2); ctx.fillRect(0, 0, 2, s); ctx.fillRect(0, s / 2, s, 1);
  speckle(ctx, s, r, 2200, '90,90,86', '255,255,255', .1);
});
/** Curtain wall: light mullions around reflective blue panes, with an evening emissive layer of lit rooms. */
const facadeRandom = rng(71);
const facadeMap = hiRes(256, (ctx, s) => {
  ctx.fillStyle = '#e9ece9'; ctx.fillRect(0, 0, s, s);
  const n = 4, cell = s / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const g = ctx.createLinearGradient(x * cell, y * cell, x * cell + cell, y * cell + cell); const t = facadeRandom() * .15;
    g.addColorStop(0, `rgb(${120 + t * 200},${168 + t * 100},${196 + t * 60})`); g.addColorStop(.55, '#4c7590'); g.addColorStop(1, '#2f4f66');
    ctx.fillStyle = g; ctx.fillRect(x * cell + 6, y * cell + 5, cell - 12, cell - 14);
  }
});
const facadeGlowMap = hiRes(256, (ctx, s) => {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s); const n = 4, cell = s / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (facadeRandom() > .45) { ctx.fillStyle = facadeRandom() > .3 ? '#ffd28a' : '#cfe8ff'; ctx.fillRect(x * cell + 6, y * cell + 5, cell - 12, cell - 14); }
});
const solarMap = texture(128, 79, (ctx, s) => {
  ctx.fillStyle = '#c9d2d8'; ctx.fillRect(0, 0, s, s); const n = 4, cell = s / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const g = ctx.createLinearGradient(0, y * cell, 0, y * cell + cell); g.addColorStop(0, '#3d5f8f'); g.addColorStop(1, '#1d335a'); ctx.fillStyle = g; ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4); }
});
const pavingMap = texture(256, 83, (ctx, s, r) => {
  ctx.fillStyle = '#b9b3a2'; ctx.fillRect(0, 0, s, s); const n = 6, cell = s / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = `rgb(${jitter([214, 208, 192], r, 20)})`; ctx.fillRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3); }
  speckle(ctx, s, r, 1800, '80,76,66', '255,255,250', .1);
});
const dirtMap = texture(256, 89, (ctx, s, r) => {
  ctx.fillStyle = '#b9a47a'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) blob(ctx, s, r() * s, r() * s, 12 + r() * 40, r() > .5 ? '130,108,70' : '226,210,170', .1 + r() * .1);
  speckle(ctx, s, r, 6000, '96,80,52', '240,226,186', .16);
});

// ---------------------------------------------------------------- later-era surfaces
/** Industrial setts: dark rounded cobbles in offset courses, sooty joints. */
const cobbleMap = texture(256, 97, (ctx, s, r) => {
  ctx.fillStyle = '#4f4a42'; ctx.fillRect(0, 0, s, s);
  const rows = 14, h = s / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 20;
    while (x < s) {
      const w = 14 + r() * 12, k = .78 + r() * .38, color = [128 * k, 122 * k, 112 * k + r() * 6].map(Math.round).join(',');
      for (const dx of [0, s]) {
        ctx.fillStyle = `rgb(${color})`; ctx.beginPath(); ctx.roundRect(x - dx + 1.4, row * h + 1.4, w - 2.8, h - 2.8, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,248,230,.16)'; ctx.fillRect(x - dx + 3, row * h + 2.4, w - 6, 2);
      }
      x += w;
    }
  }
  for (let i = 0; i < 26; i++) blob(ctx, s, r() * s, r() * s, 10 + r() * 34, r() > .5 ? '40,36,30' : '200,190,170', .07 + r() * .07);
  speckle(ctx, s, r, 2600, '40,36,30', '230,222,206', .12);
});
/** Asphalt with fine aggregate, patching and worn lighter tracks. */
const asphaltMap = texture(256, 101, (ctx, s, r) => {
  ctx.fillStyle = '#6a6d6f'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) blob(ctx, s, r() * s, r() * s, 12 + r() * 46, r() > .5 ? '58,60,62' : '150,152,150', .06 + r() * .07);
  speckle(ctx, s, r, 9000, '40,42,44', '190,190,186', .2);
});
/** Pale composite paving for the intelligence era: large tiles, hairline joints and small inset studs. */
const compositeMap = texture(256, 103, (ctx, s, r) => {
  ctx.fillStyle = '#bfc4c4'; ctx.fillRect(0, 0, s, s); const n = 4, cell = s / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    ctx.fillStyle = `rgb(${jitter([222, 225, 222], r, 8)})`; ctx.beginPath(); ctx.roundRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x * cell + 3, y * cell + 2.5, cell - 6, 1.5);
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = '#9fa7aa'; ctx.beginPath(); ctx.arc(x * cell, y * cell, 3.2, 0, Math.PI * 2); ctx.fill(); }
  speckle(ctx, s, r, 1200, '120,126,128', '255,255,255', .06);
});
/** Flat-topped hexagonal deck plates; rows are squeezed by 13 % so four columns and four rows repeat seamlessly. */
const hexMap = texture(256, 107, (ctx, s, r) => {
  ctx.fillStyle = '#1c2024'; ctx.fillRect(0, 0, s, s);
  const a = s / 6, rowH = s / 4, squash = .866;
  const hex = (cx: number, cy: number, inset: number) => { ctx.beginPath(); for (let k = 0; k < 6; k++) { const t = k * Math.PI / 3; ctx.lineTo(cx + Math.cos(t) * (a - inset), cy + Math.sin(t) * (a - inset) * squash); } ctx.closePath(); };
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    const k = .86 + r() * .26, cx = col * a * 1.5, cy = row * rowH + (col % 2) * rowH / 2, tone = [68 * k, 74 * k, 80 * k].map(Math.round).join(','), bolt = r() > .6;
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      ctx.fillStyle = `rgb(${tone})`; hex(cx + dx, cy + dy, 1.6); ctx.fill();
      ctx.strokeStyle = 'rgba(200,210,220,.14)'; ctx.lineWidth = 1.2; hex(cx + dx, cy + dy, 3.4); ctx.stroke();
      if (bolt) { ctx.fillStyle = 'rgba(20,22,26,.6)'; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 2.2, 0, 7); ctx.fill(); }
    }
  }
  speckle(ctx, s, r, 1800, '10,12,14', '200,210,220', .08);
});
/** Riveted steel plate, drawn near white so a vertex tint gives iron, boiler green or tank grey. */
const rivetMap = texture(256, 109, (ctx, s, r) => {
  ctx.fillStyle = '#d8d8d6'; ctx.fillRect(0, 0, s, s);
  const rows = 3, cols = 4, h = s / rows, w = s / cols;
  for (let row = 0; row < rows; row++) for (let i = -1; i <= cols; i++) {
    const x = i * w + (row % 2) * w / 2, y = row * h;
    const k = .93 + r() * .1; ctx.fillStyle = `rgb(${Math.round(226 * k)},${Math.round(226 * k)},${Math.round(223 * k)})`; ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.fillStyle = 'rgba(70,64,56,.08)'; ctx.fillRect(x + 1.5, y + h * .55, w - 3, h * .45 - 1.5);
    ctx.fillStyle = '#8f8f8b'; for (let k = 0; k < 8; k++) for (const [px, py] of [[x + 5 + k * (w - 10) / 7, y + 5], [x + 5 + k * (w - 10) / 7, y + h - 5]]) { ctx.beginPath(); ctx.arc(px, py, 1.9, 0, 7); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px - .5, py - .6, .8, 0, 7); ctx.fill(); ctx.fillStyle = '#8f8f8b'; }
  }
  for (let i = 0; i < 18; i++) { const x = r() * s, y = r() * s; const g = ctx.createLinearGradient(x, y, x, y + 40); g.addColorStop(0, 'rgba(90,70,50,.14)'); g.addColorStop(1, 'rgba(90,70,50,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, 3 + r() * 5, 40); }
  speckle(ctx, s, r, 1400, '60,60,58', '255,255,255', .08);
});
/** Smooth composite cladding for the intelligence era: large rounded panels with hairline joints and vent slots. */
const panelMap = texture(256, 113, (ctx, s, r) => {
  ctx.fillStyle = '#d4d8da'; ctx.fillRect(0, 0, s, s);
  const cols = 2, rows = 3, w = s / cols, h = s / rows;
  for (let row = 0; row < rows; row++) for (let i = -1; i <= cols; i++) {
    const x = i * w + (row % 2) * w / 2, y = row * h;
    ctx.fillStyle = `rgb(${jitter([248, 249, 249], r, 5)})`; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 6); ctx.fill();
  }
  ctx.fillStyle = 'rgba(150,158,162,.4)'; for (let k = 0; k < 5; k++) ctx.fillRect(s * .62, s * .12 + k * 3.2, 22, 1.2);
  ctx.fillStyle = 'rgba(150,158,162,.35)'; ctx.fillRect(s * .1, s * .78, 14, 3);
});
/** Spacecraft plating: irregular titanium plates, bolts at the corners and a few darker service panels. */
const hullMap = texture(256, 127, (ctx, s, r) => {
  ctx.fillStyle = '#a3a7aa'; ctx.fillRect(0, 0, s, s);
  const rows = [48, 32, 56, 40, 36, 44]; let y = 0; const scale = s / rows.reduce((a, b) => a + b, 0);
  for (const row of rows) {
    const h = row * scale; let x = -r() * 30;
    while (x < s) {
      const w = 26 + r() * 60, dark = r() > .94, k = .96 + r() * .05, color = (dark ? [192, 197, 200] : [238 * k, 240 * k, 240 * k]).map(Math.round).join(',');
      for (const dx of [0, s]) {
        ctx.fillStyle = `rgb(${color})`; ctx.fillRect(x - dx + 1.2, y + 1.2, w - 2.4, h - 2.4);
        ctx.fillStyle = 'rgba(120,124,128,.9)'; for (const [px, py] of [[x - dx + 4, y + 4], [x - dx + w - 4, y + 4], [x - dx + 4, y + h - 4], [x - dx + w - 4, y + h - 4]]) ctx.fillRect(px - 1, py - 1, 2, 2);
        if (r() > .82) { ctx.fillStyle = 'rgba(70,74,78,.35)'; for (let k = 0; k < 4; k++) ctx.fillRect(x - dx + 8, y + 8 + k * 3, Math.min(30, w - 16), 1); }
      }
      x += w;
    }
    y += h;
  }
  speckle(ctx, s, r, 1200, '90,94,98', '255,255,255', .06);
});
/** Information-era LED screens: charts, ticker lines and a logo on navy, used as both colour and glow. */
const screenMap = hiRes(256, (ctx, s) => {
  const r = rng(131);
  ctx.fillStyle = '#0d1d33'; ctx.fillRect(0, 0, s, s);
  const g = ctx.createLinearGradient(0, 0, s, s); g.addColorStop(0, 'rgba(60,140,255,.35)'); g.addColorStop(1, 'rgba(255,90,170,.2)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const colors = ['#3fd2ff', '#ffb347', '#ff5f8f', '#8cff9a', '#ffffff'];
  for (let i = 0; i < 9; i++) { const h = 20 + r() * 70; ctx.fillStyle = colors[i % 4]; ctx.fillRect(16 + i * 13, 120 - h, 9, h); }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 12; i++) ctx.lineTo(140 + i * 9, 92 - Math.sin(i * .8) * 18 - i * 2.4); ctx.stroke();
  ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(196, 42, 22, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0d1d33'; ctx.beginPath(); ctx.arc(196, 42, 12, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 8; i++) { ctx.fillStyle = colors[(i + 2) % 5]; ctx.globalAlpha = .85; ctx.fillRect(16, 142 + i * 13, 60 + r() * 150, 6); }
  ctx.globalAlpha = 1; ctx.fillStyle = '#3fd2ff'; ctx.fillRect(0, s - 12, s, 12);
});
/** Smoked glass with glowing floor lines; the glow layer carries cyan and violet lit cells. */
const darkGlassMap = hiRes(256, (ctx, s) => {
  ctx.fillStyle = '#5a6670'; ctx.fillRect(0, 0, s, s); const n = 4, cell = s / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const g = ctx.createLinearGradient(x * cell, y * cell, x * cell + cell, y * cell + cell); g.addColorStop(0, '#41566a'); g.addColorStop(.5, '#1d2731'); g.addColorStop(1, '#121920');
    ctx.fillStyle = g; ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 7);
  }
});
const darkGlassGlowMap = hiRes(256, (ctx, s) => {
  const r = rng(137); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s); const n = 4, cell = s / n;
  for (let y = 0; y < n; y++) { ctx.fillStyle = '#2fd8ff'; ctx.fillRect(0, y * cell + cell - 5, s, 2); }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (r() > .7) { ctx.fillStyle = r() > .3 ? 'rgba(120,220,255,.32)' : 'rgba(150,110,255,.3)'; ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 7); }
});
/** Alpha ramp for light beams: opaque at the base (v = 0), gone at the top. */
const fadeMap = canvasTexture(64, (ctx, s) => { const g = ctx.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#000'); g.addColorStop(.55, '#555'); g.addColorStop(1, '#fff'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); });
fadeMap.colorSpace = THREE.NoColorSpace; fadeMap.wrapS = fadeMap.wrapT = THREE.ClampToEdgeWrapping;

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: .9, ...p });
const bumped = (map: THREE.Texture, bumpScale: number, p: THREE.MeshStandardMaterialParameters = {}) => std({ map, bumpMap: map, bumpScale, ...p });

/** Shared materials. `paint` and `metal` use per-vertex colour, so any number of coloured parts share a draw call. */
export const M = {
  wood: woodMaterial('#b8925f'), darkWood: woodMaterial('#73563a'), lightWood: woodMaterial('#d4b07c'),
  plaster: bumped(plasterMap, .006, { roughness: .96 }),
  stone: bumped(stoneMap, .025),
  brick: bumped(brickMap, .02),
  thatch: bumped(thatchMap, .04, { roughness: 1 }),
  tile: bumped(tileMap, .025, { roughness: .78 }),
  slate: bumped(slateMap, .02, { roughness: .7 }),
  corrugated: bumped(corrugatedMap, .015, { roughness: .5, metalness: .35 }),
  concrete: bumped(concreteMap, .006, { roughness: .92 }),
  paving: bumped(pavingMap, .008),
  dirt: bumped(dirtMap, .01, { roughness: 1 }),
  facade: std({ map: facadeMap, emissiveMap: facadeGlowMap, emissive: '#ffffff', emissiveIntensity: .04, roughness: .22, metalness: .25 }),
  solar: std({ map: solarMap, roughness: .25, metalness: .45 }),
  paint: std({ vertexColors: true, roughness: .78 }),
  metal: std({ vertexColors: true, roughness: .36, metalness: .62 }),
  glass: std({ color: '#3f5c66', roughness: .1, metalness: .25, emissive: '#ffc977', emissiveIntensity: .03 }),
  lamp: std({ color: '#fff1c8', emissive: '#ffcf7d', emissiveIntensity: .45 }),
  cyan: std({ color: '#06323d', emissive: '#00c2ff', emissiveIntensity: 1.15, roughness: .4 }),
  red: std({ color: '#ffb0a0', emissive: '#ff3b22', emissiveIntensity: 1.4 }),
  fire: new THREE.MeshBasicMaterial({ color: '#ffad54' }),
  water: std({ color: '#5fb6bf', roughness: .12, metalness: .1 }),
  // Later eras: each has its own ground, cladding and light so a district reads as one period from orbit.
  cobble: bumped(cobbleMap, .012, { roughness: .95 }),
  asphalt: bumped(asphaltMap, .004, { roughness: .97 }),
  composite: bumped(compositeMap, .004, { roughness: .62 }),
  hexDeck: bumped(hexMap, .006, { roughness: .5, metalness: .35 }),
  rivet: bumped(rivetMap, .01, { vertexColors: true, roughness: .55, metalness: .45 }),
  panel: std({ map: panelMap, vertexColors: true, roughness: .3, metalness: .08 }),
  hull: bumped(hullMap, .004, { vertexColors: true, roughness: .34, metalness: .5 }),
  screen: std({ map: screenMap, emissiveMap: screenMap, emissive: '#ffffff', emissiveIntensity: .85, roughness: .3 }),
  darkGlass: std({ map: darkGlassMap, emissiveMap: darkGlassGlowMap, emissive: '#ffffff', emissiveIntensity: .8, roughness: .12, metalness: .45 }),
  clearGlass: std({ color: '#d6f1f7', transparent: true, opacity: .26, roughness: .05, metalness: .2, depthWrite: false }),
  violet: std({ color: '#1c0b40', emissive: '#7040ff', emissiveIntensity: 1.25, roughness: .4 }),
  amber: std({ color: '#3a1a06', emissive: '#ff7a1a', emissiveIntensity: 1.25, roughness: .4 }),
  /**
   * Translucent light shells: holograms, halos and force fields. Normal blending tints what lies behind, so they stay
   * coloured against a bright daytime sky where additive light would only turn white. Never cast shadows.
   */
  holo: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide }),
  /** Light shafts that fade out along the geometry's v coordinate. */
  beam: new THREE.MeshBasicMaterial({ vertexColors: true, alphaMap: fadeMap, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide }),
};
for (const m of [M.paint, M.metal]) m.color.set('#ffffff');
// Light sources and see-through shells throw no shadow (see buildTemplate for how they leave the shadow pass).
for (const m of [M.holo, M.beam, M.clearGlass, M.cyan, M.violet, M.amber]) m.userData.noShadow = true;

const reflective = [M.glass, M.metal, M.facade, M.solar, M.corrugated, M.water, M.rivet, M.panel, M.hull, M.darkGlass, M.clearGlass, M.hexDeck];
/** Sky reflections for glass and metal; set once the renderer has a PMREM environment. */
export function setBuildingEnvironment(env: THREE.Texture) { for (const m of reflective) { m.envMap = env; m.envMapIntensity = m === M.metal ? .9 : .75; m.needsUpdate = true; } }
/** Windows warm up in the evening light preset; screens and smoked glass glow brighter. */
export function setEveningLights(evening: boolean) {
  M.glass.emissiveIntensity = evening ? .85 : .03; M.lamp.emissiveIntensity = evening ? 1.6 : .45; M.facade.emissiveIntensity = evening ? .75 : .04;
  M.darkGlass.emissiveIntensity = evening ? 1.5 : .8; M.screen.emissiveIntensity = evening ? 1.25 : .85;
}

// ---------------------------------------------------------------- geometry helpers
export type V3 = [number, number, number];
type Paint = THREE.Material | string;
const tmpColor = new THREE.Color();
/** Box-projects UVs in local units so textures keep one density on parts of any size. */
export function projectUV(geo: THREE.BufferGeometry, scale = 1, swap = false) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    if (swap) [u, v] = [v, u];
    uv.push(u * scale, v * scale);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return geo;
}
/** Writes a flat vertex colour; geometry with baked shading (boulders) keeps its shading under the new colour. */
export function tint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  tmpColor.set(color); const count = geo.attributes.position.count, data = new Float32Array(count * 3);
  const shade = geo.userData.bakedShade ? geo.attributes.color : null;
  for (let i = 0; i < count; i++) { const k = shade ? shade.getX(i) : 1; data[i * 3] = tmpColor.r * k; data[i * 3 + 1] = tmpColor.g * (shade ? shade.getY(i) : 1); data[i * 3 + 2] = tmpColor.b * (shade ? shade.getZ(i) : 1); }
  geo.userData.bakedShade = false;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(data, 3)); return geo;
}
const textured = (m: THREE.Material) => !!(m as THREE.MeshStandardMaterial).map;
/** Vertex-tinted materials picked by a colour-string prefix, e.g. `hull:#d9dde0`. */
const TINTED: Record<string, THREE.Material> = { metal: M.metal, rivet: M.rivet, panel: M.panel, hull: M.hull, holo: M.holo, beam: M.beam };
/**
 * Adds a mesh. A colour string selects the shared vertex-coloured paint; prefixes such as `metal:`, `rivet:`, `panel:`,
 * `hull:`, `holo:` and `beam:` pick a tinted variant. Textured materials get box-projected UVs unless the geometry is
 * flagged `userData.keepUV`.
 */
export function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: Paint, at: V3 = [0, 0, 0], rot?: V3, uvScale = 1.6) {
  let material: THREE.Material;
  if (typeof mat === 'string') { const split = mat.indexOf(':'); material = split < 0 ? M.paint : TINTED[mat.slice(0, split)] ?? M.paint; tint(geo, mat.slice(split + 1)); }
  else material = mat;
  if (textured(material) && !geo.userData.keepUV) projectUV(geo, uvScale);
  const m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true; m.position.set(...at); if (rot) m.rotation.set(...rot);
  parent.add(m); return m;
}
export const rbox = (w: number, h: number, d: number, r = .03, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
export const bx = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/**
 * Side count for a round part: at least `minimum`, and enough that facets bulge less than 2.5 mm (model units), so big
 * towers, tanks and domes stay smooth up close. Counts of 8 or fewer are deliberate facets and kept as given.
 */
export const sides = (radius: number, minimum: number) =>
  minimum <= 8 ? minimum : Math.min(64, Math.max(minimum, Math.ceil(Math.PI / Math.acos(Math.max(0, 1 - .0025 / Math.max(radius, .0025))))));
export const cyl = (rt: number, rb: number, h: number, seg = 14, open = false) => new THREE.CylinderGeometry(rt, rb, h, sides(Math.max(rt, rb), seg), 1, open);
export const sph = (r: number, w = 14, h = 10) => { const n = sides(r, w); return new THREE.SphereGeometry(r, n, Math.max(h, Math.round(n * h / w))); };
/** Rod between two points with any cross-section geometry factory. */
export function rod(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: Paint, seg = 8) {
  const m = add(parent, cyl(radius, radius, a.distanceTo(b), seg), mat, a.clone().add(b).multiplyScalar(.5).toArray() as V3);
  m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); return m;
}
/** Square timber between two points; matches `craft.beam` but routes colour strings to paint. */
export function timber(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, mat: Paint = M.darkWood) {
  const m = add(parent, rbox(w, a.distanceTo(b), d, Math.min(w, d) * .22, 1), mat, a.clone().add(b).multiplyScalar(.5).toArray() as V3);
  m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); return m;
}
export function lathe(points: [number, number][], seg = 18) { const g = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), sides(Math.max(...points.map(p => p[0])), seg)); g.userData.keepUV = true; return g; }
/** Extruded prism from an x/y outline, centred on z. */
export function prism(points: [number, number][], depth: number, bevel = 0) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -depth / 2); return g;
}
export function marker(parent: THREE.Object3D, name: string, at: V3, data: Record<string, unknown> = {}) { const o = new THREE.Object3D(); o.name = name; o.position.set(...at); Object.assign(o.userData, data); parent.add(o); return o; }
/** Chimney / exhaust emitter consumed by the smoke system. `kind` picks colour and rise. */
export const smoke = (parent: THREE.Object3D, at: V3, kind: 'chimney' | 'industry' | 'steam' = 'chimney', size = 1) => marker(parent, 'smoke', at, { smoke: { kind, size } });
/**
 * A sub-group animated by the settlement view. `spin` turns continuously, `swing` oscillates by `amount` radians,
 * `bob`/`slide` move along an axis, `blink` toggles visibility and `pulse` breathes in scale.
 * Production facilities only animate while working unless `always` is set; concept models always animate.
 */
export type AnimSpec = { type: 'spin' | 'swing' | 'bob' | 'blink' | 'pulse' | 'slide'; axis?: 'x' | 'y' | 'z'; speed?: number; amount?: number; phase?: number; always?: boolean };
export function animated(parent: THREE.Object3D, anim: AnimSpec, at: V3 = [0, 0, 0]) {
  const g = new THREE.Group(); g.position.set(...at); g.userData.anim = { speed: 1, amount: 1, phase: 0, axis: 'y', ...anim }; parent.add(g); return g;
}

// ---------------------------------------------------------------- architecture
/** Ground variants of a material: same look, but they merge separately so they can skip the shadow pass. */
const groundVariants = new Map<THREE.Material, THREE.Material>();
export function groundMaterial(mat: THREE.Material) {
  let g = groundVariants.get(mat);
  if (!g) {
    g = mat.clone(); g.userData.ground = true; groundVariants.set(mat, g); reflective.includes(mat as THREE.MeshStandardMaterial) && reflective.push(g as THREE.MeshStandardMaterial);
    // Paved and trodden ground sits a little warmer and darker than walls so pads settle into the meadow.
    if (g instanceof THREE.MeshStandardMaterial) g.color.multiply(new THREE.Color('#e2dccb'));
  }
  return g;
}
/** Ground pad that extends below the surface so curved terrain never shows a gap. */
export function pad(parent: THREE.Object3D, w: number, d: number, mat: THREE.Material = M.dirt, h = .14) {
  add(parent, rbox(w, h + .3, d, .06, 2), groundMaterial(mat), [0, h / 2 - .15 - .07, 0]);
}
/** Round pad for large complexes; keeps the paved area inside the circular footprint used for spacing. */
export function roundPad(parent: THREE.Object3D, radius: number, mat: THREE.Material = M.concrete, h = .12) {
  add(parent, cyl(radius, radius + .02, h + .3, 40), groundMaterial(mat), [0, h / 2 - .15 - .06, 0], undefined, 1.2);
}
/** Stone plinth beneath walls. */
export const plinth = (parent: THREE.Object3D, w: number, d: number, h = .22, y = 0, mat: THREE.Material = M.stone) => add(parent, rbox(w, h + .2, d, .05, 2), mat, [0, y + (h - .2) / 2, 0], undefined, 2.6);

/**
 * Plaster walls with a timber frame: posts, sill and head beams on every face, braces in the wide panels.
 * Returns the wall-top height for roofs.
 */
export function framedWalls(parent: THREE.Object3D, w: number, h: number, d: number, y0 = 0, options: { wall?: THREE.Material; frame?: Paint; braces?: boolean } = {}) {
  const wall = options.wall ?? M.plaster, frame = options.frame ?? M.darkWood;
  add(parent, rbox(w, h, d, .025, 1), wall, [0, y0 + h / 2, 0], undefined, 1.2);
  const t = .075, o = .02;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) timber(parent, vec(sx * (w / 2 + o - t / 2), y0, sz * (d / 2 + o - t / 2)), vec(sx * (w / 2 + o - t / 2), y0 + h, sz * (d / 2 + o - t / 2)), t + .01, t + .01, frame);
  for (const yy of [y0 + t / 2, y0 + h - t / 2]) {
    for (const sz of [-1, 1]) timber(parent, vec(-w / 2 - o, yy, sz * (d / 2 + o)), vec(w / 2 + o, yy, sz * (d / 2 + o)), t, t * .55, frame);
    for (const sx of [-1, 1]) timber(parent, vec(sx * (w / 2 + o), yy, -d / 2 - o), vec(sx * (w / 2 + o), yy, d / 2 + o), t * .55, t, frame);
  }
  if (options.braces !== false) for (const sx of [-1, 1]) {
    timber(parent, vec(sx * (w / 2 + o), y0 + t, -d / 2 + t), vec(sx * (w / 2 + o), y0 + h - t, -d / 2 + d * .42), t * .5, t * .8, frame);
    timber(parent, vec(sx * (w / 2 + o), y0 + t, d / 2 - t), vec(sx * (w / 2 + o), y0 + h - t, d / 2 - d * .42), t * .5, t * .8, frame);
  }
  return y0 + h;
}

export interface RoofSpec { width: number; depth: number; eave: number; peak: number; overhang?: number; kind: 'thatch' | 'tile' | 'slate' | 'shingle' | 'metal'; gable?: THREE.Material; trim?: Paint }
/** Height of a gable roof's outer surface at `x`, for chimneys and dormers. */
export const roofHeight = (r: RoofSpec, x: number) => r.peak - (r.peak - r.eave) * Math.abs(x) / (r.width / 2);
/**
 * Gable roof along z. Thatch is thick and soft with a mid-slope tier and rolled ridge; tile and slate get stepped
 * courses so the eave reads as overlapping rows; gable triangles close the ends.
 */
export function gableRoof(parent: THREE.Object3D, r: RoofSpec) {
  const o = r.overhang ?? .18, half = r.width / 2, rise = r.peak - r.eave, angle = Math.atan2(rise, half);
  const run = half + o, length = run / Math.cos(angle), depth = r.depth + o * 2;
  const thick = r.kind === 'thatch' ? .2 : r.kind === 'shingle' ? .09 : .07;
  const material = r.kind === 'thatch' ? M.thatch : r.kind === 'tile' ? M.tile : r.kind === 'slate' ? M.slate : r.kind === 'metal' ? M.corrugated : M.wood;
  const trim = r.trim ?? M.darkWood;
  const slab = (side: number, len: number, offset: number, t: number, along = 0, mat: Paint = material) => {
    const geo = rbox(len, t, depth + (r.kind === 'thatch' ? .02 : 0), r.kind === 'thatch' ? t * .48 : .02, r.kind === 'thatch' ? 3 : 1);
    if (typeof mat !== 'string') { projectUV(geo, r.kind === 'thatch' ? 1.1 : 1.35, true); geo.userData.keepUV = true; }
    const m = add(parent, geo, mat);
    // Slabs hinge at the ridge; `along` slides a course down the slope, `offset` lifts it off the deck.
    const cx = side * (len / 2 + along) * Math.cos(angle), cy = r.peak - (len / 2 + along) * Math.sin(angle);
    m.position.set(cx + side * Math.sin(angle) * (t / 2 + offset), cy + Math.cos(angle) * (t / 2 + offset), 0); m.rotation.z = -side * angle;
    return m;
  };
  for (const side of [-1, 1]) {
    slab(side, length, 0, thick);
    if (r.kind === 'thatch') slab(side, length * .5, thick * .55, thick * .7, length * .5);
    // Each higher course stops short of the one below, so the step edges face the eave like overlapping rows.
    else if (r.kind !== 'metal') for (let i = 1; i < 6; i++) slab(side, length * (1 - i / 6), thick * .6 + i * .028, .04, 0, material);
  }
  if (r.kind === 'thatch') {
    const ridge = add(parent, cyl(thick * .95, thick * .95, depth + .04, 12), M.thatch, [0, r.peak + thick * .62, 0], [Math.PI / 2, 0, 0]);
    ridge.scale.set(1.25, 1, .8);
  } else {
    add(parent, cyl(.07, .07, depth + .04, 10), r.kind === 'tile' ? M.tile : trim, [0, r.peak + thick * .9, 0], [Math.PI / 2, 0, 0]);
  }
  if (r.gable !== undefined) for (const sz of [-1, 1]) {
    const tri = prism([[-half, 0], [half, 0], [0, rise]], .06);
    add(parent, tri, r.gable, [0, r.eave, sz * (r.depth / 2 - .03)], undefined, 1.2);
  }
  // Barge boards trace the gable edge for a crisp silhouette.
  if (r.kind !== 'thatch') for (const sz of [-1, 1]) for (const side of [-1, 1])
    timber(parent, vec(0, r.peak + thick + .02, sz * (depth / 2)), vec(side * run, r.peak - run * Math.tan(angle) + thick + .02, sz * (depth / 2)), .05, .07, trim);
  return angle;
}
/** Hipped pyramid roof for towers and pavilions. */
export function pyramidRoof(parent: THREE.Object3D, w: number, d: number, eave: number, height: number, mat: THREE.Material = M.tile, sides = 4) {
  const g = new THREE.ConeGeometry(Math.hypot(w, d) / 2, height, sides, 1); g.rotateY(Math.PI / 4);
  const m = add(parent, g, mat, [0, eave + height / 2, 0], undefined, 1.4); m.scale.set(w / (Math.hypot(w, d) / Math.SQRT2), 1, d / (Math.hypot(w, d) / Math.SQRT2)); return m;
}
/** Framed window on a wall face; `facing` is the outward y-rotation (0 faces +z). */
export function windowAt(parent: THREE.Object3D, at: V3, facing: number, w = .3, h = .36, options: { shutters?: string; box?: boolean; frame?: Paint } = {}) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = facing; parent.add(g);
  const frame = options.frame ?? M.darkWood;
  add(g, bx(w, h, .03), M.glass, [0, 0, .005]);
  for (const sx of [-1, 1]) add(g, bx(.045, h + .06, .05), frame, [sx * w / 2, 0, .02]);
  for (const sy of [-1, 1]) add(g, bx(w + .06, .045, .05), frame, [0, sy * h / 2, .02]);
  add(g, bx(.025, h, .04), frame, [0, 0, .03]); add(g, bx(w, .025, .04), frame, [0, 0, .03]);
  add(g, rbox(w + .12, .045, .1, .015), M.lightWood, [0, -h / 2 - .04, .05]);
  if (options.shutters) for (const sx of [-1, 1]) { const s = add(g, rbox(w * .48, h + .02, .03, .01), options.shutters, [sx * (w * .74 + .02), 0, .03]); s.rotation.y = sx * .25; }
  if (options.box) {
    add(g, rbox(w + .04, .09, .11, .02), M.wood, [0, -h / 2 - .1, .09]);
    for (let i = 0; i < 6; i++) add(g, sph(.035, 6, 5), ['#d8566a', '#f2c15a', '#e88aa2', '#f7f0e0'][i % 4], [-w / 2 + .03 + i * (w - .06) / 5, -h / 2 - .03 + (i % 2) * .02, .1]);
    for (let i = 0; i < 4; i++) add(g, sph(.04, 6, 5), '#6f9a4c', [-w / 2 + .06 + i * (w - .12) / 3, -h / 2 - .06, .12]);
  }
  return g;
}
export function doorAt(parent: THREE.Object3D, at: V3, facing: number, w = .36, h = .66, color: Paint = M.wood) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = facing; parent.add(g);
  add(g, rbox(w, h, .05, .012), color, [0, h / 2, .01]);
  for (let i = 1; i < 4; i++) add(g, bx(.012, h - .04, .055), M.darkWood, [-w / 2 + i * w / 4, h / 2, .012]);
  for (const sx of [-1, 1]) add(g, bx(.06, h + .07, .07), M.darkWood, [sx * (w / 2 + .03), (h + .07) / 2, .02]);
  add(g, bx(w + .12, .07, .08), M.darkWood, [0, h + .05, .02]);
  add(g, sph(.02, 6, 5), 'metal:#3c3a33', [w * .32, h * .48, .05]);
  add(g, rbox(w + .2, .07, .22, .02), M.stone, [0, .01, .12]);
  return g;
}
export function chimney(parent: THREE.Object3D, x: number, z: number, base: number, top: number, w = .24, mat: THREE.Material = M.stone, kind: 'chimney' | 'industry' = 'chimney') {
  add(parent, rbox(w, top - base, w, .02), mat, [x, (base + top) / 2, z], undefined, 2.4);
  add(parent, rbox(w + .07, .07, w + .07, .015), '#8f8c80', [x, top + .02, z]);
  add(parent, bx(w * .6, .02, w * .6), '#3a3c36', [x, top + .055, z]);
  return smoke(parent, [x, top + .1, z], kind);
}

// ---------------------------------------------------------------- props
export function barrel(parent: THREE.Object3D, at: V3, scale = 1, color: Paint = M.wood) {
  const s = scale, g = lathe([[0, 0], [.13 * s, 0], [.155 * s, .14 * s], [.13 * s, .28 * s], [0, .28 * s]], 14);
  add(parent, g, color, at);
  for (const y of [.05, .23]) add(parent, cyl(.142 * s + (y > .1 ? -.004 : 0), .142 * s, .018, 14), 'metal:#4d4b45', [at[0], at[1] + y * s, at[2]]);
}
export function crate(parent: THREE.Object3D, at: V3, size = .3, rotY = 0) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rotY; parent.add(g);
  add(g, rbox(size, size, size, .015), M.lightWood, [0, size / 2, 0]);
  for (const sz of [-1, 1]) for (const sy of [-1, 1]) add(g, bx(size + .01, .04, .015), M.darkWood, [0, size / 2 + sy * size * .38, sz * (size / 2 + .005)]);
  for (const sz of [-1, 1]) timber(g, vec(-size * .42, size * .12, sz * (size / 2 + .012)), vec(size * .42, size * .88, sz * (size / 2 + .012)), .035, .012);
  return g;
}
export function sack(parent: THREE.Object3D, at: V3, color = '#d8c79c', scale = 1) {
  const m = add(parent, sph(.13 * scale, 10, 8), color, [at[0], at[1] + .1 * scale, at[2]]); m.scale.set(.85, 1.15, .75);
  add(parent, cyl(.035 * scale, .05 * scale, .07 * scale, 8), color, [at[0], at[1] + .24 * scale, at[2]]);
}
export function logStack(parent: THREE.Object3D, at: V3, rows = 3, length = .9, r = .09, rotY = 0) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rotY; parent.add(g);
  for (let row = 0; row < rows; row++) for (let i = 0; i < rows - row + 1; i++) {
    const x = (i - (rows - row) / 2) * r * 2.05, y = r + row * r * 1.75;
    add(g, cyl(r, r * 1.03, length, 10), M.darkWood, [x, y, 0], [Math.PI / 2, 0, 0]);
    for (const sz of [-1, 1]) add(g, new THREE.CircleGeometry(r * .92, 12), '#dcb780', [x, y, sz * (length / 2 + .002)], [0, sz > 0 ? 0 : Math.PI, 0]);
  }
  return g;
}
export function fence(parent: THREE.Object3D, points: [number, number][], height = .32, closed = false) {
  const pts = closed ? [...points, points[0]] : points;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = vec(pts[i][0], 0, pts[i][1]), b = vec(pts[i + 1][0], 0, pts[i + 1][1]), n = Math.max(1, Math.round(a.distanceTo(b) / .42));
    for (let j = 0; j <= n; j++) { if (j === n && i < pts.length - 2) continue; const p = a.clone().lerp(b, j / n); add(parent, rbox(.05, height + .04, .05, .012), M.darkWood, [p.x, height / 2, p.z]); }
    for (const y of [height * .45, height * .85]) timber(parent, a.clone().setY(y), b.clone().setY(y), .025, .035, M.wood);
  }
}
export function bush(parent: THREE.Object3D, at: V3, size = .2, color = '#6c8d45', berries?: string) {
  const r = rng(Math.round(at[0] * 97 + at[2] * 31 + 7));
  for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2, d = r() * size * .45; const m = add(parent, new THREE.IcosahedronGeometry(size * (.45 + r() * .25), 1), color, [at[0] + Math.cos(a) * d, at[1] + size * (.4 + r() * .3), at[2] + Math.sin(a) * d]); m.scale.y = .8; }
  if (berries) for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2; add(parent, sph(.026, 6, 4), berries, [at[0] + Math.cos(a) * size * .62, at[1] + size * (.35 + r() * .5), at[2] + Math.sin(a) * size * .62]); }
}
export function lampPost(parent: THREE.Object3D, at: V3, height = .9, modern = false) {
  add(parent, cyl(.022, .03, height, 8), modern ? 'metal:#5b6266' : 'metal:#3c3b36', [at[0], at[1] + height / 2, at[2]]);
  if (modern) { add(parent, rbox(.2, .04, .07, .015), 'metal:#5b6266', [at[0] + .08, at[1] + height, at[2]]); add(parent, bx(.14, .015, .05), M.lamp, [at[0] + .1, at[1] + height - .025, at[2]]); }
  else { add(parent, cyl(.06, .045, .1, 6), M.lamp, [at[0], at[1] + height + .06, at[2]]); add(parent, new THREE.ConeGeometry(.085, .07, 6), 'metal:#3c3b36', [at[0], at[1] + height + .14, at[2]]); }
}
/** Parabolic dish facing +z before rotation. */
export function dish(parent: THREE.Object3D, at: V3, radius: number, rot: V3 = [0, 0, 0], color = 'metal:#e9ecec') {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.set(...rot); parent.add(g);
  const pts: [number, number][] = []; for (let i = 0; i <= 8; i++) { const x = Math.max(.001, radius * i / 8); pts.push([x, x * x / (radius * 2.4)]); }
  // Lathe winding follows profile order: the reversed, slightly offset copy is the convex back of the bowl.
  const bowl = lathe(pts, 24); bowl.rotateX(Math.PI / 2); add(g, bowl, color);
  const back = lathe(pts.map(([x, y]) => [x, y - .018] as [number, number]).reverse(), 24); back.rotateX(Math.PI / 2); add(g, back, color);
  rod(g, vec(0, 0, 0), vec(0, 0, radius * .62), .015, 'metal:#9aa1a3');
  add(g, sph(radius * .07, 8, 6), 'metal:#c9cfcf', [0, 0, radius * .64]);
  return g;
}
/** Tank with domed cap. */
export function tank(parent: THREE.Object3D, at: V3, r: number, h: number, color = 'metal:#d9dcd8', band = '#4f86b8') {
  add(parent, cyl(r, r, h, 20), color, [at[0], at[1] + h / 2, at[2]]);
  const cap = add(parent, new THREE.SphereGeometry(r, sides(r, 20), 8, 0, Math.PI * 2, 0, Math.PI / 2), color, [at[0], at[1] + h, at[2]]); cap.scale.y = .35;
  add(parent, cyl(r + .01, r + .01, h * .12, 20), band, [at[0], at[1] + h * .72, at[2]]);
}
export function pipe(parent: THREE.Object3D, points: V3[], r = .035, color = 'metal:#8c9496') {
  for (let i = 0; i < points.length - 1; i++) { rod(parent, vec(...points[i]), vec(...points[i + 1]), r, color, 10); if (i > 0) add(parent, sph(r * 1.05, 8, 6), color, points[i]); }
}
/** Rooftop condensing unit with a fan that the settlement view spins. */
export function fanUnit(parent: THREE.Object3D, at: V3, size = .3) {
  add(parent, rbox(size, size * .45, size, .02), 'metal:#c7ccca', [at[0], at[1] + size * .22, at[2]]);
  add(parent, cyl(size * .38, size * .38, .02, 18), '#2f3537', [at[0], at[1] + size * .45 + .005, at[2]]);
  const spin = animated(parent, { type: 'spin', axis: 'y', speed: 5, always: true }, [at[0], at[1] + size * .46, at[2]]);
  for (let i = 0; i < 4; i++) { const b = add(spin, bx(size * .66, .01, size * .12), '#9aa3a5'); b.rotation.y = i * Math.PI / 4; }
}
export function lightStrip(parent: THREE.Object3D, at: V3, w: number, h: number, d: number, mat: THREE.Material = M.cyan) { const m = add(parent, bx(w, h, d), mat, at); m.castShadow = false; return m; }
/** Small articulated truck facing +z. */
export function truck(parent: THREE.Object3D, at: V3, rotY = 0, body = '#e1b443', cargo = '#8a6a43') {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rotY; parent.add(g);
  add(g, rbox(.34, .26, .26, .04), body, [0, .2, .3]);
  add(g, bx(.3, .1, .02), M.glass, [0, .26, .43]);
  add(g, rbox(.38, .06, .62, .02), '#4b4f4f', [0, .1, -.05]);
  add(g, rbox(.36, .22, .52, .03), cargo, [0, .24, -.1]);
  for (const sx of [-1, 1]) for (const z of [.3, -.05, -.25]) add(g, cyl(.065, .065, .05, 12), '#2d2f2f', [sx * .18, .065, z], [0, 0, Math.PI / 2]);
  return g;
}
export function person(parent: THREE.Object3D, at: V3, rotY = 0, shirt = '#d9d6cc', hat?: string) {
  const g = new THREE.Group(); g.position.set(...at); g.rotation.y = rotY; parent.add(g);
  add(g, new THREE.CapsuleGeometry(.07, .12, 3, 8), shirt, [0, .26, 0]);
  add(g, sph(.06, 10, 8), '#d7b187', [0, .43, 0]);
  if (hat) add(g, cyl(.065, .07, .04, 10), hat, [0, .48, 0]);
  for (const sx of [-1, 1]) add(g, new THREE.CapsuleGeometry(.028, .12, 3, 6), '#4c5652', [sx * .035, .09, 0]);
  return g;
}
/** Irregular boulder used by quarries and mines; displaced icosphere with soft facets. */
/**
 * Weathered boulder: a smooth noisy body cut by a few fracture planes, with a flattened base that sits in the
 * ground. Vertex colours carry baked shading — darker toward the soil, optional moss on upward faces.
 */
export function boulderGeometry(seed: number, detail = 2, moss = 0) {
  const r = rng(seed), source = new THREE.IcosahedronGeometry(1, detail);
  source.deleteAttribute('normal'); source.deleteAttribute('uv');
  const g = mergeVertices(source), p = g.attributes.position, v = new THREE.Vector3();
  source.dispose();
  const planes = Array.from({ length: 6 }, () => ({ n: vec(r() - .5, r() * .9 - .25, r() - .5).normalize(), d: .58 + r() * .26 }));
  const phase = r() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const s = 1 + .13 * Math.sin(v.x * 3.7 + phase) * Math.cos(v.y * 3.1 - phase * .6) + .07 * Math.sin(v.z * 8.3 + v.x * 5.9 + phase) + .03 * Math.sin(v.y * 15 + v.z * 12);
    v.multiplyScalar(s);
    for (const plane of planes) { const d = v.dot(plane.n); if (d > plane.d) v.addScaledVector(plane.n, (plane.d - d) * .9); }
    if (v.y < -.42) v.y = -.42 + (v.y + .42) * .25;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const ao = .58 + .42 * THREE.MathUtils.smoothstep(p.getY(i), -.45, .55), mossy = moss * THREE.MathUtils.smoothstep(n.getY(i), .5, .9);
    colors[i * 3] = ao * (1 - mossy * .34); colors[i * 3 + 1] = ao * (1 - mossy * .1); colors[i * 3 + 2] = ao * (1 - mossy * .5);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.userData.bakedShade = true;
  return g;
}
/** Rock for scattered instances: per-vertex baked shading times a per-instance colour. */
export const rockMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93, flatShading: true });
