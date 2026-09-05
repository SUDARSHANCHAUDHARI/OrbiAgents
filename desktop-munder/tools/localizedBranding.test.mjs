import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const locales = ['en', 'zh-CN', 'ar'];
const retiredSettingsKeys = [
  'sponsoredBy', 'visit', 'announcement', 'proLaunch', 'proCommunityFree',
  'proParagraph', 'foundersWallTitle', 'foundersWallBody', 'seeTheWall', 'joinDiscord'
];

test('all bundled locales identify OrbiAgents without upstream product copy', async () => {
  for (const locale of locales) {
    const data = JSON.parse(await readFile(
      new URL(`src/renderer/src/i18n/locales/${locale}.json`, root),
      'utf8'
    ));
    const text = JSON.stringify(data);

    assert.doesNotMatch(text, /Munder Difflin|MUNDER DIFFLIN|munderdiffl\.in/i, locale);
    assert.match(data.onboarding.titles.persona, /ORBIAGENTS/, locale);
    for (const key of retiredSettingsKeys) {
      assert.equal(key in data.settingsHero, false, `${locale}: ${key}`);
    }
  }
});
