import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';
const tool = name => fileURLToPath(new URL(name, import.meta.url));
test('main/preload build emits source bundles and required sidecars without launch', () => {
  const result = spawnSync(process.execPath, [tool('./build-main.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const directory = result.stdout.match(/Main\/preload source bundles: (.+)\. External/)[1];
  for (const file of ['main/index.cjs', 'preload/index.cjs', 'main/slack-trigger.cjs', 'main/kg-core.cjs'])
    assert.ok(statSync(join(directory, file)).size > 0);
  // These are intentionally external, not a claim that native modules work.
  assert.match(readFileSync(join(directory, 'main/index.cjs'), 'utf8'), /require\("electron"\)/);
});
test('compile dependency lock matches exact direct pins and contains no project scripts', () => {
  const pkg = JSON.parse(readFileSync(tool('./compile-dependencies.json')));
  const lock = JSON.parse(readFileSync(tool('./compile-dependencies.lock.json')));
  assert.equal(pkg.private, true);
  assert.equal(pkg.scripts, undefined);
  assert.deepEqual(pkg.dependencies, lock.packages[''].dependencies);
  for (const [name, version] of Object.entries(pkg.dependencies))
    assert.equal(lock.packages['node_modules/' + name].version, version);
});

test('remediation keeps unused tunneling dependency out and pins patched TOML', () => {
  const pkg = JSON.parse(readFileSync(tool('./compile-dependencies.json')));
  const lock = JSON.parse(readFileSync(tool('./compile-dependencies.lock.json')));
  assert.equal(pkg.dependencies.electron, '41.10.3');
  assert.equal(pkg.dependencies.localtunnel, undefined);
  assert.equal(pkg.dependencies['@types/localtunnel'], undefined);
  assert.equal(pkg.overrides.tunnelmole.toml, '4.2.0');
  const toml = Object.entries(lock.packages).filter(([path]) => path.endsWith('node_modules/toml'));
  assert.ok(toml.length > 0);
  for (const [, entry] of toml) assert.equal(entry.version, '4.2.0');
  assert.ok(!Object.keys(lock.packages).some(path => path.endsWith('node_modules/localtunnel')));
});
