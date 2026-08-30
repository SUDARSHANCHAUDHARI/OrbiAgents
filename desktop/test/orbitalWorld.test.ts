import assert from "node:assert/strict";
import test from "node:test";
import { centerCameraOn, clampOrbitalCamera, createOrbitalWorld, findOrbitalPath, isWalkable, ORBITAL_WORLD_COLUMNS, ORBITAL_WORLD_ROWS, stationById, stationForState, tileAt } from "../src/renderer/src/office/orbitalWorld";

test("orbital world is deterministic, bounded, and contains unique stations", () => {
  const first = createOrbitalWorld(); const second = createOrbitalWorld();
  assert.deepEqual(first, second);
  assert.equal(first.tiles.length, ORBITAL_WORLD_COLUMNS * ORBITAL_WORLD_ROWS);
  assert.equal(new Set(first.stations.map((station) => station.id)).size, first.stations.length);
  assert.equal(tileAt(first, -1, 0), null); assert.equal(tileAt(first, first.columns, 0), null);
  for (const station of first.stations) assert.equal(isWalkable(tileAt(first, station.column, station.row)), true);
});

test("runtime activity maps to purposeful orbital stations", () => {
  const world = createOrbitalWorld();
  assert.equal(stationById(world, stationForState("coding")).label, "Code Console");
  assert.equal(stationById(world, stationForState("permission-waiting")).label, "Signal Array");
  assert.equal(stationById(world, stationForState("failed")).label, "Recovery Pod");
});

test("every orbital station has a stable walkable route to Orbi Prime", () => {
  const world = createOrbitalWorld();
  const prime = stationById(world, "prime");
  for (const station of world.stations) {
    const route = findOrbitalPath(world, station, prime);
    assert.deepEqual(route[0], { column: station.column, row: station.row });
    assert.deepEqual(route.at(-1), { column: prime.column, row: prime.row });
    assert.equal(route.every((step) => isWalkable(tileAt(world, step.column, step.row))), true);
    assert.deepEqual(findOrbitalPath(world, station, prime), route);
  }
});

test("camera centers on tiles and remains inside integer world bounds", () => {
  const world = createOrbitalWorld();
  const camera = { x: 200, y: 300, zoom: 2 as const, viewportWidth: 640, viewportHeight: 360 };
  assert.deepEqual(clampOrbitalCamera(camera, world), { ...camera, x: 0, y: 0 });
  const centered = centerCameraOn(camera, world, 39, 23);
  assert.equal(Number.isInteger(centered.x), true); assert.equal(Number.isInteger(centered.y), true);
  assert.ok(centered.x <= 0 && centered.x >= centered.viewportWidth - world.columns * world.tileSize * centered.zoom);
  assert.ok(centered.y <= 0 && centered.y >= centered.viewportHeight - world.rows * world.tileSize * centered.zoom);
});
