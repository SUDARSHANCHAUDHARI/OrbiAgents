import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createOfficeRoom } from '../theme/room.mjs';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');
const { entries } = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

test('operations display discovers its placement and animates all approved screen states', () => {
  assert.match(source, /endsWith\('\/TV, Widescreen\.png'\)/);
  assert.match(source, /gidAt\('furniture-below', x, y\) === displaySheet\.firstgid/);
  assert.match(source, /stateOffsets = \[0, 3, 18, 21, 24\]/);
  assert.match(source, /new AnimatedSprite\(displayFrames\[row\]\[column\]/);
  assert.match(source, /ambientTextures\.push\(\.\.\.displayFrames\.flat\(2\)/);
  assert.match(source, /if \(!texture\.destroyed\) texture\.destroy\(\)/);
  assert.doesNotMatch(source, /displayTile\s*=\s*\{\s*x:\s*38/);

  const { map } = createOfficeRoom(entries);
  const display = map.tilesets.find(sheet => sheet.image === 'art/lpc-office/TV, Widescreen.png');
  assert.equal(display.columns, 9);
  assert.equal(display.tilecount, 36);
  const furniture = map.layers.find(layer => layer.name === 'furniture-below').data;
  const positions = [];
  furniture.forEach((gid, index) => {
    if (gid === display.firstgid) positions.push([index % map.width, Math.floor(index / map.width)]);
  });
  assert.deepEqual(positions, [[38, 0]]);
});
