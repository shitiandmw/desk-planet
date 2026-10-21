import './companion.css';
import { COMPANION_STORAGE, defaultLayout, dockLayout, fitLayout, restoreLayout, smoothLayout, zoomLayout, type CompanionLayout } from './companion-layout';
import { desktop, type HitRegion } from './desktop';
import type { WoodlandScene } from './scene';
import { COMPANION_MIN_FRAME_SCALE } from './companion-framing';

type Icon = (name: string, size?: number) => string;
const element = (id: string) => document.getElementById(id)!;

/** Owns the small companion's presentation and pointer gestures; economic actions stay in main.ts. */
export class PlanetCompanion {
  private layout: CompanionLayout;
  private visualLayout: CompanionLayout;
  private presentedLayout: CompanionLayout;
  private scene?: WoodlandScene;
  private shell: HTMLElement;
  private body: HTMLElement;
  private tools: HTMLElement;
  private journal: HTMLElement;
  private resources: HTMLElement;
  private gesture: { id: number; x: number; y: number; lastX: number; lastY: number; start: CompanionLayout; rotate: boolean; moved: boolean } | null = null;
  private regionKey = '';
  private zooming = false;
  private zoomTime = 0;
  private opened = false;
  private expanded = false;
  private sheet: 'management' | 'journal' | 'tools' | null = null;
  private viewport = () => ({ width: innerWidth, height: innerHeight });
  private get frameScale() { return this.scene?.companionFrameScale ?? COMPANION_MIN_FRAME_SCALE; }

