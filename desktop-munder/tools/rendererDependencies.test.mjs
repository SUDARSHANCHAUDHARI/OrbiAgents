import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url)));
test('isolated renderer manifest is pinned, locked and excludes main-process dependencies', () => {
  const pkg = read('./renderer-dependencies.json');
  const lock = read('./renderer-dependencies.lock.json');
  assert.equal(pkg.private, true);
  assert.equal(pkg.scripts, undefined);
  assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
  for (const [name, version] of Object.entries(pkg.dependencies)) {
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.equal(lock.packages['node_modules/' + name].version, version);
  }
  for (const name of ['electron', 'node-pty', 'better-sqlite3', 'electron-updater', 'posthog-node', 'localtunnel', 'tunnelmole'])
    assert.equal(pkg.dependencies[name], undefined);
});
test('renderer build refuses an unprepared directory before building', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orbi-deps-test-'));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./build-renderer.mjs', import.meta.url)), dir], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing or mismatched renderer dependency/);
});
