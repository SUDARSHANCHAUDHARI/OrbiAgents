import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');

test('worker admission pulses the semantic entrance airlock through the scene ticker', () => {
  assert.match(source, /airlockPulse\.position\.set\(\(entrance\.x - 1\)/);
  assert.match(source, /character\.show\(charLayer\);\n        character\.setSelected\(.*\);\n        triggerAirlockPulse\(\);/);
  assert.match(source, /updateAirlockPulse\(dt\);/);
  assert.doesNotMatch(source, /setInterval\([^\n]*airlock|setTimeout\([^\n]*airlock/);
});
