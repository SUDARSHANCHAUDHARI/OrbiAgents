import { createPublicKey, verify } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { RemoteCatalogEntry, RemoteCatalogReview, RemoteCatalogReviewRequest } from "../../shared/contracts";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_ENTRIES = 200;
const MAX_CACHE_ENTRIES = 20;
const CACHE_MS = 5 * 60_000;
const MAX_VALIDITY_MS = 31 * 24 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

interface SignedCatalog { schemaVersion: 1; publisher: { id: string; keyId: string }; issuedAt: string; expiresAt: string; entries: RemoteCatalogEntry[]; signature: string; }
interface CacheEntry { review: RemoteCatalogReview; expiresAt: number; }

export class RemoteCatalogClient {
  private readonly cache = new Map<string, CacheEntry>();
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly now: () => number = Date.now, private readonly resolver: (host: string) => Promise<Array<{ address: string }>> = async (host) => lookup(host, { all: true })) {}

  async review(input: unknown): Promise<RemoteCatalogReview> {
    const request = parseRequest(input); await assertPublicDestination(new URL(request.url).hostname, this.resolver); const cacheKey = `${request.url}\n${request.publisherId}\n${request.keyId}\n${request.publicKey}`; const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) return { ...cached.review, entries: cached.review.entries.map((entry) => ({ ...entry })), fromCache: true };
    const response = await this.fetcher(request.url, { redirect: "manual", headers: { accept: "application/json" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(() => { throw new Error("Catalog request failed"); });
    if (response.status >= 300 && response.status < 400) throw new Error("Catalog redirects are not allowed");
    if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);
    const value = await readBoundedJson(response); const catalog = parseCatalog(value, request, this.now());
    verifySignature(catalog, request.publicKey);
    const review: RemoteCatalogReview = { publisherId: catalog.publisher.id, keyId: catalog.publisher.keyId, issuedAt: catalog.issuedAt, expiresAt: catalog.expiresAt, entries: catalog.entries, fetchedAt: this.now(), fromCache: false };
    this.cache.set(cacheKey, { review, expiresAt: Math.min(Date.parse(catalog.expiresAt), this.now() + CACHE_MS) });
    while (this.cache.size > MAX_CACHE_ENTRIES) this.cache.delete(this.cache.keys().next().value!);
    return { ...review, entries: review.entries.map((entry) => ({ ...entry })) };
  }
}

function parseRequest(value: unknown): RemoteCatalogReviewRequest {
  if (!value || typeof value !== "object") throw new Error("Catalog review request is required"); const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["url", "publisherId", "keyId", "publicKey"].includes(key))) throw new Error("Catalog review request contains unsupported fields");
  const url = safeHttpsUrl(row.url, "Catalog URL"); const publisherId = boundedId(row.publisherId, "Publisher id"); const keyId = boundedId(row.keyId, "Publisher key id");
  if (typeof row.publicKey !== "string" || row.publicKey.length < 40 || row.publicKey.length > 1_000 || !/^[A-Za-z0-9+/=]+$/.test(row.publicKey)) throw new Error("Publisher public key is invalid");
  return { url: url.href, publisherId, keyId, publicKey: row.publicKey };
}

function parseCatalog(value: unknown, request: RemoteCatalogReviewRequest, now: number): SignedCatalog {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Catalog manifest is invalid"); const row = value as Record<string, unknown>;
  if (row.schemaVersion !== 1 || !row.publisher || typeof row.publisher !== "object" || !Array.isArray(row.entries) || row.entries.length > MAX_ENTRIES) throw new Error("Catalog manifest is invalid");
  const publisher = row.publisher as Record<string, unknown>; if (Object.keys(publisher).some((key) => !["id", "keyId"].includes(key))) throw new Error("Catalog publisher contains unsupported fields"); if (publisher.id !== request.publisherId || publisher.keyId !== request.keyId) throw new Error("Catalog publisher identity does not match the pinned source");
  const issuedAt = timestamp(row.issuedAt, "issued"); const expiresAt = timestamp(row.expiresAt, "expiry"); const issued = Date.parse(issuedAt); const expires = Date.parse(expiresAt);
  if (issued > now + 5 * 60_000 || expires <= now || expires <= issued || expires - issued > MAX_VALIDITY_MS) throw new Error("Catalog validity window is invalid");
  if (typeof row.signature !== "string" || row.signature.length < 40 || row.signature.length > 500 || !/^[A-Za-z0-9+/=]+$/.test(row.signature)) throw new Error("Catalog signature is invalid");
  const sourceOrigin = new URL(request.url).origin; const ids = new Set<string>(); const entries = row.entries.map((entry) => parseEntry(entry, sourceOrigin));
  for (const entry of entries) { if (ids.has(entry.id)) throw new Error("Catalog entry identifiers must be unique"); ids.add(entry.id); }
  if (Object.keys(row).some((key) => !["schemaVersion", "publisher", "issuedAt", "expiresAt", "entries", "signature"].includes(key))) throw new Error("Catalog manifest contains unsupported fields");
  return { schemaVersion: 1, publisher: { id: request.publisherId, keyId: request.keyId }, issuedAt, expiresAt, entries, signature: row.signature };
}

