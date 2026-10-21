import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Tone-map straight color, then restore premultiplication for the transparent desktop window.
 * Mapping already-premultiplied color makes faint rain and MSAA edges brighter than their alpha.
 */
export class CompanionOutputPass extends OutputPass {
  constructor() {
    super();
    // This is the terminal pass. Swapping here makes EffectComposer allocate a second full MSAA target next frame.
    this.needsSwap = false;
    this.material.fragmentShader = this.material.fragmentShader.replace(
      'gl_FragColor = texture2D( tDiffuse, vUv );',
      `gl_FragColor = texture2D( tDiffuse, vUv );
       gl_FragColor.rgb = gl_FragColor.a > 0.00001 ? gl_FragColor.rgb / gl_FragColor.a : vec3(0.0);`,
    ).replace(/\n\s*}\s*$/, '\n gl_FragColor.rgb *= gl_FragColor.a;\n }');
  }
}
