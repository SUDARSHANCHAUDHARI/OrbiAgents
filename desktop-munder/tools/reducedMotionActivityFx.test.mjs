import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const floor = readFileSync(new URL('../src/renderer/src/scene/office/OfficeFloor.tsx', import.meta.url), 'utf8');
const character = readFileSync(new URL('../src/renderer/src/scene/office/Character.ts', import.meta.url), 'utf8');

test('reduced motion keeps the entrance cue static and removes fixture particles', () => {
  assert.match(floor, /prefersReducedMotion\s*\? 0\.36\s*:\s*Math\.sin\(progress \* Math\.PI \* 3\)/);
  assert.match(floor, /sinkG\.rect\(7, 6, 2, 4\).*\n\s*if \(prefersReducedMotion\) return;/);
  assert.match(floor, /if \(machineBusy <= 0 \|\| prefersReducedMotion\) return;/);
  assert.match(floor, /const drawErrandFx[\s\S]*?g\.clear\(\);\s*if \(prefersReducedMotion\) return;/);
});

test('live preference changes clear active scene effects immediately', () => {
  assert.match(floor, /syncReducedMotionActivityFx\?\.\(\)/);
  assert.match(floor, /syncReducedMotionActivityFx = \(\) => \{[\s\S]*?updateAirlockPulse\(0\);[\s\S]*?drawSink\(fxClock\);[\s\S]*?drawMachine\(fxClock\);[\s\S]*?effect\.clear\(\);/);
});

test('character activity keeps static objects while suppressing decorative particles', () => {
  assert.match(character, /prefersReducedMotion\?: \(\) => boolean/);
  assert.match(floor, /prefersReducedMotion: \(\) => prefersReducedMotion/);
  assert.match(character, /if \(!reducedMotion\) \{\s*\/\/ two staggered steam pixels/);
  assert.match(character, /for \(let i = 0; !reducedMotion && i < 3; i\+\+\)/);
  assert.match(character, /for \(let i = 0; !reducedMotion && i < 4; i\+\+\)/);
});
