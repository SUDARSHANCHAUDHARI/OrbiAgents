import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const graph = readFileSync(new URL('../src/renderer/src/components/git/CommitGraph.tsx', import.meta.url), 'utf8');
const panes = readFileSync(new URL('../src/renderer/src/ide/GitPanes.tsx', import.meta.url), 'utf8');

test('interactive history commits use native buttons with selected state', () => {
  assert.match(graph, /return onCommitClick \? \(\s+<button\s+type="button"/);
  assert.match(graph, /onClick=\{\(\) => onCommitClick\(c\.sha\)\}/);
  assert.match(graph, /aria-current=\{selected \? 'true' : undefined\}/);
});

test('read-only graph consumers retain inert commit rows', () => {
  assert.match(graph, /:\s*\(\s+<div key=\{c\.sha\} title=\{title\} style=\{style\}>\{content\}<\/div>/);
});

test('history pane identifies the commit whose details are visible', () => {
  assert.match(panes, /selectedSha=\{selected\?\.sha\}/);
  assert.match(graph, /background: selected \? 'var\(--cth-sky-light\)' : 'transparent'/);
});
