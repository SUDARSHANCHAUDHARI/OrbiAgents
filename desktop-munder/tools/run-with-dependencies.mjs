import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const action = process.argv[2];
if (!['typecheck', 'build', 'package', 'dev'].includes(action))
  throw new Error('Usage: node tools/run-with-dependencies.mjs <typecheck|build|package|dev>');

const root = fileURLToPath(new URL('..', import.meta.url));
const tools = join(root, 'tools');
const dependencyRoot = mkdtempSync(join(tmpdir(), 'orbi-runtime-deps-'));
cpSync(join(tools, 'compile-dependencies.json'), join(dependencyRoot, 'package.json'));
cpSync(join(tools, 'compile-dependencies.lock.json'), join(dependencyRoot, 'package-lock.json'));

const run = (executable, args, options = {}) => execFileSync(executable, args, {
  cwd: root,
  stdio: 'inherit',
  ...options,
});

try {
  run('npm', ['ci', '--ignore-scripts', '--no-fund', '--no-audit', '--prefix', dependencyRoot]);

  if (action === 'typecheck' || action === 'build') {
    run(process.execPath, [join(tools, 'typecheck.mjs'), dependencyRoot, 'web']);
    run(process.execPath, [join(tools, 'typecheck.mjs'), dependencyRoot, 'node']);
  }
  if (action === 'build') {
    run(process.execPath, [join(tools, 'build-main.mjs')]);
    run(process.execPath, [join(tools, 'build-renderer.mjs'), dependencyRoot]);
  }
  if (action === 'package' || action === 'dev') {
    run(process.execPath, [join(tools, 'prepare-native.mjs'), dependencyRoot]);
    run(process.execPath, [join(tools, 'package-macos.mjs'), dependencyRoot], {
      env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    });
  }
  if (action === 'dev') {
    const executable = join(root, 'release/mac-arm64/OrbiAgents.app/Contents/MacOS/OrbiAgents');
    const child = spawn(executable, [], { detached: true, stdio: 'ignore' });
    child.unref();
    console.log(`Opened OrbiAgents (pid ${child.pid}).`);
  }
} finally {
  rmSync(dependencyRoot, { recursive: true, force: true });
}
