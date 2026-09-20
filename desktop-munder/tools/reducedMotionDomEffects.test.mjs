import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/renderer/src/design/global.css', import.meta.url), 'utf8');

test('reduced motion disables DOM animation and transitions deterministically', () => {
  const media = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(media, /\*, \*::before, \*::after \{/);
  assert.match(media, /animation: none !important/);
  assert.match(media, /transition: none !important/);
  assert.doesNotMatch(media, /animation-duration|transition-duration/);
});

test('reduced motion disables smooth scrolling', () => {
  const media = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(media, /html \{ scroll-behavior: auto !important; \}/);
});

test('normal-motion keyframes remain available outside the media query', () => {
  assert.match(css, /@keyframes cth-blink/);
  assert.match(css, /@keyframes cth-pulse/);
  assert.ok(css.indexOf('@keyframes cth-pulse') < css.indexOf('@media (prefers-reduced-motion: reduce)'));
});
