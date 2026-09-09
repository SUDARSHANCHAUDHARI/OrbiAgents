'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const source = readFileSync('src/renderer/src/components/MessageQueueComposer.tsx', 'utf8');

test('queued terminal holds remain visible while an agent is busy', () => {
  assert.match(source, /useTerminalBlock\(agent\.ptyId, queue\.length > 0\)/);
  assert.doesNotMatch(source, /useTerminalBlock\(agent\.ptyId, queue\.length > 0 && idle\)/);

  const statusStart = source.indexOf('const statusHint =');
  const statusEnd = source.indexOf('\n\n  return (', statusStart);
  const status = source.slice(statusStart, statusEnd);
  const draftHold = status.indexOf("block === 'draft'");
  const busy = status.indexOf('!idle');

  assert.ok(statusStart >= 0 && statusEnd > statusStart, 'queue status calculation is present');
  assert.ok(draftHold >= 0 && busy > draftHold, 'terminal holds take priority over generic busy status');
});
