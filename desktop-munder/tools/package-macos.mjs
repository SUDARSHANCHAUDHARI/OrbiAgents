// Assemble an unsigned local OrbiAgents app. Never launches it.
import { createRequire } from 'node:module';
import { cpSync, copyFileSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
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
const iconRenderDir = join(staging, 'icon-render');
const iconsetDir = join(staging, 'OrbiAgents.iconset');
mkdirSync(iconRenderDir);
mkdirSync(iconsetDir);
const iconSource = resolve(toolsDir, '../src/renderer/src/assets/orbi-mark.svg');
execFileSync('/usr/bin/qlmanage', ['-t', '-s', '1024', '-o', iconRenderDir, iconSource], { stdio: 'ignore' });
const iconPng = join(iconRenderDir, 'orbi-mark.svg.png');
for (const [points, pixels] of [[16, 16], [16, 32], [32, 32], [32, 64], [128, 128], [128, 256], [256, 256], [256, 512], [512, 512], [512, 1024]]) {
  const suffix = pixels === points ? `${points}x${points}` : `${points}x${points}@2x`;
  execFileSync('/usr/bin/sips', ['-z', String(pixels), String(pixels), iconPng, '--out', join(iconsetDir, `icon_${suffix}.png`)], { stdio: 'ignore' });
}
const appIcon = join(staging, 'OrbiAgents.icns');
execFileSync('/usr/bin/iconutil', ['-c', 'icns', iconsetDir, '-o', appIcon]);
const appDir = join(staging, 'app');
mkdirSync(join(appDir, 'out'), { recursive: true });
cpSync(mainDir, join(appDir, 'out'), { recursive: true });
// The imported BrowserWindow expects ../preload/index.js.
copyFileSync(join(appDir, 'out/preload/index.cjs'), join(appDir, 'out/preload/index.js'));
cpSync(rendererDir, join(appDir, 'out/renderer'), { recursive: true });
cpSync(join(dependenciesRoot, 'node_modules'), join(appDir, 'node_modules'), { recursive: true });
const dependencies = Object.fromEntries(Object.entries(pinned.dependencies).filter(([name]) => name !== 'electron' && !name.startsWith('@types/')));
writeFileSync(join(appDir, 'package.json'), JSON.stringify({
  name: 'orbiagents-desktop', version: '0.4.6-orbi.1', private: true,
  description: 'OrbiAgents local-first multi-agent desktop application', author: 'SudarshanTechLabs',
  main: 'launch-gate.cjs', dependencies,
}, null, 2));
copyFileSync(join(toolsDir, 'launch-gate.cjs'), join(appDir, 'launch-gate.cjs'));
// The compile tree also contains Electron and type-only packages. Prune the
// staged copy against the runtime manifest before archiving so they are not
// shipped as dead weight. Lifecycle scripts stay disabled.
execFileSync('npm', ['prune', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
  cwd: appDir,
  stdio: 'inherit',
});
const { build, Platform, Arch } = require('electron-builder');
// Archive the already pinned and native-verified tree directly. Asking npm list
// to expand this graph during electron-builder collection exhausts its heap.
const packedDir = join(staging, 'packed');
mkdirSync(packedDir);
await require('@electron/asar').createPackageWithOptions(appDir, join(packedDir, 'app.asar'), {
  unpack: '**/{*.node,spawn-helper}',
});
await build({ projectDir: packedDir, targets: Platform.MAC.createTarget(['dir'], Arch.arm64), publish: 'never',
  config: { appId: 'com.sudarshantechlabs.orbiagents', productName: 'OrbiAgents',
    electronVersion: pinned.dependencies.electron, electronDist: join(electronRoot, 'dist'),
    directories: { output: join(staging, 'dist') }, asar: true,
    asarUnpack: ['**/*.node', '**/spawn-helper'], npmRebuild: false, nodeGypRebuild: false,
    publish: null, mac: { icon: appIcon, identity: null, notarize: false, hardenedRuntime: false },
  },
});
execFileSync(process.execPath, [join(toolsDir, 'verify-package.mjs'),
  join(staging, 'dist/mac-arm64/OrbiAgents.app')], { stdio: 'inherit' });
const releaseDir = resolve(toolsDir, '../release/mac-arm64');
const releaseApp = join(releaseDir, 'OrbiAgents.app');
mkdirSync(releaseDir, { recursive: true });
rmSync(releaseApp, { recursive: true, force: true });
const stagedApp = join(staging, 'dist/mac-arm64/OrbiAgents.app');
cpSync(stagedApp, releaseApp, { recursive: true });
// The custom Electron distribution produces absolute links within macOS
// frameworks. Relocate those links into the durable app instead of retaining
// temporary paths or dereferencing the framework repeatedly.
const relocateLinks = (directory) => {
  for (const name of readdirSync(directory)) {
    const destination = join(directory, name);
    const info = lstatSync(destination);
    if (info.isDirectory()) relocateLinks(destination);
    if (!info.isSymbolicLink()) continue;
    const target = readlinkSync(destination);
    if (!target.startsWith(`${stagedApp}/`))
      throw new Error(`Package contains an external symlink: ${destination}`);
    const relocatedTarget = join(releaseApp, target.slice(stagedApp.length + 1));
    unlinkSync(destination);
    symlinkSync(relative(dirname(destination), relocatedTarget), destination);
  }
};
relocateLinks(releaseApp);
console.log(`Unsigned local package: ${releaseApp}`);
