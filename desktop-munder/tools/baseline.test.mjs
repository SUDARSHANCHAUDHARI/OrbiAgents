import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (directory, script) => spawnSync(process.execPath, [join(directory, 'tools', script)], { encoding: 'utf8' });

test('pinned source verifies and migration launch fails closed', () => {
  const verification = run(root, 'verify-baseline.mjs');
  assert.equal(verification.status, 0, verification.stderr);
  const launch = run(root, 'migration-gate.mjs');
  assert.equal(launch.status, 1);
  assert.match(launch.stderr, /not launch-ready/);
});

test('verifier rejects modified source and unapproved artwork', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'orbi-baseline-test-'));
  try {
    const copy = join(scratch, 'baseline');
    cpSync(root, copy, { recursive: true });
    const manifest = JSON.parse(readFileSync(join(copy, 'UPSTREAM.json'), 'utf8'));
    const target = join(copy, manifest.entries[0].target);
    const original = readFileSync(target);
    writeFileSync(target, 'modified');
    const changed = run(copy, 'verify-baseline.mjs');
    assert.equal(changed.status, 1);
    assert.match(changed.stderr, /Changed baseline/);
    writeFileSync(target, original);
    const artManifest = JSON.parse(readFileSync(join(copy, 'art/manifest.json'), 'utf8'));
    const artTarget = join(copy, artManifest.entries[0].path);
    const originalArt = readFileSync(artTarget);
    writeFileSync(artTarget, 'modified artwork');
    const changedArt = run(copy, 'verify-baseline.mjs');
    assert.equal(changedArt.status, 1);
    assert.match(changedArt.stderr, /Changed art/);
    writeFileSync(artTarget, originalArt);
    writeFileSync(join(copy, 'unapproved.png'), 'not approved');
    const artwork = run(copy, 'verify-baseline.mjs');
    assert.equal(artwork.status, 1);
    assert.match(artwork.stderr, /Unapproved artwork/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
