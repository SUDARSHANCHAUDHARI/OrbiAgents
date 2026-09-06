import { accessSync, constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const executable = fileURLToPath(new URL('../release/mac-arm64/OrbiAgents.app/Contents/MacOS/OrbiAgents', import.meta.url));
try {
  accessSync(executable, constants.X_OK);
} catch {
  throw new Error('No built OrbiAgents app found. Run `pnpm build` first.');
}
const child = spawn(executable, [], { detached: true, stdio: 'ignore' });
child.unref();
console.log(`Opened OrbiAgents (pid ${child.pid}).`);
