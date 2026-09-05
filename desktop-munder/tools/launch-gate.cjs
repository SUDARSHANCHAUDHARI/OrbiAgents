const { app, ipcMain } = require('electron');
const { isAbsolute, join, sep } = require('node:path');
const { lstatSync, readdirSync, realpathSync, writeFileSync } = require('node:fs');

const verifyPrefix = '--verify-isolated-startup=';
const reviewPrefix = '--review-isolated=';
const supplied = process.argv.find((arg) => arg.startsWith(verifyPrefix) || arg.startsWith(reviewPrefix));
if (!supplied) {
  console.error('Migration startup remains disabled pending isolation and full-app verification.');
  app.quit();
} else {
  try {
    const review = supplied.startsWith(reviewPrefix);
    const prefix = review ? reviewPrefix : verifyPrefix;
    const sentinelName = review ? '.orbi-isolated-review' : '.orbi-isolated-startup';
    const requested = supplied.slice(prefix.length);
    if (!isAbsolute(requested)) throw new Error('Isolated root must be absolute');
    const root = realpathSync(requested);
    const info = lstatSync(root);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Isolated root must be a real directory');
    if (!readdirSync(root).every((name) => name === sentinelName))
      throw new Error('Isolated root must contain only its sentinel');
    const sentinel = join(root, sentinelName);
    if (!lstatSync(sentinel).isFile()) throw new Error('Isolation sentinel must be a regular file');
    app.setPath('appData', root);
    process.env.ORBI_ISOLATED_STARTUP_VERIFY = '1';
    const resultFile = join(root, review ? 'review-ready.json' : 'startup-result.json');
    let finished = false;
    let preloadSenderId = null;
    ipcMain.once('migration:preload-ready', (event) => { preloadSenderId = event.sender.id; });
    const finish = (result, exitCode = 0, keepOpen = false) => {
      if (finished) return;
      finished = true;
      writeFileSync(resultFile, JSON.stringify(result, null, 2), { mode: 0o600 });
      if (!keepOpen) app.exit(exitCode);
    };
    const timeout = setTimeout(() => finish({ ok: false, error: 'startup timed out' }, 1), 30_000);
    app.once('browser-window-created', (_event, window) => {
      window.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        if (preloadSenderId !== window.webContents.id)
          return finish({ ok: false, error: 'preload bridge did not initialize for the loaded window' }, 1);
        const userData = realpathSync(app.getPath('userData'));
        const sessionData = realpathSync(app.getPath('sessionData'));
        const inside = (candidate) => candidate.startsWith(`${root}${sep}`);
        if (!inside(userData) || !inside(sessionData))
          return finish({ ok: false, error: 'application paths escaped verification root' }, 1);
        finish({ ok: true, mode: review ? 'review' : 'verification', preloadReady: true,
          userData, sessionData, url: window.webContents.getURL() }, 0, review);
      });
      window.webContents.once('did-fail-load', (_event, code, description) => {
        clearTimeout(timeout);
        finish({ ok: false, error: `renderer failed to load: ${code} ${description}` }, 1);
      });
    });
    require('./out/main/index.cjs');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    app.exit(1);
  }
}
