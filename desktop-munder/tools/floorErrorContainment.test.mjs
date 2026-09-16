import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('office error states stay inside the floor panel', () => {
  assert.match(floor, /width: '100%', height: '100%',\s*position: 'relative'/);
  assert.match(floor, /position:absolute;inset:0/);
});

test('office error states announce actionable failures accessibly', () => {
  assert.match(floor, /note\.setAttribute\('role', 'status'\)/);
  assert.match(floor, /note\.setAttribute\('aria-live', 'polite'\)/);
  assert.match(floor, /note\.textContent = text/);
});
