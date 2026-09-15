import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const character = readFileSync(new URL('../src/renderer/src/scene/office/Character.ts', import.meta.url), 'utf8');
const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');
const thoughtBubble = readFileSync(new URL('../src/renderer/src/scene/office/ThoughtBubble.ts', import.meta.url), 'utf8');

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
  assert.match(character, /this\.identityNameplateScale = 1 \/ Math\.min\(Math\.max\(z, 0\.01\), 1\)/);
  assert.match(character, /this\.identityNameplate\.scale\.set\(this\.identityNameplateScale\)/);
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

test('nameplate frame shares the lamp status color', () => {
  assert.match(character, /const NAMEPLATE_STATUS_COLOR: Record<string, number>/);
  assert.match(character, /this\.identityStatusColor = NAMEPLATE_STATUS_COLOR\[status\] \?\? NAMEPLATE_STATUS_COLOR\.idle/);
  assert.match(character, /\.fill\(this\.identityStatusColor\)/);
  assert.match(character, /\.stroke\(\{ color: this\.identityStatusColor, width: 1 \}\)/);
  assert.match(character, /this\.identityNameplateWidth = width;\n\s*this\.redrawIdentityFrame\(\)/);
});

test('nameplate center clamps inside map bounds after name, zoom, and movement changes', () => {
  assert.match(character, /const mapWidth = this\.mapRenderer\.width \* this\.mapRenderer\.tileSize/);
  assert.match(character, /const halfWidth = this\.identityNameplateWidth \* this\.identityNameplateScale \/ 2/);
  assert.match(character, /Math\.min\(Math\.max\(this\.px, minCenter\), maxCenter\)/);
  assert.match(character, /this\.identityNameplate\.position\.set\(Math\.round\(center - this\.px\), -29\)/);
  assert.equal((character.match(/this\.updateIdentityPosition\(\)/g) ?? []).length, 3);
});

test('active statuses keep worker identity visible without drawing a selection ring', () => {
  assert.match(character, /this\.statusKeepsIdentityVisible = status !== 'idle' && status !== 'ghost'/);
  assert.match(character, /this\.identityNameplate\.visible = this\.selected \|\| this\.hovered \|\| this\.statusKeepsIdentityVisible/);
  assert.match(character, /\.fill\(this\.identityStatusColor\);\n\s*this\.redrawIdentityFrame\(\);\n\s*this\.drawSelectionRing\(\)/);
  assert.match(character, /if \(!this\.selected && !this\.hovered\) return/);
});

test('transient status glyphs clear the identity nameplate band', () => {
  assert.match(character, /identityNameplate\.position\.set\(0, -29\)/);
  assert.match(character, /identityNameplate\.pivot\.set\(width \/ 2, 10\)/);
  assert.match(character, /const yTop = -48/);
  assert.doesNotMatch(character, /const yTop = -34/);
});

test('thought cloud tail clears glyph and identity overlays', () => {
  assert.match(thoughtBubble, /const OFFSET_Y = -60/);
  assert.match(thoughtBubble, /puff\(baseX, this\.bgH \+ 4, 3\)/);
  assert.match(thoughtBubble, /puff\(baseX - 5, this\.bgH \+ 9, 2\)/);
  assert.doesNotMatch(thoughtBubble, /const OFFSET_Y = -38/);
});
