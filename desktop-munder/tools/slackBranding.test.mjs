import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Slack setup and reply helper identify OrbiAgents', async () => {
  const settings = await readFile(
    new URL('src/renderer/src/components/SettingsModal.tsx', root),
    'utf8'
  );
  const helper = await readFile(new URL('resources/md-slack-reply.cjs', root), 'utf8');

  assert.match(settings, /Connect OrbiAgents to Slack/);
  assert.match(settings, /\/invite @OrbiAgents/);
  assert.doesNotMatch(settings, /Munder Difflin|@MunderDifflin/);
  assert.match(helper, /The OrbiAgents main process/);
  assert.doesNotMatch(helper, /The Munder Difflin main process/);
});
