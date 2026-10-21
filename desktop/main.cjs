'use strict';
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { validRegions, containsPoint } = require('./hit-regions.cjs');

app.setName('微缩星球');
let window, tray, pointerTimer, activeDisplayId, dragging = false, ignored = true;
let regions = [];
let quitting = false;
const command = value => { if (window && !window.isDestroyed()) window.webContents.send('planet:command', value); };
const preferencesPath = () => path.join(app.getPath('userData'), 'desktop.json');

function readDisplay() {
  try { return JSON.parse(fs.readFileSync(preferencesPath(), 'utf8')).displayId; } catch { return null; }
}

function setPassthrough(value) {
  if (!window || window.isDestroyed() || ignored === value) return;
  ignored = value;
  window.setIgnoreMouseEvents(value, { forward: true });
}

function updatePointer() {
  if (!window || window.isDestroyed() || !window.isVisible()) return;
  const cursor = screen.getCursorScreenPoint(), bounds = window.getBounds();
  setPassthrough(!dragging && !containsPoint(regions, { x: cursor.x - bounds.x, y: cursor.y - bounds.y }));
}

function moveToDisplay(display, reset = true) {
  activeDisplayId = display.id;
  regions = [];
  setPassthrough(true);
  window.setBounds(display.workArea);
  try { fs.writeFileSync(preferencesPath(), JSON.stringify({ displayId: display.id })); } catch (error) { console.warn('Unable to save display preference:', error.message); }
  if (reset) command('reset');
  rebuildTray();
}

function showPlanet() { window.showInactive(); command('dismiss'); updatePointer(); rebuildTray(); }
function hidePlanet() { command('save'); command('dismiss'); dragging = false; window.hide(); rebuildTray(); }

function rebuildTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '微缩星球 · 陪你慢慢生长', enabled: false },
    { type: 'separator' },
    { label: window.isVisible() ? '暂时隐藏星球' : '显示星球', click: () => window.isVisible() ? hidePlanet() : showPlanet() },
    { label: '找回星球 / 恢复大小', click: () => { showPlanet(); command('reset'); } },
    { label: '暂停 / 继续生长', click: () => command('pause') },
    { label: '所在屏幕', submenu: screen.getAllDisplays().map((display, i) => ({
      label: display.label || `显示器 ${i + 1}`, type: 'radio', checked: display.id === activeDisplayId,
      click: () => { moveToDisplay(display); showPlanet(); },
    })) },
    { type: 'separator' },
    { label: '退出微缩星球', accelerator: 'CommandOrControl+Q', click: () => app.quit() },
  ]));
}

function createWindow() {
  const display = screen.getAllDisplays().find(d => d.id === readDisplay()) || screen.getPrimaryDisplay();
  activeDisplayId = display.id;
  window = new BrowserWindow({
    ...display.workArea, title: '微缩星球', transparent: true, backgroundColor: '#00000000',
    frame: false, hasShadow: false, resizable: false, movable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, backgroundThrottling: false,
    },
  });
  window.setAlwaysOnTop(true, 'floating');
  if (process.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.setIgnoreMouseEvents(true, { forward: true });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    // Only the local game's own mode switches are allowed.
    if (url.split('?')[0] !== window.webContents.getURL().split('?')[0]) event.preventDefault();
  });
  window.webContents.on('did-start-loading', () => { regions = []; dragging = false; setPassthrough(true); });
  window.webContents.on('render-process-gone', () => { regions = []; dragging = false; setPassthrough(true); });
  window.on('blur', () => { if (!dragging) command('dismiss'); });
  window.on('close', event => { if (!quitting) { event.preventDefault(); hidePlanet(); } });
  window.once('ready-to-show', () => { window.showInactive(); });
  if (process.env.PLANET_DEV_URL) {
    const url = new URL(process.env.PLANET_DEV_URL);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('PLANET_DEV_URL must point to a local development server.');
    if (process.argv.includes('--test')) url.searchParams.set('test', '');
    window.loadURL(url.href);
  } else window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
    query: process.argv.includes('--test') ? { test: '' } : undefined,
  });
  // Native polling works even when the transparent window receives no DOM events.
  pointerTimer = setInterval(updatePointer, 40);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) showPlanet(); });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    const icon = nativeImage.createFromPath(path.join(__dirname, 'tray.png')).resize({ width: 18, height: 18 });
    icon.setTemplateImage(process.platform === 'darwin');
    tray = new Tray(icon);
    tray.setToolTip('微缩星球 · 拖动旋转，Shift＋拖动移动，滚轮缩放');
    tray.on('click', () => tray.popUpContextMenu());
    rebuildTray();
    app.dock?.hide();
    const trusted = event => event.sender === window?.webContents && event.senderFrame === window.webContents.mainFrame;
    ipcMain.on('planet:regions', (event, value) => { if (trusted(event)) { regions = validRegions(value); updatePointer(); } });
    ipcMain.on('planet:dragging', (event, value) => { if (trusted(event)) { dragging = value === true; updatePointer(); } });
    ipcMain.on('planet:hide', event => { if (trusted(event)) hidePlanet(); });
    const fitDisplay = () => {
      const display = screen.getAllDisplays().find(d => d.id === activeDisplayId) || screen.getPrimaryDisplay();
      moveToDisplay(display);
    };
    screen.on('display-removed', fitDisplay);
    screen.on('display-metrics-changed', fitDisplay);
    screen.on('display-added', rebuildTray);
    app.on('activate', showPlanet);
  }).catch(error => { console.error(error); app.exit(1); });
  // Give the renderer a final save before destroying it (also handled by pagehide).
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault(); quitting = true; command('save');
    clearInterval(pointerTimer);
    setTimeout(() => app.quit(), 150);
  });
  app.on('will-quit', () => { clearInterval(pointerTimer); tray?.destroy(); });
  process.on('SIGTERM', () => app.quit());
  process.on('SIGINT', () => app.quit());
  app.on('window-all-closed', () => app.quit());
}
