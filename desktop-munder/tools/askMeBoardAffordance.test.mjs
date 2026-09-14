import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('ask-me board names and signals its human action on hover', () => {
  assert.match(source, /const askAffordance = new Graphics\(\)/);
  assert.match(source, /askG\.addChild\(askAffordance, askPlacard\)/);
  assert.match(source, /text: t\('commandCenter\.tabs\.human'\)\.toUpperCase\(\)/);
  assert.match(source, /const askPlacardWidth = Math\.ceil\(askPlacardText\.width\) \+ 10/);
  assert.match(source, /pointerover[\s\S]*?askPlacard\.visible = true/);
  assert.match(source, /pointerout[\s\S]*?askAffordance\.clear\(\)/);
});

test('ask-me board preserves navigation and its live pending-question pulse', () => {
  assert.match(source, /st\.requestCommandCenterTab\('human'\)/);
  assert.match(source, /const drawAskBoard = \(pulse: number\): void => \{/);
  assert.match(source, /if \(askCount > 0\) drawAskBoard\(askPulse\)/);
});
