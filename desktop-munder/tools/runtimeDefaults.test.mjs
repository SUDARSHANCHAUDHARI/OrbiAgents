import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const ts = require('typescript');
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('fresh runtime defaults disable auto permissions, telemetry and updates', () => {
  const ast = ts.createSourceFile('config.ts', read('src/main/config.ts'), ts.ScriptTarget.Latest, true);
  let defaults;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'DEFAULTS') defaults = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(defaults && ts.isObjectLiteralExpression(defaults));
  for (const key of ['autoMode', 'autoUpdate', 'telemetryEnabled', 'orchestratorMaySpawn']) {
    const property = defaults.properties.find(p => p.name?.getText(ast) === key);
    assert.equal(property?.initializer?.kind, ts.SyntaxKind.FalseKeyword, key);
  }
});

test('hidden helper has no unconditional permission-bypass argument', () => {
  const ast = ts.createSourceFile('hiddenClaude.ts', read('src/main/hiddenClaude.ts'), ts.ScriptTarget.Latest, true);
  const strings = [];
  function visit(node) {
    if (ts.isStringLiteral(node)) strings.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(!strings.includes('bypassPermissions'));
  assert.ok(!strings.includes('--dangerously-skip-permissions'));
  assert.ok(strings.includes('--disallowedTools'), 'existing tool restrictions retained');
});
