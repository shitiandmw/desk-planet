import { COMPANION_MIN_FRAME_SCALE, COMPANION_PLANET_DIAMETER } from './companion-framing';

/** CSS-pixel layout shared by the desktop overlay and the browser preview. */
export interface CompanionLayout { x: number; y: number; size: number }
export interface Viewport { width: number; height: number }
export const COMPANION_STORAGE = 'mini-planet-companion-layout-v1';
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function fitLayout(layout: CompanionLayout, viewport: Viewport, frameScale = COMPANION_MIN_FRAME_SCALE): CompanionLayout {
  // Enough magnification to cover all four corners, with extra room to inspect the surface.
  const maxSize = Math.max(200, Math.hypot(viewport.width, viewport.height) * 1.25 / COMPANION_PLANET_DIAMETER);
  const size = clamp(layout.size, 200, maxSize);
  const halfFrame = size * frameScale / 2;
  const fitCenter = (position: number, length: number) => {
    const available = Math.max(0, length / 2 - 12);
    // Keep small scenes intact. Once the frame exceeds the screen, allow panning while keeping its center reachable.
    const travel = halfFrame <= available ? available - halfFrame : Math.min(halfFrame - available, Math.max(0, length / 2 - 64));
    return clamp(position, length / 2 - travel, length / 2 + travel);
  };
  return {
    size,
    x: fitCenter(layout.x, viewport.width),
    y: fitCenter(layout.y, viewport.height),
  };
}

export function defaultLayout(viewport: Viewport): CompanionLayout {
  const size = Math.max(200, Math.min(360, (viewport.width - 24) / COMPANION_MIN_FRAME_SCALE, (viewport.height - 168) / COMPANION_MIN_FRAME_SCALE));
  return fitLayout({ x: viewport.width - 210, y: viewport.height * .42, size }, viewport);
}

export function restoreLayout(raw: string | null, viewport: Viewport): CompanionLayout {
  try {
    const saved = JSON.parse(raw || 'null');
    if (saved && ['x', 'y', 'size'].every(key => typeof saved[key] === 'number' && Number.isFinite(saved[key]))) {
      return fitLayout(saved, viewport);
    }
  } catch { /* A damaged preference must never prevent opening the game. */ }
  return defaultLayout(viewport);
}

export function zoomLayout(layout: CompanionLayout, delta: number, viewport: Viewport, frameScale = COMPANION_MIN_FRAME_SCALE): CompanionLayout {
  return fitLayout({ ...layout, size: layout.size * Math.exp(-clamp(delta, -100, 100) * .0012) }, viewport, frameScale);
}

/** Exponential convergence has the same feel at different frame rates, with no overshoot at the screen edges. */
export function smoothLayout(current: CompanionLayout, target: CompanionLayout, seconds: number): CompanionLayout {
  const blend = 1 - Math.exp(-Math.max(0, seconds) / .075);
  const step = (from: number, to: number) => Math.abs(from - to) < .05 ? to : from + (to - from) * blend;
  return { x: step(current.x, target.x), y: step(current.y, target.y), size: step(current.size, target.size) };
}

/** Follow the globe until its lower edge leaves the screen, then pin the dock inside the viewport. */
export function dockLayout(layout: CompanionLayout, viewport: Viewport, frameScale = COMPANION_MIN_FRAME_SCALE, height = 128) {
  const width = Math.min(340, viewport.width - 24);
  const top = clamp(layout.y + layout.size * frameScale / 2 + 8, 12, Math.max(12, viewport.height - height - 12));
  return { left: clamp(layout.x - width / 2, 12, viewport.width - width - 12), top, width,
    maxHeight: Math.max(88, viewport.height - top - 12) };
}
