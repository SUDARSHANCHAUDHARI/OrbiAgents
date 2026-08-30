import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CommandHistoryEntry } from "../../shared/contracts";

interface EncryptionProvider { isAvailable(): boolean; encrypt(value: string): Buffer; decrypt(value: Buffer): string; }
const MAX_ENTRIES = 100;
const MAX_BODY_BYTES = 8 * 1024;

export class CommandHistoryStore {
  private entries: CommandHistoryEntry[] = [];
  private queue = Promise.resolve();
  constructor(private readonly filePath: string, private readonly encryption: EncryptionProvider) {}

  async load(): Promise<CommandHistoryEntry[]> {
    if (!this.encryption.isAvailable()) { this.entries = []; return []; }
    try {
      const envelope = JSON.parse(await readFile(this.filePath, "utf8")) as Record<string, unknown>;
      if (envelope.version !== 1 || typeof envelope.payload !== "string") throw new Error("Invalid command history envelope");
      const value: unknown = JSON.parse(this.encryption.decrypt(Buffer.from(envelope.payload, "base64")));
      this.entries = Array.isArray(value) ? value.flatMap((entry) => parseEntry(entry, true) ?? []).slice(-MAX_ENTRIES) : [];
    } catch { this.entries = []; }
    return this.list();
  }

  list(agentId?: string): CommandHistoryEntry[] { return this.entries.filter((entry) => !agentId || entry.agentId === agentId).map(copyEntry); }

  async upsert(value: unknown): Promise<CommandHistoryEntry[]> {
    if (!this.encryption.isAvailable()) throw new Error("Encrypted command history is unavailable");
    const entry = parseEntry(value); if (!entry) throw new Error("Command history entry is invalid");
    const next = [...this.entries.filter((candidate) => candidate.id !== entry.id), entry].sort((a, b) => a.createdAt - b.createdAt).slice(-MAX_ENTRIES);
    await this.save(next); this.entries = next; return this.list(entry.agentId);
  }

  private save(entries: CommandHistoryEntry[]): Promise<void> {
    const snapshot = entries.map(copyEntry);
    this.queue = this.queue.catch(() => undefined).then(async () => {
      const payload = this.encryption.encrypt(JSON.stringify(snapshot)).toString("base64");
      await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify({ version: 1, payload })}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.filePath);
    });
    return this.queue;
  }
}

function parseEntry(value: unknown, resumeInterrupted = false): CommandHistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CommandHistoryEntry>;
  if (typeof row.id !== "string" || !/^[0-9a-f-]{36}$/i.test(row.id) || typeof row.agentId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(row.agentId) || typeof row.body !== "string" || !row.body.trim() || Buffer.byteLength(row.body, "utf8") > MAX_BODY_BYTES || !["queued", "sending", "sent", "failed"].includes(row.status ?? "") || typeof row.createdAt !== "number" || !Number.isFinite(row.createdAt) || row.createdAt < 0 || row.error !== undefined && (typeof row.error !== "string" || row.error.length > 500)) return null;
  const status = row.status as CommandHistoryEntry["status"];
  return { id: row.id, agentId: row.agentId, body: row.body.trim(), status: resumeInterrupted && status === "sending" ? "queued" : status, createdAt: row.createdAt, error: row.error };
}
function copyEntry(entry: CommandHistoryEntry): CommandHistoryEntry { return { ...entry }; }
