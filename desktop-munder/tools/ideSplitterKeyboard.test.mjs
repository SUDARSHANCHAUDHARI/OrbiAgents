import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panel = readFileSync(new URL('../src/renderer/src/ide/IdePanel.tsx', import.meta.url), 'utf8');

test('IDE splitter exposes an adjustable vertical separator', () => {
  assert.match(panel, /role="separator"/);
  assert.match(panel, /aria-orientation="vertical"/);
  assert.match(panel, /aria-valuemin=\{TREE_MIN_WIDTH\}/);
  assert.match(panel, /aria-valuemax=\{TREE_MAX_WIDTH\}/);
  assert.match(panel, /aria-valuenow=\{treeWidth\}/);
  assert.match(panel, /tabIndex=\{0\}/);
});

test('IDE splitter supports arrow and boundary keyboard resizing', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    assert.match(panel, new RegExp(`event\\.key === '${key}'`));
  }
  assert.match(panel, /onKeyDown=\{resizeTreeFromKeyboard\}/);
  assert.match(panel, /const TREE_KEYBOARD_STEP = 20/);
});

test('mouse and keyboard resizing share the same width boundaries', () => {
  assert.match(panel, /Math\.min\(TREE_MAX_WIDTH, Math\.max\(TREE_MIN_WIDTH, startW/);
  assert.match(panel, /Math\.max\(TREE_MIN_WIDTH, treeWidth - TREE_KEYBOARD_STEP\)/);
  assert.match(panel, /Math\.min\(TREE_MAX_WIDTH, treeWidth \+ TREE_KEYBOARD_STEP\)/);
});
