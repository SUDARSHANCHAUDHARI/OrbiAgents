import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const asar = require('@electron/asar');
if (!process.argv[2]) throw new Error('Supply the unsigned migration .app path');
const app = resolve(process.argv[2]);
const archive = join(app, 'Contents/Resources/app.asar');
const read = file => asar.extractFile(archive, file).toString('utf8');
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.name, 'orbiagents-migration-package');
assert.equal(pkg.main, 'launch-gate.cjs');
assert.equal(read('launch-gate.cjs'), readFileSync(new URL('./launch-gate.cjs', import.meta.url), 'utf8'));
assert.match(read('launch-gate.cjs'), /if \(!supplied\)[\s\S]*Migration startup remains disabled/);
assert.match(readFileSync(join(app, 'Contents/Info.plist'), 'utf8'), /com\.sudarshantechlabs\.orbiagents\.migration/);
for (const file of ['out/main/index.cjs', 'out/preload/index.js', 'out/main/slack-trigger.cjs', 'out/main/kg-core.cjs',
  'out/renderer/ART-CREDITS.txt', 'out/renderer/SOURCE-LICENSE.txt', 'out/renderer/FONT-LICENSE.txt'])
  assert.ok(read(file).length > 0, file);
const html = read('out/renderer/index.html');
assert.match(html, /\.\/assets\//);
assert.doesNotMatch(html, /(?:src|href)="\/assets\//);
const assetHashes = new Set(asar.listPackage(archive)
  .filter(file => file.startsWith('/out/renderer/assets/') && file.endsWith('.png'))
  .map(file => createHash('sha256').update(asar.extractFile(archive, file.slice(1))).digest('hex')));
const art = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url)));
for (const entry of art.entries.filter(entry => entry.path.endsWith('.png')))
  assert.ok(assetHashes.has(entry.sha256), `Packaged artwork missing or changed: ${entry.path}`);
const unpacked = join(app, 'Contents/Resources/app.asar.unpacked/node_modules');
for (const file of ['better-sqlite3/prebuilds/darwin-arm64.node', 'node-pty/prebuilds/darwin-arm64/pty.node'])
  assert.ok(statSync(join(unpacked, file)).size > 0, file);
assert.ok(statSync(join(unpacked, 'node-pty/prebuilds/darwin-arm64/spawn-helper')).mode & 0o111);
console.log('Package structure, disabled launcher, relative assets, notices and unpacked native modules verified. App not launched.');
