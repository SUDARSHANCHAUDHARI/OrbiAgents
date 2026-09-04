import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
test('runtime probe refuses ordinary Node before loading application dependencies', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./runtime-smoke.cjs', import.meta.url))], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pinned Electron binary/);
});
test('native preparation requires an explicit isolated target', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./prepare-native.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Supply an isolated/);
});
