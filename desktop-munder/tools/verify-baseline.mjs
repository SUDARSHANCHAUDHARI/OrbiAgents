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
const adaptations = JSON.parse(readFileSync(join(root, 'ADAPTATIONS.json'), 'utf8'));
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
  let bytes = readFileSync(join(root, entry.target));
  if (adaptations[entry.target]) {
    let restored = bytes.toString('utf8');
    for (const edit of [...adaptations[entry.target]].reverse()) {
      assert.ok(edit.before && edit.after && edit.before !== edit.after && edit.reason);
      assert.equal(restored.split(edit.after).length, 2, `Adaptation missing or ambiguous: ${entry.target}`);
      restored = restored.replace(edit.after, edit.before);
    }
    bytes = Buffer.from(restored);
  }
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `Changed baseline: ${entry.target}`);
}
for (const target of Object.keys(adaptations)) assert.ok(seen.has(target), `Unknown adaptation target: ${target}`);
function checkTree(relative = '') {
  for (const name of readdirSync(join(root, relative))) {
    if (relative === '' && name === 'release') continue;
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
assert.equal(pkg.scripts.dev, 'node tools/run-with-dependencies.mjs dev');
assert.equal(pkg.scripts.build, 'node tools/run-with-dependencies.mjs build');
assert.equal(pkg.scripts.start, 'node tools/open-built-app.mjs');
assert.equal(pkg.scripts['package:mac'], 'node tools/run-with-dependencies.mjs package');
console.log(`Verified ${seen.size} upstream file provenances (${Object.keys(adaptations).length} explicitly adapted), ${approvedArt.size} approved art/credit files, retained licenses, excluded paid artwork, and explicit dependency preparation.`);
