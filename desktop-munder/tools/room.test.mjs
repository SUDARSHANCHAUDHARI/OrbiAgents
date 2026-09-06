import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createOfficeRoom, createRoomAtlas } from '../theme/room.mjs';
const { entries } = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

test('room layers cover every tile, show every obstacle, and preserve paths', () => {
  const { map } = createOfficeRoom(entries);
  const floor = map.layers.find(l => l.name === 'floor').data;
  const walls = map.layers.find(l => l.name === 'walls').data;
  const furniture = map.layers.find(l => l.name === 'furniture-below').data;
  const collision = map.layers.find(l => l.name === 'collision').data;
  assert.equal(new Set(map.layers.map(l => l.name)).size, map.layers.length);
  for (let i = 0; i < floor.length; i++) {
    assert.ok(floor[i] >= 1 && floor[i] <= 3);
    assert.equal(Boolean(walls[i] || furniture[i]), Boolean(collision[i]), `obstacle at ${i}`);
  }
  for (const layer of map.layers.filter(l => l.type === 'tilelayer')) {
    assert.equal(layer.data.length, map.width * map.height);
    if (layer.name === 'collision') continue;
    for (const gid of layer.data.filter(Boolean))
      assert.ok(map.tilesets.some(t => gid >= t.firstgid && gid < t.firstgid + t.tilecount), `unknown GID ${gid}`);
  }
  // Both east-wing doorways remain visibly and logically unobstructed.
  for (const y of [11, 12, 13, 23, 24, 25]) {
    const i = y * map.width + 33;
    assert.equal(walls[i], 0); assert.equal(collision[i], 0);
  }
});

test('original atlas has six opaque surfaces and transparent off/on monitor tiles', () => {
  const atlas = createRoomAtlas();
  assert.equal(atlas.pixels.length, atlas.width * atlas.height * 4);
  for (let tile = 0; tile < 6; tile++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
    assert.equal(atlas.pixels[(y * atlas.width + tile * 16 + x) * 4 + 3], 255);
  assert.equal(atlas.tileset.firstgid, 1);
  assert.equal(atlas.tileset.tilecount, 14);
  assert.deepEqual(atlas, createRoomAtlas());
  const colors = new Set(Array.from({ length: 6 }, (_, i) => atlas.pixels.slice(i * 64, i * 64 + 3).join(',')));
  assert.equal(colors.size, 6);
  const alpha = (tile) => Array.from({ length: 256 }, (_, i) => atlas.pixels[((Math.floor(i / 16) * atlas.width) + tile * 16 + (i % 16)) * 4 + 3]);
  for (let tile = 6; tile < 14; tile++) {
    assert.ok(alpha(tile).some(value => value === 0), `monitor tile ${tile} transparency`);
    assert.ok(alpha(tile).some(value => value === 255), `monitor tile ${tile} pixels`);
  }
});

test('all desks expose procedural off monitors for the live DeskScreen overlay', () => {
  const { map, desks } = createOfficeRoom(entries);
  const above = map.layers.find(l => l.name === 'furniture-above').data;
  for (const desk of desks) {
    const x = desk.x + 1, y = desk.y;
    assert.deepEqual([above[y * map.width + x], above[y * map.width + x + 1], above[(y + 1) * map.width + x], above[(y + 1) * map.width + x + 1]], [7, 8, 9, 10]);
  }
});
