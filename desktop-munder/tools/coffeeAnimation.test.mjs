import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const officeFloor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('brewing steam follows the active theme coffee-machine anchor', () => {
  assert.match(officeFloor, /machineG\.position\.set\(MACHINE_STAND\.x \* ts0, \(MACHINE_STAND\.y - 1\) \* ts0\)/);
  assert.match(officeFloor, /machineG\.zIndex = \(MACHINE_STAND\.y - 1\) \* ts0/);
  assert.doesNotMatch(officeFloor, /machineG\.position\.set\(26 \* ts0, 17 \* ts0\)/);
});
