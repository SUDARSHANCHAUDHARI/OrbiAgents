// Bundle main/preload source without executing Electron or native dependencies.
import { createRequire } from 'node:module';
import { mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const { build } = createRequire(require.resolve('vite'))('esbuild');
const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'orbi-main-build-'));
for (const part of ['main', 'preload']) {
  await build({ entryPoints: [join(root, 'src', part, 'index.ts')],
    outfile: join(outDir, part, 'index.cjs'), bundle: true, platform: 'node',
    format: 'cjs', target: 'node20', packages: 'external',
    define: { __APP_VERSION__: '"0.0.0-migration"', __POSTHOG_KEY__: '""', __POSTHOG_HOST__: '""' },
  });
}
for (const name of ['slack-trigger.cjs', 'kg-core.cjs'])
  copyFileSync(join(root, 'src/main', name), join(outDir, 'main', name));
console.log(`Main/preload source bundles: ${outDir}. External dependencies and native runtime are NOT verified.`);
