import assert from 'node:assert/strict';
import test from 'node:test';
import { createOfficeLayout } from '../theme/layout.mjs';

test('every desk, meeting seat, café seat and coffee stand is reachable', () => {
  const { map, primarySeatNames, cafeSeatNames, coffee } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  const spawns = map.layers.find(l => l.name === 'spawn-points').objects;
  const entrance = spawns.find(s => s.name === 'entrance');
  const queue = [[entrance.x / 16, entrance.y / 16]], visited = new Set();
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i], key = `${x},${y}`;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height || visited.has(key) || collision[y * map.width + x]) continue;
    visited.add(key);
    queue.push([x-1,y], [x+1,y], [x,y-1], [x,y+1]);
  }
  assert.equal(primarySeatNames.length, 15);
  assert.equal(cafeSeatNames.length, 4);
  assert.equal(new Set(spawns.map(s => s.name)).size, spawns.length);
  for (const spawn of spawns) assert.ok(visited.has(`${spawn.x / 16},${spawn.y / 16}`), spawn.name);
  for (const point of [coffee.trayStand, coffee.machineStand, coffee.sinkStand])
    assert.ok(visited.has(`${point.x},${point.y}`), 'coffee stand');
  for (const name of [...primarySeatNames, ...cafeSeatNames]) assert.ok(spawns.some(s => s.name === name));
});

test('desk footprints and perimeter are blocked without forced seat overrides', () => {
  const { map, desks } = createOfficeLayout();
  const cells = map.layers[0].data;
  assert.equal(cells.length, map.width * map.height);
  for (const desk of desks) for (let y = desk.y; y < desk.y + desk.height; y++)
    for (let x = desk.x; x < desk.x + desk.width; x++) assert.equal(cells[y * map.width + x], 1);
  for (let x = 0; x < map.width; x++) {
    assert.equal(cells[x], 1); assert.equal(cells[(map.height - 1) * map.width + x], 1);
  }
  for (let y = 0; y < map.height; y++) {
    assert.equal(cells[y * map.width], 1); assert.equal(cells[y * map.width + map.width - 1], 1);
  }
  assert.deepEqual(createOfficeLayout(), createOfficeLayout());
});

test('licensed room props are blocked while their interaction stands stay reachable', () => {
  const { map, props } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  for (const prop of props) for (let y = prop.y; y < prop.y + prop.height; y++)
    for (let x = prop.x; x < prop.x + prop.width; x++) assert.equal(collision[y * map.width + x], 1, prop.name);
  for (const { x, y } of [{ x: 29, y: 28 }, { x: 3, y: 28 }, { x: 44, y: 27 }, { x: 35, y: 5 }])
    assert.equal(collision[y * map.width + x], 0, `stand ${x},${y}`);
});
