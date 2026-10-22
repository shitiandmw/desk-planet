import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { CompanionOutputPass } from './companion-output';
import { companionBufferSize, companionViewport } from './companion-viewport';
import { CachedSSAOPass } from './cached-ssao';
import { companionFrameFov, companionFrameScale, COMPANION_MIN_FRAME_SCALE } from './companion-framing';
import { vec } from './craft';
import { makeTerrain } from './terrain';
import { BACK_LAND, dragRotation, NORTH, PLANET_RADIUS, placeOnPlanet } from './planet-surface';
import { makePlanetNature } from './planet-nature';
import { makeTree, Tree, treeLocations } from './trees';
import { SceneryClearance } from './scenery';
import { stump } from './props';
import { makeDecor } from './decor';
import { GameSimulation, type ActionResult } from './simulation';
import { BUILDINGS, type BuildingType, type Direction } from './game-data';
import { ALL_SITES, SITE_BY_ID, directionVector, nearestSite } from './world-layout';
import { SettlementView, onSurface } from './settlement-view';
import { M, setBuildingEnvironment, setEveningLights } from './building-kit';
import { PlanetWeather } from './weather';
import type { WeatherMode } from './weather-state';

export type ViewName = 'planet' | 'grove' | 'back' | 'coast' | 'tree' | 'worksite';
export class WoodlandScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, .1, 180);
  controls: OrbitControls;
  composer: EffectComposer;
  ao: SSAOPass;
  world = new THREE.Group();
  trees: Tree[] = [];
  readonly settlement: SettlementView;
  preview: { type: BuildingType; siteId: string | null; direction: Direction; yaw: number; error: string | null } | null = null;
  wind = true;
  autoRotate = false;
  /** Instanced background trees (baked prototypes, no per-tree sway). */
  backgroundTrees = 0;
  private scenery = new SceneryClearance();
  readonly weather: PlanetWeather;
  private warmLight = false;
  private localSun = new THREE.Vector3();
  private inverseWorld = new THREE.Quaternion();
  private daySun = new THREE.Color('#fff0d0');
  private eveningSun = new THREE.Color('#ffdda5');
  private stormSun = new THREE.Color('#cad8e1');
  private clearSky = new THREE.Color('#eeede4');
  private stormSky = new THREE.Color('#c9d3db');
  private surface: ReturnType<typeof makeTerrain>;
  private readonly initialRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.5, -.25, 0));
  private dragPointer: number | null = null;
  private activePointers = new Set<number>();
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  photo = false;
  onSelect?: (id: string | null) => void;
  onPreview?: () => void;
  onFrame?: () => void;
  onCompanionFrameChange?: () => void;
  onBeforeCompanionFrame?: (timestamp: number) => void;
  companionFrameScale = COMPANION_MIN_FRAME_SCALE;
  private companionViewDirty = true;
  private companionProjectionKey = '';
  private companionBuffer = { width: 1, height: 1 };
  private companionResizeAfter = 0;
  private framingDirty = false;
  selected: string | null = null;
  private ring: THREE.Mesh;
  private sun: THREE.DirectionalLight;
  private fill: THREE.HemisphereLight;
  private ray = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private animation = 0;
  private previous = 0;
  private cameraMove: { start: THREE.Vector3; end: THREE.Vector3; targetStart: THREE.Vector3; targetEnd: THREE.Vector3; rotationStart: THREE.Quaternion; rotationEnd: THREE.Quaternion; time: number } | null = null;
  private disposed = false;
  private phase = 0;
  private resizeObserver: ResizeObserver;
  /** Render resolution: up to 2× on high-density screens, stepped down while frames run long. */
  private normalBudget = Math.min(window.devicePixelRatio, 2);
  private frameAverage = 16;
  private slowTime = 0;
  private shadowAge = 0;
  private shadowRotation = new THREE.Quaternion(0, 0, 0, 0);
  private aoRotation = new THREE.Quaternion(0, 0, 0, 0);
  private shadowFit = '';
  private fitRay = new THREE.Ray();
  private fitPoint = new THREE.Vector3();
  private fitSphere = new THREE.Sphere(new THREE.Vector3(), PLANET_RADIUS);
  private dirty = true;
  private companionInteracting = false;

  constructor(public host: HTMLElement, public simulation: GameSimulation, public companion = false) {
    // Companion MSAA resolves the geometry's alpha silhouette before output; the final full-screen quad needs no MSAA.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: companion, powerPreference: companion ? 'low-power' : 'high-performance' });
    if (companion) this.renderer.setClearColor(0x000000, 0);
    if (companion) this.normalBudget = 1;
    this.renderer.setPixelRatio(this.normalBudget);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = companion ? THREE.PCFSoftShadowMap : THREE.VSMShadowMap;
    // Shadows are refreshed explicitly (see frame): the SSAO prepass renders the scene a second time and would
    // otherwise redraw and re-blur the shadow map with it.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.renderer.domElement.setAttribute('aria-label', '完整三维星球。拖动可向任意方向转动星球，滚轮缩放，点击建筑管理，进入建设后点击地面选址。');
    this.renderer.domElement.setAttribute('role', 'img');
    host.append(this.renderer.domElement);
    this.scene.background = companion ? null : new THREE.Color('#eeede4');
    this.scene.fog = new THREE.Fog('#eeede4', PLANET_RADIUS * 8, PLANET_RADIUS * 16);
    this.scene.add(this.world);
    this.fill = new THREE.HemisphereLight('#dbe8ef', '#9c8d64', 1.9); this.scene.add(this.fill);
    this.scene.add(new THREE.AmbientLight('#f5e8ce', companion ? .12 : .32));
    this.sun = new THREE.DirectionalLight('#fff0d0', companion ? 4.2 : 3.3); this.positionSun(); this.sun.target.position.set(0, 0, 0);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -PLANET_RADIUS - 4, right: PLANET_RADIUS + 4, top: PLANET_RADIUS + 5, bottom: -PLANET_RADIUS - 4, near: .5, far: PLANET_RADIUS * 8 });
    this.sun.shadow.bias = -.00012; this.sun.shadow.normalBias = .018; this.sun.shadow.radius = 3; this.sun.shadow.blurSamples = 6;
    this.scene.add(this.sun, this.sun.target);
    const bounce = new THREE.DirectionalLight(companion ? '#b1d4ed' : '#e4edd7', companion ? .35 : .55); bounce.position.set(5, 4, -6); this.scene.add(bounce);

    this.weather = new PlanetWeather(this.world);
    this.surface = makeTerrain(this.world, this.renderer, this.weather.shadowUniform);
    this.surface.oceanSurface.reflectionStrength = companion ? .68 : 1;
    this.world.name = 'rotatable-complete-planet';
    this.world.quaternion.copy(this.initialRotation);
    treeLocations.forEach((t, i) => {
      const tree = makeTree(t.seed, i);
      placeOnPlanet(tree.root, t.x, t.z, i * 1.7, t.scale * .8);
      this.world.add(tree.root); this.trees.push(tree);
    });
    for (const [x, z, seed] of [[-1.7, 1.4, 3], [3, .5, 6]]) { const s = stump(seed); placeOnPlanet(s, x, z); this.world.add(s); }
    makeDecor(this.world, this.scenery);
    this.backgroundTrees = makePlanetNature(this.world, this.scenery);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.97, 1.03, 64), new THREE.MeshBasicMaterial({ color: '#e2c77f', side: THREE.DoubleSide, transparent: true, opacity: .9, depthWrite: false }));
    this.ring.visible = false; this.world.add(this.ring);

    setBuildingEnvironment(this.surface.oceanSurface.environment);
    this.settlement = new SettlementView(this.world, this.simulation);
    this.settlement.onLayout = footprints => { this.scenery.apply(footprints); this.dirty = true; this.framingDirty = true; };
    this.scenery.apply(this.settlement.footprints);
    if (companion) this.companionFrameScale = companionFrameScale(Math.max(this.settlement.framingRadius,this.weather.framingRadius));
    this.sharpenTextures();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = .075;
    this.controls.maxDistance = PLANET_RADIUS * 6.8; this.updateZoomLimit();
    this.controls.enableRotate = false; this.controls.enablePan = false;
    this.controls.enabled = !companion;
    this.controls.addEventListener('start', () => { this.cameraMove = null; });
    this.setView('planet', false);
    const target = companion ? new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, samples: Math.min(4, this.renderer.capabilities.maxSamples),
    }) : undefined;
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = companion ? new CachedSSAOPass(this.scene, this.camera) : new SSAOPass(this.scene, this.camera, 1, 1, 16);
    this.ao.kernelRadius = .28; this.ao.minDistance = .002; this.ao.maxDistance = .16;
    // Occlusion is blurred anyway; computing it at half resolution quarters its cost.
    const setAOSize = this.ao.setSize.bind(this.ao);
    this.ao.setSize = (width: number, height: number) => setAOSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
    this.hideTransparentFromAO();
    this.composer.addPass(this.ao);
    if (companion) this.composer.addPass(new CompanionOutputPass());
    else { this.composer.addPass(new OutputPass()); this.composer.addPass(new SMAAPass()); }
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
    // The desktop companion renders only the current settlement. Compile later-era materials when first used.
    if (!companion) this.warmUpMaterials();
    if (!companion) this.bindPicking();
    this.animation = requestAnimationFrame(this.frame);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  resize() {
    if (this.companion) {
      // Apply CSS, camera crop and any buffer allocation together in the next rendered frame.
      this.companionViewDirty = true; this.dirty = true;
      return;
    }
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height; this.camera.fov = !this.companion && width < 760 ? 50 : 36;
    if (!this.companion && width < 760) this.camera.setViewOffset(width, height, 0, height * .08, width, height); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height); this.composer.setSize(width, height);
    this.dirty = true;
  }

  private updateCompanionViewport(timestamp: number) {
    if (this.companionViewDirty) {
      this.companionViewDirty = false;
      const rect = this.host.getBoundingClientRect();
      const layout = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width };
      const viewport = { width: innerWidth, height: innerHeight };
      const view = companionViewport(layout, viewport, this.companionFrameScale);
      const { fullSize, offsetX, offsetY, width, height } = view;
      Object.assign(this.renderer.domElement.style, {
        position: 'absolute', left: `${view.left - rect.left}px`, top: `${view.top - rect.top}px`, width: `${width}px`, height: `${height}px`,
      });
      // Scaling an uncropped square leaves the projection unchanged; panning a crop needs a new projection.
      const key = [this.companionFrameScale, offsetX / fullSize, offsetY / fullSize, width / fullSize, height / fullSize].map(n => n.toFixed(8)).join(',');
      if (key !== this.companionProjectionKey) {
        this.companionProjectionKey = key;
        this.camera.fov = companionFrameFov(this.companionFrameScale);
        this.camera.setViewOffset(fullSize, fullSize, offsetX, offsetY, width, height);
        this.ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
        this.ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
        this.dirty = true;
      }
      this.companionBuffer = companionBufferSize(layout, viewport, this.companionFrameScale, devicePixelRatio);
    }
    const { width, height } = this.companionBuffer;
    const canvas = this.renderer.domElement;
    if ((!this.companionInteracting && timestamp >= this.companionResizeAfter) || canvas.width <= 1) {
      if (canvas.width !== width || canvas.height !== height) {
        // Never reallocate during a gesture. Draw the new buffer in this same frame, so no cleared canvas is presented.
        this.renderer.setSize(width, height, false); this.composer.setSize(width, height); this.dirty = true;
      }
    }
  }

  setView(view: ViewName, animate = true) {
    const mobile = !this.companion && this.host.clientWidth < 760;
    const ratio = PLANET_RADIUS / 6;
    const whole = (mobile ? vec(10, 11, 34) : vec(9, 10, 27)).multiplyScalar(ratio * (mobile ? 1 : .97));
    const coastNormal = vec(-.34, .63, .7).normalize().applyQuaternion(this.initialRotation);
    const coastTarget = coastNormal.clone().multiplyScalar(PLANET_RADIUS + .05);
    const configs = {
      planet: { position: whole, target: vec(0, ratio, 0) },
      back: { position: whole, target: vec(0, ratio, 0) },
      grove: { position: (mobile ? vec(5, 10, 20) : vec(4, 10, 17)).multiplyScalar(ratio), target: vec(0, 4, 2).multiplyScalar(ratio) },
      coast: { position: coastTarget.clone().addScaledVector(coastNormal, mobile ? 19 : 14).add(vec(0,3,0)), target: coastTarget },
      tree: { position: vec(-5, 9, 13).multiplyScalar(ratio), target: vec(-1.5, 5.5, 2).multiplyScalar(ratio) },
      worksite: { position: vec(5, 9, 13).multiplyScalar(ratio), target: vec(.8, 4.8, 3).multiplyScalar(ratio) },
    };
    const c = configs[view];
    if (this.companion) {
      // Keep the complete globe centered while its CSS viewport changes size.
      c.position.copy(vec(9, 10, 27).normalize().multiplyScalar(PLANET_RADIUS * 4.4));
      c.target.set(0, 0, 0);
    }
    const rotation = view === 'back'
      ? new THREE.Quaternion().setFromUnitVectors(BACK_LAND, c.position.clone().normalize())
      : this.initialRotation.clone();
    if (animate && !this.reducedMotion) this.cameraMove = { start: this.camera.position.clone(), end: c.position, targetStart: this.controls.target.clone(), targetEnd: c.target, rotationStart: this.world.quaternion.clone(), rotationEnd: rotation, time: 0 };
    else { this.camera.position.copy(c.position); this.controls.target.copy(c.target); this.world.quaternion.copy(rotation); this.updateZoomLimit(); this.controls.update(); }
    this.dirty = true;
    this.selectBuilding(null);
  }

  setLight(warm: boolean) {
    this.warmLight = warm; this.dirty = true;
    setEveningLights(warm);
    this.positionSun();
    this.updateWeatherLighting();
  }

  setWeather(mode: WeatherMode) { this.weather.state.setMode(mode); this.dirty = true; }

  private positionSun() {
    // The key belongs to the scene: rotating the planet reveals lit faces, shaded faces and contact shadows.
    if (this.companion) this.sun.position.set(this.warmLight ? -22 : -18, this.warmLight ? 11 : 20, 10);
    else this.sun.position.set(this.warmLight ? -16 : -10, this.warmLight ? 9 : 16, 14);
    this.sun.position.multiplyScalar(PLANET_RADIUS / 6);
  }

  private updateWeatherLighting() {
    const { cloudiness, rain, wetness } = this.weather.state;
    this.sun.color.copy(this.warmLight ? this.eveningSun : this.daySun).lerp(this.stormSun, cloudiness * .6);
    this.sun.intensity = (this.companion ? (this.warmLight ? 3.8 : 4.2) : (this.warmLight ? 3.1 : 3.3)) * (1-cloudiness*.25-rain*.32);
    this.fill.intensity = (this.companion ? (this.warmLight ? .65 : .85) : (this.warmLight ? 1.45 : 1.9)) * (1-cloudiness*.15);
    const sky = (this.scene.fog as THREE.Fog).color.copy(this.clearSky).lerp(this.stormSky, rain*.42+cloudiness*.12);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(sky);
    const material = this.surface.terrain.material as THREE.MeshStandardMaterial;
    material.roughness = .97-wetness*.18; material.color.setRGB(1-wetness*.09,1-wetness*.07,1-wetness*.04);
  }

  selectBuilding(id: string | null) {
    if (id && !this.simulation.building(id)) return;
    this.selected = id; this.ring.visible = id !== null; this.dirty = true;
    const selectedBuilding=id?this.simulation.building(id):null;
    this.settlement.setCoverage(selectedBuilding?.type==='well'?SITE_BY_ID.get(selectedBuilding.siteId)!.direction:null);
    if (id) {
      const b = this.simulation.building(id)!, n = directionVector(SITE_BY_ID.get(b.siteId)!.direction);
      this.ring.position.copy(onSurface(n, .045));
      this.ring.quaternion.setFromUnitVectors(vec(0, 0, 1), n);
      this.ring.scale.setScalar(BUILDINGS[b.type].radius + .12);
    }
    this.onSelect?.(id);
  }

  focusDirection(direction: Direction) {
    this.autoRotate = false;
    const normal = vec(.18, .42, 1).normalize();
    const surfaceNormal = vec(.1, .83, .55).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(directionVector(direction), surfaceNormal);
    const targetEnd = this.companion ? vec(0, 0, 0) : surfaceNormal.clone().multiplyScalar(PLANET_RADIUS * .88);
    const end = this.companion ? vec(9, 10, 27).normalize().multiplyScalar(PLANET_RADIUS * 4.4)
      : targetEnd.clone().addScaledVector(normal, PLANET_RADIUS * (this.host.clientWidth < 760 ? 2.9 : 2.5));
    if (this.reducedMotion) { this.camera.position.copy(end); this.controls.target.copy(targetEnd); this.world.quaternion.copy(rotation); this.updateZoomLimit(); this.controls.update(); }
    else this.cameraMove = { start: this.camera.position.clone(), end, targetStart: this.controls.target.clone(), targetEnd, rotationStart: this.world.quaternion.clone(), rotationEnd: rotation, time: 0 };
    this.dirty = true;
  }
  focusBuilding(id: string) {
    const b = this.simulation.building(id); if (!b) return;
    this.focusDirection(SITE_BY_ID.get(b.siteId)!.direction); this.selectBuilding(id);
  }
  /** Close three-quarter view: the planet turns so the facility stands upright with its front toward the camera. */
  inspectBuilding(id: string) {
    if (this.companion) { this.focusBuilding(id); return; }
    const b = this.simulation.building(id), view = this.settlement.buildings.get(id); if (!b || !view) return;
    this.autoRotate = false;
    const definition = BUILDINGS[b.type], n = directionVector(SITE_BY_ID.get(b.siteId)!.direction);
    const facing = new THREE.Quaternion().setFromUnitVectors(NORTH, n).multiply(new THREE.Quaternion().setFromAxisAngle(NORTH, b.yaw));
    const height = definition.tall ? THREE.MathUtils.clamp(this.modelHeight(view.root), 1.5, 3.6) : .75, mobile = this.host.clientWidth < 760;
    const distance = (definition.radius * 3.4 + height * 1.25 + 1.1) * (mobile ? 1.35 : 1), elevation = .5;
    const azimuth = this.clearAzimuth(view.root, n, facing, height * .5, distance, elevation);
    const front = vec(Math.sin(azimuth), 0, Math.cos(azimuth)).applyQuaternion(facing), side = new THREE.Vector3().crossVectors(n, front);
    const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, n, front)).invert();
    const targetEnd = vec(0, onSurface(n).length() + height * .5, 0);
    const end = targetEnd.clone().add(vec(0, Math.sin(elevation), Math.cos(elevation)).multiplyScalar(distance));
    if (this.reducedMotion) { this.camera.position.copy(end); this.controls.target.copy(targetEnd); this.world.quaternion.copy(rotation); this.updateZoomLimit(); this.controls.update(); }
    else this.cameraMove = { start: this.camera.position.clone(), end, targetStart: this.controls.target.clone(), targetEnd, rotationStart: this.world.quaternion.clone(), rotationEnd: rotation, time: 0 };
    this.dirty = true; this.selectBuilding(id);
  }
  /** Top of the visible, opaque model in planet units; beams, holograms and glass halos don't count. */
  private modelHeight(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const local = root.matrixWorld.clone().invert(), box = new THREE.Box3(), part = new THREE.Box3(), matrix = new THREE.Matrix4();
    root.traverseVisible(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || [mesh.material].flat().every(m => m.transparent)) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      box.union(part.copy(mesh.geometry.boundingBox!).applyMatrix4(matrix.multiplyMatrices(local, mesh.matrixWorld)));
    });
    return box.isEmpty() ? 0 : box.max.y * root.scale.y;
  }
  /** Prefers a front three-quarter view, then sides and back, keeping the first that no tree, rock or neighbour hides. */
  private clearAzimuth(target: THREE.Object3D, n: THREE.Vector3, facing: THREE.Quaternion, lift: number, distance: number, elevation: number) {
    this.world.updateMatrixWorld(true);
    const people = new Set([...this.settlement.actors.values()].map(a => a.root as THREE.Object3D));
    const blockers = this.world.children.filter(o => o.visible && o !== target && o !== this.surface.terrain && o !== this.surface.ocean && !people.has(o));
    const origin = onSurface(n).addScaledVector(n, lift), from = this.world.localToWorld(origin.clone());
    let best = .62, clearest = -1;
    for (const azimuth of [.62, -.62, 1.2, -1.2, 0, 2.2, -2.2, Math.PI]) {
      const front = vec(Math.sin(azimuth), 0, Math.cos(azimuth)).applyQuaternion(facing);
      const eye = this.world.localToWorld(origin.clone().addScaledVector(n, Math.sin(elevation) * distance).addScaledVector(front, Math.cos(elevation) * distance));
      this.ray.set(from, eye.sub(from).normalize()); this.ray.far = distance;
      const hit = this.ray.intersectObjects(blockers, true).find(h => {
        const material = (h.object as THREE.Mesh).material as THREE.Material | undefined;
        return (h.object as THREE.Mesh).isMesh && !material?.transparent && h.object.name !== 'chimney-smoke';
      });
      const clear = hit ? hit.distance : Infinity;
      if (clear > clearest) { clearest = clear; best = azimuth; }
      if (!hit) break;
    }
    this.ray.far = Infinity;
    return best;
  }
  beginBuild(type: BuildingType) {
    this.selectBuilding(null); this.autoRotate = false;
    const site = this.simulation.availableSites(type)[0] || ALL_SITES[0];
    this.preview = { type, siteId: site.id, direction: site.direction, yaw: 0, error: null };
    this.updatePreview(); this.focusDirection(site.direction); this.onPreview?.();
  }
  chooseBuildSite(siteId: string) {
    const site = SITE_BY_ID.get(siteId); if (!site || !this.preview) return;
    this.preview.siteId = site.id; this.preview.direction = site.direction;
    this.updatePreview(); this.onPreview?.();
  }
  nextBuildSite() {
    if (!this.preview) return;
    const sites = this.simulation.availableSites(this.preview.type);
    if (!sites.length) return;
    const index = sites.findIndex(s => s.id === this.preview!.siteId);
    const site = sites[(index + 1) % sites.length];
    this.chooseBuildSite(site.id); this.focusDirection(site.direction);
  }
  rotatePreview() { if (this.preview) { this.preview.yaw = (this.preview.yaw + Math.PI / 2) % (Math.PI * 2); this.updatePreview(); this.onPreview?.(); } }
  updatePreview() {
    if (!this.preview) return;
    const p = this.preview;
    p.error = p.siteId ? this.simulation.placementError(p.type, p.siteId) : '这里无法建设，请点击陆地上的选址圆点';
    this.settlement.showPreview(p.type, p.direction, p.yaw, !p.error); this.dirty = true; this.framingDirty = true;
  }
  cancelBuild() { this.preview = null; this.settlement.hidePreview(); this.dirty = true; this.framingDirty = true; this.onPreview?.(); }
  confirmBuild(): ActionResult {
    this.updatePreview(); const p = this.preview;
    if (!p || p.error || !p.siteId) return { ok: false, reason: p?.error || '请先选择位置' };
    const result = this.simulation.build(p.type, p.siteId, p.yaw);
    if (result.ok) { this.cancelBuild(); this.syncSettlement(); this.selectBuilding(result.id!); }
    return result;
  }

  private bindPicking() {
    const canvas = this.renderer.domElement;
    let downX = 0, downY = 0, dragged = false;
    let previous = new THREE.Vector3();
    const trackball = (x: number, y: number) => {
      const rect = canvas.getBoundingClientRect(), radius = Math.min(rect.width, rect.height) * .4;
      const p = vec((x - rect.left - rect.width / 2) / radius, (rect.top + rect.height / 2 - y) / radius, 0);
      const length = p.lengthSq(); p.z = length < 1 ? Math.sqrt(1 - length) : 0;
      return p.normalize();
    };
    canvas.addEventListener('pointerdown', e => {
      this.activePointers.add(e.pointerId);
      if (e.button !== 0 || this.activePointers.size > 1) { this.dragPointer = null; dragged = true; return; }
      downX = e.clientX; downY = e.clientY; dragged = false;
      previous = trackball(e.clientX, e.clientY); this.dragPointer = e.pointerId;
      this.cameraMove = null; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', e => {
      if (this.dragPointer !== e.pointerId || this.activePointers.size !== 1) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) dragged = true;
      if (!dragged) return;
      const current = trackball(e.clientX, e.clientY);
      this.world.quaternion.premultiply(dragRotation(previous, current, this.camera.quaternion)).normalize();
      previous.copy(current); this.dirty = true;
    });
    const release = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId); this.dragPointer = null; canvas.style.cursor = 'grab';
      if (e.type === 'pointercancel' || dragged || e.button !== 0 || this.activePointers.size) return;
      const rect = canvas.getBoundingClientRect();
      this.pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
      this.world.updateMatrixWorld(true); this.ray.setFromCamera(this.pointer, this.camera);
      const occluder = this.ray.intersectObjects([this.surface.terrain, this.surface.ocean], false)[0];
      if (this.preview) {
        if (!occluder) return;
        const direction = this.world.worldToLocal(occluder.point.clone()).normalize().toArray() as Direction;
        const site = nearestSite(direction);
        this.preview.siteId = site?.id || null; this.preview.direction = site?.direction || direction;
        this.updatePreview(); this.onPreview?.(); return;
      }
      const hits = this.ray.intersectObjects(this.settlement.pickables, true);
      if (hits.length && (!occluder || hits[0].distance < occluder.distance + .02)) {
        let o: THREE.Object3D | null = hits[0].object;
        while (o && o.userData.buildingId === undefined) o = o.parent;
        this.selectBuilding(o?.userData.buildingId ?? null);
      } else this.selectBuilding(null);
    };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
    canvas.style.cursor = 'grab';
  }

  /** Companion input owns dragging and wheel resizing; the scene only handles explicit rotation and picking. */
  rotateCompanion(fromX: number, fromY: number, toX: number, toY: number) {
    const rect = this.host.getBoundingClientRect(), radius = rect.width * .4;
    const point = (x: number, y: number) => {
      const p = vec((x - rect.left - rect.width / 2) / radius, (rect.top + rect.height / 2 - y) / radius, 0);
      p.z = Math.sqrt(Math.max(0, 1 - p.lengthSq())); return p.normalize();
    };
    this.cameraMove = null;
    const rotation = dragRotation(point(fromX, fromY), point(toX, toY), this.camera.quaternion);
    // Reduce the angular gain, preserving the arcball's axis and size-independent feel.
    this.world.quaternion.premultiply(new THREE.Quaternion().slerp(rotation, .65)).normalize();
    this.dirty = true;
  }

  setCompanionInteracting(active: boolean) {
    this.companionInteracting = active;
    this.companionResizeAfter = active ? Infinity : performance.now() + 120;
    this.dirty = true;
  }

  pickCompanion(x: number, y: number, buildings: boolean) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    this.world.updateMatrixWorld(true); this.camera.updateMatrixWorld(); this.ray.setFromCamera(this.pointer, this.camera);
    const ground = this.ray.intersectObjects([this.surface.terrain, this.surface.ocean], false)[0];
    if (this.preview && ground) {
      const direction = this.world.worldToLocal(ground.point.clone()).normalize().toArray() as Direction;
      const site = nearestSite(direction);
      this.preview.siteId = site?.id || null; this.preview.direction = site?.direction || direction;
      this.updatePreview(); this.onPreview?.();
    } else if (buildings) {
      const hit = this.ray.intersectObjects(this.settlement.pickables, true)[0];
      if (hit && (!ground || hit.distance < ground.distance + .02)) {
        let object: THREE.Object3D | null = hit.object;
        while (object && object.userData.buildingId === undefined) object = object.parent;
        if (object?.userData.buildingId) this.selectBuilding(object.userData.buildingId);
      }
    }
  }

  /** Anisotropic filtering keeps roofs, walls and the meadow sharp at grazing angles. */
  private sharpenTextures() {
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const sharpen = (material: THREE.Material) => {
      for (const key of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'emissiveMap'] as const) {
        const texture = (material as THREE.MeshStandardMaterial)[key];
        if (texture && texture.anisotropy < anisotropy) { texture.anisotropy = anisotropy; texture.needsUpdate = true; }
      }
    };
    this.scene.traverse(o => { const material = (o as THREE.Mesh).material; if (material) for (const m of Array.isArray(material) ? material : [material]) sharpen(m); });
    Object.values(M).forEach(sharpen);
  }
  /** Compiles every building-kit material up front, so the first farm or factory does not stall a frame. */
  private warmUpMaterials() {
    const group = new THREE.Group(), geometry = new THREE.BoxGeometry(.001, .001, .001);
    for (const material of Object.values(M)) { const m = new THREE.Mesh(geometry, material); m.castShadow = m.receiveShadow = true; group.add(m); }
    this.scene.add(group); this.renderer.compile(this.scene, this.camera); this.scene.remove(group); geometry.dispose();
  }
  /**
   * Fits the sun's shadow frustum to the part of the planet the camera can see. From afar that is the whole globe,
   * as before; zoomed in, the same 2048² map covers a few metres, so eaves, fences and window sills cast crisp
   * shadows. Sizes come in discrete steps and the centre snaps to whole texels, so zooming does not make shadows crawl.
   */
  private fitShadows() {
    const light = this.sun.shadow.camera;
    light.position.copy(this.sun.position); light.lookAt(this.sun.target.position); light.updateMatrixWorld();
    this.camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < 25; i++) {
      this.fitRay.origin.copy(this.camera.position);
      this.fitRay.direction.set(i % 5 / 2 - 1, Math.floor(i / 5) / 2 - 1, .5).unproject(this.camera).sub(this.camera.position).normalize();
      // Rays past the limb count the horizon point; everything is measured in the light's view.
      const p = this.fitRay.intersectSphere(this.fitSphere, this.fitPoint) ?? this.fitRay.closestPointToPoint(this.fitSphere.center, this.fitPoint).setLength(this.fitSphere.radius);
      p.applyMatrix4(light.matrixWorldInverse);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const full = 2 * PLANET_RADIUS + 9, needed = Math.max(maxX - minX, maxY - minY) + 2.4;
    let size = full; while (size * .84 > needed) size *= .84;
    const texel = size / this.sun.shadow.mapSize.x, x = Math.round((minX + maxX) / 2 / texel) * texel, y = Math.round((minY + maxY) / 2 / texel) * texel;
    const key = size === full ? 'globe' : `${size}:${x}:${y}`, mapScale = 2048 / this.sun.shadow.mapSize.x;
    if (key === this.shadowFit) return;
    if (size === full) Object.assign(light, { left: -PLANET_RADIUS - 4, right: PLANET_RADIUS + 4, top: PLANET_RADIUS + 5, bottom: -PLANET_RADIUS - 4 });
    else Object.assign(light, { left: x - size / 2, right: x + size / 2, top: y + size / 2, bottom: y - size / 2 });
    light.updateProjectionMatrix(); this.sun.shadow.normalBias = .018 * size / full * mapScale; this.shadowFit = key; this.renderer.shadowMap.needsUpdate = true;
  }
  /** Last resorts on slow graphics at 1×: first the ambient-occlusion pass, then a smaller, lighter shadow map. */
  private lowerEffects() {
    const shadow = this.sun.shadow;
    if (this.ao.enabled) this.ao.enabled = false;
    else if (shadow.mapSize.x > 1024) {
      shadow.mapSize.set(1024, 1024); shadow.blurSamples = 4;
      shadow.map?.dispose(); shadow.map = null; shadow.mapPass?.dispose(); shadow.mapPass = null; this.shadowFit = '';
    } else return;
    this.slowTime = 0; this.frameAverage = 16; this.dirty = true;
  }
  /** Zoom stops about a unit above the ground wherever the orbit pivot is, so every view can come close to the models. */
  private updateZoomLimit() { this.controls.minDistance = Math.max(1.2, PLANET_RADIUS + 1.1 - this.controls.target.length()); }
  /** Animations of concept models follow the render clock so they keep moving while the simulation is paused. */
  private syncSettlement() { return this.settlement.sync(this.reducedMotion ? 0 : this.phase); }
  /**
   * three's SSAO prepass only hides points and lines. Transparent shells (atmosphere rim, clouds, smoke, build
   * ghosts) would otherwise be drawn opaque into its depth buffer and wash the occlusion out beneath them.
   */
  private hideTransparentFromAO() {
    const ao = this.ao as unknown as { _visibilityCache: THREE.Object3D[]; _overrideVisibility: () => void };
    ao._overrideVisibility = () => this.scene.traverseVisible(o => {
      const material = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      const transparent = Array.isArray(material) ? material.some(m => m.transparent) : !!material?.transparent;
      if ((o as THREE.Points).isPoints || (o as THREE.Line).isLine || transparent) { o.visible = false; ao._visibilityCache.push(o); }
    });
  }

  private frame = (timestamp: number) => {
    if (this.disposed) return;
    if (this.companion) this.onBeforeCompanionFrame?.(timestamp);
    // Rest at 20 FPS; direct rotation and zoom still follow the display's refresh rate.
    if (this.companion && !this.companionInteracting && !this.dirty && this.previous && timestamp - this.previous < 1000 / 20 - 1) {
      this.animation = requestAnimationFrame(this.frame); return;
    }
    const dt = this.previous ? Math.min((timestamp - this.previous) / 1000, .1) : 0;
    this.previous = timestamp;
    this.simulation.tick(dt); this.phase += dt;
    const animating = this.syncSettlement() && !this.reducedMotion;
    if (this.companion && this.framingDirty) {
      this.framingDirty = false;
      const scale = companionFrameScale(Math.max(this.settlement.framingRadius,this.weather.framingRadius));
      if (scale !== this.companionFrameScale) {
        this.companionFrameScale = scale; this.resize(); this.onCompanionFrameChange?.();
        // Resize and draw in this same frame, so a newly built tall structure never exposes a cleared canvas.
        this.dirty = true;
      }
    }
    if (this.companion) this.updateCompanionViewport(timestamp);
    if (this.wind && !this.reducedMotion) for (const tree of this.trees) { tree.crown.rotation.z = Math.sin(this.phase * .9 + tree.seed) * .009; tree.crown.rotation.x = Math.sin(this.phase * .7 + tree.seed * .5) * .006; }
    else for (const tree of this.trees) tree.crown.rotation.set(0, 0, 0);
    const autoRotating = this.autoRotate && this.dragPointer === null && !this.companionInteracting && !this.cameraMove;
    if (autoRotating) { this.world.rotateOnWorldAxis(NORTH, dt * (this.companion ? .065 : .13)); if (!this.companion) this.dirty = true; }
    if (this.cameraMove) {
      this.cameraMove.time += dt; const t = Math.min(1, this.cameraMove.time / 1.15), smooth = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(this.cameraMove.start, this.cameraMove.end, smooth); this.controls.target.lerpVectors(this.cameraMove.targetStart, this.cameraMove.targetEnd, smooth);
      this.world.quaternion.slerpQuaternions(this.cameraMove.rotationStart, this.cameraMove.rotationEnd, smooth);
      if (t === 1) this.cameraMove = null;
    }
    this.inverseWorld.copy(this.world.quaternion).invert();
    this.localSun.copy(this.sun.position).normalize().applyQuaternion(this.inverseWorld);
    const weatherChanged = this.weather.update(dt, this.phase, this.localSun, this.reducedMotion);
    this.surface.oceanSurface.update(this.reducedMotion ? 0 : this.phase, this.weather.state.rain, this.weather.state.cloudiness);
    this.updateWeatherLighting();
    this.updateZoomLimit();
    const cameraChanged = this.controls.update();
    if (!this.companion || this.dirty || cameraChanged || this.cameraMove || !this.shadowFit) this.fitShadows();
    const rotationChanged = !this.aoRotation.equals(this.world.quaternion);
    if (this.ao instanceof CachedSSAOPass) {
      this.ao.refreshInterval = 1000 / 6;
      // AO is screen-space: even slow self-rotation moves every occluder, so cached pixels no longer line up.
      if (this.dirty || cameraChanged || this.cameraMove || rotationChanged) this.ao.invalidate();
      this.aoRotation.copy(this.world.quaternion);
    }
    if (this.dirty || weatherChanged || cameraChanged || this.cameraMove || autoRotating || animating || (this.wind && !this.reducedMotion) || !this.simulation.paused) {
      // All planet rotation needs a shadow map from this pose. Only small ambient motions use the idle cache.
      this.shadowAge += dt;
      if (this.dirty || this.shadowAge > (this.companion ? 1 / 6 : .08) || !this.shadowRotation.equals(this.world.quaternion)) { this.renderer.shadowMap.needsUpdate = true; this.shadowAge = 0; this.shadowRotation.copy(this.world.quaternion); }
      this.renderer.info.reset(); this.composer.render(); this.dirty = false;
    }
    this.onFrame?.();
    // Keep motion smooth: once frames miss 60 fps for about a second, lower the render resolution a step; at 1×, every
    // three slow seconds drop one effect (see lowerEffects). Start-up frames (shader compiles, uploads) are not counted.
    if (dt > 0 && dt < .25 && this.phase > 3) this.frameAverage += (dt * 1000 - this.frameAverage) * .05;
    this.slowTime = this.frameAverage > (this.companion ? 65 : 20) ? this.slowTime + dt : 0;
    const ratio = this.renderer.getPixelRatio();
    if (!this.companion && ratio > 1 && this.slowTime > 1) {
      const next = ratio * .8 < 1.15 ? 1 : ratio * .8; this.renderer.setPixelRatio(next); this.composer.setPixelRatio(next); this.resize();
      this.slowTime = 0; this.frameAverage = 16;
    } else if (!this.companion && ratio <= 1 && this.slowTime > 3) this.lowerEffects();
    this.animation = requestAnimationFrame(this.frame);
  };
  private handleVisibility = () => {
    if (document.hidden) cancelAnimationFrame(this.animation);
    else { this.previous = 0; this.animation = requestAnimationFrame(this.frame); }
  };
  async capture() {
    this.composer.render();
    const blob = await new Promise<Blob | null>(resolve => this.renderer.domElement.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = '微缩星球-planet.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  invalidate() { this.dirty = true; }
  get metrics() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, pixelRatio: this.renderer.getPixelRatio(), renderSize: this.renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(), antialiasSamples: this.composer.renderTarget1.samples, trees: this.trees.length + this.backgroundTrees, planetRadius: PLANET_RADIUS, surfaceAreaRatio: (PLANET_RADIUS/6)**2, population: this.simulation.population, buildings: this.simulation.buildings.length, sandbox: this.simulation.sandbox, smokeEmitters: this.settlement.smoke.emitterCount, weather: {mode:this.weather.state.mode,cloudiness:this.weather.state.cloudiness,rain:this.weather.state.rain,wetness:this.weather.state.wetness}, globeRotation: this.world.quaternion.toArray(), camera: this.camera.position.toArray() }; }
  dispose() { this.disposed = true; cancelAnimationFrame(this.animation); document.removeEventListener('visibilitychange', this.handleVisibility); this.resizeObserver.disconnect(); this.controls.dispose(); this.ao.dispose(); this.weather.dispose(); this.surface.oceanSurface.dispose(); this.surface.detail.dispose(); this.composer.dispose(); this.renderer.dispose(); }
}
