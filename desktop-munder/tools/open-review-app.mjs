import { accessSync, constants, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

if (!process.argv[2]) throw new Error('Supply the unsigned migration .app path');
const app = resolve(process.argv[2]);
const executable = join(app, 'Contents/MacOS', 'OrbiAgents Migration');
accessSync(executable, constants.X_OK);
const root = realpathSync(mkdtempSync(join(tmpdir(), 'orbi-isolated-review-')));
writeFileSync(join(root, '.orbi-isolated-review'), '', { mode: 0o600 });
const allowedEnvironment = new Set(['HOME', 'PATH', 'SHELL', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM']);
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => allowedEnvironment.has(name)));
const child = spawn(executable, [`--review-isolated=${root}`], {
  cwd: root, env, detached: true, stdio: 'ignore',
});
child.unref();
console.log(`Opened isolated review app (pid ${child.pid}); review data: ${root}`);
