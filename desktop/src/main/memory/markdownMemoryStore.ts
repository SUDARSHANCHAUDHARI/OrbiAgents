import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { MemoryRecord } from "../../shared/contracts";

interface MemoryIndexEntry extends Omit<MemoryRecord, "content"> { file: string; bytes: number; searchText: string; }
interface MemoryLimits { maxRecords: number; maxTotalBytes: number; maxRecordCharacters: number; }
const DEFAULT_LIMITS: MemoryLimits = { maxRecords: 200, maxTotalBytes: 2_000_000, maxRecordCharacters: 20_000 };

export class MarkdownMemoryStore {
  private queue = Promise.resolve();
  constructor(private readonly root: string, private readonly limits: MemoryLimits = DEFAULT_LIMITS) {}

  async capture(input: { title: string; content: string; source: string; authorAgentId: string }): Promise<MemoryRecord> {
    const record: MemoryRecord = { id: randomUUID(), title: bounded(input.title, "Memory title", 200), content: bounded(input.content, "Memory content", this.limits.maxRecordCharacters), source: safeLabel(input.source, "Memory source"), authorAgentId: safeLabel(input.authorAgentId, "Memory author"), createdAt: Date.now() };
    await this.enqueue(async () => {
      const entries = await this.loadIndex();
      const file = `${record.createdAt}-${record.id}.md`;
      const body = serialize(record);
      await atomicText(join(this.root, "records", file), body);
      entries.push(toIndex(record, file, Buffer.byteLength(body)));
      await this.enforceRetention(entries);
    });
    return record;
  }

  async list(): Promise<MemoryRecord[]> {
    const entries = await this.loadIndex();
    const records = await Promise.all(entries.sort((a, b) => b.createdAt - a.createdAt).map((entry) => this.readEntry(entry)));
    return records.filter((record): record is MemoryRecord => Boolean(record));
  }

  async search(query: string, limit = 20): Promise<MemoryRecord[]> {
    const terms = bounded(query, "Memory query", 500).toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const entries = await this.loadIndex();
    const ranked = entries.map((entry) => ({ entry, score: terms.reduce((score, term) => score + occurrences(entry.searchText, term), 0) })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || b.entry.createdAt - a.entry.createdAt).slice(0, Math.min(Math.max(limit, 1), 50));
    const records = await Promise.all(ranked.map(({ entry }) => this.readEntry(entry)));
    return records.filter((record): record is MemoryRecord => Boolean(record));
  }

  private async loadIndex(): Promise<MemoryIndexEntry[]> {
    try {
      const parsed = JSON.parse(await readFile(join(this.root, "index.json"), "utf8"));
      if (Array.isArray(parsed)) return parsed.filter(validIndexEntry);
    } catch { /* rebuild below */ }
    return this.rebuildIndex();
  }

  private async rebuildIndex(): Promise<MemoryIndexEntry[]> {
    const directory = join(this.root, "records");
    let files: string[] = [];
    try { files = (await readdir(directory)).filter((file) => file.endsWith(".md")); } catch { return []; }
    const entries: MemoryIndexEntry[] = [];
    for (const file of files) {
      try { const text = await readFile(join(directory, file), "utf8"); const record = parse(text); if (record) entries.push(toIndex(record, file, Buffer.byteLength(text))); } catch { /* ignore malformed record */ }
    }
    await atomicJson(join(this.root, "index.json"), entries);
    return entries;
  }

  private async readEntry(entry: MemoryIndexEntry): Promise<MemoryRecord | null> {
    try { return parse(await readFile(join(this.root, "records", entry.file), "utf8")); } catch { return null; }
  }

