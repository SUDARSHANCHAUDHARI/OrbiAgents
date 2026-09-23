import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const kanban = readFileSync(new URL('../src/renderer/src/components/TasksKanban.tsx', import.meta.url), 'utf8');

test('task detail exposes a named modal dialog and takes focus', () => {
  assert.match(kanban, /role="dialog"\s+aria-modal="true"\s+aria-label=\{t\('kanban\.taskTitle'\)\}\s+tabIndex=\{-1\}/);
  assert.match(kanban, /const dialog = dialogRef\.current;\s+dialog\?\.focus\(\);/);
});

test('task detail closes with Escape and restores the opener', () => {
  assert.match(kanban, /if \(event\.key === 'Escape'\)/);
  assert.match(kanban, /document\.removeEventListener\('keydown', onKeyDown\);\s+previouslyFocused\?\.focus\(\);/);
});

test('task detail keeps forward and reverse tab navigation inside the modal', () => {
  assert.match(kanban, /dialog\.querySelectorAll<HTMLElement>/);
  assert.match(kanban, /event\.shiftKey && \(document\.activeElement === first \|\| document\.activeElement === dialog\)/);
  assert.match(kanban, /!event\.shiftKey && document\.activeElement === last/);
});
