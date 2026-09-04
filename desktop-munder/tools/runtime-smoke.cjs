// Explicit Node-only probe: does not load migration main, user data or agents.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { readFileSync, mkdtempSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { tmpdir } = require('node:os');
const manifest = require('./compile-dependencies.json');
async function main() {
  if (process.env.ELECTRON_RUN_AS_NODE !== '1' || process.versions.electron !== manifest.dependencies.electron)
    throw new Error('Run only with the pinned Electron binary in ELECTRON_RUN_AS_NODE=1 mode');
  if (!process.argv[2]) throw new Error('Supply the isolated compile dependency directory');
  const root = resolve(process.argv[2]);
  const requireIsolated = createRequire(join(root, 'package.json'));
  const pkg = name => JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json')));
  for (const name of ['posthog-node', 'better-sqlite3', 'node-pty'])
    assert.equal(pkg(name).version, manifest.dependencies[name]);
  const semver = requireIsolated('semver');
  assert.ok(semver.satisfies(process.versions.node, pkg('posthog-node').engines.node));
  const results = { electron: process.versions.electron, node: process.versions.node,
    abi: process.versions.modules, arch: process.arch, posthogEngine: 'pass' };
  let failed = false;
  try {
    const Database = requireIsolated('better-sqlite3');
    const db = new Database(':memory:');
    try {
      assert.equal(db.prepare('SELECT 42 AS answer').get().answer, 42);
      db.exec('CREATE TABLE probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
      const insert = db.prepare('INSERT INTO probe (value) VALUES (?)');
      db.transaction(() => { insert.run('one'); insert.run('two'); })();
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM probe').get().n, 2);
      assert.throws(() => db.transaction(() => { insert.run('rollback'); throw new Error('rollback'); })(), /rollback/);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM probe').get().n, 2);
      db.prepare('UPDATE probe SET value = ? WHERE id = ?').run('updated', 1);
      assert.equal(db.prepare('SELECT value FROM probe WHERE id = ?').get(1).value, 'updated');
      assert.equal(db.prepare('DELETE FROM probe WHERE id = ?').run(2).changes, 1);
    }
    finally { db.close(); }
    results.sqlite = 'pass';
  } catch (error) { failed = true; results.sqlite = error.message.split('\n')[0]; }
  try {
    const pty = requireIsolated('node-pty');
    const cwd = mkdtempSync(join(tmpdir(), 'orbi-pty-smoke-'));
    await new Promise((resolveProbe, reject) => {
      const terminal = pty.spawn('/bin/echo', ['orbi-native-probe'], {
        name: 'xterm', cols: 80, rows: 24, cwd,
        env: { PATH: '/usr/bin:/bin', TERM: 'xterm', LANG: 'en_US.UTF-8' },
      });
      let output = '';
      const timeout = setTimeout(() => {
        terminal.kill(); reject(new Error('PTY probe timed out'));
      }, 5000);
      terminal.onData(data => { output += data; });
      terminal.onExit(({ exitCode }) => {
        clearTimeout(timeout);
        if (exitCode === 0 && output.includes('orbi-native-probe')) resolveProbe();
        else reject(new Error('PTY echo did not complete successfully'));
      });
    });
    results.pty = 'pass';
  } catch (error) { failed = true; results.pty = error.message.split('\n')[0]; }
  console.log(JSON.stringify(results, null, 2));
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
