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
  /** Sessions that have received a hook event — idle timer is suppressed for these. */
  private hookDeliveredSessions = new Set<string>();

  private readonly watchDir = path.join(os.homedir(), ".claude", "projects");
  private readonly INACTIVITY_MS = 5000; // 5s no activity → idle

  onActivity(cb: ActivityCallback) {
    this.callbacks.push(cb);
  }

  /**
   * Mark a session as hook-delivered. While marked, the 5s inactivity idle timer
   * is suppressed so the hook Stop event (not a timeout) controls the idle transition.
   * Called by extension.ts when any hook event arrives for this session.
   */
  markHookDelivered(sessionId: string): void {
    this.hookDeliveredSessions.add(sessionId);
  }

  private emit(activity: AgentActivity) {
    this.callbacks.forEach(cb => cb(activity));
  }

  private sessionIdFromPath(filePath: string): string {
    return path.basename(path.dirname(filePath));
  }

  private scheduleIdle(filePath: string) {
    const sessionId = this.sessionIdFromPath(filePath);
    // Suppress inactivity idle if hooks are active for this session —
    // the Stop hook event handles the idle transition instead.
    if (this.hookDeliveredSessions.has(sessionId)) return;

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

    // Pre-seed sizes for all existing files so we only read NEW bytes going forward,
    // not the full historical content of every transcript on startup.
    this.seedExistingFileSizes();

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
      // Always reset idle timer when new bytes arrive, regardless of line content.
      // scheduleIdle checks hookDeliveredSessions and returns early if hooks are active.
      this.scheduleIdle(filePath);
    });

    this.watcher.on("add", (filePath: string) => {
      this.fileSizes.set(filePath, 0);
    });
  }

  private seedExistingFileSizes() {
    try {
      const entries = fs.readdirSync(this.watchDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(this.watchDir, entry.name);
        const files = fs.readdirSync(dir).filter(f => f.endsWith(".jsonl"));
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stat = fs.statSync(filePath);
            this.fileSizes.set(filePath, stat.size);
          } catch { /* skip unreadable files */ }
        }
      }
    } catch { /* watchDir not accessible */ }
  }

  stop() {
    this.watcher?.close();
    this.watcher = null;
    this.inactivityTimers.forEach(t => clearTimeout(t));
    this.inactivityTimers.clear();
    this.fileSizes.clear();
    this.hookDeliveredSessions.clear();
  }
}
