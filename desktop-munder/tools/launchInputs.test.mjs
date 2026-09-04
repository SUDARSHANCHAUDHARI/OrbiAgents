import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const ts = require('typescript');
const read = path => readFileSync(new URL('../src/main/' + path, import.meta.url), 'utf8');
const mod = new Module('launchInputs');
mod._compile(ts.transpileModule(read('launchInputs.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, 'launchInputs.js');
const { launchInputError: check } = mod.exports;

test('canonical provider requests with no caller overrides are accepted unchanged', () => {
  for (const command of ['claude', 'codex', 'cursor-agent']) {
    const request = { command, env: {} };
    assert.equal(check(request, command), null);
    assert.deepEqual(request, { command, env: {} });
    assert.equal(check({ command }, command), null);
  }
});

test('shell substitution, executable mismatch and environment overrides fail without echoing values', () => {
  for (const request of [
    { command: '/tmp/codex' }, { command: 'sh' }, { command: 'codex --full-auto' },
    { command: 'codex', shellScript: 'sensitive-script' },
    { command: 'codex', env: { NODE_OPTIONS: 'sensitive-value' } },
    { command: 'codex', env: { CODEX_HOME: 'sensitive-value' } },
    { command: 'codex', env: { PATH: 'sensitive-value' } },
    { command: 'codex', env: [] }, { command: 'codex', env: null },
  ]) {
    const result = check(request, 'codex');
    assert.equal(typeof result, 'string');
    assert.ok(!result.includes('sensitive'));
  }
  assert.notEqual(check({ command: '' }, ''), null);
  assert.notEqual(check({ command: 'claude' }, 'codex'), null);
});

test('caller validation precedes application-generated environment and installer paths', () => {
  const source = read('index.ts');
  const start = source.indexOf('async function spawnAgentCore(');
  const gate = source.indexOf('const inputError = launchInputError(opts, providerPreset(provider).defaultCommand);', start);
  assert.ok(gate > start);
  assert.ok(gate < source.indexOf('shellScript: buildMissingCliScript', start));
  assert.ok(gate < source.indexOf('opts.env =', start));
  assert.ok(source.includes('if (inputError) return { ok: false, error: inputError };'));
});
