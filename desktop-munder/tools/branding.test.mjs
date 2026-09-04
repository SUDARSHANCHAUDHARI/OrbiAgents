import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(new URL('../src/renderer/' + path, import.meta.url), 'utf8');

test('renderer logo imports resolve to a self-contained original SVG', () => {
  for (const file of ['src/main.tsx', 'src/App.tsx']) {
    const source = read(file);
    assert.match(source, /import brandLogo from '\.\/assets\/orbi-mark\.svg\?url'/);
    assert.doesNotMatch(source, /@brand\/logo\.png/);
  }
  const svg = read('src/assets/orbi-mark.svg');
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.doesNotMatch(svg, /<script|<foreignObject|href=|onload=/i);
  assert.match(read('src/main.tsx'), /favicon.type = 'image\/svg\+xml'/);
  assert.match(read('index.html'), /<title>OrbiAgents Migration<\/title>/);
});
