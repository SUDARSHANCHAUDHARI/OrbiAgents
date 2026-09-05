import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('every static preload request has a main-process registration', () => {
  execFileSync(process.execPath, [fileURLToPath(new URL('./verify-ipc-contract.mjs', import.meta.url))]);
});
