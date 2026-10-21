import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { companionFrameFov, COMPANION_CAMERA_DISTANCE } from './companion-framing';
import { companionBufferSize, companionViewport, COMPANION_MAX_RENDER_EDGE, COMPANION_MAX_RENDER_PIXELS } from './companion-viewport';

test('cropping the camera preserves screen position and ray picking at all zoom levels and pan positions', () => {
  const viewport = { width: 1920, height: 1080 };
  for (const size of [360, 560, 1000, 2000, 4000]) for (const frameScale of [1.125, 1.5]) for (const [x, y] of [[960, 540], [64, 64], [1856, 1016]]) {
    const view = companionViewport({x, y, size}, viewport, frameScale);
    assert.ok(view.left >= 0 && view.top >= 0 && view.left + view.width <= viewport.width + 1e-8 && view.top + view.height <= viewport.height + 1e-8);
    const original = new PerspectiveCamera(companionFrameFov(frameScale), 1, .1, 180);
    original.position.z = COMPANION_CAMERA_DISTANCE; original.updateMatrixWorld();
    const cropped = original.clone();
    cropped.setViewOffset(view.fullSize, view.fullSize, view.offsetX, view.offsetY, view.width, view.height);
    for (const point of [new Vector3(), new Vector3(8, 2, 3), new Vector3(-4, 8, 10)]) {
      const before = point.clone().project(original), after = point.clone().project(cropped);
      const fullX = x + before.x * view.fullSize / 2, fullY = y - before.y * view.fullSize / 2;
      const cropX = view.left + (after.x + 1) * view.width / 2, cropY = view.top + (1 - after.y) * view.height / 2;
      assert.ok(Math.abs(fullX - cropX) < 1e-8 && Math.abs(fullY - cropY) < 1e-8);
      const rayPoint = new Vector3((fullX-view.left)/view.width*2-1, 1-(fullY-view.top)/view.height*2, after.z).unproject(cropped);
      assert.ok(rayPoint.distanceTo(point) < 1e-8);
    }
  }
});

test('render allocations stay bounded on Retina and 4K displays, and shrink back to the companion budget', () => {
  for (const viewport of [{width:390,height:700},{width:1920,height:1175},{width:3840,height:2160}]) {
    for (const size of [200, 360, 560, 1000, 4000, 8000]) for (const scale of [1.125, 1.5]) {
      const buffer = companionBufferSize({x:viewport.width/2,y:viewport.height/2,size},viewport,scale,2);
      assert.ok(buffer.width * buffer.height <= COMPANION_MAX_RENDER_PIXELS);
      assert.ok(Math.max(buffer.width,buffer.height) <= COMPANION_MAX_RENDER_EDGE);
      assert.ok(buffer.width >= 16 && buffer.height >= 16);
    }
  }
  for (const size of [200, 267.55, 360, 405.89, 500, 560]) {
    assert.deepEqual(companionBufferSize({x:960,y:540,size},{width:1920,height:1080},1.125,2),{width:1296,height:1296});
    assert.deepEqual(companionBufferSize({x:960,y:540,size},{width:1920,height:1080},1.5,2),{width:1728,height:1728});
  }
});
