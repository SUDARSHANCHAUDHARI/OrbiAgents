'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('HiveManager keeps automatic Git maintenance synchronous', () => {
  const source = readFileSync('src/main/hive.ts', 'utf8');
  const start = source.indexOf('private git(args:');
  const end = source.indexOf('\n  private ', start + 1);
  const gitMethod = source.slice(start, end);
  assert.ok(start >= 0 && end > start, 'private Git runner is present');
  assert.match(gitMethod, /'commit\.gpgsign=false', '-c', 'gc\.autoDetach=false'/);
  assert.match(gitMethod, /spawnSync\('git'/);
});
