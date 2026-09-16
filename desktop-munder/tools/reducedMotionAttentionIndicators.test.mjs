import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('reduced motion keeps Hire and Ask Me indicators static and visible', () => {
  assert.match(floor, /prefersReducedMotion \? 0\.3 : 0\.22 \+ \(Math\.sin\(hirePulsePhase\) \+ 1\) \* 0\.08/);
  assert.match(floor, /prefersReducedMotion \? 0\.5 : 0\.35 \+ 0\.3 \* Math\.sin\(pulse \* 4\)/);
  assert.match(floor, /if \(!prefersReducedMotion\) \{\s*hirePulsePhase \+= dt \* 2\.4/);
  assert.match(floor, /if \(!prefersReducedMotion\) \{\s*askPulse \+= dt/);
});

test('live preference changes redraw both attention indicators immediately', () => {
  assert.match(floor, /syncReducedMotionIndicators\?\.\(\)/);
  assert.match(floor, /syncReducedMotionIndicators = \(\) => \{\s*if \(!hireHovered\) drawHireAffordance\(\);\s*if \(askCount > 0\) drawAskBoard\(askPulse\);/);
});
