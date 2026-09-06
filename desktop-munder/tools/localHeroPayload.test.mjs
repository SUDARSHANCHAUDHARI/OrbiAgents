import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const heroSource = await readFile(new URL('../src/main/hero.ts', import.meta.url), 'utf8');

test('Settings identity payload is compiled locally without upstream I/O', () => {
  assert.match(heroSource, /return \{ hero: DEFAULT_HERO, fetchedAt: 0, stale: false \}/);
  assert.doesNotMatch(heroSource, /getText|raw\.githubusercontent|chaitanyagiri|readFile|writeFile|mkdir/);
});

test('local payload preserves the imported IPC function contract', () => {
  assert.match(heroSource, /export async function loadHero/);
  assert.match(heroSource, /_cachePath: string/);
  assert.match(heroSource, /_opts: \{ force\?: boolean \}/);
});
