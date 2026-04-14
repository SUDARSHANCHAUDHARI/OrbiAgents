import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chokidar from "chokidar";
import { parseTranscriptLine, AgentState } from "./agentMapper";

export interface AgentActivity {
  sessionId: string;   // derived from file path
  state: AgentState;
  timestamp: number;
}

export type ActivityCallback = (activity: AgentActivity) => void;

export class TranscriptWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private fileSizes = new Map<string, number>();
  private inactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private callbacks: ActivityCallback[] = [];

  private readonly watchDir = path.join(os.homedir(), ".claude", "projects");
  private readonly INACTIVITY_MS = 5000; // 5s no activity → idle

  onActivity(cb: ActivityCallback) {
    this.callbacks.push(cb);
  }

  private emit(activity: AgentActivity) {
    this.callbacks.forEach(cb => cb(activity));
  }

  private sessionIdFromPath(filePath: string): string {
    return path.basename(path.dirname(filePath));
  }

  private scheduleIdle(filePath: string) {
    const sessionId = this.sessionIdFromPath(filePath);
    const existing = this.inactivityTimers.get(filePath);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.emit({ sessionId, state: "idle", timestamp: Date.now() });
      this.inactivityTimers.delete(filePath);
    }, this.INACTIVITY_MS);
    this.inactivityTimers.set(filePath, timer);
  }

  private async readNewLines(filePath: string): Promise<string[]> {
    const prevSize = this.fileSizes.get(filePath) ?? 0;
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      return [];
    }
    if (stat.size <= prevSize) return [];

    const fh = await fs.promises.open(filePath, "r");
    try {
      const buf = Buffer.alloc(stat.size - prevSize);
      await fh.read(buf, 0, buf.length, prevSize);
      this.fileSizes.set(filePath, stat.size);
      return buf.toString("utf8").split("\n").filter(l => l.trim().length > 0);
    } finally {
      await fh.close();
    }
  }

  start() {
    if (!fs.existsSync(this.watchDir)) return;

    this.watcher = chokidar.watch(`${this.watchDir}/**/*.jsonl`, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    this.watcher.on("change", async (filePath: string) => {
      const lines = await this.readNewLines(filePath);
      if (lines.length === 0) return;
      const sessionId = this.sessionIdFromPath(filePath);
      for (const line of lines) {
        const state = parseTranscriptLine(line);
        if (state) {
          this.emit({ sessionId, state, timestamp: Date.now() });
        }
      }
      // Always reset idle timer when new bytes arrive, regardless of line content
      this.scheduleIdle(filePath);
    });

    this.watcher.on("add", (filePath: string) => {
      this.fileSizes.set(filePath, 0);
    });
  }

  stop() {
    this.watcher?.close();
    this.watcher = null;
    this.inactivityTimers.forEach(t => clearTimeout(t));
    this.inactivityTimers.clear();
    this.fileSizes.clear();
  }
}
