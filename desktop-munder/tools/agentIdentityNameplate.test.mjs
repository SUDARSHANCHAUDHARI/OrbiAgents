import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const character = readFileSync(new URL('../src/renderer/src/scene/office/Character.ts', import.meta.url), 'utf8');
const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('worker identity nameplate is bounded and follows hover or selection', () => {
  assert.match(character, /displayName\?: string/);
  assert.match(character, /options\.displayName\?\.trim\(\) \|\| options\.agentId/);
  assert.match(character, /const visibleName = displayName\.length > 18/);
  assert.match(character, /text: visibleName/);
  assert.match(character, /const nameWidth = visibleName\.length \* 4 \+ 10/);
  assert.match(character, /this\.identityNameplate\.visible = this\.selected \|\| this\.hovered/);
  assert.match(character, /this\.identityNameplate\.eventMode = 'none'/);
});

test('floor passes the human-readable agent name without changing click selection', () => {
  assert.match(floor, /displayName: agent\.name/);
  assert.match(floor, /onClick: \(id\) => useStore\.getState\(\)\.select\(id\)/);
});
