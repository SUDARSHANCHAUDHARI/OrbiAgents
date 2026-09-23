import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const splitter = readFileSync(new URL('../src/renderer/src/components/SidebarSplitter.tsx', import.meta.url), 'utf8');

test('sidebar splitter exposes an adjustable vertical separator', () => {
  assert.match(splitter, /role="separator"/);
  assert.match(splitter, /aria-label=\{splitterTitle\}/);
  assert.match(splitter, /title=\{splitterTitle\}/);
  assert.match(splitter, /aria-orientation="vertical"/);
  assert.match(splitter, /aria-valuemin=\{min\}/);
  assert.match(splitter, /aria-valuemax=\{clampMax\}/);
  assert.match(splitter, /aria-valuenow=\{width\}/);
  assert.match(splitter, /tabIndex=\{0\}/);
});

test('sidebar splitter supports directional and boundary keyboard resizing', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    assert.match(splitter, new RegExp(`e\\.key === '${key}'`));
  }
  assert.match(splitter, /onChange\(next\)/);
});

test('drag, keyboard and reset share viewport-aware bounds', () => {
  assert.match(splitter, /const clampMax = Math\.min\(max, Math\.max\(min, viewportWidth - 360\)\)/);
  assert.match(splitter, /Math\.min\(clampMax, Math\.max\(min, startRef\.current\.width \+ delta\)\)/);
  assert.match(splitter, /onDoubleClick=\{\(\) => onChange\(Math\.min\(clampMax, Math\.max\(min, 420\)\)\)\}/);
});
