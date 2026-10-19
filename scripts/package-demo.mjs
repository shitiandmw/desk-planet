import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const assets = await readdir('dist/assets');
const script = await readFile(resolve('dist/assets', assets.find(f => f.endsWith('.js'))), 'utf8');
let css = await readFile(resolve('dist/assets', assets.find(f => f.endsWith('.css'))), 'utf8');
const font = await readFile('public/fonts/noto-serif-sc-subset.ttf');
css = css.replace(/url\([^)]*noto-serif-sc-subset\.ttf\)/g, `url(data:font/ttf;base64,${font.toString('base64')})`);
const favicon = await readFile('public/favicon.svg', 'utf8');
const licenses = (await readFile('node_modules/three/LICENSE', 'utf8')) + '\n\nNoto Serif SC\n' + (await readFile('public/fonts/OFL.txt', 'utf8'));
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#eeede4"><title>微缩星球 · 文明初生</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}"><style>${css}</style></head><body><div id="app"></div><script type="text/plain" id="third-party-licenses">${licenses}</script><script type="module">${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
await mkdir('output/planet-demo', { recursive: true });
await writeFile('output/planet-demo/planet-demo.html', html);
await mkdir('output/planet-weather', { recursive: true });
await writeFile('output/planet-weather/planet-weather.html', html);
// Keep the previous download path current as well.
await mkdir('output/woodland-demo', { recursive: true });
await writeFile('output/woodland-demo/woodland-demo.html', html);
console.log(`Standalone, offline HTML: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
