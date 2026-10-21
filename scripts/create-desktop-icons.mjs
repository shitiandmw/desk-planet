// Reuse the project's existing vector mark. Run on macOS only when changing the source icon.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const temporary = mkdtempSync(join(tmpdir(), 'mini-planet-icons-'));
const convert = (...args) => execFileSync('sips', args, { stdio: 'ignore' });
try {
  const svg = readFileSync('public/favicon.svg', 'utf8').replace('<svg ', '<svg width="1024" height="1024" ');
  writeFileSync(join(temporary, 'icon.svg'), svg);
  convert('-s', 'format', 'png', join(temporary, 'icon.svg'), '--out', resolve('desktop/icon.png'));
  const iconset = join(temporary, 'icon.iconset'); mkdirSync(iconset);
  for (const size of [16, 32, 128, 256, 512]) for (const scale of [1, 2]) {
    convert('-z', String(size * scale), String(size * scale), resolve('desktop/icon.png'), '--out', join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`));
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', resolve('desktop/icon.icns')]);
  writeFileSync(join(temporary, 'tray.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24"><g fill="none" stroke="black" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></g></svg>');
  convert('-s', 'format', 'png', join(temporary, 'tray.svg'), '--out', resolve('desktop/tray.png'));
} finally { rmSync(temporary, { recursive: true, force: true }); }
