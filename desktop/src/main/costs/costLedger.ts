import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { CostLedgerEntry, CostLedgerSnapshot } from "../../shared/contracts";

export interface CostAuthorizationInput { projectPath: string; missionId: string; runId: string; approvalId: string; title: string; estimatedCostUsd: number; }
export class CostLedger {
  private readonly filePath: string;
  private queue = Promise.resolve();

  constructor(root: string, private readonly options: { maxFileBytes?: number; maxEntries?: number; now?: () => number } = {}) {
    this.filePath = path.join(root, "ledger.jsonl");
    if (options.maxFileBytes !== undefined && (!Number.isInteger(options.maxFileBytes) || options.maxFileBytes < 1)) throw new Error("Cost ledger byte limit is invalid");
    if (options.maxEntries !== undefined && (!Number.isInteger(options.maxEntries) || options.maxEntries < 1)) throw new Error("Cost ledger entry limit is invalid");
  }

  recordAuthorization(input: CostAuthorizationInput): Promise<CostLedgerEntry> {
    const operation = this.queue.then(async () => {
      const normalized = validateInput(input);
      const eventKey = createHash("sha256").update([normalized.projectPath, normalized.missionId, normalized.runId, normalized.approvalId, "authorization-estimate"].join("\0")).digest("hex");
      const current = await this.readAll();
      if (current.corrupted) throw new Error("Cost ledger integrity check failed; refusing to append");
      const existing = current.entries.find((entry) => entry.eventKey === eventKey);
      if (existing) {
        if (existing.amountUsd !== normalized.estimatedCostUsd || existing.title !== normalized.title) throw new Error("Cost authorization idempotency conflict");
        return existing;
      }
      if (current.entries.length >= (this.options.maxEntries ?? 50_000)) throw new Error("Cost ledger entry limit reached");
      const unsigned = { id: randomUUID(), eventKey, kind: "authorization-estimate" as const, basis: "operator-approved-scheduled-mission-estimate" as const, currency: "USD" as const, amountUsd: normalized.estimatedCostUsd, projectPath: normalized.projectPath, missionId: normalized.missionId, runId: normalized.runId, approvalId: normalized.approvalId, title: normalized.title, createdAt: this.options.now?.() ?? Date.now(), previousChecksum: current.entries.at(-1)?.checksum };
      const entry: CostLedgerEntry = { ...unsigned, checksum: entryChecksum(unsigned) };
      const line = `${JSON.stringify(entry)}\n`;
      const existingBytes = await stat(this.filePath).then((value) => value.size).catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? 0 : Promise.reject(error));
      if (existingBytes + Buffer.byteLength(line) > (this.options.maxFileBytes ?? 25 * 1024 * 1024)) throw new Error("Cost ledger byte limit reached");
      await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      const handle = await open(this.filePath, "a", 0o600);
      try { await handle.chmod(0o600); await handle.writeFile(line, "utf8"); await handle.sync(); } finally { await handle.close(); }
      return entry;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async snapshot(limit = 200): Promise<CostLedgerSnapshot> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("Cost ledger read limit must be between 1 and 500");
    const all = await this.readAll();
    const entries = all.entries.slice(-limit).reverse();
    return { entries, totalAuthorizedEstimateUsd: roundUsd(all.entries.reduce((total, entry) => total + entry.amountUsd, 0)), corrupted: all.corrupted, truncated: all.entries.length > limit };
  }

  private async readAll(): Promise<{ entries: CostLedgerEntry[]; corrupted: boolean }> {
    let raw: string;
    try {
      const info = await stat(this.filePath);
      if (!info.isFile() || info.size > (this.options.maxFileBytes ?? 25 * 1024 * 1024)) return { entries: [], corrupted: true };
      raw = await readFile(this.filePath, "utf8");
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { entries: [], corrupted: false }; throw error; }
    const entries: CostLedgerEntry[] = [];
    const eventKeys = new Set<string>(); let previousChecksum: string | undefined;
    for (const line of raw.split("\n")) {
      if (!line) continue;
      let value: unknown;
      try { value = JSON.parse(line); } catch { return { entries, corrupted: true }; }
      if (!validEntry(value) || value.previousChecksum !== previousChecksum || value.checksum !== entryChecksum(value) || eventKeys.has(value.eventKey)) return { entries, corrupted: true };
      eventKeys.add(value.eventKey); entries.push(value); previousChecksum = value.checksum;
      if (entries.length > (this.options.maxEntries ?? 50_000)) return { entries: entries.slice(0, -1), corrupted: true };
    }
    return { entries, corrupted: false };
  }
}

function validateInput(input: CostAuthorizationInput): CostAuthorizationInput {
  const estimatedCostUsd = input.estimatedCostUsd;
  if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd <= 0 || estimatedCostUsd > 1_000) throw new Error("Authorized cost estimate is invalid");
  return { projectPath: bounded(input.projectPath, 4_096, "Project path"), missionId: bounded(input.missionId, 128, "Mission identifier"), runId: bounded(input.runId, 128, "Run identifier"), approvalId: bounded(input.approvalId, 128, "Approval identifier"), title: bounded(input.title, 300, "Cost title"), estimatedCostUsd };
}
function bounded(value: string, max: number, label: string): string { const text = value?.trim(); if (!text || text.length > max || /[\r\n\0]/.test(text)) throw new Error(`${label} is invalid`); return text; }
function validEntry(value: unknown): value is CostLedgerEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<CostLedgerEntry>;
  return typeof row.id === "string" && /^[0-9a-f-]{36}$/i.test(row.id) && typeof row.eventKey === "string" && /^[0-9a-f]{64}$/.test(row.eventKey) && row.kind === "authorization-estimate" && row.basis === "operator-approved-scheduled-mission-estimate" && row.currency === "USD" && typeof row.amountUsd === "number" && Number.isFinite(row.amountUsd) && row.amountUsd > 0 && row.amountUsd <= 1_000 && validText(row.projectPath, 4_096) && validText(row.missionId, 128) && validText(row.runId, 128) && validText(row.approvalId, 128) && validText(row.title, 300) && typeof row.createdAt === "number" && Number.isFinite(row.createdAt) && row.createdAt >= 0 && (row.previousChecksum === undefined || typeof row.previousChecksum === "string" && /^[0-9a-f]{64}$/.test(row.previousChecksum)) && typeof row.checksum === "string" && /^[0-9a-f]{64}$/.test(row.checksum);
}
function entryChecksum(value: Omit<CostLedgerEntry, "checksum"> | CostLedgerEntry): string { const { checksum: _checksum, ...unsigned } = value as CostLedgerEntry; return createHash("sha256").update(JSON.stringify(unsigned)).digest("hex"); }
function validText(value: unknown, max: number): value is string { return typeof value === "string" && value.length > 0 && value.length <= max && !/[\r\n\0]/.test(value); }
function roundUsd(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
