import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const tree = readFileSync(new URL('../src/renderer/src/components/FileTree.tsx', import.meta.url), 'utf8');

test('file-tree rows use native buttons with folder and current-file state', () => {
  assert.match(tree, /<button\s+type="button"\s+onClick=\{\(\) => \{ void toggle\(node\); \}\}/);
  assert.match(tree, /aria-expanded=\{node\.isDir \? node\.expanded : undefined\}/);
  assert.match(tree, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.doesNotMatch(tree, /<div\s+onClick=\{\(\) => toggle\(node\)\}/);
});

test('copy path remains a separate native action', () => {
  assert.match(tree, /<button\s+type="button"\s+onClick=\{\(e\) => \{ e\.stopPropagation\(\); onCopyPath\(node\.rel\); \}\}/);
  assert.match(tree, /title=\{t\('fileTree\.copyPathTitle'\)\}/);
});

test('decorative disclosure markers stay hidden from assistive technology', () => {
  assert.equal((tree.match(/<span aria-hidden/g) ?? []).length, 2);
});
