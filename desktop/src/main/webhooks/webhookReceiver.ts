import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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
  constructor(private readonly slackSigningSecret: () => string = () => { throw new Error("Slack signing is not configured"); }, private readonly now: () => number = Date.now) {}

  status(): WebhookStatus { return { enabled: Boolean(this.server), ...(this.port ? { endpoint: `http://127.0.0.1:${this.port}/v1/events`, slackEndpoint: `http://127.0.0.1:${this.port}/v1/slack/events` } : {}), events: this.events.map((event) => ({ ...event })) }; }
  copySecret(): string { if (!this.server || !this.secret) throw new Error("Webhook receiver is not enabled"); return this.secret; }
  event(id: string): WebhookEvent { const event = this.events.find((candidate) => candidate.id === id); if (!event) throw new Error("Webhook event was not found"); if (event.workerAgentId) throw new Error("Webhook event already has a worker"); return { ...event }; }
  attachWorker(id: string, workerAgentId: string): WebhookStatus { const event = this.events.find((candidate) => candidate.id === id); if (!event || event.workerAgentId) throw new Error("Webhook event cannot accept a worker"); event.workerAgentId = workerAgentId; return this.status(); }
  completeWorker(id: string): { status: WebhookStatus; workerAgentId: string } { const event = this.events.find((candidate) => candidate.id === id); if (!event?.workerAgentId || event.completedAt) throw new Error("Webhook worker cannot be completed"); event.completedAt = Date.now(); return { status: this.status(), workerAgentId: event.workerAgentId }; }

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
    if (request.method !== "POST" || !["/v1/events", "/v1/slack/events"].includes(request.url ?? "")) return reject(404, "Not found");
    if (request.url === "/v1/slack/events") return this.handleSlack(request, response, reject);
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

  private async handleSlack(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse, reject: (status: number, message: string) => void): Promise<void> {
    try {
      const timestamp = request.headers["x-slack-request-timestamp"]; const signature = request.headers["x-slack-signature"];
      if (typeof timestamp !== "string" || !/^\d{10}$/.test(timestamp) || typeof signature !== "string" || !/^v0=[a-f0-9]{64}$/.test(signature)) return reject(401, "Invalid Slack signature");
      if (Math.abs(Math.floor(this.now() / 1_000) - Number(timestamp)) > 300) return reject(401, "Expired Slack request");
      const body = await readBody(request); const expected = `v0=${createHmac("sha256", this.slackSigningSecret()).update(`v0:${timestamp}:${body}`).digest("hex")}`;
      if (!constantEqual(signature, expected)) return reject(401, "Invalid Slack signature");
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (parsed.type === "url_verification" && typeof parsed.challenge === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(parsed.challenge)) { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ challenge: parsed.challenge })); return; }
      const eventId = parsed.event_id; const event = parsed.event;
      if (parsed.type !== "event_callback" || typeof eventId !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(eventId) || !event || typeof event !== "object" || Array.isArray(event)) return reject(422, "Invalid Slack event");
      if (this.replayIds.has(eventId)) { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ accepted: true, duplicate: true })); return; }
      const row = event as Record<string, unknown>;
      if (row.type !== "message" || row.subtype !== undefined || row.bot_id !== undefined) return reject(422, "Unsupported Slack event");
      const channel = slackId(row.channel, "channel"); const text = bounded(row.text, "detail", 10_000); const timestampValue = slackTimestamp(row.ts); const thread = row.thread_ts === undefined ? timestampValue : slackTimestamp(row.thread_ts);
      this.replayIds.add(eventId); if (this.replayIds.size > MAX_REPLAY_IDS) this.replayIds.delete(this.replayIds.values().next().value!);
      this.events.unshift({ id: eventId, title: `Slack message in ${channel}`, detail: text, source: "slack", receivedAt: this.now(), replyChannel: channel, replyThreadTimestamp: thread }); this.events.splice(MAX_EVENTS);
      response.writeHead(202, { "content-type": "application/json" }); response.end(JSON.stringify({ accepted: true }));
    } catch (error) { reject(error instanceof SyntaxError ? 400 : 422, error instanceof Error ? error.message : "Invalid Slack event"); }
  }
}

function constantEqual(left: string, right: string): boolean { const a = createHash("sha256").update(left).digest(); const b = createHash("sha256").update(right).digest(); return timingSafeEqual(a, b); }
function bounded(value: unknown, label: string, max: number): string { if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Webhook ${label} is invalid`); return value.trim(); }
async function readBody(request: import("node:http").IncomingMessage): Promise<string> { const chunks: Buffer[] = []; let size = 0; for await (const chunk of request) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > MAX_BODY_BYTES) throw new Error("Webhook payload is too large"); chunks.push(buffer); } return Buffer.concat(chunks).toString("utf8"); }
function slackId(value: unknown, label: string): string { if (typeof value !== "string" || !/^[A-Z][A-Z0-9]{1,31}$/.test(value)) throw new Error(`Slack ${label} is invalid`); return value; }
function slackTimestamp(value: unknown): string { if (typeof value !== "string" || !/^\d{1,20}\.\d{1,20}$/.test(value)) throw new Error("Slack timestamp is invalid"); return value; }
