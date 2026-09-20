import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panel = readFileSync(new URL('../src/renderer/src/ide/IdePanel.tsx', import.meta.url), 'utf8');

test('working-tree change rows use native buttons with active state', () => {
  assert.match(panel, /<button\s+type="button"\s+key=\{f\.path\}\s+onClick=\{\(\) => openDiff\(f\.path\)\}/);
  assert.match(panel, /aria-current=\{active \? 'page' : undefined\}/);
  assert.doesNotMatch(panel, /<div\s+key=\{f\.path\}\s+onClick=\{\(\) => openDiff\(f\.path\)\}/);
});

test('working-tree row keeps its full-width compact visual treatment', () => {
  assert.match(panel, /width: '100%', border: 'none', textAlign: 'start'/);
  assert.match(panel, /cursor: 'pointer', font: 'inherit', fontSize: 12/);
});

test('working-tree status code is decorative while the path names the action', () => {
  assert.match(panel, /<span aria-hidden="true" style=\{\{\s+width: 12/);
  assert.match(panel, /\}>\{f\.path\}<\/span>/);
});