  private async enforceRetention(entries: MemoryIndexEntry[]): Promise<void> {
    entries.sort((a, b) => a.createdAt - b.createdAt);
    const removed: MemoryIndexEntry[] = [];
    let bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    while (entries.length > this.limits.maxRecords || bytes > this.limits.maxTotalBytes) { const entry = entries.shift(); if (!entry) break; removed.push(entry); bytes -= entry.bytes; }
    if (removed.length) {
      const record: MemoryRecord = { id: randomUUID(), title: `Condensed memory (${removed.length} records)`, content: removed.map((entry) => `- ${new Date(entry.createdAt).toISOString()} — ${entry.title} [${entry.source}]`).join("\n").slice(0, this.limits.maxRecordCharacters), source: "retention", authorAgentId: "orbi-prime", createdAt: Date.now(), condensed: true };
      const file = `${record.createdAt}-${record.id}.md`; const body = serialize(record); await atomicText(join(this.root, "records", file), body); entries.push(toIndex(record, file, Buffer.byteLength(body)));
      bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
      while (entries.length > this.limits.maxRecords || bytes > this.limits.maxTotalBytes) { const entry = entries.shift(); if (!entry) break; removed.push(entry); bytes -= entry.bytes; }
    }
    await Promise.all(removed.map((entry) => unlink(join(this.root, "records", entry.file)).catch(() => undefined)));
    await atomicJson(join(this.root, "index.json"), entries);
  }

  private async enqueue(operation: () => Promise<void>): Promise<void> { const result = this.queue.then(operation); this.queue = result.catch(() => undefined); await result; }
}

function serialize(record: MemoryRecord): string { return `<!-- orbi-memory:${JSON.stringify({ ...record, content: undefined })} -->\n# ${record.title}\n\n${record.content}\n`; }
function parse(text: string): MemoryRecord | null { const line = text.split("\n", 1)[0]; if (!line?.startsWith("<!-- orbi-memory:") || !line.endsWith(" -->")) return null; try { const meta = JSON.parse(line.slice(17, -4)); const content = text.slice(line.length).replace(/^\n# .*?\n\n/s, "").trimEnd(); const record = { ...meta, content }; return validRecord(record) ? record : null; } catch { return null; } }
function toIndex(record: MemoryRecord, file: string, bytes: number): MemoryIndexEntry { return { id: record.id, title: record.title, source: record.source, authorAgentId: record.authorAgentId, createdAt: record.createdAt, condensed: record.condensed, file, bytes, searchText: `${record.title}\n${record.content}\n${record.source}\n${record.authorAgentId}`.toLocaleLowerCase() }; }
function validIndexEntry(value: unknown): value is MemoryIndexEntry { const row = value as Partial<MemoryIndexEntry>; return Boolean(row && typeof row.id === "string" && typeof row.file === "string" && /^\d+-[0-9a-f-]{36}\.md$/i.test(row.file) && typeof row.searchText === "string" && typeof row.createdAt === "number" && Number.isFinite(row.createdAt) && typeof row.bytes === "number" && Number.isFinite(row.bytes) && row.bytes >= 0); }
function validRecord(value: unknown): value is MemoryRecord { const row = value as Partial<MemoryRecord>; return Boolean(row && typeof row.id === "string" && typeof row.title === "string" && typeof row.content === "string" && typeof row.source === "string" && typeof row.authorAgentId === "string" && typeof row.createdAt === "number" && (row.condensed === undefined || typeof row.condensed === "boolean")); }
function bounded(value: string, label: string, max: number): string { const text = value?.trim(); if (!text || text.length > max) throw new Error(`${label} must contain 1 to ${max} characters`); return text; }
function safeLabel(value: string, label: string): string { const text = value?.trim(); if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(text)) throw new Error(`${label} is invalid`); return text; }
function occurrences(text: string, term: string): number { let score = 0; let index = 0; while ((index = text.indexOf(term, index)) >= 0) { score += 1; index += term.length; } return score; }
async function atomicText(path: string, value: string): Promise<void> { await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`; await writeFile(temporary, value, { encoding: "utf8", mode: 0o600 }); await rename(temporary, path); }
async function atomicJson(path: string, value: unknown): Promise<void> { await atomicText(path, `${JSON.stringify(value, null, 2)}\n`); }
