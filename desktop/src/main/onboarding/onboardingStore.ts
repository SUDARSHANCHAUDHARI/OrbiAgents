import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const ONBOARDING_VERSION = 1;
interface StoredOnboarding { version: number; completedAt: number; }

export class OnboardingStore {
  private state: StoredOnboarding | null = null; private saveQueue = Promise.resolve();
  constructor(private readonly filePath: string, private readonly now: () => number = Date.now) {}
  async load(): Promise<StoredOnboarding | null> {
    const raw = await readFile(this.filePath, "utf8").catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? "null" : Promise.reject(error));
    try { const value: unknown = JSON.parse(raw); this.state = parse(value); } catch { this.state = null; } return this.get();
  }
  get(): StoredOnboarding | null { return this.state ? { ...this.state } : null; }
  async complete(): Promise<StoredOnboarding> { const next = { version: ONBOARDING_VERSION, completedAt: this.now() }; await this.save(next); this.state = next; return { ...next }; }
  private save(next: StoredOnboarding): Promise<void> { this.saveQueue = this.saveQueue.catch(() => undefined).then(async () => { await mkdir(path.dirname(this.filePath), { recursive: true }); const temporary = `${this.filePath}.tmp`; await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); await rename(temporary, this.filePath); }); return this.saveQueue; }
}
function parse(value: unknown): StoredOnboarding | null { if (!value || typeof value !== "object") return null; const row = value as Record<string, unknown>; return row.version === ONBOARDING_VERSION && typeof row.completedAt === "number" && Number.isFinite(row.completedAt) && row.completedAt > 0 ? { version: ONBOARDING_VERSION, completedAt: row.completedAt } : null; }
