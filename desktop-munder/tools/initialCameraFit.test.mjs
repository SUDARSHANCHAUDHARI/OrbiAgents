import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const camera = readFileSync(new URL('../src/renderer/src/scene/office/Camera.ts', import.meta.url), 'utf8');
const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('the first office frame snaps to its centered fitted camera state', () => {
  assert.match(camera, /fitToScreen\(immediate = false\): void/);
  assert.match(camera, /if \(immediate\) \{\s*this\.currentX = this\.targetX;\s*this\.currentY = this\.targetY;\s*this\.currentZoom = this\.targetZoom;\s*this\.update\(0\);/);
  assert.match(floor, /camera\.fitToScreen\(true\)/);
});

test('responsive refits retain smooth camera motion', () => {
  assert.match(camera, /if \(!this\.manualOverride\) this\.fitToScreen\(\)/);
  assert.doesNotMatch(camera, /setViewSize[\s\S]*fitToScreen\(true\)/);
});
