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
