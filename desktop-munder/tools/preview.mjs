import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const { build, preview } = await import(require.resolve('vite'));
const root = fileURLToPath(new URL('../preview', import.meta.url));
const config = {
  configFile: false, root,
  resolve: { alias: [
    { find: '@', replacement: fileURLToPath(new URL('../src/renderer/src', import.meta.url)) },
    { find: /^pixi\.js$/, replacement: require.resolve('pixi.js').replace(/\.js$/, '.mjs') },
    { find: 'pixi.js/unsafe-eval', replacement: require.resolve('pixi.js/unsafe-eval').replace(/\.js$/, '.mjs') },
  ] },
};
if (['build', 'serve'].includes(process.argv[2])) {
  const outDir = mkdtempSync(join(tmpdir(), 'orbi-room-preview-'));
  await build({ ...config, build: { outDir, emptyOutDir: false, target: 'es2022', assetsInlineLimit: 0 } });
  const hashes = new Set(readdirSync(join(outDir, 'assets')).map(name =>
    createHash('sha256').update(readFileSync(join(outDir, 'assets', name))).digest('hex')));
  const manifest = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));
  for (const entry of manifest.entries)
    if (!hashes.has(entry.sha256)) throw new Error(`Build omitted or modified credited artwork: ${entry.path}`);
  console.log('Verified all 14 artwork/credit files in the preview output.');
  console.log(`Preview build: ${outDir}`);
  if (process.argv[2] === 'serve') {
    // Serve only built assets, never repository source files or a dev filesystem.
    const server = await preview({ ...config, build: { outDir },
      preview: { host: '127.0.0.1', port: 4174, strictPort: true, open: false } });
    server.printUrls();
  }
} else throw new Error('Usage: node desktop-munder/tools/preview.mjs <build|serve>');
