import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('reduced motion suppresses selection camera movement without suppressing selection', () => {
  assert.match(floor, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(floor, /cameraSpotlightId = prefersReducedMotion \? null : s\.selectedId/);
  assert.match(floor, /runtime\.character\.setSelected\(id === s\.selectedId\)/);
  assert.match(floor, /camera\.fitToScreen\(prefersReducedMotion\)/);
});

test('live reduced-motion changes cancel camera motion and release their listener', () => {
  assert.match(floor, /addEventListener\('change', onReducedMotionChange\)/);
  assert.match(floor, /cameraSpotlightId = null[\s\S]*?cameraSpotlightRemaining = 0[\s\S]*?camera\.fitToScreen\(true\)/);
  assert.match(floor, /removeEventListener\('change', onReducedMotionChange\)/);
  assert.match(floor, /__offReducedMotion\?\.\(\)/);
  assert.match(floor, /function safeDestroy\(app: Application\) \{\s*try \{ \(app as any\)\.__offReducedMotion\?\.\(\)/);
});
