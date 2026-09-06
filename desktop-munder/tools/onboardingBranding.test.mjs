import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('English onboarding and title bar identify OrbiAgents', () => {
  const locale = JSON.parse(readFileSync(new URL('../src/renderer/src/i18n/locales/en.json', import.meta.url)));
  const onboarding = JSON.stringify(locale.onboarding);
  assert.match(onboarding, /WELCOME TO ORBIAGENTS/);
  assert.match(onboarding, /OrbiAgents turns the CLI agent/);
  assert.doesNotMatch(onboarding, /Munder(?: Difflin)?/i);
  const app = readFileSync(new URL('../src/renderer/src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /alt="OrbiAgents"/);
});
