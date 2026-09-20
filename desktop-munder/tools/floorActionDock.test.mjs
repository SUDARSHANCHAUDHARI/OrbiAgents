import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/renderer/src/design/global.css', import.meta.url), 'utf8');

test('office floor exposes its canvas actions through a native keyboard toolbar', () => {
  assert.match(floor, /role="toolbar" aria-label=\{t\('office\.floorActions'\)\}/);
  assert.equal((floor.match(/<button type="button"/g) ?? []).length, 5);
  for (const action of ['setAddAgentOpen(true)', "openFloorCommandTab('triggers')",
    "openFloorCommandTab('tasks')", "openFloorCommandTab('human')", 'window.close()']) {
    assert.match(floor, new RegExp(action.replace(/[().]/g, '\\$&')));
  }
});

test('canvas and keyboard command-center actions share one reviewed implementation', () => {
  assert.match(floor, /function openFloorCommandTab\(tab: FloorCommandTab\)/);
  for (const tab of ['triggers', 'tasks', 'human']) {
    assert.equal((floor.match(new RegExp(`openFloorCommandTab\\('${tab}'\\)`, 'g')) ?? []).length, 2);
  }
});

test('floor action dock keeps compact visible focus and destructive close feedback', () => {
  assert.match(css, /\.cth-floor-action-dock \{/);
  assert.match(css, /\.cth-floor-action-dock button:focus-visible/);
  assert.match(css, /\.cth-floor-action-dock__close:focus-visible/);
  assert.match(css, /min-height: 28px/);
});
