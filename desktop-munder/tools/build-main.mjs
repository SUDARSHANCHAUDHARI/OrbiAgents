// Bundle main/preload source without executing Electron or native dependencies.
import { createRequire } from 'node:module';
import { builtinModules } from 'node:module';
import { mkdtempSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const { build } = createRequire(require.resolve('vite'))('esbuild');
const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'orbi-main-build-'));
const runtimeDependencies = new Set();
const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));
const packageName = specifier => {
  if (specifier === 'electron' || builtins.has(specifier)) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};
for (const part of ['main', 'preload']) {
  const result = await build({ entryPoints: [join(root, 'src', part, 'index.ts')],
    outfile: join(outDir, part, 'index.cjs'), bundle: true, platform: 'node',
    format: 'cjs', target: 'node20', packages: 'external',
    metafile: true,
    define: { __APP_VERSION__: '"0.0.0-migration"', __POSTHOG_KEY__: '""', __POSTHOG_HOST__: '""' },
  });
  for (const output of Object.values(result.metafile.outputs)) {
    for (const dependency of output.imports.filter(entry => entry.external)) {
      const name = packageName(dependency.path);
      if (name) runtimeDependencies.add(name);
    }
  }
}
for (const name of ['slack-trigger.cjs', 'kg-core.cjs'])
  copyFileSync(join(root, 'src/main', name), join(outDir, 'main', name));
writeFileSync(join(outDir, 'runtime-dependencies.json'), `${JSON.stringify([...runtimeDependencies].sort(), null, 2)}\n`);
console.log(`Main/preload source bundles: ${outDir}. External dependencies and native runtime are NOT verified.`);
