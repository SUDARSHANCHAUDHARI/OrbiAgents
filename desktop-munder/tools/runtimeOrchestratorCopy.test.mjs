import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = [
  'src/main/updater.ts',
  'src/main/index.ts',
  'src/renderer/src/hooks/useHive.ts',
  'src/renderer/src/realtime/session.ts'
];

test('runtime-facing generated and error copy does not name the upstream orchestrator', async () => {
  const source = (await Promise.all(files.map((path) =>
    readFile(new URL(`../${path}`, import.meta.url), 'utf8')))).join('\n');
  assert.doesNotMatch(source, /coordinated by your clone, Michael|tells you \(Michael\)|prompt to Michael|talk to Michael/);
  assert.match(source, /coordinated by your Orbi Prime orchestrator/);
  assert.match(source, /talk to the orchestrator/);
});
