import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { WebhookEvent, WebhookStatus } from "../../shared/contracts";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_EVENTS = 100;
const MAX_REPLAY_IDS = 500;

export class WebhookReceiver {
  private server: Server | null = null;
  private secret = "";
  private port?: number;
  private readonly events: WebhookEvent[] = [];
  private readonly replayIds = new Set<string>();

  status(): WebhookStatus { return { enabled: Boolean(this.server), ...(this.port ? { endpoint: `http://127.0.0.1:${this.port}/v1/events` } : {}), events: this.events.map((event) => ({ ...event })) }; }
  copySecret(): string { if (!this.server || !this.secret) throw new Error("Webhook receiver is not enabled"); return this.secret; }
  event(id: string): WebhookEvent { const event = this.events.find((candidate) => candidate.id === id); if (!event) throw new Error("Webhook event was not found"); if (event.workerAgentId) throw new Error("Webhook event already has a worker"); return { ...event }; }
  attachWorker(id: string, workerAgentId: string): WebhookStatus { const event = this.events.find((candidate) => candidate.id === id); if (!event || event.workerAgentId) throw new Error("Webhook event cannot accept a worker"); event.workerAgentId = workerAgentId; return this.status(); }

  async start(): Promise<WebhookStatus> {
    if (this.server) return this.status();
    this.secret = randomBytes(32).toString("base64url");
    const server = createServer((request, response) => void this.handle(request, response));
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve()); });
    const address = server.address();
    if (!address || typeof address === "string") { server.close(); throw new Error("Webhook receiver address is unavailable"); }
    this.server = server; this.port = address.port;
    return this.status();
  }

  async stop(): Promise<WebhookStatus> {
    const server = this.server; this.server = null; this.port = undefined; this.secret = ""; this.replayIds.clear();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    return this.status();
  }

  private async handle(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse): Promise<void> {
    const reject = (status: number, message: string) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify({ error: message })); };
    if (request.method !== "POST" || request.url !== "/v1/events") return reject(404, "Not found");
    const authorization = request.headers.authorization ?? "";
    if (!constantEqual(authorization, `Bearer ${this.secret}`)) return reject(401, "Unauthorized");
    const eventId = request.headers["x-orbi-event-id"];
    if (typeof eventId !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(eventId)) return reject(400, "A valid X-Orbi-Event-Id is required");
    if (this.replayIds.has(eventId)) return reject(409, "Duplicate event");
    try {
      const body = await readBody(request);
      const parsed = JSON.parse(body) as unknown;
      if (!parsed || typeof parsed !== "object") throw new Error("Payload must be an object");
      const value = parsed as Record<string, unknown>;
      const title = bounded(value.title, "title", 200); const detail = bounded(value.detail, "detail", 10_000);
      const source = value.source === undefined ? "generic" : bounded(value.source, "source", 80);
      this.replayIds.add(eventId); if (this.replayIds.size > MAX_REPLAY_IDS) this.replayIds.delete(this.replayIds.values().next().value!);
      this.events.unshift({ id: eventId, title, detail, source, receivedAt: Date.now() }); this.events.splice(MAX_EVENTS);
      response.writeHead(202, { "content-type": "application/json" }); response.end(JSON.stringify({ accepted: true }));
    } catch (error) { reject(error instanceof SyntaxError ? 400 : 422, error instanceof Error ? error.message : "Invalid payload"); }
  }
}

function constantEqual(left: string, right: string): boolean { const a = createHash("sha256").update(left).digest(); const b = createHash("sha256").update(right).digest(); return timingSafeEqual(a, b); }
function bounded(value: unknown, label: string, max: number): string { if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Webhook ${label} is invalid`); return value.trim(); }
async function readBody(request: import("node:http").IncomingMessage): Promise<string> { const chunks: Buffer[] = []; let size = 0; for await (const chunk of request) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > MAX_BODY_BYTES) throw new Error("Webhook payload is too large"); chunks.push(buffer); } return Buffer.concat(chunks).toString("utf8"); }