  constructor(icon: Icon, private cancelPreview: () => void) {
    document.documentElement.classList.add('companion');
    document.body.classList.add('companion');
    document.body.classList.toggle('native-desktop', !!desktop);
    let saved: string | null = null;
    try { saved = localStorage.getItem(COMPANION_STORAGE); } catch { /* Use defaults when storage is unavailable. */ }
    this.layout = restoreLayout(saved, this.viewport());
    this.visualLayout = { ...this.layout };
    this.presentedLayout = { ...this.layout };
    const ui = element('interface');
    this.shell = document.createElement('section');
    this.shell.id = 'companion-shell';
    this.shell.setAttribute('aria-label', '星球操作面板');
    this.shell.hidden = true;
    this.shell.innerHTML = `
      <header class="companion-heading"><span class="companion-mark">${icon('globe',18)}</span>
        <div><strong>微缩星球</strong><span id="companion-status">陪你慢慢生长</span></div>
        <button class="companion-collapse" data-companion="dismiss" aria-label="收起星球面板" title="收起 · Esc">${icon('close',14)}</button>
      </header>
      <nav class="companion-nav" aria-label="星球快捷操作"></nav>
      <div id="companion-body" hidden>
        <div id="companion-stocks"></div>
        <section id="companion-tools" hidden>
          <div class="companion-section-heading"><span>陪伴设置</span><button class="tool small" data-companion="back" aria-label="收起设置">${icon('close',14)}</button></div>
          <p class="companion-instructions">拖动旋转 · 滚轮缩放<br>Shift ＋ 拖动移动位置 · Esc 收起面板</p>
          <div class="companion-setting"><span>生长节奏</span><div id="companion-time"></div></div>
          <div class="companion-setting"><span>星球天气</span><div id="companion-weather"></div></div>
          <div class="companion-setting"><span>观察</span><div id="companion-views"></div></div>
          <div class="companion-tool-grid">
            <button data-action="auto-rotate">${icon('globe',16)}缓缓自转</button>
            <button data-action="light">${icon('sun',16)}晨光 / 夕照</button>
            <button data-action="photo">${icon('camera',16)}保存星球图片</button>
            <button data-companion="reset">${icon('reset',16)}恢复位置大小</button>
            <button data-action="help">${icon('help',16)}帮助与存档</button>
            ${desktop ? `<button data-companion="hide">${icon('minus',16)}暂时隐藏星球</button>` : ''}
          </div>
          <p class="companion-save-note">${desktop ? '进度自动保存。工作时继续生长，隐藏或退出后停止。可从菜单栏 / 托盘找回星球。' : '进度自动保存。桌面版可透明悬浮在工作软件上。'}</p>
        </section>
      </div>`;
    ui.append(this.shell);
    this.body = element('companion-body');
    ui.append(this.body);
    this.tools = element('companion-tools');
    this.resources = element('companion-stocks');
    this.journal = document.querySelector<HTMLElement>('.journey')!;
    this.journal.hidden = true;
    const nav = this.shell.querySelector('nav')!;
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.game-controls > button'))) nav.append(button);
    nav.insertAdjacentHTML('beforeend', `<button data-companion="journal" aria-label="聚落目标">${icon('tree',18)}目标</button><button data-companion="tools" aria-label="陪伴设置">${icon('sun',18)}设置</button>`);
    this.resources.append(document.querySelector('.resources')!, element('industry-stock'));
    this.body.append(this.journal, element('management'), element('food-alert'));
    element('management').hidden = true;
    element('companion-time').append(document.querySelector('.time-controls')!);
    element('companion-weather').append(document.querySelector('.weather-dock')!);
    element('companion-views').append(document.querySelector('.view-controls')!);
    this.journal.insertAdjacentHTML('afterbegin', `<div class="companion-section-heading"><span>聚落目标</span><button class="tool small" data-companion="back" aria-label="收起目标">${icon('close',14)}</button></div>`);
    ui.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-companion]');
      if (!button) return;
      switch (button.dataset.companion) {
        case 'dismiss': this.dismiss(); break;
        case 'back': this.closeSheet(); break;
        case 'tools': this.cancelPreview(); this.showSheet('tools'); break;
        case 'journal': this.cancelPreview(); this.showSheet('journal'); break;
        case 'reset': this.reset(); break;
        case 'hide': desktop?.hide(); break;
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!(event.target as HTMLElement).closest('#world, #companion-shell, #companion-body, dialog')) this.dismiss();
    });
    const fitViewport = () => { this.layout = fitLayout(this.layout, this.viewport(), this.frameScale); this.place(); };
    window.addEventListener('resize', fitViewport);
    window.visualViewport?.addEventListener('resize', fitViewport);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) fitViewport(); });
    // Observe actual viewport geometry too: display scaling / device emulation can change it without a window resize event.
    new ResizeObserver(fitViewport).observe(document.documentElement);
    window.addEventListener('pagehide', () => this.saveLayout());
    // Size, dialog and hidden-state changes are also native hit-test changes.
    new ResizeObserver(() => this.syncRegions()).observe(this.shell);
    new ResizeObserver(() => this.syncRegions()).observe(this.body);
    new MutationObserver(() => this.syncRegions()).observe(element('app'), { subtree: true, attributes: true, attributeFilter: ['hidden', 'open', 'class'] });
    this.place();
  }

  attach(scene: WoodlandScene) {
    this.scene = scene;
    scene.onBeforeCompanionFrame = time => { if (this.zooming) this.animateZoom(time); };
    scene.onCompanionFrameChange = () => {
      this.stopZoom(); this.layout = fitLayout(this.layout, this.viewport(), this.frameScale); this.place(); this.saveLayout();
    };
    this.layout = fitLayout(this.layout, this.viewport(), this.frameScale); this.place();
    const canvas = scene.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'button');
    canvas.setAttribute('aria-label', '微缩星球：点击展开操作，拖动旋转，滚轮缩放，Shift 加拖动移动位置');
    canvas.setAttribute('aria-controls', 'companion-shell');
    canvas.setAttribute('aria-expanded', 'false');
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => {
      if (this.gesture || event.button !== 0) return;
      if (!this.onGlobe(event.clientX, event.clientY)) { this.dismiss(); return; }
      this.stopZoom();
      this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY,
        start: { ...this.visualLayout }, rotate: !event.shiftKey, moved: false };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
      desktop?.setDragging(true);
      scene.setCompanionInteracting(true);
    });
    canvas.addEventListener('pointermove', event => {
      const gesture = this.gesture;
      if (!gesture || event.pointerId !== gesture.id) return;
      if (!gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) {
        gesture.moved = true;
        if (!gesture.rotate) { this.layout = { ...gesture.start }; this.dismiss(); }
      }
      if (gesture.moved) {
        if (gesture.rotate) scene.rotateCompanion(gesture.lastX, gesture.lastY, event.clientX, event.clientY);
        else {
          this.layout = fitLayout({ ...gesture.start, x: gesture.start.x + event.clientX - gesture.x, y: gesture.start.y + event.clientY - gesture.y }, this.viewport(), this.frameScale);
          this.place();
        }
      }
      gesture.lastX = event.clientX; gesture.lastY = event.clientY;
    });
    const release = (event?: PointerEvent) => {
      const gesture = this.gesture;
      if (!gesture || (event && event.pointerId !== gesture.id)) return;
      this.gesture = null;
      if (canvas.hasPointerCapture(gesture.id)) canvas.releasePointerCapture(gesture.id);
      desktop?.setDragging(false);
      scene.setCompanionInteracting(false);
      canvas.style.cursor = event?.shiftKey ? 'move' : 'grab';
      this.saveLayout();
      if (event?.type === 'pointerup' && !gesture.moved) {
        if (scene.preview) scene.pickCompanion(event.clientX, event.clientY, false);
        else if (!this.opened) this.open();
        else scene.pickCompanion(event.clientX, event.clientY, true);
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('lostpointercapture', release);
    window.addEventListener('blur', () => { release(); this.dismiss(); });
    canvas.addEventListener('wheel', event => {
      if (!this.onGlobe(event.clientX, event.clientY)) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (this.gesture) return;
      this.layout = zoomLayout(this.layout, delta, this.viewport(), this.frameScale);
      if (scene.reducedMotion) { this.place(); this.saveLayout(); return; }
      if (!this.zooming) {
        this.zoomTime = performance.now(); scene.setCompanionInteracting(true);
        this.zooming = true;
      }
    }, { passive: false });
    canvas.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.opened ? this.dismiss() : this.open(); }
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        this.layout = fitLayout({ ...this.layout, x: this.layout.x + (event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0),
          y: this.layout.y + (event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0) }, this.viewport(), this.frameScale);
        this.place(); this.saveLayout();
      }
    });
    canvas.style.cursor = 'grab';
    this.syncRegions();
  }

  private animateZoom = (time: number) => {
    const next = smoothLayout(this.presentedLayout, this.layout, Math.min((time - this.zoomTime) / 1000, .05));
    this.zoomTime = time; this.place(next);
    if (next.x === this.layout.x && next.y === this.layout.y && next.size === this.layout.size) {
      this.zooming = false; this.scene?.setCompanionInteracting(false); this.saveLayout();
    }
  };
  private stopZoom() {
    if (!this.zooming) return;
    this.zooming = false;
    this.layout = { ...this.presentedLayout }; this.scene?.setCompanionInteracting(false);
  }

  get visible() { return this.opened; }
  open() { this.opened = true; this.shell.hidden = false; this.scene?.renderer.domElement.setAttribute('aria-expanded', 'true'); this.place(); }
  dismiss() {
    this.cancelPreview();
    if(this.scene?.selected)this.scene.selectBuilding(null);
    this.closeSheet(); this.opened = false; this.shell.hidden = true;
    element('toast').classList.remove('visible');
    this.scene?.renderer.domElement.setAttribute('aria-expanded', 'false');
    this.syncRegions();
  }
  closeSheet() {
    this.expanded = false; this.sheet = null; this.body.hidden = true;
    element('management').hidden = true; this.journal.hidden = true; this.tools.hidden = true;
    this.place();
  }
  showManagement() { this.showSheet('management'); }
  private showSheet(sheet: 'management' | 'journal' | 'tools') {
    this.open(); this.expanded = true; this.sheet = sheet; this.body.hidden = false;
    this.tools.hidden = sheet !== 'tools'; this.journal.hidden = sheet !== 'journal';
    this.resources.hidden = sheet !== 'management'; element('management').hidden = sheet !== 'management';
    this.body.dataset.sheet = sheet;
    this.body.scrollTop = 0; this.place();
  }
  reset() { this.dismiss(); this.layout = fitLayout(defaultLayout(this.viewport()), this.viewport(), this.frameScale); this.scene?.setView('planet'); this.place(); this.saveLayout(); }
  enlarge() { this.layout = fitLayout({ ...this.layout, size: Math.max(this.layout.size, 500) }, this.viewport(), this.frameScale); this.place(); this.saveLayout(); }
  updateStatus(population: number, paused: boolean, speed: number) {
    const status = element('companion-status');
    const text = paused ? `${population} 位居民 · 已暂停` : `${population} 位居民 · ${speed === 1 ? '慢慢生长' : speed + '× 生长'}`;
    if (status.textContent !== text) status.textContent = text;
    this.tools.querySelector('[data-action="auto-rotate"]')?.setAttribute('aria-pressed', String(this.scene?.autoRotate));
    for (const button of Array.from(this.shell.querySelectorAll<HTMLButtonElement>('[data-companion="journal"], [data-companion="tools"]'))) {
      button.classList.toggle('active', button.dataset.companion === this.sheet);
    }
  }
  private onGlobe(x: number, y: number) { return Math.hypot(x - this.visualLayout.x, y - this.visualLayout.y) < this.visualLayout.size * .41; }
  private place(layout = this.layout) {
    this.presentedLayout = { ...layout };
    const width = Math.min(340, innerWidth - 24);
    const halfFrame = layout.size * this.frameScale / 2;
    const spaceLeft = layout.x - halfFrame - 24;
    const spaceRight = innerWidth - layout.x - halfFrame - 24;
    const closeup = layout.size * this.frameScale > Math.min(innerWidth - 24, innerHeight - 168);
    const noSideSpace = Math.max(spaceLeft, spaceRight) < width;
    const stacked = this.expanded && noSideSpace && !closeup;
    const overlay = this.expanded && noSideSpace && closeup;
    this.visualLayout = { ...layout };
    if (stacked) {
      const size = Math.max(100, Math.min(layout.size, 280, (innerHeight - 380) / this.frameScale, (innerWidth - 24) / this.frameScale));
      this.visualLayout = { x: innerWidth / 2, y: size * this.frameScale / 2 + 12, size };
    }
    const { x, y, size } = this.visualLayout;
    Object.assign(element('world').style, { left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px` });
    const dock = dockLayout(this.visualLayout, this.viewport(), this.frameScale, this.shell.offsetHeight || 128);
    Object.assign(this.shell.style, { left: `${dock.left}px`, top: `${dock.top}px`, width: `${dock.width}px`, maxHeight: `${innerHeight - dock.top - 12}px` });
    const left = stacked || overlay ? dock.left : spaceLeft >= width ? x - halfFrame - width - 12 : x + halfFrame + 12;
    const maxHeight = overlay ? Math.min(520, dock.top - 22) : 520;
    const top = overlay ? Math.max(12, dock.top - maxHeight - 10) : stacked ? dock.top + this.shell.getBoundingClientRect().height + 10 : Math.max(12, Math.min(y - halfFrame, innerHeight - 460));
    Object.assign(this.body.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, maxHeight: `${Math.max(0, Math.min(maxHeight, innerHeight - top - 12))}px` });
    element('toast').style.left = `${dock.left + dock.width / 2}px`;
    this.scene?.resize();
    this.syncRegions();
  }
  private saveLayout() { try { localStorage.setItem(COMPANION_STORAGE, JSON.stringify(this.layout)); } catch { /* Geometry is optional; game saves report their own errors. */ } }
  private syncRegions() {
    if (!desktop) return;
    const regions: HitRegion[] = [{ kind: 'circle', x: this.visualLayout.x, y: this.visualLayout.y, radius: this.visualLayout.size * .41 }];
    for (const target of [this.shell, this.body, ...Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')), document.querySelector<HTMLElement>('#loading.failed')]) {
      if (!target || target.hidden) continue;
      const r = target.getBoundingClientRect();
      if (r.width && r.height) regions.push({ kind: 'rect', x: r.x, y: r.y, width: r.width, height: r.height });
    }
    const key = JSON.stringify(regions);
    if (key !== this.regionKey) { this.regionKey = key; desktop.updateRegions(regions); }
  }
}
