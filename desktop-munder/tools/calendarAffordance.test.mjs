import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('calendar names and signals its triggers action on hover', () => {
  assert.match(source, /const calendarPlacard = new Container\(\)/);
  assert.match(source, /text: t\('commandCenter\.tabs\.triggers'\)\.toUpperCase\(\)/);
  assert.match(source, /const calendarPlacardWidth = Math\.ceil\(calendarPlacardText\.width\) \+ 10/);
  assert.match(source, /pointerover[\s\S]*?calendarPlacard\.visible = true/);
  assert.match(source, /pointerout[\s\S]*?calendarPlacard\.visible = false/);
  assert.match(source, /drawCalendarAffordance\(true\)/);
});

test('calendar preserves the reviewed triggers navigation', () => {
  assert.match(source, /const god = st\.agents\.find\(\(a\) => a\.isGod\)/);
  assert.match(source, /if \(god\) st\.select\(god\.id\)/);
  assert.match(source, /st\.requestCommandCenterTab\('triggers'\)/);
});
