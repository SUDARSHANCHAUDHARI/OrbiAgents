import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panes = readFileSync(new URL('../src/renderer/src/ide/GitPanes.tsx', import.meta.url), 'utf8');

test('history and compare file rows use a native button', () => {
  assert.match(panes, /<button type="button" onClick=\{onClick\}/);
  assert.doesNotMatch(panes, /<div onClick=\{onClick\}/);
});

test('native file row preserves the full-width compact visual treatment', () => {
  assert.match(panes, /width: '100%', border: 'none', background: 'transparent', textAlign: 'start'/);
  assert.match(panes, /cursor: 'pointer', font: 'inherit', fontSize: 12/);
});

test('status code is decorative while the file path names the row', () => {
  assert.match(panes, /<span aria-hidden="true" style=/);
  assert.match(panes, /\}>\{f\.path\}<\/span>/);
});
