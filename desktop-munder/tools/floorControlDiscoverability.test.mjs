import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('semantic floor controls retain quiet outlines before hover', () => {
  for (const name of ['Calendar', 'Board', 'Clock', 'Ask']) {
    assert.match(floor, new RegExp(`const draw${name}Affordance = \\(hovered: boolean\\): void`));
    assert.match(floor, new RegExp(`draw${name}Affordance\\(false\\)`));
    assert.match(floor, new RegExp(`draw${name}Affordance\\(true\\)`));
  }
  assert.match(floor, /alpha: hovered \? 0\.9 : 0\.24/);
  assert.match(floor, /alpha: hovered \? 0\.9 : 0\.2/);
  assert.match(floor, /alpha: hovered \? 0\.95 : 0\.22/);
});

test('persistent outlines do not replace hover placards or reviewed actions', () => {
  for (const placard of ['calendarPlacard', 'boardPlacard', 'clockPlacard', 'askPlacard']) {
    assert.match(floor, new RegExp(`${placard}\\.visible = true`));
    assert.match(floor, new RegExp(`${placard}\\.visible = false`));
  }
  assert.match(floor, /openFloorCommandTab\('triggers'\)/);
  assert.match(floor, /openFloorCommandTab\('tasks'\)/);
  assert.match(floor, /openFloorCommandTab\('human'\)/);
  assert.match(floor, /window\.close\(\)/);
});
