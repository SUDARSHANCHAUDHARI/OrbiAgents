import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const chromeFiles = [
  'src/renderer/src/components/ReleaseDrop.tsx',
  'src/renderer/src/components/SettingsHeroCard.tsx',
  'src/renderer/src/components/UpdateToast.tsx',
  'src/renderer/src/ide/IdePanel.tsx',
  'src/renderer/src/components/FullscreenTerminal.tsx',
  'src/renderer/src/realtime/tools.ts',
  'src/renderer/src/realtime/session.ts'
];

test('English application chrome uses OrbiAgents identity', async () => {
  for (const path of chromeFiles) {
    const source = await readFile(new URL(path, root), 'utf8');
    assert.doesNotMatch(source, /Munder Difflin|MUNDER DIFFLIN|chaitanyagiri\/munder-difflin/, path);
  }
});

test('repository actions point to the OrbiAgents repository', async () => {
  const expected = 'https://github.com/SUDARSHANCHAUDHARI/OrbiAgents';
  for (const path of [
    'src/renderer/src/components/SettingsHeroCard.tsx',
    'src/renderer/src/components/UpdateToast.tsx'
  ]) {
    const source = await readFile(new URL(path, root), 'utf8');
    assert.match(source, new RegExp(expected.replaceAll('/', '\\/')), path);
  }
});
