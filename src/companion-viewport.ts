import type { CompanionLayout, Viewport } from './companion-layout';

export const COMPANION_RENDER_SIZE = 1152;
export const COMPANION_MAX_RENDER_PIXELS = 2048 * 2048;
export const COMPANION_MAX_RENDER_EDGE = 2880;

/** The camera views a crop of a virtual square; off-screen padding never needs GPU storage. */
export function companionViewport(layout: CompanionLayout, viewport: Viewport, frameScale: number) {
  const fullSize = layout.size * frameScale;
  const fullLeft = layout.x - fullSize / 2, fullTop = layout.y - fullSize / 2;
  const left = Math.max(0, fullLeft), top = Math.max(0, fullTop);
  const width = Math.max(1, Math.min(viewport.width, fullLeft + fullSize) - left);
  const height = Math.max(1, Math.min(viewport.height, fullTop + fullSize) - top);
  return { left, top, width, height, fullSize, offsetX: left - fullLeft, offsetY: top - fullTop };
}

/** Small companions retain their supersampling; close-ups use a bounded, screen-sized render target. */
export function companionBufferSize(layout: CompanionLayout, viewport: Viewport, frameScale: number, pixelRatio: number) {
  const { width, height } = companionViewport(layout, viewport, frameScale);
  const density = Math.min(
    Math.max(COMPANION_RENDER_SIZE / layout.size, Math.min(2, pixelRatio)),
    COMPANION_MAX_RENDER_EDGE / Math.max(width, height),
    Math.sqrt(COMPANION_MAX_RENDER_PIXELS / (width * height)),
  );
  // Quantize allocations. These are applied only after interaction settles, in the frame that draws them.
  const quantize = (pixels: number) => Math.max(16, Math.floor((pixels + 1e-8) / 16) * 16);
  return { width: quantize(width * density), height: quantize(height * density) };
}
