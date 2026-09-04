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

test('original atlas is deterministic, opaque RGBA with six distinct surfaces', () => {
  const atlas = createRoomAtlas();
  assert.equal(atlas.pixels.length, atlas.width * atlas.height * 4);
  for (let i = 3; i < atlas.pixels.length; i += 4) assert.equal(atlas.pixels[i], 255);
  assert.equal(atlas.tileset.firstgid, 1);
  assert.equal(atlas.tileset.tilecount, 6);
  assert.deepEqual(atlas, createRoomAtlas());
  const colors = new Set(Array.from({ length: 6 }, (_, i) => atlas.pixels.slice(i * 64, i * 64 + 3).join(',')));
  assert.equal(colors.size, 6);
});
