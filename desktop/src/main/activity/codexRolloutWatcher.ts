import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { codexRolloutSession, normalizeCodexRolloutLine, type NormalizedProviderActivity } from "./providerActivity";

const MAX_READ_BYTES = 256 * 1024;

interface TrackedRollout {
  offset: number;
  remainder: string;
  agentId?: string;
}

export class CodexRolloutWatcher {
  private readonly files = new Map<string, TrackedRollout>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sessionsRoot: string,
    private readonly resolveAgent: (cwd: string, modifiedAt: number) => string | undefined,
    private readonly onActivity: (agentId: string, activity: NormalizedProviderActivity) => void,
  ) {}

  start(intervalMs = 500): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.scan().catch(() => undefined), intervalMs);
    this.timer.unref();
    void this.scan().catch(() => undefined);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.files.clear();
  }

  async scan(): Promise<void> {
    let names: string[];
    try { names = await readdir(this.sessionsRoot, { recursive: true }); } catch { return; }
    await Promise.all(names.filter((name) => name.endsWith(".jsonl")).map((name) => this.read(join(this.sessionsRoot, name))));
  }

  private async read(path: string): Promise<void> {
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) return;
    const tracked = this.files.get(path) ?? { offset: 0, remainder: "" };
    if (info.size <= tracked.offset) return;
    const bytesToRead = Math.min(info.size - tracked.offset, MAX_READ_BYTES);
    const handle = await open(path, "r");
    const buffer = Buffer.alloc(bytesToRead);
    try { await handle.read(buffer, 0, bytesToRead, tracked.offset); } finally { await handle.close(); }
    tracked.offset += bytesToRead;
    const lines = (tracked.remainder + buffer.toString("utf8")).split("\n");
    tracked.remainder = lines.pop() ?? "";
    for (const line of lines) {
      if (!tracked.agentId) {
        const session = codexRolloutSession(line);
        if (session) tracked.agentId = this.resolveAgent(session.cwd, info.mtimeMs);
      }
      if (!tracked.agentId) continue;
      const activity = normalizeCodexRolloutLine(line);
      if (activity) this.onActivity(tracked.agentId, activity);
    }
    this.files.set(path, tracked);
  }
}
