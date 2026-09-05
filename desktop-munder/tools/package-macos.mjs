// Assemble an unsigned, default-deny migration app. Never launches it.
import { createRequire } from 'node:module';
import { cpSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Only macOS arm64 packaging is verified');
if (!process.argv[2]) throw new Error('Supply the prepared isolated dependency directory');
const dependenciesRoot = resolve(process.argv[2]);
const pinned = JSON.parse(readFileSync(new URL('./compile-dependencies.json', import.meta.url)));
for (const [name, version] of Object.entries(pinned.dependencies)) {
  if (JSON.parse(readFileSync(join(dependenciesRoot, 'node_modules', name, 'package.json'))).version !== version)
    throw new Error(`Mismatched package dependency: ${name}`);
}
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const electronRoot = dirname(require.resolve('electron/package.json'));
if (JSON.parse(readFileSync(join(electronRoot, 'package.json'))).version !== pinned.dependencies.electron)
  throw new Error('Installed Electron does not match the migration pin');
const electronBin = join(electronRoot, 'dist', readFileSync(join(electronRoot, 'path.txt'), 'utf8').trim());
const toolsDir = dirname(fileURLToPath(import.meta.url));
// Verify ABI bindings before copying. Uses only an in-memory DB and PTY echo.
execFileSync(electronBin, [join(toolsDir, 'runtime-smoke.cjs'), dependenciesRoot], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'inherit',
});
const run = (name, args = []) => execFileSync(process.execPath, [join(toolsDir, name), ...args], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const mainOutput = run('build-main.mjs');
const rendererOutput = run('build-renderer.mjs', [dependenciesRoot]);
const mainDir = mainOutput.match(/Main\/preload source bundles: (.+)\. External/)[1];
const rendererDir = rendererOutput.match(/Renderer-only build: (.+)\. Not/)[1];
const staging = mkdtempSync(join(tmpdir(), 'orbi-package-'));
const appDir = join(staging, 'app');
mkdirSync(join(appDir, 'out'), { recursive: true });
cpSync(mainDir, join(appDir, 'out'), { recursive: true });
// The imported BrowserWindow expects ../preload/index.js.
copyFileSync(join(appDir, 'out/preload/index.cjs'), join(appDir, 'out/preload/index.js'));
cpSync(rendererDir, join(appDir, 'out/renderer'), { recursive: true });
cpSync(join(dependenciesRoot, 'node_modules'), join(appDir, 'node_modules'), { recursive: true });
const dependencies = Object.fromEntries(Object.entries(pinned.dependencies).filter(([name]) => name !== 'electron' && !name.startsWith('@types/')));
writeFileSync(join(appDir, 'package.json'), JSON.stringify({
  name: 'orbiagents-migration-package', version: '0.0.0', private: true,
  description: 'Disabled migration package for validation only', author: 'SudarshanTechLabs',
  main: 'launch-gate.cjs', dependencies,
}, null, 2));
copyFileSync(join(toolsDir, 'launch-gate.cjs'), join(appDir, 'launch-gate.cjs'));
const { build, Platform, Arch } = require('electron-builder');
// Archive the already pinned and native-verified tree directly. Asking npm list
// to expand this graph during electron-builder collection exhausts its heap.
const packedDir = join(staging, 'packed');
mkdirSync(packedDir);
await require('@electron/asar').createPackageWithOptions(appDir, join(packedDir, 'app.asar'), {
  unpack: '**/{*.node,spawn-helper}',
});
await build({ projectDir: packedDir, targets: Platform.MAC.createTarget(['dir'], Arch.arm64), publish: 'never',
  config: { appId: 'com.sudarshantechlabs.orbiagents.migration', productName: 'OrbiAgents Migration',
    electronVersion: pinned.dependencies.electron, electronDist: join(electronRoot, 'dist'),
    directories: { output: join(staging, 'dist') }, asar: true,
    asarUnpack: ['**/*.node', '**/spawn-helper'], npmRebuild: false, nodeGypRebuild: false,
    publish: null, mac: { identity: null, notarize: false, hardenedRuntime: false },
  },
});
execFileSync(process.execPath, [join(toolsDir, 'verify-package.mjs'),
  join(staging, 'dist/mac-arm64/OrbiAgents Migration.app')], { stdio: 'inherit' });
console.log(`Unsigned disabled migration package: ${staging}`);
