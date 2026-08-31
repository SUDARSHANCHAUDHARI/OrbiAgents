import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { VoicePolicy, VoiceRetention } from "../../shared/contracts";

const DEFAULT_POLICY: VoicePolicy = { consent: false, retention: "none", captureEnabled: false, updatedAt: 0 };
export class VoicePolicyStore {
  private policy = DEFAULT_POLICY; private queue = Promise.resolve();
  constructor(private readonly filePath: string, private readonly now: () => number = Date.now) {}
  async load(): Promise<VoicePolicy> { try { this.policy = parse(JSON.parse(await readFile(this.filePath, "utf8"))); } catch { this.policy = DEFAULT_POLICY; } return this.get(); }
  get(): VoicePolicy { return { ...this.policy }; }
  async update(value: unknown): Promise<VoicePolicy> {
    const request = value as Partial<VoicePolicy>; if (!value || typeof value !== "object" || typeof request.consent !== "boolean" || !isRetention(request.retention)) throw new Error("Voice policy is invalid");
    const next: VoicePolicy = { consent: request.consent, retention: request.consent ? request.retention : "none", captureEnabled: false, updatedAt: this.now() };
    this.queue = this.queue.catch(() => undefined).then(async () => { await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 }); const temporary = `${this.filePath}.${randomUUID()}.tmp`; await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 }); await rename(temporary, this.filePath); }); await this.queue; this.policy = next; return this.get();
  }
}
function isRetention(value: unknown): value is VoiceRetention { return value === "none" || value === "session" || value === "24-hours"; }
function parse(value: unknown): VoicePolicy { if (!value || typeof value !== "object") return DEFAULT_POLICY; const row = value as Partial<VoicePolicy>; if (typeof row.consent !== "boolean" || !isRetention(row.retention) || row.captureEnabled !== false || typeof row.updatedAt !== "number" || !Number.isFinite(row.updatedAt)) return DEFAULT_POLICY; return { consent: row.consent, retention: row.consent ? row.retention : "none", captureEnabled: false, updatedAt: row.updatedAt }; }
