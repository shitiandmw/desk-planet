import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { vec } from './craft';
import { makeTerrain } from './terrain';
import { BACK_LAND, dragRotation, NORTH, PLANET_RADIUS, placeOnPlanet } from './planet-surface';
import { makePlanetNature } from './planet-nature';
import { makeTree, Tree, treeLocations } from './trees';
import { stump } from './props';
import { makeDecor } from './decor';
import { GameSimulation, type ActionResult } from './simulation';
import { BUILDINGS, type BuildingType, type Direction } from './game-data';
import { ALL_SITES, SITE_BY_ID, directionVector, nearestSite } from './world-layout';
import { SettlementView, onSurface } from './settlement-view';
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
  nature: Tree[] = [];
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
  private normalBudget = Math.min(window.devicePixelRatio, 1.6);
  private lowPerformanceFrames = 0;
  private dirty = true;

  constructor(public host: HTMLElement, public simulation: GameSimulation) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(this.normalBudget);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.info.autoReset = false;
    this.renderer.domElement.setAttribute('aria-label', '完整三维星球。拖动可向任意方向转动星球，滚轮缩放，点击建筑管理，进入建设后点击地面选址。');
    this.renderer.domElement.setAttribute('role', 'img');
    host.append(this.renderer.domElement);
    this.scene.background = new THREE.Color('#eeede4');
    this.scene.fog = new THREE.Fog('#eeede4', PLANET_RADIUS * 8, PLANET_RADIUS * 16);
    this.scene.add(this.world);
    this.fill = new THREE.HemisphereLight('#dbe8ef', '#9c8d64', 1.9); this.scene.add(this.fill);
    this.scene.add(new THREE.AmbientLight('#f5e8ce', .32));
    this.sun = new THREE.DirectionalLight('#fff0d0', 3.3); this.sun.position.set(-10, 16, 14).multiplyScalar(PLANET_RADIUS / 6); this.sun.target.position.set(0, 0, 0);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -PLANET_RADIUS - 4, right: PLANET_RADIUS + 4, top: PLANET_RADIUS + 5, bottom: -PLANET_RADIUS - 4, near: .5, far: PLANET_RADIUS * 8 });
    this.sun.shadow.bias = -.00012; this.sun.shadow.normalBias = .018; this.sun.shadow.radius = 10; this.sun.shadow.blurSamples = 12;
    this.scene.add(this.sun, this.sun.target);
    const bounce = new THREE.DirectionalLight('#e4edd7', .55); bounce.position.set(5, 4, -6); this.scene.add(bounce);

    this.weather = new PlanetWeather(this.world);
    this.surface = makeTerrain(this.world, this.renderer, this.weather.shadowUniform);
    this.world.name = 'rotatable-complete-planet';
    this.world.quaternion.copy(this.initialRotation);
    treeLocations.forEach((t, i) => {
      const tree = makeTree(t.seed, i);
      placeOnPlanet(tree.root, t.x, t.z, i * 1.7, t.scale * .8);
      this.world.add(tree.root); this.trees.push(tree);
    });
    for (const [x, z, seed] of [[-1.7, 1.4, 3], [3, .5, 6]]) { const s = stump(seed); placeOnPlanet(s, x, z); this.world.add(s); }
    makeDecor(this.world);
    this.nature = makePlanetNature(this.world);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.97, 1.03, 64), new THREE.MeshBasicMaterial({ color: '#e2c77f', side: THREE.DoubleSide, transparent: true, opacity: .9, depthWrite: false }));
    this.ring.visible = false; this.world.add(this.ring);

    this.settlement = new SettlementView(this.world, this.simulation);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = .075;
    this.controls.minDistance = PLANET_RADIUS + 3.2; this.controls.maxDistance = PLANET_RADIUS * 6.8;
    this.controls.enableRotate = false; this.controls.enablePan = false;
    this.controls.addEventListener('start', () => { this.cameraMove = null; });
    this.setView('planet', false);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new SSAOPass(this.scene, this.camera, 1, 1, 16); this.ao.kernelRadius = .28; this.ao.minDistance = .002; this.ao.maxDistance = .16;
    this.composer.addPass(this.ao); this.composer.addPass(new OutputPass()); this.composer.addPass(new SMAAPass());
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
    this.bindPicking(); this.animation = requestAnimationFrame(this.frame);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  resize() {
    const width = this.host.clientWidth, height = this.host.clientHeight;
    this.camera.aspect = width / height; this.camera.fov = width < 760 ? 50 : 36;
    if (width < 760) this.camera.setViewOffset(width, height, 0, height * .08, width, height); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height); this.composer.setSize(width, height);
    this.dirty = true;
  }

  setView(view: ViewName, animate = true) {
    const mobile = this.host.clientWidth < 760;
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
    const rotation = view === 'back'
      ? new THREE.Quaternion().setFromUnitVectors(BACK_LAND, c.position.clone().normalize())
      : this.initialRotation.clone();
    if (animate && !this.reducedMotion) this.cameraMove = { start: this.camera.position.clone(), end: c.position, targetStart: this.controls.target.clone(), targetEnd: c.target, rotationStart: this.world.quaternion.clone(), rotationEnd: rotation, time: 0 };
    else { this.camera.position.copy(c.position); this.controls.target.copy(c.target); this.world.quaternion.copy(rotation); this.controls.update(); }
    this.dirty = true;
    this.selectBuilding(null);
  }

  setLight(warm: boolean) {
    this.warmLight = warm; this.dirty = true;
    this.sun.position.set(warm ? -16 : -10, warm ? 9 : 16, 14).multiplyScalar(PLANET_RADIUS / 6);
    this.updateWeatherLighting();
  }

  setWeather(mode: WeatherMode) { this.weather.state.setMode(mode); this.dirty = true; }

  private updateWeatherLighting() {
    const { cloudiness, rain, wetness } = this.weather.state;
    this.sun.color.copy(this.warmLight ? this.eveningSun : this.daySun).lerp(this.stormSun, cloudiness * .6);
    this.sun.intensity = (this.warmLight ? 3.1 : 3.3) * (1-cloudiness*.25-rain*.32);
    this.fill.intensity = (this.warmLight ? 1.45 : 1.9) * (1-cloudiness*.15);
    (this.scene.background as THREE.Color).copy(this.clearSky).lerp(this.stormSky, rain*.42+cloudiness*.12);
    (this.scene.fog as THREE.Fog).color.copy(this.scene.background as THREE.Color);
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
    const targetEnd = surfaceNormal.clone().multiplyScalar(PLANET_RADIUS * .88);
    const end = targetEnd.clone().addScaledVector(normal, PLANET_RADIUS * (this.host.clientWidth < 760 ? 2.9 : 2.5));
    if (this.reducedMotion) { this.camera.position.copy(end); this.controls.target.copy(targetEnd); this.world.quaternion.copy(rotation); this.controls.update(); }
    else this.cameraMove = { start: this.camera.position.clone(), end, targetStart: this.controls.target.clone(), targetEnd, rotationStart: this.world.quaternion.clone(), rotationEnd: rotation, time: 0 };
    this.dirty = true;
  }
  focusBuilding(id: string) {
    const b = this.simulation.building(id); if (!b) return;
    this.focusDirection(SITE_BY_ID.get(b.siteId)!.direction); this.selectBuilding(id);
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
    this.settlement.showPreview(p.type, p.direction, p.yaw, !p.error); this.dirty = true;
  }
  cancelBuild() { this.preview = null; this.settlement.hidePreview(); this.dirty = true; this.onPreview?.(); }
  confirmBuild(): ActionResult {
    this.updatePreview(); const p = this.preview;
    if (!p || p.error || !p.siteId) return { ok: false, reason: p?.error || '请先选择位置' };
    const result = this.simulation.build(p.type, p.siteId, p.yaw);
    if (result.ok) { this.cancelBuild(); this.settlement.sync(); this.selectBuilding(result.id!); }
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

  private frame = (timestamp: number) => {
    if (this.disposed) return;
    const dt = this.previous ? Math.min((timestamp - this.previous) / 1000, .1) : 0;
    this.previous = timestamp;
    this.simulation.tick(dt); this.phase += dt;
    this.settlement.sync();
    if (this.wind && !this.reducedMotion) for (const tree of [...this.trees, ...this.nature]) { tree.crown.rotation.z = Math.sin(this.phase * .9 + tree.seed) * .009; tree.crown.rotation.x = Math.sin(this.phase * .7 + tree.seed * .5) * .006; }
    else for (const tree of [...this.trees, ...this.nature]) tree.crown.rotation.set(0, 0, 0);
    if (this.autoRotate && this.dragPointer === null && !this.cameraMove) { this.world.rotateOnWorldAxis(NORTH, dt * .13); this.dirty = true; }
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
    const cameraChanged = this.controls.update();
    if (this.dirty || weatherChanged || cameraChanged || this.cameraMove || (this.wind && !this.reducedMotion) || !this.simulation.paused) {
      this.renderer.info.reset(); this.composer.render(); this.dirty = false;
    }
    this.onFrame?.();
    // Lower resolution only after observing a sustained frame-time problem.
    if (dt > .045 && dt < .1) this.lowPerformanceFrames++; else this.lowPerformanceFrames = Math.max(0, this.lowPerformanceFrames - 1);
    if (this.lowPerformanceFrames > 150 && this.renderer.getPixelRatio() > 1) { this.renderer.setPixelRatio(1); this.composer.setPixelRatio(1); this.resize(); this.lowPerformanceFrames = 0; }
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
  get metrics() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, pixelRatio: this.renderer.getPixelRatio(), trees: this.trees.length + this.nature.length, planetRadius: PLANET_RADIUS, surfaceAreaRatio: (PLANET_RADIUS/6)**2, population: this.simulation.population, buildings: this.simulation.buildings.length, weather: {mode:this.weather.state.mode,cloudiness:this.weather.state.cloudiness,rain:this.weather.state.rain,wetness:this.weather.state.wetness}, globeRotation: this.world.quaternion.toArray(), camera: this.camera.position.toArray() }; }
  dispose() { this.disposed = true; cancelAnimationFrame(this.animation); document.removeEventListener('visibilitychange', this.handleVisibility); this.resizeObserver.disconnect(); this.controls.dispose(); this.ao.dispose(); this.weather.dispose(); this.surface.oceanSurface.dispose(); this.composer.dispose(); this.renderer.dispose(); }
}
