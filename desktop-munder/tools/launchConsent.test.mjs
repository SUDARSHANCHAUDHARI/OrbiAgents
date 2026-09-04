import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import test from 'node:test';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const ts = require('typescript');
const read = path => readFileSync(new URL('../src/main/' + path, import.meta.url), 'utf8');
const mod = new Module('launchConsent');
mod._compile(ts.transpileModule(read('launchConsent.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, 'launchConsent.js');
const { launchConsentError: check } = mod.exports;

test('restricted options and model values remain allowed without mutating argv', () => {
  for (const [provider, args] of [
    ['claude', ['--model', 'example-model', '--permission-mode=plan']],
    ['claude', ['--continue']],
    ['codex', ['-s', 'read-only', '-a', 'on-request', 'Review the project']],
    ['codex', ['--sandbox=workspace-write', '--ask-for-approval=untrusted']],
  ]) {
    const before = [...args];
    assert.equal(check(provider, args, false), null);
    assert.deepEqual(args, before);
  }
});

test('bypass, unknown switches, config overrides and directory grants require consent', () => {
  for (const [provider, args] of [
    ['claude', ['--permission-mode', 'bypassPermissions']],
    ['claude', ['--permission-mode=bypassPermissions']],
    ['claude', ['--dangerously-skip-permissions']],
    ['codex', ['--dangerously-bypass-approvals-and-sandbox']],
    ['codex', ['-a', 'never']], ['codex', ['--sandbox=danger-full-access']],
    ['codex', ['--add-dir', '/private']], ['codex', ['-c', 'sandbox_mode="danger-full-access"']],
    ['custom', ['--unknown']], ['gemini', ['--yolo']],
    ['claude', ['--model']], ['claude', ['--model', '--dangerously-skip-permissions']],
  ]) assert.equal(typeof check(provider, args, false), 'string', args.join(' '));
  assert.equal(check('claude', ['--permission-mode', 'bypassPermissions'], true), null);
  assert.equal(check('claude', ['--model', 5], false), 'Invalid provider arguments');
  assert.equal(check('claude', null, false), 'Invalid provider arguments');
  assert.notEqual(check('claude', ['--dangerously-skip-permissions'], 'true'), null);
});

test('shared spawn checks caller consent before installation or hive side effects', () => {
  const source = read('index.ts');
  const start = source.indexOf('async function spawnAgentCore(');
  const gate = source.indexOf('const consentError = launchConsentError(', start);
  assert.ok(gate > start);
  assert.ok(gate < source.indexOf("analytics.track('agent_spawn_attempted'", start));
  assert.ok(source.includes('if (consentError) return { ok: false, error: consentError };'));
  const hive = ts.createSourceFile('hive.ts', read('hive.ts'), ts.ScriptTarget.Latest, true);
  let grant = false;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(hive) === 'preArgs.push' &&
        node.arguments.some(a => ts.isStringLiteral(a) && a.text === '--add-dir')) grant = true;
    ts.forEachChild(node, visit);
  }
  visit(hive); assert.equal(grant, false);
});
