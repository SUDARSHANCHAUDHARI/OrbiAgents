import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('removed workers remain ticked while walking out through the semantic entrance', () => {
  assert.match(source, /const departing = new Map<string, Character>\(\)/);
  assert.match(source, /character\.walkToAndThen\(entrance, finishDeparture\)/);
  assert.match(source, /for \(const character of departing\.values\(\)\) character\.update\(dt\)/);
  assert.match(source, /watchdog = setTimeout\(finishDeparture, 8000\)/);
  assert.match(source, /triggerAirlockPulse\(\);\n          character\.hide\(0\);/);
  assert.match(source, /for \(const timer of departureTimers\) clearTimeout\(timer\)/);
});
