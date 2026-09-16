import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('reduced motion pins every ambient display to a clear static frame', () => {
  assert.match(floor, /const ambientDisplays: AnimatedSprite\[\] = \[\]/);
  assert.match(floor, /if \(prefersReducedMotion\) display\.gotoAndStop\(0\);\s*else display\.play\(\);/);
  assert.match(floor, /registerAmbientDisplay\(copierLight\)/);
  assert.match(floor, /registerAmbientDisplay\(screenCell\)/);
  assert.match(floor, /registerAmbientDisplay\(briefingBeacon\)/);
});

test('live preference changes freeze and resume ambient displays', () => {
  assert.match(floor, /const syncAmbientDisplayMotion = \(\): void => \{[\s\S]*?for \(const display of ambientDisplays\)/);
  assert.match(floor, /prefersReducedMotion = event\.matches;[\s\S]*?syncAmbientDisplayMotion\(\);/);
  assert.match(floor, /prefersReducedMotion = reducedMotionQuery\.matches;\s*syncAmbientDisplayMotion\(\);\s*reducedMotionQuery\.addEventListener/);
  assert.match(floor, /if \(prefersReducedMotion\) display\.gotoAndStop\(0\);\s*else display\.play\(\);/);
});

test('worker animation remains outside the ambient display registry', () => {
  assert.doesNotMatch(floor, /registerAmbientDisplay\([^\n]*(?:character|worker|sprite)/i);
});
