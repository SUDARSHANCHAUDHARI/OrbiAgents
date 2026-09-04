// Compile declarations/source only. Never imports application runtime modules.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = process.argv[2];
const mode = process.argv[3];
if (!dir || !['web', 'node'].includes(mode)) throw new Error('Usage: node tools/typecheck.mjs <compile-dependency-directory> <web|node>');
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const dependencies = JSON.parse(readFileSync(new URL('./compile-dependencies.json', import.meta.url))).dependencies;
for (const [name, version] of Object.entries(dependencies)) {
  const installed = JSON.parse(readFileSync(resolve(dir, 'node_modules', name, 'package.json')));
  if (installed.version !== version) throw new Error(`Mismatched compile dependency: ${name}@${version}`);
}
const ts = require('typescript');
const root = fileURLToPath(new URL('..', import.meta.url));
const config = JSON.parse(readFileSync(new URL(`../baseline/tsconfig.${mode}.json`, import.meta.url)));
config.compilerOptions.types = ['node'];
config.compilerOptions.typeRoots = [resolve(dir, 'node_modules/@types')];
config.compilerOptions.baseUrl = root;
config.compilerOptions.noEmit = true;
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root);
const host = ts.createCompilerHost(parsed.options);
host.resolveModuleNames = (names, containingFile) => names.map(name => {
  const local = name.startsWith('.') || name.startsWith('/') || name.startsWith('@/') || name.startsWith('@shared/');
  return ts.resolveModuleName(name, local ? containingFile : resolve(dir, 'typecheck.ts'), parsed.options, host).resolvedModule;
});
const files = [...parsed.fileNames];
if (mode === 'web') files.push(resolve(dirname(require.resolve('vite/package.json')), 'client.d.ts'));
const program = ts.createProgram(files, parsed.options, host);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else console.log(`${mode} typecheck passed (${files.length} root files).`);
