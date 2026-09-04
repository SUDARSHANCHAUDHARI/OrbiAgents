import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'UPSTREAM.json'), 'utf8'));
assert.equal(manifest.revision, '4ff5a158c253eae3f917a136a80a586e1fc60c2f');
assert.ok(manifest.entries.length > 0);
const seen = new Set();
const approvedArt = new Set();
if (existsSync(join(root, 'art/manifest.json'))) {
  const art = JSON.parse(readFileSync(join(root, 'art/manifest.json'), 'utf8'));
  assert.equal(art.license, 'OGA-BY-3.0');
  assert.equal(art.archiveSha256, '697b688de1c18ca71ee5851ca925c4cfea8be810a82551c3595990d1e6266aaa');
  for (const entry of art.entries) {
    assert.ok(entry.path.startsWith('art/lpc-office/') && !entry.path.split('/').includes('..'));
    assert.ok(!approvedArt.has(entry.path));
    const bytes = readFileSync(join(root, entry.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `Changed art: ${entry.path}`);
    if (entry.path.endsWith('.png')) {
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(bytes.readUInt32BE(16), entry.width);
      assert.equal(bytes.readUInt32BE(20), entry.height);
    }
    approvedArt.add(entry.path);
  }
  assert.ok(approvedArt.has('art/lpc-office/Credits.txt'));
}
for (const entry of manifest.entries) {
  assert.ok(!entry.target.startsWith('/') && !entry.target.split('/').includes('..'));
  assert.ok(!seen.has(entry.target), `Duplicate import: ${entry.target}`); seen.add(entry.target);
  assert.ok(lstatSync(join(root, entry.target)).isFile());
  assert.equal(createHash('sha256').update(readFileSync(join(root, entry.target))).digest('hex'), entry.sha256, `Changed baseline: ${entry.target}`);
}
function checkTree(relative = '') {
  for (const name of readdirSync(join(root, relative))) {
    const path = join(relative, name); const stat = lstatSync(join(root, path));
    assert.ok(!stat.isSymbolicLink(), `Symlink: ${path}`);
    assert.ok(!['AGENTS.md', 'CLAUDE.md', 'SKILL.md', '.github', 'node_modules'].includes(name), `Unexpected imported content: ${path}`);
    if (stat.isDirectory()) checkTree(path);
    else if (/\.(png|jpg|jpeg|gif|webp|tmj|ico|icns)$/i.test(name)) assert.ok(approvedArt.has(path), `Unapproved artwork: ${path}`);
  }
}
checkTree();
assert.match(readFileSync(join(root, 'baseline/LICENSE'), 'utf8'), /Copyright \(c\) 2026 Chaitanya Giri/);
assert.ok(existsSync(join(root, 'src/renderer/src/assets/fonts/LICENSE.txt')));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
assert.equal(pkg.private, true);
assert.equal(pkg.scripts.postinstall, undefined);
assert.equal(pkg.dependencies, undefined);
for (const command of ['dev', 'build', 'start']) assert.equal(pkg.scripts[command], 'node tools/migration-gate.mjs');
console.log(`Verified ${seen.size} byte-identical upstream files, ${approvedArt.size} approved art/credit files, retained licenses, excluded paid artwork, and disabled launch/install defaults.`);
