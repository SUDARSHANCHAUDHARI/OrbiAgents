import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('onboarding power guidance follows the active desktop platform', () => {
  const wizard = source('../src/renderer/src/components/OnboardingWizard.tsx');
  assert.match(wizard, /platform === 'darwin'/);
  assert.match(wizard, /platform === 'win32'/);
  assert.match(wizard, /x-apple\.systempreferences:com\.apple\.preference\.battery/);
  assert.match(wizard, /ms-settings:powersleep/);
  assert.match(wizard, /stayAwakeUrl &&/);

  const main = source('../src/main/index.ts');
  assert.match(main, /x-apple\\\.systempreferences:\|ms-settings:\|https:\\\/\\\//);
});

test('every bundled locale provides macOS, Windows and Linux power guidance', () => {
  for (const localeName of ['en', 'ar', 'zh-CN']) {
    const locale = JSON.parse(source(`../src/renderer/src/i18n/locales/${localeName}.json`));
    const permissions = locale.onboarding.permissions;
    for (const key of [
      'stayAwakeDescMac',
      'stayAwakeDescWindows',
      'stayAwakeDescLinux',
      'openBatteryMac',
      'openBatteryWindows'
    ]) {
      assert.equal(typeof permissions[key], 'string', `${localeName}.${key}`);
      assert.ok(permissions[key].length > 0, `${localeName}.${key}`);
    }
    assert.equal(permissions.stayAwakeDesc, undefined);
    assert.equal(permissions.openBattery, undefined);
  }
});
