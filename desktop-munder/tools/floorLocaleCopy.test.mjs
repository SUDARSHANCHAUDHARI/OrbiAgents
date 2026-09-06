import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const locales = ['en', 'zh-CN', 'ar'];

test('localized floor chatter keeps stable pools and removes copied-show jokes', async () => {
  for (const locale of locales) {
    const source = await readFile(new URL(`../src/renderer/src/i18n/locales/${locale}.json`, import.meta.url), 'utf8');
    const data = JSON.parse(source);
    assert.equal(data.office.errand.smoke.length, 4, `${locale} smoke pool`);
    assert.equal(data.office.suckUp.length, 7, `${locale} status pool`);
    assert.equal(data.office.gossip.length, 7, `${locale} conversation pool`);
    const chatter = [...data.office.errand.smoke, ...data.office.suckUp, ...data.office.gossip].join('\n');
    assert.doesNotMatch(chatter, /world.?s best boss|I DECLARE|cigar|雪茄|أفضل مدير في العالم|أُعلن/i, locale);
  }
});
