import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('Settings uses local OrbiAgents identity without upstream promotions', async () => {
  const source = await readFile(
    new URL('src/renderer/src/components/SettingsHeroCard.tsx', root),
    'utf8'
  );

  assert.match(source, /const hero = DEFAULT_HERO;/);
  assert.doesNotMatch(source, /heroPayload\(|PLAN\.upgrade|SPONSOR|proLaunch|foundersWall/);
  assert.doesNotMatch(source, /munderdiffl\.in|discord\.gg|settingsHero\.joinDiscord/);
});
