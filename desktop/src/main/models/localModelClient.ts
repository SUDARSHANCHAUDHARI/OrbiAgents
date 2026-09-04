import type { LocalModelProbeResult, LocalModelCompletionRequest, LocalModelCompletionResult } from "../../shared/contracts";
import type { LocalModelEndpointStore } from "./localModelEndpointStore";

const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_MODELS = 200;
const TIMEOUT_MS = 5_000;

export class LocalModelClient {
  private readonly requests = new Map<string, AbortController>();
  private readonly earlyCancellations = new Map<string, number>();
  private closed = false;
  constructor(private readonly store: LocalModelEndpointStore, private readonly fetcher: typeof fetch = fetch, private readonly timeoutMs = TIMEOUT_MS, private readonly completionTimeoutMs = 60_000) {}

  cancel(requestId: string): void {
    validateRequestId(requestId);
    const active = this.requests.get(requestId);
    if (active) active.abort();
    else { if (this.earlyCancellations.size >= 128) this.earlyCancellations.delete(this.earlyCancellations.keys().next().value!); this.earlyCancellations.set(requestId, Date.now() + 60_000); }
  }
  dispose(): void { this.closed = true; for (const controller of this.requests.values()) controller.abort(); this.earlyCancellations.clear(); }

  async complete(request: LocalModelCompletionRequest, format: "text" | "json" = "text"): Promise<LocalModelCompletionResult> {
    validateRequestId(request.requestId);
    if (this.closed) throw new Error("Local inference is closed");
    for (const [id, expires] of this.earlyCancellations) if (expires < Date.now()) this.earlyCancellations.delete(id);
    if (this.earlyCancellations.delete(request.requestId)) throw new Error("Local inference cancelled");
    if (typeof request.prompt !== "string" || !request.prompt.trim() || request.prompt.length > 20_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(request.prompt)) throw new Error("Prompt must contain 1-20000 printable characters");
    const endpoint = this.store.resolve(request.id);
    const model = request.model ?? endpoint.defaultModel;
    if (typeof model !== "string" || !model.trim() || model.length > 200 || /[\r\n\0]/.test(model)) throw new Error("Choose a model before running inference");
    if (this.requests.has(request.requestId)) throw new Error("Request is already running");
    if (this.requests.size >= 2) throw new Error("At most two local model requests may run at once");
    const controller = new AbortController(); this.requests.set(request.requestId, controller);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.completionTimeoutMs);
    try {
      const response = await this.fetcher(`${endpoint.baseUrl}/chat/completions`, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { "content-type": "application/json", ...(endpoint.apiKey ? { authorization: `Bearer ${endpoint.apiKey}` } : {}) },
        body: JSON.stringify({ model: model.trim(), messages: [{ role: "user", content: request.prompt }], stream: false, max_tokens: 4096, ...(format === "json" ? { response_format: { type: "json_object" } } : {}) }),
      });
      if (!response.ok) throw new Error("Inference failed");
      const value = await readBoundedJson(response) as { choices?: Array<{ finish_reason?: string; message?: { content?: unknown; tool_calls?: unknown } }> };
      const choice = value?.choices?.[0]; const content = choice?.message?.content; const calls = choice?.message?.tool_calls;
      if (choice?.finish_reason !== "stop" || (calls != null && (!Array.isArray(calls) || calls.length > 0)) || typeof content !== "string" || !content.trim() || content.length > 50_000) throw new Error("Invalid or incomplete inference response");
      if (controller.signal.aborted) throw new Error("Aborted");
      return { text: content, model: model.trim() };
    } catch {
      throw new Error(timedOut ? "Local inference timed out" : controller.signal.aborted ? "Local inference cancelled" : "Local inference failed or returned an incomplete response; check the endpoint and model");
    } finally { clearTimeout(timer); this.requests.delete(request.requestId); }
  }

  async probe(id: string): Promise<LocalModelProbeResult> {
    const endpoint = this.store.resolve(id);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${endpoint.baseUrl}/models`, { redirect: "error", headers: endpoint.apiKey ? { authorization: `Bearer ${endpoint.apiKey}` } : undefined, signal: controller.signal });
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

function validateRequestId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(value)) throw new Error("Invalid inference request id");
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) { await response.body?.cancel(); throw new Error("Endpoint response exceeded 1 MB"); }
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
