import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const camera = readFileSync(new URL('../src/renderer/src/scene/office/Camera.ts', import.meta.url), 'utf8');
const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('selected workers receive a responsive zoomed camera spotlight', () => {
  assert.match(camera, /zoom \?\? this\.getMinZoom\(\) \* 1\.35/);
  assert.match(floor, /cameraSpotlightRemaining = cameraSpotlightId \? 1\.8 : 0/);
  assert.match(floor, /const focused = runtimes\.get\(cameraSpotlightId\)/);
  assert.match(floor, /focused\.character\.getPixelPosition\(\)/);
  assert.match(floor, /camera\.focusOn\(p\.x, p\.y\)/);
});

test('the spotlight releases back to the responsive whole-office fit', () => {
  assert.match(floor, /if \(!s\.selectedId \|\| prefersReducedMotion\) camera\.fitToScreen\(prefersReducedMotion\)/);
  assert.match(floor, /cameraSpotlightRemaining === 0[\s\S]*?cameraSpotlightId = null[\s\S]*?camera\.fitToScreen\(\)/);
  assert.match(camera, /fitToScreen\(immediate = false\): void/);
});
