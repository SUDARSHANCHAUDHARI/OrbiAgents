import * as crypto from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";

export interface ServerConfig {
  port: number;
  pid: number;
  token: string;
  startedAt: number;
}

export type HookEventCallback = (event: Record<string, unknown>) => void;

const SERVER_JSON_PATH = path.join(os.homedir(), ".orbiagents", "server.json");
const HOOK_API_PREFIX = "/api/hooks";
const MAX_HOOK_BODY_SIZE = 65_536; // 64 KB

export class HookServer {
  private server: http.Server | null = null;
  private config: ServerConfig | null = null;
  ownsServer = false;
  private callback: HookEventCallback | null = null;
  private startedAt = 0;

  onHookEvent(cb: HookEventCallback): void {
    this.callback = cb;
  }

  /**
   * Start the HTTP server. If another VS Code window already owns a server
   * (detected via server.json PID check), reuses its config.
   */
  async start(): Promise<ServerConfig> {
    if (this.config) return this.config;

    const existing = this.readServerJson();
    if (existing && isProcessRunning(existing.pid)) {
      // Another VS Code window owns the server. This window will NOT receive hook
      // events — the registered onHookEvent callback will never fire. The JSONL
      // transcript watcher (fallback) continues to run and provides state updates.
      this.config = existing;
      this.ownsServer = false;
      console.log(`[OrbiAgents] Reusing server on port ${existing.port} (PID ${existing.pid})`);
      return existing;
    }

    const token = crypto.randomUUID();
    this.startedAt = Date.now();

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));
      this.server.on("error", reject);
      this.server.setTimeout(5000);

      // port 0 = OS picks a free port
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server?.address();
        if (addr && typeof addr === "object") {
          this.config = {
            port: addr.port,
            pid: process.pid,
            token,
            startedAt: this.startedAt,
          };
          this.ownsServer = true;
          this.writeServerJson(this.config);
          this.server!.removeListener("error", reject);
          this.server!.on("error", (err) =>
            console.error(`[OrbiAgents] Server error: ${err}`),
          );
          console.log(`[OrbiAgents] Server listening on 127.0.0.1:${addr.port}`);
          resolve(this.config);
        } else {
          reject(new Error("Failed to get server address"));
        }
      });
    });
  }

  /** Stop the server and remove server.json (only if we own it). */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (this.ownsServer) {
      this.deleteServerJson();
    }
    this.config = null;
    this.ownsServer = false;
  }

  getConfig(): ServerConfig | null {
    return this.config;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url ?? "";

    if (req.method === "GET" && url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          pid: process.pid,
          uptime: Math.floor((Date.now() - this.startedAt) / 1000),
        }),
      );
      return;
    }

    if (req.method === "POST" && url.startsWith(HOOK_API_PREFIX + "/")) {
      this.handleHookRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  }

  private handleHookRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Timing-safe token comparison prevents side-channel attacks
    const authHeader = req.headers["authorization"] ?? "";
    const expectedToken = `Bearer ${this.config?.token ?? ""}`;
    const authBuf = Buffer.from(authHeader);
    const expectedBuf = Buffer.from(expectedToken);
    if (
      authBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(authBuf, expectedBuf)
    ) {
      res.writeHead(401);
      res.end("unauthorized");
      return;
    }

    let body = "";
    let bodySize = 0;
    let responded = false;

    req.on("error", () => {
      if (!responded) {
        responded = true;
        res.writeHead(500).end();
      }
    });

    req.on("data", (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_HOOK_BODY_SIZE && !responded) {
        responded = true;
        res.writeHead(413);
        res.end("payload too large");
        req.destroy();
        return;
      }
      if (!responded) body += chunk.toString();
    });

    req.on("end", () => {
      if (responded) return;
      try {
        const event = JSON.parse(body) as Record<string, unknown>;
        // Only dispatch events that have the required fields
        if (event.session_id && event.hook_event_name) {
          this.callback?.(event);
        }
        res.writeHead(200);
        res.end("ok");
      } catch {
        res.writeHead(400);
        res.end("invalid json");
      }
    });
  }

  private readServerJson(): ServerConfig | null {
    try {
      if (!fs.existsSync(SERVER_JSON_PATH)) return null;
      return JSON.parse(fs.readFileSync(SERVER_JSON_PATH, "utf-8")) as ServerConfig;
    } catch {
      return null;
    }
  }

  private writeServerJson(config: ServerConfig): void {
    const dir = path.dirname(SERVER_JSON_PATH);
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmpPath = SERVER_JSON_PATH + ".tmp";
      // Restricted permissions: only owner can read (contains auth token)
      fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), { mode: 0o600 });
      fs.renameSync(tmpPath, SERVER_JSON_PATH);
    } catch (e) {
      console.error(`[OrbiAgents] Failed to write server.json: ${e}`);
    }
  }

  private deleteServerJson(): void {
    try {
      if (!fs.existsSync(SERVER_JSON_PATH)) return;
      const existing = JSON.parse(
        fs.readFileSync(SERVER_JSON_PATH, "utf-8"),
      ) as ServerConfig;
      // Only delete if our PID owns it — don't stomp on another window's server
      if (existing.pid === process.pid) fs.unlinkSync(SERVER_JSON_PATH);
    } catch {
      // File may already be gone
    }
  }
}

/** Check if a process is alive by sending signal 0 (no-op, just checks existence). */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
