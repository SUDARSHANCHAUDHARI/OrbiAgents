// Build only: never launches Electron, a server, or any provider process.
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const dependenciesRoot = process.argv[2];
if (!dependenciesRoot) throw new Error('Usage: node tools/build-renderer.mjs <isolated-dependency-directory>');
const dependencies = JSON.parse(readFileSync(new URL('./renderer-dependencies.json', import.meta.url))).dependencies;
const dependencyDir = resolve(dependenciesRoot, 'node_modules');
for (const [name, version] of Object.entries(dependencies)) {
  const manifestPath = join(dependencyDir, name, 'package.json');
  if (!existsSync(manifestPath) || JSON.parse(readFileSync(manifestPath)).version !== version)
    throw new Error(`Missing or mismatched renderer dependency: ${name}@${version}`);
}
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const isolatedRequire = createRequire(join(resolve(dependenciesRoot), 'package.json'));
const { build } = await import(require.resolve('vite'));
const root = fileURLToPath(new URL('../src/renderer', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'orbi-renderer-build-'));
await build({ configFile: false, envDir: false, root,
  esbuild: { jsx: 'automatic' },
  define: { __APP_VERSION__: JSON.stringify('0.0.0-migration') },
  resolve: { alias: [
    { find: '@', replacement: join(root, 'src') },
    { find: '@shared', replacement: fileURLToPath(new URL('../src/shared', import.meta.url)) },
    { find: 'pixi.js/unsafe-eval', replacement: isolatedRequire.resolve('pixi.js/unsafe-eval').replace(/\.js$/, '.mjs') },
    ...Object.keys(dependencies).sort((a, b) => b.length - a.length).map(name => ({
      find: name === '@openai/agents-realtime' ? /^@openai\/agents-realtime$/ : name,
      replacement: join(dependencyDir, name),
    })),
  ] },
  build: { outDir, emptyOutDir: false, target: 'es2022', assetsInlineLimit: 0 },
});
copyFileSync(new URL('../art/lpc-office/Credits.txt', import.meta.url), join(outDir, 'ART-CREDITS.txt'));
copyFileSync(new URL('../baseline/LICENSE', import.meta.url), join(outDir, 'SOURCE-LICENSE.txt'));
copyFileSync(new URL('../src/renderer/src/assets/fonts/LICENSE.txt', import.meta.url), join(outDir, 'FONT-LICENSE.txt'));
const hashes = new Set(readdirSync(join(outDir, 'assets')).map(name =>
  createHash('sha256').update(readFileSync(join(outDir, 'assets', name))).digest('hex')));
const art = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url)));
for (const entry of art.entries.filter(entry => entry.path.endsWith('.png')))
  if (!hashes.has(entry.sha256)) throw new Error(`Build omitted or modified approved artwork: ${entry.path}`);
console.log(`Renderer-only build: ${outDir}. Not a runnable or packaged Electron application.`);
