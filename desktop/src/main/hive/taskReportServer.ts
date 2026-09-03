import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";

export interface WorkerReport { status: "completed" | "blocked"; result: string; }
export interface TaskReportChannel {
  issue(key: string, receive: (report: WorkerReport) => Promise<void>): Promise<string>;
  revoke(key: string): void;
  stop(): void;
}

/** Each capability can report one task result, never launch work or access files. */
export class TaskReportServer implements TaskReportChannel {
  private server?: Server;
  private starting?: Promise<number>;
  private stopped = false;
  private readonly capabilities = new Map<string, { token: string; expires: number; busy: boolean; receive: (report: WorkerReport) => Promise<void> }>();
  constructor(private readonly now: () => number = Date.now) {}

  async issue(key: string, receive: (report: WorkerReport) => Promise<void>): Promise<string> {
    if (this.stopped) throw new Error("Task report server is closed");
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(key)) throw new Error("Invalid task report key");
    const port = await this.start();
    if (this.stopped) throw new Error("Task report server is closed");
    for (const [id, entry] of this.capabilities) if (entry.expires <= this.now()) this.capabilities.delete(id);
    if (this.capabilities.size >= 64) throw new Error("Task report limit reached");
    const token = randomBytes(32).toString("hex");
    this.capabilities.set(key, { token, expires: this.now() + 30 * 60_000, busy: false, receive });
    return `When finished, POST JSON {"status":"completed","result":"Concrete changes and verification results"} to http://127.0.0.1:${port}/result/${encodeURIComponent(key)} with Authorization: Bearer ${token} and Content-Type: application/json. Use status "blocked" if you need approval or cannot verify completion. This one-task capability expires in 30 minutes. Do not print or persist the capability. A 204 response acknowledges receipt; retry a 409 response after 2 seconds, at most twice. Do not report success merely because a command started.`;
  }

  revoke(key: string): void { this.capabilities.delete(key); }
  stop(): void { this.stopped = true; this.capabilities.clear(); this.server?.close(); this.server?.closeAllConnections(); }

  private start(): Promise<number> {
    if (this.starting) return this.starting;
    this.starting = new Promise<number>((resolve, reject) => {
      const server = createServer((request, response) => {
        const finish = (status: number) => { if (!response.writableEnded) { response.writeHead(status, { "content-type": "text/plain", "cache-control": "no-store" }); response.end(); } };
        if (request.method !== "POST" || request.headers.origin || request.socket.remoteAddress !== "127.0.0.1") { finish(403); request.resume(); return; }
        const key = /^\/result\/([a-zA-Z0-9-]+)$/.exec(request.url ?? "")?.[1];
        const capability = key ? this.capabilities.get(key) : undefined;
        const actual = Buffer.from(request.headers.authorization ?? ""); const expected = Buffer.from(`Bearer ${capability?.token ?? ""}`);
        if (!capability || capability.expires <= this.now() || actual.length !== expected.length || !timingSafeEqual(actual, expected)) { finish(401); request.resume(); return; }
        if (capability.busy) { finish(409); request.resume(); return; }
        if (request.headers["content-type"] !== "application/json") { finish(415); request.resume(); return; }
        capability.busy = true;
        const chunks: Buffer[] = []; let bytes = 0;
        request.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 64 * 1024) { capability.busy = false; finish(413); request.destroy(); } else chunks.push(chunk); });
        request.on("error", () => { capability.busy = false; finish(400); });
        request.on("close", () => { if (!request.complete) capability.busy = false; });
        request.on("end", () => {
          if (response.writableEnded) return;
          let report: WorkerReport;
          try { report = parseWorkerReport(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
          catch { capability.busy = false; finish(400); return; }
          if (this.capabilities.get(key!) !== capability || capability.expires <= this.now()) { capability.busy = false; finish(401); return; }
          void capability.receive(report).then(() => { if (this.capabilities.get(key!) === capability) this.capabilities.delete(key!); finish(204); }).catch(() => { capability.busy = false; finish(409); });
        });
      });
      this.server = server; server.requestTimeout = 5000; server.headersTimeout = 5000; server.maxConnections = 16;
      server.setTimeout(5000, (socket) => socket.destroy());
      server.on("error", () => reject(new Error("Local task reporting is unavailable")));
      server.listen(0, "127.0.0.1", () => { if (this.stopped) { server.close(); reject(new Error("Task report server is closed")); return; } const address = server.address(); if (!address || typeof address === "string") { reject(new Error("Local task reporting is unavailable")); return; } resolve(address.port); });
    });
    return this.starting;
  }
}

export function parseWorkerReport(value: unknown): WorkerReport {
  if (!value || typeof value !== "object") throw new Error("Invalid worker report");
  const report = value as Record<string, unknown>;
  if (!["completed", "blocked"].includes(String(report.status)) || typeof report.result !== "string" || !report.result.trim() || report.result.length > 40_000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(report.result)) throw new Error("Invalid worker report");
  return { status: report.status as WorkerReport["status"], result: report.result.trim() };
}
