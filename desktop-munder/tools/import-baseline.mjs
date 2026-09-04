import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mechanical, byte-for-byte vendor import. Never install or execute upstream code.
const revision = '4ff5a158c253eae3f917a136a80a586e1fc60c2f';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] && resolve(process.argv[2]);
if (!source) throw new Error('Usage: node tools/import-baseline.mjs <verified-upstream-checkout>');
if (execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision) throw new Error('Upstream revision does not match');
if (execFileSync('git', ['-C', source, 'status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('Upstream checkout must be clean');
if (existsSync(join(root, 'UPSTREAM.json'))) throw new Error('Baseline already imported; refusing to overwrite');

const entries = [];
const excluded = [];
const exact = ['LICENSE', 'LICENSE-ASSETS', 'package.json', 'package-lock.json', 'electron.vite.config.ts', 'electron-builder.yml', 'tsconfig.json', 'tsconfig.node.json', 'tsconfig.web.json', 'tools/copy-main-assets.cjs', 'resources/kg.cjs', 'resources/md-slack-reply.cjs'];
const fontRoot = 'src/renderer/src/assets/fonts/';
function visit(relative) {
  const file = join(source, relative);
  const stat = lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`Unexpected symlink: ${relative}`);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(file).sort()) visit(`${relative}/${entry}`);
    return;
  }
  if (relative.startsWith('src/renderer/src/assets/') && !relative.startsWith(fontRoot)) {
    excluded.push(relative); return;
  }
  if (/(^|\/)(AGENTS\.md|CLAUDE\.md|SKILL\.md|\.env[^/]*|\.github)(\/|$)/.test(relative)) {
    excluded.push(relative); return;
  }
  // Operational build/config files stay inert until adapted deliberately.
  const target = exact.includes(relative) && !relative.startsWith('resources/')
    ? `baseline/${relative}` : relative;
  if (existsSync(join(root, target))) throw new Error(`Refusing to replace ${target}`);
  entries.push({ source: relative, target, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
}
visit('src'); visit('test');
for (const file of exact) visit(file);
// All targets were checked before any copy. This is a deliberate source import,
// not a shell extraction of arbitrary paths from a third-party archive.
for (const entry of entries) {
  mkdirSync(dirname(join(root, entry.target)), { recursive: true });
  copyFileSync(join(source, entry.source), join(root, entry.target));
}
writeFileSync(join(root, 'UPSTREAM.json'), JSON.stringify({ repository: 'https://github.com/chaitanyagiri/munder-difflin', revision, entries, excluded }, null, 2) + '\n', { flag: 'wx' });
console.log(`Imported ${entries.length} pinned files; excluded ${excluded.length} artwork/attribution files. No upstream code executed.`);