function parseEntry(value: unknown, sourceOrigin: string): RemoteCatalogEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Catalog entry is invalid"); const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["id", "kind", "name", "description", "version", "artifactUrl", "sha256", "size"].includes(key))) throw new Error("Catalog entry contains unsupported fields");
  const artifact = safeHttpsUrl(row.artifactUrl, "Artifact URL"); if (artifact.origin !== sourceOrigin) throw new Error("Catalog artifacts must use the catalog origin");
  if (row.kind !== "skill" && row.kind !== "hire-profile") throw new Error("Catalog entry kind is invalid");
  if (typeof row.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error("Catalog artifact checksum is invalid");
  if (!Number.isInteger(row.size) || Number(row.size) < 1 || Number(row.size) > 5 * 1024 * 1024) throw new Error("Catalog artifact size is invalid");
  return { id: boundedId(row.id, "Catalog entry id"), kind: row.kind, name: boundedText(row.name, "Catalog entry name", 120), description: boundedText(row.description, "Catalog entry description", 500), version: boundedText(row.version, "Catalog entry version", 64), artifactUrl: artifact.href, sha256: row.sha256, size: Number(row.size) };
}

function verifySignature(catalog: SignedCatalog, encodedKey: string): void {
  try { const { signature, ...payload } = catalog; const key = createPublicKey({ key: Buffer.from(encodedKey, "base64"), format: "der", type: "spki" }); if (key.asymmetricKeyType !== "ed25519" || !verify(null, Buffer.from(canonical(payload)), key, Buffer.from(signature, "base64"))) throw new Error(); } catch { throw new Error("Catalog signature verification failed"); }
}
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`; return JSON.stringify(value); }
function safeHttpsUrl(value: unknown, label: string): URL { if (typeof value !== "string" || value.length > 2_048) throw new Error(`${label} is invalid`); let url: URL; try { url = new URL(value); } catch { throw new Error(`${label} is invalid`); } if (url.protocol !== "https:" || url.username || url.password || url.hash || isUnsafeHost(url.hostname)) throw new Error(`${label} is invalid`); return url; }
function isUnsafeHost(host: string): boolean { const normalized = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, ""); if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) return true; if (!isIP(normalized)) return false; if (normalized.includes(":")) { const mappedIpv4 = mappedIpv4Address(normalized); if (mappedIpv4) return isUnsafeHost(mappedIpv4); const first = Number.parseInt(normalized.split(":")[0] || "0", 16); return normalized === "::" || normalized === "::1" || first >= 0xfc00 && first <= 0xfdff || first >= 0xfe80 && first <= 0xfeff || first >= 0xff00; } const parts = normalized.split(".").map(Number); return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127 || parts[0] === 169 && parts[1] === 254 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && (parts[1] === 0 && (parts[2] === 0 || parts[2] === 2) || parts[1] === 168) || parts[0] === 198 && (parts[1] === 18 || parts[1] === 19 || parts[1] === 51 && parts[2] === 100) || parts[0] === 203 && parts[1] === 0 && parts[2] === 113 || parts[0] >= 224; }
function mappedIpv4Address(host: string): string | undefined { const dotted = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]; if (dotted) return dotted; const hex = host.match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/); if (!hex) return undefined; const high = Number.parseInt(hex[1], 16); const low = Number.parseInt(hex[2], 16); return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`; }
async function assertPublicDestination(host: string, resolver: (host: string) => Promise<Array<{ address: string }>>): Promise<void> { let addresses: Array<{ address: string }>; try { addresses = await resolver(host); } catch { throw new Error("Catalog hostname could not be verified"); } if (!addresses.length || addresses.some(({ address }) => isUnsafeHost(address))) throw new Error("Catalog hostname resolved to an unsafe address"); }
function boundedId(value: unknown, label: string): string { if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]{1,127}$/i.test(value)) throw new Error(`${label} is invalid`); return value; }
function boundedText(value: unknown, label: string, max: number): string { if (typeof value !== "string" || !value.trim() || value.length > max || /[\0\r]/.test(value)) throw new Error(`${label} is invalid`); return value.trim(); }
function timestamp(value: unknown, label: string): string { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`Catalog ${label} timestamp is invalid`); return value; }
async function readBoundedJson(response: Response): Promise<unknown> { const declared = Number(response.headers.get("content-length")); if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error("Catalog response exceeded 1 MB"); if (!response.body) throw new Error("Catalog response is empty"); const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0; try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error("Catalog response exceeded 1 MB"); } chunks.push(value); } } finally { reader.releaseLock(); } const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("Catalog response is invalid JSON"); } }
