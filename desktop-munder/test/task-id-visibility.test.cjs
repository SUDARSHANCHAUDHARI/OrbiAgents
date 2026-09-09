'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const source = readFileSync('src/renderer/src/components/TasksKanban.tsx', 'utf8');

test('task IDs stay visible on both Kanban cards and task details', () => {
  const cardStart = source.indexOf('function TaskCard(');
  const detailStart = source.indexOf('export function TaskDetail(');
  const card = source.slice(cardStart, detailStart);
  const detail = source.slice(detailStart);

  assert.ok(cardStart >= 0 && detailStart > cardStart, 'task card and detail views are present');
  assert.match(card, /fontFamily: 'var\(--cth-font-mono\)'[\s\S]*?\{task\.id\}/);
  assert.match(detail, /Fact row[\s\S]*?fontFamily: 'var\(--cth-font-mono\)'[\s\S]*?\{task\.id\}/);
});
