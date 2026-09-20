import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const card = readFileSync(new URL('../src/renderer/src/components/AgentCard.tsx', import.meta.url), 'utf8');

test('live task note is a native named button', () => {
  const note = card.match(/\{doingCount > 0 && \(([\s\S]*?)\n      \)\}/)?.[1] ?? '';
  assert.match(note, /<button\s+type="button"/);
  assert.match(card, /const doingTaskLabel = doingCount === 1[\s\S]*?agentCard\.doingTasksPlural/);
  assert.match(note, /title=\{doingTaskLabel\}/);
  assert.match(note, /aria-label=\{doingTaskLabel\}/);
  assert.doesNotMatch(note, /role="button"|tabIndex=|onKeyDown=/);
  assert.match(note, /onTaskNoteClick\?\.\(\)/);
  assert.match(note, /<\/button>/);
});

test('task-note activation stays isolated from card selection', () => {
  assert.match(card, /onClick=\{\(e\) => \{ e\.stopPropagation\(\); onTaskNoteClick\?\.\(\); \}\}/);
});
