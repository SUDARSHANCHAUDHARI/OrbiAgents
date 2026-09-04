import { mkdirSync, lstatSync } from 'node:fs';
import { isAbsolute, join, parse } from 'node:path';

interface MigrationApp {
  isReady(): boolean;
  getPath(name: 'appData'): string;
  setPath(name: string, path: string): void;
  setName(name: string): void;
}

/** Must run before other main-process modules and before Electron ready.
 * No state is copied from another application or inferred from its app name.
 */
export function configureMigrationStorage(app: MigrationApp): { userData: string; sessionData: string } {
  if (app.isReady()) throw new Error('Migration storage must be configured before Electron ready');
  const base = app.getPath('appData');
  if (!isAbsolute(base) || base === parse(base).root)
    throw new Error('Invalid application-data base directory');
  const userData = join(base, 'OrbiAgents-Migration');
  const sessionData = join(userData, 'chromium-session');
  for (const directory of [userData, sessionData]) {
    try { mkdirSync(directory, { mode: 0o700 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    const info = lstatSync(directory);
    if (info.isSymbolicLink() || !info.isDirectory())
      throw new Error('Migration storage must be a real directory, not a file or symlink');
  }
  app.setName('OrbiAgents Migration');
  app.setPath('userData', userData);
  app.setPath('sessionData', sessionData);
  return { userData, sessionData };
}
