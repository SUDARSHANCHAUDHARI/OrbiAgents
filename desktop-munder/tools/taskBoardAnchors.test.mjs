import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createOfficeRoom } from '../theme/room.mjs';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');
const { entries } = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

test('task-card choreography follows the active board anchor', () => {
  assert.match(source, /const boardStandY = BOARD_TILE\.y \+ 2/);
  for (const offset of [1, 3, 5])
    assert.match(source, new RegExp(`x: BOARD_TILE\\.x \\+ ${offset}, y: boardStandY`));
  assert.doesNotMatch(source, /const PIN_STAND: Tile = \{ x: 8, y: 11 \}/);
});

test('Orbi task-board choreography destinations are walkable', () => {
  const { map } = createOfficeRoom(entries);
  const collision = map.layers.find(layer => layer.name === 'collision').data;
  for (const [x, y] of [[39, 4], [41, 4], [43, 4]])
    assert.equal(collision[y * map.width + x], 0, `board destination ${x},${y}`);
});

test('human-question board shares the active board band with clear Orbi tiles', () => {
  assert.match(source, /const askBoardTile: Tile = \{ x: BOARD_TILE\.x - 3, y: BOARD_TILE\.y \}/);
  assert.match(source, /askG\.position\.set\(askBoardTile\.x \* tsB, askBoardTile\.y \* tsB\)/);
  assert.doesNotMatch(source, /askG\.position\.set\(14 \* tsB \+ 25, 10 \* tsB\)/);
  const { map } = createOfficeRoom(entries);
  const collision = map.layers.find(layer => layer.name === 'collision').data;
  const below = map.layers.find(layer => layer.name === 'furniture-below').data;
  const above = map.layers.find(layer => layer.name === 'furniture-above').data;
  for (const x of [35, 36]) {
    const index = 2 * map.width + x;
    assert.equal(collision[index], 0, `human board tile ${x},2 collision`);
    assert.equal(below[index], 0, `human board tile ${x},2 furniture below`);
    assert.equal(above[index], 0, `human board tile ${x},2 furniture above`);
  }
});
