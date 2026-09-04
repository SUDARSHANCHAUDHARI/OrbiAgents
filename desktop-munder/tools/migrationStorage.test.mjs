import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../src/main/migrationStorage.ts', import.meta.url), 'utf8');
const mod = new Module('migrationStorage'); mod.require = require;
mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, 'migrationStorage.js');
const { configureMigrationStorage } = mod.exports;
const fakeApp = (base, calls = [], ready = false) => ({
  isReady: () => ready, getPath: () => base,
  setName: name => calls.push(['name', name]), setPath: (name, path) => calls.push([name, path]),
});

test('migration paths are independent and existing application directories remain untouched', () => {
  const base = mkdtempSync(join(tmpdir(), 'orbi-storage-test-'));
  try {
    for (const name of ['OrbiAgents', 'munder-difflin']) mkdirSync(join(base, name));
    const calls = [];
    const paths = configureMigrationStorage(fakeApp(base, calls));
    assert.equal(paths.userData, join(base, 'OrbiAgents-Migration'));
    assert.equal(paths.sessionData, join(paths.userData, 'chromium-session'));
    assert.deepEqual(calls, [['name', 'OrbiAgents Migration'], ['userData', paths.userData], ['sessionData', paths.sessionData]]);
    assert.deepEqual(configureMigrationStorage(fakeApp(base)), paths);
    assert.deepEqual(readdirSync(join(base, 'OrbiAgents')), []);
    assert.deepEqual(readdirSync(join(base, 'munder-difflin')), []);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('symlink aliases, invalid roots and late initialization fail closed', () => {
  const base = mkdtempSync(join(tmpdir(), 'orbi-storage-test-'));
  try {
    const existing = join(base, 'OrbiAgents'); mkdirSync(existing);
    symlinkSync(existing, join(base, 'OrbiAgents-Migration'));
    const calls = [];
    assert.throws(() => configureMigrationStorage(fakeApp(base, calls)), /symlink/);
    assert.deepEqual(calls, []); assert.deepEqual(readdirSync(existing), []);
    assert.throws(() => configureMigrationStorage(fakeApp('/')), /Invalid/);
    assert.throws(() => configureMigrationStorage(fakeApp('relative')), /Invalid/);
    assert.throws(() => configureMigrationStorage(fakeApp(base, [], true)), /before Electron ready/);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('bootstrap is the first main entry import', () => {
  const source = readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
  assert.ok(ts.isImportDeclaration(ast.statements[0]));
  assert.equal(ast.statements[0].moduleSpecifier.text, './migrationBootstrap');
});
