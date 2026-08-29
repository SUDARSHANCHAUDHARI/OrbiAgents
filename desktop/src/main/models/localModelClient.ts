import type { LocalModelProbeResult } from "../../shared/contracts";
import type { LocalModelEndpointStore } from "./localModelEndpointStore";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_MODELS = 200;
const TIMEOUT_MS = 5_000;

export class LocalModelClient {
  constructor(private readonly store: LocalModelEndpointStore, private readonly fetcher: typeof fetch = fetch, private readonly timeoutMs = TIMEOUT_MS) {}

  async probe(id: string): Promise<LocalModelProbeResult> {
    const endpoint = this.store.resolve(id);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${endpoint.baseUrl}/models`, { headers: endpoint.apiKey ? { authorization: `Bearer ${endpoint.apiKey}` } : undefined, signal: controller.signal });
      if (!response.ok) throw new Error(`Endpoint probe failed with HTTP ${response.status}`);
      const value = await readBoundedJson(response);
      if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>).data)) throw new Error("Endpoint returned an invalid OpenAI models response");
      const models: string[] = []; let truncated = false;
      for (const candidate of (value as Record<string, unknown>).data as unknown[]) {
        if (!candidate || typeof candidate !== "object") continue;
        const modelId = (candidate as Record<string, unknown>).id;
        if (typeof modelId !== "string" || modelId.length < 1 || modelId.length > 200) continue;
        if (models.length === MAX_MODELS) { truncated = true; break; }
        models.push(modelId);
      }
      return { models, truncated };
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Endpoint probe timed out");
      if (error instanceof Error && error.message.startsWith("Endpoint ")) throw error;
      throw new Error("Endpoint probe failed");
    } finally { clearTimeout(timer); }
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error("Endpoint response exceeded 1 MB");
  if (!response.body) throw new Error("Endpoint returned an empty response");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength; if (total > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error("Endpoint response exceeded 1 MB"); } chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("Endpoint returned invalid JSON"); }
}
