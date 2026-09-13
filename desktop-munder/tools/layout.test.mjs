import assert from 'node:assert/strict';
import test from 'node:test';
import { createOfficeLayout } from '../theme/layout.mjs';

test('every desk, meeting seat, café seat and interaction stand is reachable', () => {
  const { map, primarySeatNames, warroomSeatNames, cafeSeatNames,
    coffee, hireKiosk, planter, cafeteriaPlanter, archiveShelf, coldStorage } = createOfficeLayout();
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
  assert.equal(warroomSeatNames.length, 6);
  assert.equal(cafeSeatNames.length, 6);
  assert.equal(new Set(spawns.map(s => s.name)).size, spawns.length);
  for (const spawn of spawns) assert.ok(visited.has(`${spawn.x / 16},${spawn.y / 16}`), spawn.name);
  for (const point of [coffee.trayStand, coffee.machineStand, coffee.sinkStand,
    hireKiosk.stand, planter.stand, cafeteriaPlanter.stand, archiveShelf.stand, coldStorage.stand])
    assert.ok(visited.has(`${point.x},${point.y}`), 'interaction stand');
  for (const name of [...primarySeatNames, ...warroomSeatNames, ...cafeSeatNames])
    assert.ok(spawns.some(s => s.name === name));
});

test('entrance hire kiosk is blocked beside a reachable launch stand', () => {
  const { map, hireKiosk } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  const at = (x, y) => collision[y * map.width + x];
  assert.deepEqual(hireKiosk, {
    x: 19, y: 28, width: 2, height: 2, stand: { x: 21, y: 29 }, facing: 'left',
  });
  assert.deepEqual([at(19, 28), at(20, 28), at(19, 29), at(20, 29), at(21, 29)], [1, 1, 1, 1, 0]);
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

test('boardroom collision matches the extended table and leaves surrounding floor open', () => {
  const { map } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  const at = (x, y) => collision[y * map.width + x];
  for (let y = 6; y < 8; y++) for (let x = 38; x < 43; x++) assert.equal(at(x, y), 1);
  for (const [x, y] of [[38, 5], [42, 5], [38, 8], [42, 8], [37, 6], [43, 6]])
    assert.equal(at(x, y), 0, `open boardroom tile ${x},${y}`);
});

test('boardroom exposes six walkable seats around all four table sides', () => {
  const { map, warroomSeatNames } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  const spawns = map.layers.find(l => l.name === 'spawn-points').objects;
  const expected = [[37, 6], [43, 6], [39, 5], [41, 5], [39, 8], [41, 8]];
  assert.deepEqual(warroomSeatNames, [1, 2, 3, 4, 5, 6].map(i => `warroom-${i}`));
  assert.deepEqual(warroomSeatNames.map(name => {
    const seat = spawns.find(point => point.name === name);
    return [seat.x / map.tilewidth, seat.y / map.tileheight];
  }), expected);
  for (const [x, y] of expected) assert.equal(collision[y * map.width + x], 0);
});

test('café collision matches its complete table and leaves all four seats open', () => {
  const { map, loungeTable, cafeSeatNames } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  const at = (x, y) => collision[y * map.width + x];
  for (let y = 19; y < 21; y++) for (let x = 38; x < 42; x++) assert.equal(at(x, y), 1);
  for (const [x, y] of [[37, 19], [42, 19], [38, 21], [41, 21]])
    assert.equal(at(x, y), 0, `open café seat ${x},${y}`);
  assert.deepEqual(loungeTable, { x: 43, y: 25, width: 1, height: 1 });
  assert.equal(at(43, 25), 1);
  assert.deepEqual(cafeSeatNames.slice(-2), ['cafe-seat-5', 'cafe-seat-6']);
  assert.deepEqual([at(43, 24), at(43, 26)], [0, 0]);
});

test('licensed room props are blocked while their interaction stands stay reachable', () => {
  const { map, props } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  for (const prop of props) for (let y = prop.y; y < prop.y + prop.height; y++)
    for (let x = prop.x; x < prop.x + prop.width; x++) assert.equal(collision[y * map.width + x], 1, prop.name);
  for (const { x, y } of [{ x: 29, y: 28 }, { x: 3, y: 28 }, { x: 44, y: 27 }, { x: 35, y: 5 }])
    assert.equal(collision[y * map.width + x], 0, `stand ${x},${y}`);
});

test('orbital planter is blocked while its watering stand remains reachable', () => {
  const { map, planter, cafeteriaPlanter } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  const at = (x, y) => collision[y * map.width + x];
  assert.deepEqual(planter, {
    x: 31, y: 3, width: 1, height: 2,
    stand: { x: 30, y: 4 }, facing: 'right', fx: { x: 31, y: 4 },
  });
  assert.deepEqual([at(31, 3), at(31, 4), at(30, 4)], [1, 1, 0]);
  assert.deepEqual(cafeteriaPlanter, {
    x: 46, y: 27, width: 1, height: 2,
    stand: { x: 45, y: 28 }, facing: 'right', fx: { x: 46, y: 28 },
  });
  assert.deepEqual([at(46, 27), at(46, 28), at(45, 28)], [1, 1, 0]);
});

test('orbital archive shelf is blocked beside its browsing stand', () => {
  const { map, archiveShelf } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  const at = (x, y) => collision[y * map.width + x];
  assert.deepEqual(archiveShelf, {
    x: 31, y: 23, width: 2, height: 2,
    stand: { x: 30, y: 24 }, facing: 'right', fx: { x: 31, y: 23 },
  });
  assert.deepEqual([at(31, 23), at(32, 23), at(31, 24), at(32, 24), at(30, 24)], [1, 1, 1, 1, 0]);
});

test('orbital cold storage is blocked beside its inspection stand', () => {
  const { map, coldStorage } = createOfficeLayout();
  const collision = map.layers.find(l => l.name === 'collision').data;
  const at = (x, y) => collision[y * map.width + x];
  assert.deepEqual(coldStorage, {
    x: 45, y: 15, width: 1, height: 2,
    stand: { x: 45, y: 17 }, facing: 'up', fx: { x: 45, y: 16 },
  });
  assert.deepEqual([at(45, 15), at(45, 16), at(45, 17)], [1, 1, 0]);
});
