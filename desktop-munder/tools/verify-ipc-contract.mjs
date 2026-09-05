import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const preload = readFileSync(join(root, 'src/preload/index.ts'), 'utf8');
const requested = new Set([...preload.matchAll(/ipcRenderer\.(?:invoke|sendSync)\('([^']+)'/g)].map(match => match[1]));
const mainDir = join(root, 'src/main');
const main = readdirSync(mainDir).filter(name => name.endsWith('.ts'))
  .map(name => readFileSync(join(mainDir, name), 'utf8')).join('\n');
const registered = new Set([...main.matchAll(/ipcMain\.(?:handle|on)\('([^']+)'/g)].map(match => match[1]));
const missing = [...requested].filter(channel => !registered.has(channel)).sort();
assert.deepEqual(missing, [], `Preload channels without main registrations: ${missing.join(', ')}`);
assert.match(preload, /contextBridge\.exposeInMainWorld\('cth', api\)/);
console.log(`IPC contract verified: ${requested.size} static preload requests have main-process registrations.`);
