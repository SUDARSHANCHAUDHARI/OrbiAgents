import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createOfficeRoom } from '../theme/room.mjs';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');
const { entries } = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

test('copier scanner light discovers its body and all approved frames by GID', () => {
  assert.match(source, /new AnimatedSprite\(lightFrames\)/);
  assert.match(source, /gidAt\('furniture-below', x, y\) === copierBodySheet\.firstgid/);
  assert.match(source, /copierTile\.x \+ 1/);
  assert.doesNotMatch(source, /copierLight\.position\.set\(35|copierLight\.position\.set\(36/);
  const { map } = createOfficeRoom(entries);
  const body = map.tilesets.find(sheet => sheet.image === 'art/lpc-office/Copy Machine.png');
  const light = map.tilesets.find(sheet => sheet.image === 'art/lpc-office/Copy Machine - Copy Light.png');
  assert.equal(light.tilecount, 8);
  const furniture = map.layers.find(layer => layer.name === 'furniture-below').data;
  const positions = [];
  furniture.forEach((gid, index) => { if (gid === body.firstgid) positions.push([index % map.width, Math.floor(index / map.width)]); });
  assert.deepEqual(positions, [[35, 3]]);
});
