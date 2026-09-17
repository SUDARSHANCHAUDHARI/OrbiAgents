import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const hook = readFileSync(new URL('../src/renderer/src/hooks/useTypewriter.ts', import.meta.url), 'utf8');

test('typewriter subscribes to the live reduced-motion preference', () => {
  assert.match(hook, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(hook, /query\.addEventListener\('change', onChange\)/);
  assert.match(hook, /query\.removeEventListener\('change', onChange\)/);
  assert.match(hook, /\[text, seed, cps, reducedMotion\]/);
});

test('reduced motion reveals the complete recent message without an interval', () => {
  assert.match(hook, /if \(reducedMotion \|\| \(wasReduced && sameText\)\) \{\s*setShown\(text\);\s*setDone\(true\);\s*return;/);
  assert.match(hook, /if \(!text\) \{ setShown\(''\); setDone\(true\); return; \}\s*if \(reducedMotion/);
  assert.ok(hook.indexOf('if (reducedMotion') < hook.indexOf('window.setInterval'));
});

test('leaving reduced motion does not replay an unchanged message', () => {
  assert.match(hook, /const wasReduced = previousReducedMotion\.current;\s*const sameText = previousText\.current === text;/);
  assert.match(hook, /previousReducedMotion\.current = reducedMotion;\s*previousText\.current = text;/);
  assert.match(hook, /reducedMotion \|\| \(wasReduced && sameText\)/);
});
