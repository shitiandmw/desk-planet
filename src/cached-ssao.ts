import { CustomBlending, type Camera, type Scene, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Reuse the same occlusion texture between small ambient motions; view/layout changes invalidate immediately. */
export class CachedSSAOPass extends SSAOPass {
  private stale = true;
  private lastUpdate = -Infinity;
  private cachedQuad: FullScreenQuad;
  updates = 0;
  reuses = 0;
  refreshInterval = 1000 / 6;

  constructor(scene: Scene, camera: Camera) {
    super(scene, camera, 1, 1, 16);
    this.cachedQuad = new FullScreenQuad(this.copyMaterial);
  }

  invalidate() { this.stale = true; }

  override render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    const now = performance.now();
    if (this.stale || now - this.lastUpdate >= this.refreshInterval || this.output !== SSAOPass.OUTPUT.Default) {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
      this.lastUpdate = now; this.stale = false; this.updates++;
      return;
    }
    this.copyMaterial.uniforms.tDiffuse.value = this.blurRenderTarget.texture;
    this.copyMaterial.blending = CustomBlending;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    this.cachedQuad.render(renderer);
    renderer.autoClear = autoClear;
    this.reuses++;
  }

  override dispose() { super.dispose(); this.cachedQuad.dispose(); }
}
