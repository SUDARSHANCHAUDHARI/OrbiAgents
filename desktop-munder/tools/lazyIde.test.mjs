import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/renderer/src/App.tsx', import.meta.url), 'utf8');

test('Monaco workspace is loaded only when the IDE opens', () => {
  assert.match(source, /const IdePanel = lazy\(\(\) => import\('@\/ide\/IdePanel'\)/);
  assert.match(source, /<Suspense fallback=/);
  assert.doesNotMatch(source, /import \{ IdePanel \} from '@\/ide\/IdePanel'/);
});
