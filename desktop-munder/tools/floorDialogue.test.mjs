import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../src/renderer/src/scene/office/cafeteriaLines.ts', import.meta.url);

test('floor dialogue is original OrbiAgents operations copy', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /original break-room dialogue for the OrbiAgents floor/);
  assert.doesNotMatch(source, /Dunder Mifflin|that's what she said|Schrute|Pretzel Day|Cornell|Battlestar/i);
  assert.match(source, /is the build green\?/);
  assert.match(source, /one verified outcome at a time/);
});

test('replacement preserves scene-facing dialogue exports and every worker key', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const workers = [
    'michael', 'jim', 'pam', 'dwight', 'kevin', 'angela', 'oscar', 'stanley',
    'phyllis', 'andy', 'kelly', 'ryan', 'toby', 'creed', 'meredith'
  ];

  assert.match(source, /export function pickSoloLine/);
  assert.match(source, /export function pickExchange/);
  for (const worker of workers) assert.match(source, new RegExp(`\\b${worker}:`), worker);
});
