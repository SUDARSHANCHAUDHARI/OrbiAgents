import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LocalModelEndpoint, LocalModelEndpointCreateRequest } from "../../shared/contracts";

const MAX_ENDPOINTS = 10;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;

interface StoredEndpoint extends Omit<LocalModelEndpoint, "hasApiKey"> { encryptedApiKey?: string; }
export interface CredentialCipher { isAvailable(): boolean; encrypt(value: string): Buffer; decrypt(value: Buffer): string; }
export interface ResolvedLocalModelEndpoint extends LocalModelEndpoint { apiKey?: string; }

export class LocalModelEndpointStore {
  private endpoints: StoredEndpoint[] = [];
  private saveQueue = Promise.resolve();
  constructor(private readonly filePath: string, private readonly cipher: CredentialCipher, private readonly now: () => number = Date.now) {}

  async load(): Promise<LocalModelEndpoint[]> {
    const raw = await readFile(this.filePath, "utf8").catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? "[]" : Promise.reject(error));
    try {
      const value: unknown = JSON.parse(raw);
      const parsed = Array.isArray(value) ? value.flatMap((candidate) => parseStoredEndpoint(candidate) ?? []) : [];
      this.endpoints = parsed.filter((endpoint, index) => parsed.findIndex((candidate) => candidate.id === endpoint.id) === index).slice(0, MAX_ENDPOINTS);
    } catch { this.endpoints = []; }
    return this.list();
  }

  list(): LocalModelEndpoint[] { return this.endpoints.map(publicEndpoint); }

  async create(request: LocalModelEndpointCreateRequest): Promise<LocalModelEndpoint[]> {
    if (this.endpoints.length >= MAX_ENDPOINTS) throw new Error(`Local model endpoint limit is ${MAX_ENDPOINTS}`);
    const id = validateEndpointId(request.id);
    if (this.endpoints.some((endpoint) => endpoint.id === id)) throw new Error(`Local model endpoint ${id} already exists`);
    const timestamp = this.now();
    const endpoint: StoredEndpoint = {
      id,
      name: validateEndpointName(request.name),
      baseUrl: validateLocalBaseUrl(request.baseUrl),
      defaultModel: validateModelName(request.defaultModel),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const next = [...this.endpoints, endpoint];
    await this.save(next); this.endpoints = next; return this.list();
  }

  async setCredential(value: unknown, credential: unknown): Promise<LocalModelEndpoint[]> {
    const id = validateEndpointId(value); const apiKey = validateApiKey(credential);
    if (!apiKey) throw new Error("Clipboard does not contain an API key");
    if (!this.cipher.isAvailable()) throw new Error("Secure credential storage is unavailable; the API key was not saved");
    const index = this.endpoints.findIndex((endpoint) => endpoint.id === id);
    if (index < 0) throw new Error(`Unknown local model endpoint ${id}`);
    const next = this.endpoints.map((endpoint, candidate) => candidate === index ? { ...endpoint, encryptedApiKey: this.cipher.encrypt(apiKey).toString("base64"), updatedAt: this.now() } : endpoint);
    await this.save(next); this.endpoints = next; return this.list();
  }

  async clearCredential(value: unknown): Promise<LocalModelEndpoint[]> {
    const id = validateEndpointId(value); const index = this.endpoints.findIndex((endpoint) => endpoint.id === id);
    if (index < 0) throw new Error(`Unknown local model endpoint ${id}`);
    const next = this.endpoints.map((endpoint, candidate) => { if (candidate !== index) return endpoint; const { encryptedApiKey: _removed, ...metadata } = endpoint; return { ...metadata, updatedAt: this.now() }; });
    await this.save(next); this.endpoints = next; return this.list();
  }

  async remove(value: unknown): Promise<LocalModelEndpoint[]> {
    const id = validateEndpointId(value);
    if (!this.endpoints.some((endpoint) => endpoint.id === id)) throw new Error(`Unknown local model endpoint ${id}`);
    const next = this.endpoints.filter((endpoint) => endpoint.id !== id);
    await this.save(next); this.endpoints = next; return this.list();
  }

  resolve(value: unknown): ResolvedLocalModelEndpoint {
    const id = validateEndpointId(value);
    const endpoint = this.endpoints.find((candidate) => candidate.id === id);
    if (!endpoint) throw new Error(`Unknown local model endpoint ${id}`);
    let apiKey: string | undefined;
    if (endpoint.encryptedApiKey) {
      if (!this.cipher.isAvailable()) throw new Error("Secure credential storage is unavailable");
      try { apiKey = this.cipher.decrypt(Buffer.from(endpoint.encryptedApiKey, "base64")); }
      catch { throw new Error("The stored endpoint credential cannot be decrypted"); }
    }
    return { ...publicEndpoint(endpoint), apiKey };
  }

  private save(endpoints: StoredEndpoint[]): Promise<void> {
    const snapshot = endpoints.map((endpoint) => ({ ...endpoint }));
    this.saveQueue = this.saveQueue.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.tmp`;
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.filePath);
    });
    return this.saveQueue;
  }
}

export function validateEndpointId(value: unknown): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw new Error("Endpoint id must be 1-48 lowercase letters, numbers, or hyphens");
  return value;
}

export function validateLocalBaseUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2_048) throw new Error("Endpoint base URL is invalid");
  let url: URL; try { url = new URL(value); } catch { throw new Error("Endpoint base URL is invalid"); }
  if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error("Endpoint must be an HTTP(S) loopback URL without credentials, query, or fragment");
  const pathname = url.pathname.replace(/\/+$/, "");
  if (pathname !== "/v1") throw new Error("Endpoint base URL must end with /v1");
  url.pathname = pathname;
  return url.toString().replace(/\/$/, "");
}

function validateEndpointName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80) throw new Error("Endpoint name must be 1-80 characters");
  return value.trim();
}
function validateModelName(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !value.trim() || value.trim().length > 200 || /[\r\n\0]/.test(value)) throw new Error("Default model is invalid");
  return value.trim();
}
function validateApiKey(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 8_192 || /[\r\n\0]/.test(value)) throw new Error("API key is invalid");
  return value;
}
function publicEndpoint(endpoint: StoredEndpoint): LocalModelEndpoint {
  const { encryptedApiKey, ...metadata } = endpoint; return { ...metadata, hasApiKey: typeof encryptedApiKey === "string" };
}
function parseStoredEndpoint(value: unknown): StoredEndpoint[] | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  try {
    const id = validateEndpointId(row.id); const name = validateEndpointName(row.name); const baseUrl = validateLocalBaseUrl(row.baseUrl); const defaultModel = validateModelName(row.defaultModel);
    if (typeof row.createdAt !== "number" || !Number.isFinite(row.createdAt) || typeof row.updatedAt !== "number" || !Number.isFinite(row.updatedAt)) return null;
    if (row.encryptedApiKey !== undefined && (typeof row.encryptedApiKey !== "string" || row.encryptedApiKey.length < 4 || row.encryptedApiKey.length > 16_384 || row.encryptedApiKey.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(row.encryptedApiKey))) return null;
    return [{ id, name, baseUrl, defaultModel, encryptedApiKey: row.encryptedApiKey as string | undefined, createdAt: row.createdAt, updatedAt: row.updatedAt }];
  } catch { return null; }
}
