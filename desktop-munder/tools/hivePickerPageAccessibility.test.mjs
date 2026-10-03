import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/renderer/src/components/HivePicker.tsx', import.meta.url), 'utf8');

test('Hive Picker is a named launch page that receives initial focus', () => {
  assert.match(page, /<main\s+ref=\{pageRef\}\s+aria-label="Select a harness configuration"\s+tabIndex=\{-1\}/);
  assert.match(page, /useEffect\(\(\) => \{ pageRef\.current\?\.focus\(\); \}, \[\]\);/);
});
