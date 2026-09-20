import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('task board names and signals its tasks action on hover', () => {
  assert.match(source, /const boardAffordance = new Graphics\(\)/);
  assert.match(source, /boardG\.addChild\(boardAffordance, boardPlacard\)/);
  assert.match(source, /text: t\('commandCenter\.tabs\.tasks'\)\.toUpperCase\(\)/);
  assert.match(source, /const boardPlacardWidth = Math\.ceil\(boardPlacardText\.width\) \+ 10/);
  assert.match(source, /pointerover[\s\S]*?boardPlacard\.visible = true/);
  assert.match(source, /pointerout[\s\S]*?boardAffordance\.clear\(\)/);
});

test('task board preserves its reviewed tasks navigation and live redraw', () => {
  assert.match(source, /openFloorCommandTab\('tasks'\)/);
  assert.match(source, /const drawTaskBoard = \(tasks: BoardTask\[\]\): void => \{/);
  assert.match(source, /drawCork\(0, NOTE_COLORS\.blocked, blocked\)/);
  assert.match(source, /drawCork\(34, NOTE_COLORS\.todo, todoNotes\)/);
});
