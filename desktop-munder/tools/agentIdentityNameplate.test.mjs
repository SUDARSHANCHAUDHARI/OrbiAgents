import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const character = readFileSync(new URL('../src/renderer/src/scene/office/Character.ts', import.meta.url), 'utf8');
const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('worker identity nameplate is bounded and follows hover or selection', () => {
  assert.match(character, /displayName\?: string/);
  assert.match(character, /this\.setDisplayName\(options\.displayName\)/);
  assert.match(character, /name\?\.trim\(\) \|\| this\.agentId/);
  assert.match(character, /const visibleName = displayName\.length > 18/);
  assert.match(character, /this\.identityNameText\.text = visibleName/);
  assert.match(character, /const width = visibleName\.length \* 4 \+ 14/);
  assert.match(character, /this\.identityNameplate\.visible = this\.selected \|\| this\.hovered/);
  assert.match(character, /this\.identityNameplate\.eventMode = 'none'/);
  assert.match(character, /this\.identityNameplate\.pivot\.set\(width \/ 2, 10\)/);
  assert.match(character, /this\.identityNameplate\.scale\.set\(1 \/ Math\.min\(Math\.max\(z, 0\.01\), 1\)\)/);
});

test('floor passes the human-readable agent name without changing click selection', () => {
  assert.match(floor, /displayName: agent\.name/);
  assert.match(floor, /rt\.character\.setDisplayName\(agent\.name\)/);
  assert.match(floor, /onClick: \(id\) => useStore\.getState\(\)\.select\(id\)/);
});

test('live renames redraw the existing nameplate without rebuilding the worker', () => {
  assert.match(character, /setDisplayName\(name\?: string\): void/);
  assert.match(character, /if \(visibleName === this\.visibleIdentityName\) return/);
  assert.match(character, /this\.identityNameBg\.clear\(\)/);
  assert.match(character, /this\.identityNameplate\.pivot\.set\(width \/ 2, 10\)/);
});

test('live status changes recolor a retained pixel lamp before state short-circuiting', () => {
  assert.match(character, /private identityStatusLamp: Graphics/);
  assert.match(character, /setAgentStatus\(status: string\): void/);
  assert.match(character, /if \(status === this\.visibleIdentityStatus\) return/);
  for (const status of ['idle', 'thinking', 'working', 'waiting', 'blocked', 'success', 'ghost', 'compacting', 'looping', 'typing']) {
    assert.match(character, new RegExp(`${status}: 0x[0-9a-f]+`));
  }
  assert.match(character, /\.rect\(4, 4, 3, 3\)/);
  assert.match(floor, /rt\.character\.setDisplayName\(agent\.name\);\n\s*rt\.character\.setAgentStatus\(agent\.status\);\n\s*const changed/);
});
