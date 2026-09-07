import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { delimiter, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const action = process.argv[2];
if (!['typecheck', 'build', 'package', 'dev', 'test-upstream'].includes(action))
  throw new Error('Usage: node tools/run-with-dependencies.mjs <typecheck|build|package|dev|test-upstream>');

const root = fileURLToPath(new URL('..', import.meta.url));
const tools = join(root, 'tools');
const dependencyRoot = mkdtempSync(join(tmpdir(), 'orbi-runtime-deps-'));
let suiteTempRoot;
cpSync(join(tools, 'compile-dependencies.json'), join(dependencyRoot, 'package.json'));
cpSync(join(tools, 'compile-dependencies.lock.json'), join(dependencyRoot, 'package-lock.json'));

const run = (executable, args, options = {}) => execFileSync(executable, args, {
  cwd: root,
  stdio: 'inherit',
  ...options,
});

try {
  run('npm', ['ci', '--ignore-scripts', '--no-fund', '--no-audit'], { cwd: dependencyRoot });

  if (action === 'test-upstream') {
    suiteTempRoot = mkdtempSync(join(tmpdir(), 'orbi-upstream-suite-'));
    const suiteRoot = join(suiteTempRoot, 'desktop-munder');
    cpSync(root, suiteRoot, {
      recursive: true,
      filter: (source) => source !== join(root, 'release'),
    });
    // Upstream's test reads its evidence regex from a GitHub workflow. Workflows
    // are intentionally excluded from this repository, so provide the tested
    // policy only inside the disposable, non-repository suite copy.
    const workflowDir = join(suiteRoot, '.github/workflows');
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, 'pr-evidence.yml'), [
      'name: Test fixture only',
      'section: |',
      '  `^#{1,6}\\\\s*${name}\\\\b[^\\\\n]*\\\\n([\\\\s\\\\S]*?)(?=\\\\n#{1,6}\\\\s|(?![\\\\s\\\\S]))`',
      '',
    ].join('\n'));
    const availableTests = readdirSync(join(suiteRoot, 'test'))
      .filter((name) => name.endsWith('.test.cjs'))
      .sort();
    const requestedTests = process.argv.slice(3);
    if (requestedTests.some((name) => !availableTests.includes(name)))
      throw new Error('Requested test is not an imported .test.cjs file');
    const tests = (requestedTests.length ? requestedTests : availableTests)
      .map((name) => join('test', name));
    const reporter = requestedTests.length ? 'spec' : 'dot';
    run(process.execPath, ['--test', `--test-reporter=${reporter}`, ...tests], {
      cwd: suiteRoot,
      env: {
        ...process.env,
        NODE_PATH: [join(root, '../desktop/node_modules'), join(dependencyRoot, 'node_modules')].join(delimiter),
      },
    });
  }

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
  if (suiteTempRoot) rmSync(suiteTempRoot, { recursive: true, force: true });
  rmSync(dependencyRoot, { recursive: true, force: true });
}
