import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('office clock names and distinguishes its close action on hover', () => {
  assert.match(source, /const clockPlacard = new Container\(\)/);
  assert.match(source, /text: t\('common\.close'\)\.toUpperCase\(\)/);
  assert.match(source, /const clockPlacardWidth = Math\.ceil\(clockPlacardText\.width\) \+ 10/);
  assert.match(source, /pointerover[\s\S]*?clockPlacard\.visible = true/);
  assert.match(source, /clockG\.rect\(1, 1, 14, 30\)\.stroke\(\{ color: 0xf0a3a3/);
  assert.match(source, /pointerout[\s\S]*?clockPlacard\.visible = false/);
});

test('office clock preserves the guarded close entry point', () => {
  assert.match(source, /clockG\.on\('pointertap', \(ev\) => \{/);
  assert.match(source, /ev\.stopPropagation\(\);\s*window\.close\(\)/);
});
