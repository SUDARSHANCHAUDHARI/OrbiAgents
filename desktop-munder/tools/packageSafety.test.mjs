import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
test('package tooling requires an explicit prepared dependency directory', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./package-macos.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Supply the prepared|Only macOS arm64/);
});
test('renderer build uses relative URLs for packaged file loading', () => {
  const source = readFileSync(new URL('./build-renderer.mjs', import.meta.url), 'utf8');
  assert.match(source, /base: '\.\/'/);
});
test('startup verification requires a sentinel-marked empty isolated root', () => {
  const source = readFileSync(new URL('./launch-gate.cjs', import.meta.url), 'utf8');
  assert.match(source, /--verify-isolated-startup=/);
  assert.match(source, /\.orbi-isolated-startup/);
  assert.match(source, /Isolated root must contain only its sentinel/);
  assert.match(source, /app\.setPath\('appData', root\)/);
  assert.match(source, /ORBI_ISOLATED_STARTUP_VERIFY = '1'/);
  const updater = readFileSync(new URL('../src/main/updater.ts', import.meta.url), 'utf8');
  assert.match(updater, /ORBI_ISOLATED_STARTUP_VERIFY === '1'\) return/);
});
test('manual review launcher requires an explicit packaged app path', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./open-review-app.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Supply the unsigned migration/);
});
test('ordinary package launch enters the application while verification stays isolated', () => {
  const source = readFileSync(new URL('./launch-gate.cjs', import.meta.url), 'utf8');
  assert.match(source, /if \(!supplied\) \{\s*require\('\.\/out\/main\/index\.cjs'\)/);
  assert.match(source, /--review-isolated=/);
});
test('durable package copy relocates temporary framework symlinks', () => {
  const source = readFileSync(new URL('./package-macos.mjs', import.meta.url), 'utf8');
  assert.match(source, /target\.startsWith\(`\$\{stagedApp\}\/`\)/);
  assert.match(source, /symlinkSync\(relative\(dirname\(destination\), relocatedTarget\)/);
});
test('package staging removes compile-only dependencies before archiving', () => {
  const source = readFileSync(new URL('./package-macos.mjs', import.meta.url), 'utf8');
  assert.match(source, /runtime-dependencies\.json/);
  assert.match(source, /Runtime dependency is not pinned/);
  assert.match(source, /npm', \['prune', '--omit=dev', '--ignore-scripts'/);
});
test('main build records external runtime packages for exact package pruning', () => {
  const source = readFileSync(new URL('./build-main.mjs', import.meta.url), 'utf8');
  assert.match(source, /metafile: true/);
  assert.match(source, /output\.imports\.filter\(entry => entry\.external\)/);
  assert.match(source, /builtinModules/);
  assert.match(source, /runtime-dependencies\.json/);
});
test('public build runner always removes its temporary dependency tree', () => {
  const source = readFileSync(new URL('./run-with-dependencies.mjs', import.meta.url), 'utf8');
  assert.match(source, /finally \{[\s\S]{0,160}rmSync\(dependencyRoot, \{ recursive: true, force: true \}\)/);
});
test('upstream suite runs from a disposable copy without adding a repository workflow', () => {
  const source = readFileSync(new URL('./run-with-dependencies.mjs', import.meta.url), 'utf8');
  assert.match(source, /orbi-upstream-suite-/);
  assert.match(source, /writeFileSync\(join\(workflowDir, 'pr-evidence\.yml'\)/);
  assert.match(source, /cwd: suiteRoot/);
  assert.match(source, /if \(suiteTempRoot\) rmSync\(suiteTempRoot, \{ recursive: true, force: true \}\)/);
});
