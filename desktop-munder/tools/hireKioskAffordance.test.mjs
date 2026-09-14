import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('hire kiosk signals interactivity through ticker and pointer states', () => {
  assert.match(source, /const drawHireAffordance = \(\): void =>/);
  assert.match(source, /hireG\.on\('pointerover'/);
  assert.match(source, /hireG\.on\('pointerout'/);
  assert.match(source, /hirePulsePhase \+= dt \* 2\.4/);
  assert.match(source, /if \(!hireHovered\) drawHireAffordance\(\)/);
  assert.match(source, /useStore\.getState\(\)\.setAddAgentOpen\(true\)/);
});
