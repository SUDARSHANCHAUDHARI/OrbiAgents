import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createOfficeFurniture } from '../theme/furniture.mjs';
const { entries } = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

test('furniture stamps resolve only approved source cells and match blocked footprints', () => {
  const { map, placements, desks, coffee } = createOfficeFurniture(entries);
  const data = map.layers.find(l => l.name === 'furniture-below').data;
  const collision = map.layers.find(l => l.name === 'collision').data;
  const spawns = map.layers.find(l => l.name === 'spawn-points').objects;
  assert.equal(placements.length, 16);
  assert.equal(data.filter(Boolean).length, 91);
  for (const placement of placements) {
    const sheet = map.tilesets.find(t => t.image === placement.image);
    for (let dy = 0; dy < placement.height; dy++) for (let dx = 0; dx < placement.width; dx++) {
      const index = (placement.y + dy) * map.width + placement.x + dx;
      const expected = sheet.firstgid + (placement.sy + dy) * sheet.columns + placement.sx + dx;
      assert.equal(data[index], expected);
      assert.ok(expected >= sheet.firstgid && expected < sheet.firstgid + sheet.tilecount);
      assert.equal(collision[index], 1, placement.name + ' should not obstruct a path');
    }
  }
  for (const desk of desks) {
    const stamp = placements.find(p => p.name === desk.name);
    assert.equal(stamp.width, desk.width);
    assert.equal(stamp.height, desk.height);
  }
  for (const spawn of spawns) assert.equal(data[(spawn.y / 16) * map.width + spawn.x / 16], 0);
  const machine = placements.find(p => p.name === 'coffee-machine');
  assert.equal(machine.x, coffee.machineStand.x);
  assert.equal(machine.y + 1, coffee.machineStand.y);
});

test('missing required art fails instead of silently rendering an empty scene', () => {
  assert.throws(() => createOfficeFurniture(entries.filter(e => !e.path.endsWith('Desk, Ornate.png'))), /Missing furniture sheet/);
  assert.throws(() => createOfficeFurniture(entries.filter(e => !e.path.endsWith('Coffee Maker.png'))), /Missing furniture sheet/);
});
