// Explicit, limited native preparation; never runs upstream install hooks.
import { createRequire } from 'node:module';
import { readFileSync, realpathSync, lstatSync, chmodSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
const dir = process.argv[2];
if (!dir) throw new Error('Supply an isolated compile dependency directory');
const root = realpathSync(resolve(dir));
const tempRoots = [realpathSync(tmpdir()), realpathSync('/tmp')];
if (!tempRoots.some(temp => root.startsWith(temp + sep))) throw new Error('Native preparation is limited to temporary directories');
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Only macOS arm64 is verified by this preparation command');
const pinned = JSON.parse(readFileSync(new URL('./compile-dependencies.json', import.meta.url)));
const installed = JSON.parse(readFileSync(join(root, 'package.json')));
if (installed.name !== pinned.name) throw new Error('Not an isolated migration compile environment');
for (const name of ['electron', 'node-pty', 'better-sqlite3']) {
  const packageRoot = realpathSync(join(root, 'node_modules', name));
  if (!packageRoot.startsWith(root + sep)) throw new Error('Native dependencies must remain inside the isolated directory');
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json')));
  if (pkg.version !== pinned.dependencies[name]) throw new Error(`Unexpected native dependency: ${name}`);
}
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const builderRequire = createRequire(require.resolve('electron-builder'));
const { rebuild } = await import(builderRequire.resolve('@electron/rebuild'));
await rebuild({ buildPath: root, electronVersion: pinned.dependencies.electron,
  arch: 'arm64', onlyModules: ['better-sqlite3'], force: true });
const helper = join(root, 'node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper');
const stat = lstatSync(helper);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid PTY helper');
chmodSync(helper, stat.mode | 0o111);
console.log('Isolated SQLite rebuild and PTY helper permissions prepared. Run runtime-smoke.cjs to verify.');
