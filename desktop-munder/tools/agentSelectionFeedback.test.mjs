import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const character = readFileSync(new URL('../src/renderer/src/scene/office/Character.ts', import.meta.url), 'utf8');
const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('characters show bounded hover and persistent selection rings', () => {
  assert.match(character, /setSelected\(selected: boolean\): void/);
  assert.match(character, /selectionRing\.ellipse\(0, 0, 12, 5\)/);
  assert.match(character, /pointerover[\s\S]*?this\.hovered = true/);
  assert.match(character, /pointerout[\s\S]*?this\.hovered = false/);
  assert.match(character, /this\.selectionRing\.destroy\(\)/);
});

test('floor synchronizes selection for loaded and newly arriving workers', () => {
  assert.match(floor, /character\.setSelected\(useStore\.getState\(\)\.selectedId === agent\.id\)/);
  assert.match(floor, /for \(const \[id, runtime\] of runtimes\) runtime\.character\.setSelected\(id === s\.selectedId\)/);
  assert.match(floor, /cameraSpotlightId = s\.selectedId/);
  assert.match(floor, /camera\.focusOn\(p\.x, p\.y\)/);
});
