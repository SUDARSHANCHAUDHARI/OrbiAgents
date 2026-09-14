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

test('hire kiosk names its action on hover', () => {
  assert.match(source, /const hirePlacard = new Container\(\)/);
  assert.match(source, /text: t\('agentStrip\.addAgent'\)\.toUpperCase\(\)/);
  assert.match(source, /const hirePlacardWidth = Math\.ceil\(hirePlacardText\.width\) \+ 10/);
  assert.match(source, /hirePlacard\.position\.set\(\(32 - hirePlacardWidth\) \/ 2, -12\)/);
  assert.match(source, /hirePlacard\.visible = false/);
  assert.match(source, /pointerover[\s\S]*?hirePlacard\.visible = true/);
  assert.match(source, /pointerout[\s\S]*?hirePlacard\.visible = false/);
});
