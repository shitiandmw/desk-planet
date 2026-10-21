import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { companionFrameFov, companionFrameScale, COMPANION_BASE_FOV, COMPANION_CAMERA_DISTANCE, radialExtent } from './companion-framing';
import { fitLayout, dockLayout } from './companion-layout';

test('clouds and orbital-elevator geometry fit the camera at every spherical direction', () => {
  for (const radius of [11.98, 15.6, 18]) {
    const scale = companionFrameScale(radius);
    const camera = new PerspectiveCamera(companionFrameFov(scale), 1, .1, 180);
    camera.position.z = COMPANION_CAMERA_DISTANCE; camera.updateMatrixWorld();
    const point = new Vector3();
    for (let latitude = -90; latitude <= 90; latitude += 5) for (let longitude = 0; longitude < 360; longitude += 5) {
      const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
      point.set(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)).multiplyScalar(radius).project(camera);
      assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z > -1 && point.z < 1);
    }
  }
});

test('padding preserves the displayed size of the planet and render density at every tier', () => {
  const oldPixelScale = 560 / Math.tan(COMPANION_BASE_FOV * Math.PI / 360);
  for (const reach of [0, 12, 15.6, 18]) {
    const scale = companionFrameScale(reach);
    const paddedPixelScale = 560 * scale / Math.tan(companionFrameFov(scale) * Math.PI / 360);
    assert.ok(Math.abs(paddedPixelScale-oldPixelScale) < 1e-9);
    assert.ok(Math.ceil(1152 * scale) / (560 * scale) >= 2);
  }
  assert.ok(companionFrameScale(12) < companionFrameScale(15.6));
});

test('radial bounds include remote cable and solar-panel corners through parent transforms', () => {
  const root = new Group(); root.position.set(0, 8.4, 0); root.rotation.z = .5;
  const mesh = new Mesh(new BoxGeometry(4, 12, 1), new MeshBasicMaterial()); mesh.position.y = 6; root.add(mesh);
  const radius = radialExtent(root), p = mesh.geometry.attributes.position, point = new Vector3();
  for(let i=0;i<p.count;i++) assert.ok(point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).length() <= radius+1e-9);
  assert.ok(radius > 19);
  mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose();
});

test('screen bounds reserve the expanded rendering frame at companion sizes and clamp the dock', () => {
  for (const viewport of [{width:1920,height:1080},{width:390,height:700}]) for (const frameScale of [1.125,1.5,1.75]) {
    const layout = fitLayout({x:9999,y:9999,size:200},viewport,frameScale), half=layout.size*frameScale/2;
    assert.ok(layout.x-half >= 12 && layout.x+half <= viewport.width-12+1e-9);
    assert.ok(layout.y-half >= 12);
    const dock = dockLayout(layout,viewport,frameScale);
    assert.ok(dock.top >= 12 && dock.top+128 <= viewport.height-12);
  }
});
