import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('fresh and voice orchestrator identity uses Orbi Prime or the resolved live name', async () => {
  const [identity, hive, voice, onboarding] = await Promise.all([
    read('src/shared/godIdentity.ts'), read('src/renderer/src/hooks/useHive.ts'),
    read('src/renderer/src/realtime/session.ts'), read('src/renderer/src/components/OnboardingWizard.tsx')
  ]);
  assert.match(identity, /DEFAULT_GOD_NAME = 'Orbi Prime'/);
  assert.match(hive, /initialGodPrompt\(godName\)/);
  assert.match(voice, /name: godName/);
  assert.match(voice, /instructions: voicePersona\(godName\)/);
  assert.doesNotMatch(`${hive}\n${voice}\n${onboarding}`, /You're online as Michael|You are Michael|Michael here|\(Michael\) is the engine/);
});
