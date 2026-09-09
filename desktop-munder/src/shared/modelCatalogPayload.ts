export interface CatalogModel {
  id?: string;
  label: string;
  minAppVersion?: string | null;
  maxAppVersion?: string | null;
}

export interface ModelCatalog {
  version: number;
  providers: Record<string, CatalogModel[]>;
}

export const CATALOG_SCHEMA_VERSION = 1;

const LIMIT = { id: 120, label: 60, key: 40, version: 24, providers: 40, models: 60 };

function cleanString(value: unknown, cap: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, cap) : null;
}

function parseModel(raw: unknown): CatalogModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const label = cleanString(value.label, LIMIT.label);
  if (!label) return null;
  const model: CatalogModel = { label };
  const id = cleanString(value.id, LIMIT.id);
  const min = cleanString(value.minAppVersion, LIMIT.version);
  const max = cleanString(value.maxAppVersion, LIMIT.version);
  if (id) model.id = id;
  if (min) model.minAppVersion = min;
  if (max) model.maxAppVersion = max;
  return model;
}

function parseProviderKey(key: string): string | null {
  if (key.length > LIMIT.key || !/^[a-z][a-z0-9_-]*$/i.test(key)) return null;
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') return null;
  return key;
}

/** Total parser for untrusted remote catalog data. Invalid input returns null. */
export function parseModelCatalog(raw: unknown): ModelCatalog | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== CATALOG_SCHEMA_VERSION) return null;
  if (!value.providers || typeof value.providers !== 'object' || Array.isArray(value.providers)) return null;

  const providers: Record<string, CatalogModel[]> = Object.create(null);
  let kept = 0;
  for (const [rawKey, rawModels] of Object.entries(value.providers as Record<string, unknown>)) {
    if (kept >= LIMIT.providers) break;
    const key = parseProviderKey(rawKey);
    if (!key || !Array.isArray(rawModels)) continue;
    const models: CatalogModel[] = [];
    const seen = new Set<string>();
    for (const entry of rawModels.slice(0, LIMIT.models)) {
      const model = parseModel(entry);
      if (!model) continue;
      const id = model.id ?? '';
      if (seen.has(id)) continue;
      seen.add(id);
      models.push(model);
    }
    if (!models.length && rawModels.length) continue;
    providers[key] = models;
    kept += 1;
  }
  return kept ? { version: CATALOG_SCHEMA_VERSION, providers: { ...providers } } : null;
}
