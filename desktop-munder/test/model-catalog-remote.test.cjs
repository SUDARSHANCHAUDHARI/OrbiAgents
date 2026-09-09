'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const loadTs = require('./load-ts.cjs');
const baked = require('../src/shared/modelCatalog.json');

const { parseModelCatalog, CATALOG_SCHEMA_VERSION } = loadTs('src/shared/modelCatalogPayload.ts');
const { loadModelCatalog, MODEL_CATALOG_URL, MODEL_CATALOG_TTL_MS } = loadTs('src/main/modelCatalog.ts');
const { applyRemoteModelCatalog, modelsForProvider, refreshModelCatalogStatus } = loadTs('src/renderer/src/store/config.ts');
const valid = (providers) => ({ version: CATALOG_SCHEMA_VERSION, providers });

test.afterEach(() => applyRemoteModelCatalog(null));

test('remote parser rejects unknown schemas and malformed payloads', () => {
  assert.equal(parseModelCatalog({ version: 2, providers: {} }), null);
  for (const value of [null, [], {}, valid(null)]) assert.equal(parseModelCatalog(value), null);
});

test('remote parser sanitizes command values, caps fields, and deduplicates IDs', () => {
  const parsed = parseModelCatalog(valid({ claude: [
    { id: 'safe\n--flag', label: 'Nice\0 model' },
    { id: 'safe\n--flag', label: 'Duplicate' },
    { id: 'x'.repeat(500), label: 'y'.repeat(500) }
  ] }));
  assert.equal(parsed.providers.claude[0].id, 'safe --flag');
  assert.equal(parsed.providers.claude[0].label, 'Nice model');
  assert.equal(parsed.providers.claude.length, 2);
  assert.equal(parsed.providers.claude[1].id.length, 120);
  assert.equal(parsed.providers.claude[1].label.length, 60);
});

test('remote provider overlays baked data and null restores it', () => {
  applyRemoteModelCatalog(parseModelCatalog(valid({ claude: [{ id: 'next', label: 'Next' }] })));
  assert.deepEqual(modelsForProvider('claude'), [{ id: 'next', label: 'Next' }]);
  assert.deepEqual(modelsForProvider('codex').map((m) => m.id), baked.providers.codex.map((m) => m.id));
  applyRemoteModelCatalog(null);
  assert.equal(modelsForProvider('claude')[0].id, baked.providers.claude[0].id);
});

test('renderer refresh exposes honest fresh, stale, and unavailable status', async (t) => {
  const previous = globalThis.cth;
  t.after(() => { globalThis.cth = previous; });
  globalThis.cth = { modelCatalog: async () => ({
    catalog: parseModelCatalog(valid({ claude: [{ id: 'next', label: 'Next' }] })),
    fetchedAt: 42,
    stale: false
  }) };
  assert.deepEqual(await refreshModelCatalogStatus(true), {
    changed: true, available: true, stale: false, fetchedAt: 42
  });
  globalThis.cth = { modelCatalog: async () => ({ catalog: null, fetchedAt: 0, stale: true }) };
  assert.deepEqual(await refreshModelCatalogStatus(true), {
    changed: true, available: false, stale: true, fetchedAt: 0
  });
});

test('catalog fetch uses the Orbi-owned endpoint and writes a validated cache', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-model-catalog-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cache = path.join(dir, 'catalog.json');
  const now = 123456789;
  const catalog = valid({ claude: [{ id: 'next', label: 'Next' }] });
  let requested = '';
  const result = await loadModelCatalog(cache, {
    now: () => now,
    fetchText: async (url) => { requested = url; return JSON.stringify(catalog); }
  });
  assert.equal(requested, MODEL_CATALOG_URL);
  assert.match(requested, /SUDARSHANCHAUDHARI\/OrbiAgents/);
  assert.deepEqual(result, { catalog: parseModelCatalog(catalog), fetchedAt: now, stale: false });
  assert.ok(fs.existsSync(cache));
});

test('fresh cache avoids network and stale cache survives fetch failure', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbi-model-catalog-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cache = path.join(dir, 'catalog.json');
  const catalog = parseModelCatalog(valid({ codex: [{ id: 'x', label: 'X' }] }));
  fs.writeFileSync(cache, JSON.stringify({ catalog, fetchedAt: 1000 }));
  let calls = 0;
  const fetchText = async () => { calls += 1; throw new Error('offline'); };
  const fresh = await loadModelCatalog(cache, { now: () => 1000 + MODEL_CATALOG_TTL_MS - 1, fetchText });
  assert.equal(calls, 0);
  assert.equal(fresh.stale, false);
  const stale = await loadModelCatalog(cache, { now: () => 1000 + MODEL_CATALOG_TTL_MS, fetchText });
  assert.equal(calls, 1);
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.catalog, catalog);
});

test('the published Orbi catalog is valid remote data', () => {
  assert.ok(parseModelCatalog(require('../docs/model-catalog.json')));
});
