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
    assert.ok(floor[i] === 1 || (floor[i] >= 15 && floor[i] <= 22));
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

test('original atlas has zone surfaces and transparent off/on monitor tiles', () => {
  const atlas = createRoomAtlas();
  assert.equal(atlas.pixels.length, atlas.width * atlas.height * 4);
  for (let tile = 0; tile < 6; tile++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
    assert.equal(atlas.pixels[(y * atlas.width + tile * 16 + x) * 4 + 3], 255);
  assert.equal(atlas.tileset.firstgid, 1);
  assert.equal(atlas.tileset.tilecount, 29);
  assert.deepEqual(atlas, createRoomAtlas());
  const colors = new Set(Array.from({ length: 6 }, (_, i) => atlas.pixels.slice(i * 64, i * 64 + 3).join(',')));
  assert.equal(colors.size, 6);
  const alpha = (tile) => Array.from({ length: 256 }, (_, i) => atlas.pixels[((Math.floor(i / 16) * atlas.width) + tile * 16 + (i % 16)) * 4 + 3]);
  for (let tile = 6; tile < 14; tile++) {
    assert.ok(alpha(tile).some(value => value === 0), `monitor tile ${tile} transparency`);
    assert.ok(alpha(tile).some(value => value === 255), `monitor tile ${tile} pixels`);
  }
  for (let tile = 14; tile < 22; tile++)
    assert.ok(alpha(tile).every(value => value === 255), `zone tile ${tile} opacity`);
  for (let tile = 22; tile < 26; tile++)
    assert.ok(alpha(tile).every(value => value === 255), `wall tile ${tile} opacity`);
  for (let tile = 26; tile < 29; tile++) {
    assert.ok(alpha(tile).some(value => value === 0), `chair tile ${tile} transparency`);
    assert.ok(alpha(tile).some(value => value === 255), `chair tile ${tile} pixels`);
  }
});

test('boardroom and café seats have directional chairs without blocking paths', () => {
  const { map } = createOfficeRoom(entries);
  const above = map.layers.find(l => l.name === 'furniture-above').data;
  const collision = map.layers.find(l => l.name === 'collision').data;
  const chairs = [
    [37, 6, 29], [43, 6, 28],
    [37, 19, 29], [42, 19, 28], [38, 21, 27], [41, 21, 27],
  ];
  for (const [x, y, gid] of chairs) {
    const index = y * map.width + x;
    assert.equal(above[index], gid, `chair at ${x},${y}`);
    assert.equal(collision[index], 0, `walkable seat at ${x},${y}`);
  }
});

test('workspace, boardroom, café, entrance and doorways have distinct floor treatments', () => {
  const { map } = createOfficeRoom(entries);
  const floor = map.layers.find(l => l.name === 'floor').data;
  const at = (x, y) => floor[y * map.width + x];
  assert.ok([1, 15, 16].includes(at(5, 10)));
  assert.ok([17, 18].includes(at(40, 8)));
  assert.ok([19, 20].includes(at(40, 24)));
  assert.equal(at(23, 29), 21);
  assert.equal(at(33, 12), 22);
  assert.equal(at(33, 24), 22);
});

test('perimeter, side, divider and doorway-jamb walls remain structurally distinct', () => {
  const { map } = createOfficeRoom(entries);
  const walls = map.layers.find(l => l.name === 'walls').data;
  const at = (x, y) => walls[y * map.width + x];
  assert.equal(at(20, 0), 23);
  assert.equal(at(0, 12), 24);
  assert.equal(at(33, 8), 25);
  assert.equal(at(33, 10), 26);
  assert.equal(at(33, 14), 26);
  assert.equal(at(33, 12), 0);
  assert.equal(at(33, 24), 0);
});

test('all desks expose accessories beside procedural monitors', () => {
  const { map, desks } = createOfficeRoom(entries);
  const above = map.layers.find(l => l.name === 'furniture-above').data;
  const accessoryImages = new Set();
  for (const desk of desks) {
    const accessory = above[desk.y * map.width + desk.x];
    const sheet = map.tilesets.find(t => accessory >= t.firstgid && accessory < t.firstgid + t.tilecount);
    assert.ok(sheet, `desk ${desk.name} accessory has a valid tileset`);
    accessoryImages.add(sheet.image);
    const x = desk.x + 1, y = desk.y;
    assert.deepEqual([above[y * map.width + x], above[y * map.width + x + 1], above[(y + 1) * map.width + x], above[(y + 1) * map.width + x + 1]], [7, 8, 9, 10]);
  }
  assert.deepEqual(accessoryImages, new Set([
    'art/lpc-office/Laptop.png',
    'art/lpc-office/Rotary Phones.png',
    'art/lpc-office/Coffee Cup.png',
  ]));
});

test('desk accessories require every approved source sheet', () => {
  for (const image of ['Laptop.png', 'Rotary Phones.png', 'Coffee Cup.png']) {
    const withoutImage = entries.filter(entry => entry.path !== `art/lpc-office/${image}`);
    assert.throws(() => createOfficeRoom(withoutImage), new RegExp(`Missing desk accessory sheet: ${image.replace('.', '\\.')}`));
  }
});
