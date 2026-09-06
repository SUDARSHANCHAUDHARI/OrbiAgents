import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./package-macos.mjs', import.meta.url), 'utf8');

test('macOS package derives its icon from the original OrbiAgents SVG', () => {
  assert.match(source, /orbi-mark\.svg/);
  assert.match(source, /OrbiAgents\.iconset/);
  assert.match(source, /OrbiAgents\.icns/);
  assert.match(source, /mac: \{ icon: appIcon/);
  assert.doesNotMatch(source, /build\/icon\.icns/);
});
