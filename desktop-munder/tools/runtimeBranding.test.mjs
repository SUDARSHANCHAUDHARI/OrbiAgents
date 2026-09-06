import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const runtimeSurfaces = [
  'src/main/index.ts',
  'src/main/updater.ts',
  'src/main/hive.ts',
  'src/shared/updateState.ts',
  'src/shared/releaseDrop.ts',
  'src/shared/triggers.ts',
  'src/shared/codexCommands.ts',
  'src/shared/grokCommands.ts',
  'src/shared/ossModels.ts',
  'src/renderer/src/components/AddAgentModal.tsx'
];

test('active runtime surfaces use OrbiAgents product identity', async () => {
  for (const path of runtimeSurfaces) {
    const source = await readFile(new URL(path, root), 'utf8');
    assert.doesNotMatch(source, /Munder Difflin|MUNDER DIFFLIN|chaitanyagiri\/munder-difflin|munderdiffl\.in\/blog/, path);
  }
});

test('release metadata points to OrbiAgents while hire protocol stays compatible', async () => {
  const updates = await readFile(new URL('src/shared/updateState.ts', root), 'utf8');
  const hire = await readFile(new URL('src/renderer/src/components/AddAgentModal.tsx', root), 'utf8');

  assert.match(updates, /SUDARSHANCHAUDHARI\/OrbiAgents/);
  assert.match(updates, /OrbiAgents-\$\{v\}-mac-\$\{arch\}\.dmg/);
  assert.match(hire, /"spec": "munder-difflin\/hire@1"/);
});
