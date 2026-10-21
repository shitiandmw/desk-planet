export type HitRegion = { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number };

export interface DesktopBridge {
  updateRegions(regions: HitRegion[]): void;
  setDragging(dragging: boolean): void;
  hide(): void;
  onCommand(callback: (command: 'dismiss' | 'reset' | 'pause' | 'save') => void): () => void;
}

declare global { interface Window { planetDesktop?: DesktopBridge } }

export const desktop = window.planetDesktop;
// The optional classic view remains useful for the full-screen game and its gameplay regression.
export const COMPANION = !!desktop || !new URLSearchParams(location.search).has('classic');
