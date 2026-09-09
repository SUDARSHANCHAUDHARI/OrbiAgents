import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getText } from './fetchText';
import { parseModelCatalog, type ModelCatalog } from '../shared/modelCatalogPayload';

export const MODEL_CATALOG_URL =
  'https://raw.githubusercontent.com/SUDARSHANCHAUDHARI/OrbiAgents/main/desktop-munder/docs/model-catalog.json';
export const MODEL_CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

export interface RemoteCatalogResult {
  catalog: ModelCatalog | null;
  fetchedAt: number;
  stale: boolean;
}

export async function loadModelCatalog(
  cachePath: string,
  opts: { force?: boolean; fetchText?: typeof getText; now?: () => number } = {}
): Promise<RemoteCatalogResult> {
  const now = opts.now ?? Date.now;
  let cached: { catalog: ModelCatalog; fetchedAt: number } | null = null;
  try {
    if (existsSync(cachePath)) {
      const value = JSON.parse(readFileSync(cachePath, 'utf8'));
      const catalog = parseModelCatalog(value?.catalog);
      if (catalog && typeof value.fetchedAt === 'number') cached = { catalog, fetchedAt: value.fetchedAt };
    }
  } catch { cached = null; }

  if (cached && !opts.force && now() - cached.fetchedAt < MODEL_CATALOG_TTL_MS) {
    return { ...cached, stale: false };
  }

  try {
    const body = await (opts.fetchText ?? getText)(MODEL_CATALOG_URL, { timeoutMs: 8000 });
    const catalog = parseModelCatalog(JSON.parse(body));
    if (!catalog) throw new Error('invalid model catalog');
    const payload = { catalog, fetchedAt: now() };
    try {
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, JSON.stringify(payload));
    } catch { /* Cache failure must not hide a valid catalog. */ }
    return { ...payload, stale: false };
  } catch {
    return cached
      ? { ...cached, stale: true }
      : { catalog: null, fetchedAt: 0, stale: true };
  }
}
