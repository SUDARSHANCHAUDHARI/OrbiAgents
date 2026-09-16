import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const character = readFileSync(new URL('../src/renderer/src/scene/office/Character.ts', import.meta.url), 'utf8');
const sprite = readFileSync(new URL('../src/renderer/src/scene/office/CharacterSprite.ts', import.meta.url), 'utf8');

test('initial reduced-motion state reaches worker sprites before playback starts', () => {
  assert.match(character, /this\.prefersReducedMotion = options\.prefersReducedMotion \?\? \(\(\) => false\);\s*this\.sprite = new CharacterSprite\(options\.frames, this\.prefersReducedMotion\(\)\)/);
  assert.match(sprite, /constructor\(frames: Texture\[\]\[\], reducedMotion = false\)/);
  assert.match(sprite, /this\.sprite\.animationSpeed = this\.frameSpeed;\s*this\.syncPlayback\(\)/);
});

test('reduced motion freezes non-walking loops but preserves walking animation', () => {
  assert.match(sprite, /if \(this\.reducedMotion && this\.currentAnim !== 'walk'\) this\.sprite\.gotoAndStop\(0\);\s*else this\.sprite\.play\(\)/);
  assert.match(sprite, /this\.sprite\.animationSpeed = anim === 'walk' \? 0\.15 : anim === 'idle' \? 0\.08 : 0\.06;\s*this\.syncPlayback\(\)/);
});

test('live preference changes update existing worker sprites', () => {
  assert.match(character, /this\.sprite\.setReducedMotion\(this\.prefersReducedMotion\(\)\);\s*if \(!this\.isVisible\) return/);
  assert.match(sprite, /setReducedMotion\(reducedMotion: boolean\): void \{\s*if \(reducedMotion === this\.reducedMotion\) return;\s*this\.reducedMotion = reducedMotion;\s*this\.syncPlayback\(\)/);
});
