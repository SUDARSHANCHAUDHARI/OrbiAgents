import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('semantic entrance kiosk opens the existing reviewed hire flow', () => {
  assert.match(source, /hireG\.position\.set\(theme\.anchors\.hire\.x/);
  assert.match(source, /useStore\.getState\(\)\.setAddAgentOpen\(true\)/);
  assert.match(source, /hireG\.hitArea/);
  assert.doesNotMatch(source, /hireG\.position\.set\(19|hireG\.position\.set\([^\n]*28/);
});
