import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

if (!process.argv[2]) throw new Error('Supply the unsigned migration .app path');
const app = resolve(process.argv[2]);
const root = realpathSync(mkdtempSync(join(tmpdir(), 'orbi-isolated-startup-')));
writeFileSync(join(root, '.orbi-isolated-startup'), '', { mode: 0o600 });
const executable = join(app, 'Contents/MacOS', 'OrbiAgents Migration');
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/(TOKEN|SECRET|PASSWORD|API_KEY|ELECTRON_RENDERER_URL)/i.test(name)));
const run = spawnSync(executable, [`--verify-isolated-startup=${root}`], {
  cwd: root, env, encoding: 'utf8', timeout: 45_000,
});
if (run.error) throw run.error;
assert.equal(run.status, 0, run.stderr || run.stdout);
const result = JSON.parse(readFileSync(join(root, 'startup-result.json'), 'utf8'));
assert.equal(result.ok, true);
const inside = value => value.startsWith(`${root}${sep}`);
assert.ok(inside(result.userData));
assert.ok(inside(result.sessionData));
assert.match(result.url, /^file:/);
assert.equal(existsSync(join(result.userData, 'config.json')), false, 'fresh verification unexpectedly loaded or wrote config');
assert.equal(existsSync(join(result.userData, 'updater.log')), false, 'updater ran during isolated verification');
assert.equal(existsSync(join(result.userData, 'last-run-version')), false, 'updater wrote version state during isolated verification');
console.log(`Isolated packaged startup verified in ${root}. Renderer loaded; app exited automatically.`);
