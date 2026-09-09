'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');

const { linkWorktreeDeps, unlinkWorktreeDeps } = loadTs('src/main/worktreeDeps.ts');

function harness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-worktree-deps-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const base = path.join(root, 'base');
  const worktree = path.join(root, 'worktree');
  fs.mkdirSync(base);
  fs.mkdirSync(worktree);
  return { base, worktree };
}

test('links base dependencies and removes only that owned link', async (t) => {
  const { base, worktree } = harness(t);
  const deps = path.join(base, 'node_modules');
  fs.mkdirSync(deps);
  fs.writeFileSync(path.join(deps, 'sentinel'), 'base');

  assert.deepEqual(await linkWorktreeDeps(base, worktree), { ok: true, skipped: false });
  const linked = path.join(worktree, 'node_modules');
  assert.equal(fs.lstatSync(linked).isSymbolicLink(), true);
  assert.equal(fs.readFileSync(path.join(linked, 'sentinel'), 'utf8'), 'base');
  assert.deepEqual(await unlinkWorktreeDeps(base, worktree), { ok: true, removed: true });
  assert.equal(fs.existsSync(linked), false);
  assert.equal(fs.existsSync(deps), true);
});

test('skips a missing base or an existing worktree dependency entry', async (t) => {
  const { base, worktree } = harness(t);
  assert.deepEqual(await linkWorktreeDeps(base, worktree), { ok: true, skipped: true });
  fs.mkdirSync(path.join(base, 'node_modules'));
  fs.mkdirSync(path.join(worktree, 'node_modules'));
  assert.deepEqual(await linkWorktreeDeps(base, worktree), { ok: true, skipped: true });
  assert.deepEqual(await unlinkWorktreeDeps(base, worktree), { ok: true, removed: false });
});

test('does not remove a dependency link owned by another directory', async (t) => {
  const { base, worktree } = harness(t);
  const baseDeps = path.join(base, 'node_modules');
  const foreign = path.join(base, 'foreign');
  fs.mkdirSync(baseDeps);
  fs.mkdirSync(foreign);
  const linked = path.join(worktree, 'node_modules');
  fs.symlinkSync(foreign, linked);
  assert.deepEqual(await unlinkWorktreeDeps(base, worktree), { ok: true, removed: false });
  assert.equal(fs.readlinkSync(linked), foreign);
});

test('main lifecycle wires dependency linking before worktree safety checks', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/main/index.ts'), 'utf8');
  assert.match(source, /from ['"]\.\/worktreeDeps['"]/);
  assert.match(source, /await linkWorktreeDeps\(origCwd, wtPath\)/);
  const finalize = source.indexOf('async function finalizeWorkerWorktree');
  assert.ok(source.indexOf('await unlinkWorktreeDeps(origCwd, wtPath)', finalize)
    < source.indexOf('await worktreeHasUnintegratedWork(wtPath', finalize));
  const gc = source.indexOf('async function gcPreservedWorktrees');
  assert.ok(source.indexOf('await unlinkWorktreeDeps(e.origCwd, e.wtPath)', gc)
    < source.indexOf('await worktreeIsGcSafe(e.wtPath', gc));
});
