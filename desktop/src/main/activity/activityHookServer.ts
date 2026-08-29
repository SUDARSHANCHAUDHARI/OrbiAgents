import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

const MAX_BODY_BYTES = 64 * 1024;

export interface ActivityHookServerConfig {
  port: number;
  token: string;
}

export class ActivityHookServer {
  private server: Server | null = null;
  private config: ActivityHookServerConfig | null = null;

  constructor(private readonly onEvent: (provider: string, payload: unknown) => void) {}

  async start(): Promise<ActivityHookServerConfig> {
    if (this.config) return this.config;
    const token = randomBytes(32).toString("hex");
    const server = createServer((request, response) => this.handle(request, response, token));
    server.setTimeout(5_000);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("Activity hook server did not receive a TCP address");
    }
    this.server = server;
    this.config = { port: address.port, token };
    return this.config;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.config = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private handle(request: IncomingMessage, response: ServerResponse, token: string): void {
    const match = /^\/api\/activity\/(claude|codex)$/.exec(request.url ?? "");
    if (request.method !== "POST" || !match) return respond(response, 404, "not found");
    if (!authorized(request.headers.authorization, token)) return respond(response, 401, "unauthorized");

    let body = "";
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        respond(response, 413, "payload too large");
        request.destroy();
      } else body += chunk.toString("utf8");
    });
    request.on("end", () => {
      if (response.writableEnded) return;
      try {
        this.onEvent(match[1], JSON.parse(body) as unknown);
        respond(response, 204, "");
      } catch {
        respond(response, 400, "invalid json");
      }
    });
    request.on("error", () => {
      if (!response.writableEnded) respond(response, 400, "request failed");
    });
  }
}

function authorized(header: string | undefined, token: string): boolean {
  const actual = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function respond(response: ServerResponse, status: number, body: string): void {
  if (response.writableEnded) return;
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}
