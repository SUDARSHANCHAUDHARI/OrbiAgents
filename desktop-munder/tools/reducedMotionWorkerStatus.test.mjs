import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const character = readFileSync(new URL('../src/renderer/src/scene/office/Character.ts', import.meta.url), 'utf8');

test('reduced motion holds the working halo at a steady midpoint', () => {
  assert.match(character, /if \(!reducedMotion\) this\.workGlowElapsed \+= dt/);
  assert.match(character, /const phase = reducedMotion\s*\? 0\.5\s*:\s*\(Math\.sin/);
  assert.match(character, /this\.workGlow\.alpha = \(0\.18 \+ 0\.27 \* phase\)/);
  assert.match(character, /this\.workGlow\.scale\.set\(0\.95 \+ 0\.15 \* phase\)/);
});

test('reduced motion keeps continuous warning glyphs static and recognizable', () => {
  assert.match(character, /this\.prefersReducedMotion\(\) \|\| Math\.floor\(this\.glyphElapsed \/ 0\.4\)/);
  assert.match(character, /const p = this\.prefersReducedMotion\(\)\s*\? 0\.5\s*:\s*\(Math\.sin/);
  assert.match(character, /fill\(reducedMotion \|\| i === idx \? 0xff9f43 : 0x6b5878\)/);
});

test('brief success and cheer lifecycle cues remain unchanged', () => {
  assert.match(character, /if \(this\.glyphElapsed > 0\.9\) this\.setStatusGlyph\('none'\)/);
  assert.match(character, /const hop = Math\.abs\(Math\.sin\(t \* Math\.PI \* 2\.2\)\) \* 5 \* decay/);
});
