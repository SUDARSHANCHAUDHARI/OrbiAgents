import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createOfficeRoom } from '../theme/room.mjs';

const officeFloor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');
const { entries } = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

test('brewing steam follows the active theme coffee-machine anchor', () => {
  assert.match(officeFloor, /machineG\.position\.set\(MACHINE_STAND\.x \* ts0, \(MACHINE_STAND\.y - 1\) \* ts0\)/);
  assert.match(officeFloor, /machineG\.zIndex = \(MACHINE_STAND\.y - 1\) \* ts0/);
  assert.doesNotMatch(officeFloor, /machineG\.position\.set\(26 \* ts0, 17 \* ts0\)/);
});

test('sink animation preserves approved room artwork and draws only live wash effects', () => {
  const { map, coffee } = createOfficeRoom(entries);
  const below = map.layers.find(layer => layer.name === 'furniture-below').data;
  const sinkSheet = map.tilesets.find(sheet => sheet.image.endsWith('/Sink.png'));
  assert.ok(sinkSheet);
  assert.equal(below[coffee.sinkTile.y * map.width + coffee.sinkTile.x],
    sinkSheet.firstgid + sinkSheet.columns);
  assert.match(officeFloor, /The approved room tile owns the basin and faucet; this layer is FX only/);
  assert.match(officeFloor, /if \(sinkBusy > 0\)/);
  assert.doesNotMatch(officeFloor, /sinkG\.rect\(2, 6, 12, 8\)/);
  assert.doesNotMatch(officeFloor, /sinkG\.rect\(7, 2, 2, 4\)/);
});
