import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panel = readFileSync(new URL('../src/renderer/src/ide/IdePanel.tsx', import.meta.url), 'utf8');

test('editor tabs expose tablist, tab, selection and roving focus semantics', () => {
  assert.match(panel, /<div role="tablist" aria-label=\{t\('idePanel\.files'\)\}/);
  assert.match(panel, /role="tab"\s+aria-selected=\{active\}\s+tabIndex=\{active \? 0 : -1\}/);
});

test('editor tabs support conventional horizontal and boundary navigation', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    assert.match(panel, new RegExp(`event\\.key === '${key}'`));
  }
  assert.match(panel, /querySelectorAll<HTMLButtonElement>\('\[role="tab"\]'\)/);
  assert.match(panel, /tabButtons\?\.\[next\]\?\.focus\(\)/);
});

test('tab selection and close remain separate native controls', () => {
  assert.match(panel, /type="button"\s+role="tab"/);
  assert.match(panel, /<button\s+type="button"\s+onClick=\{\(e\) => \{ e\.stopPropagation\(\); closeTab\(tab\.key\); \}\}/);
  assert.doesNotMatch(panel, /<div\s+key=\{tab\.key\}\s+onClick=\{\(\) => setActiveKey/);
});
