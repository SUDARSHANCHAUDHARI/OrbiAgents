import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import chokidar from "chokidar";
import { parseTranscriptLine, AgentState } from "./agentMapper";

export interface AgentActivity {
  sessionId: string;
  state: AgentState;
  toolName?: string;   // set when state came from a specific tool
  isSubagent?: boolean; // true when this session is a sub-agent turn
  timestamp: number;
}

export type ActivityCallback = (activity: AgentActivity) => void;

// A richer parsed JSONL record
interface ParsedLine {
  state: AgentState;
  toolName?: string;
  isTurnComplete?: boolean;  // system + subtype:"turn_duration"
  isAgentProgress?: boolean; // progress.data.type === "agent_progress"
}

const TOOL_DONE_BUFFER_MS = 300; // debounce before emitting idle after tool completion

export class TranscriptWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private fileSizes = new Map<string, number>();
  private inactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private toolDoneTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private callbacks: ActivityCallback[] = [];
  private hookDeliveredSessions = new Set<string>();
  // Track which sessions are sub-agent sessions
  private subagentSessions = new Set<string>();

  private readonly watchDir = path.join(os.homedir(), ".claude", "projects");
  private readonly INACTIVITY_MS = 5000;

  onActivity(cb: ActivityCallback) {
    this.callbacks.push(cb);
  }

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
    if (this.hookDeliveredSessions.has(sessionId)) return;

    const existing = this.inactivityTimers.get(filePath);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.emit({ sessionId, state: "idle", timestamp: Date.now() });
      this.inactivityTimers.delete(filePath);
    }, this.INACTIVITY_MS);
    this.inactivityTimers.set(filePath, timer);
  }

  // 300ms buffer before emitting idle after a tool completes —
  // Claude often writes multiple consecutive records; debounce prevents flicker.
  private scheduleToolDoneIdle(sessionId: string) {
    if (this.hookDeliveredSessions.has(sessionId)) return;
    const existing = this.toolDoneTimers.get(sessionId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.emit({ sessionId, state: "idle", timestamp: Date.now() });
      this.toolDoneTimers.delete(sessionId);
    }, TOOL_DONE_BUFFER_MS);
    this.toolDoneTimers.set(sessionId, timer);
  }

  private cancelToolDoneTimer(sessionId: string) {
    const t = this.toolDoneTimers.get(sessionId);
    if (t !== undefined) {
      clearTimeout(t);
      this.toolDoneTimers.delete(sessionId);
    }
  }

  private parseRichLine(raw: string): ParsedLine | null {
    try {
      const line = JSON.parse(raw) as Record<string, unknown>;

      // turn_duration system record → turn complete, agent goes idle
      if (
        line.type === "system" &&
        (line as Record<string, unknown>).subtype === "turn_duration"
      ) {
        return { state: "idle", isTurnComplete: true };
      }

      // progress record — check for sub-agent activity
      if (line.type === "progress") {
        const data = (line as Record<string, unknown>).data as Record<string, unknown> | undefined;
        if (data?.type === "agent_progress") {
          return { state: "thinking", isAgentProgress: true };
        }
        // Other progress (e.g. Bash streaming output) → keep coding state
        return { state: "coding" };
      }

      // Standard assistant/user records
      const state = parseTranscriptLine(raw);
      if (!state) return null;

      // Extract tool name for overlay
      const msg = (line as Record<string, unknown>).message as Record<string, unknown> | undefined;
      const content = (msg?.content as Array<Record<string, unknown>> | undefined) ?? [];
      const toolBlock = content.find(b => b.type === "tool_use");
      const toolName = toolBlock?.name as string | undefined;

      return { state, toolName };
    } catch {
      return null;
    }
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
        const parsed = this.parseRichLine(line);
        if (!parsed) continue;

        // Track sub-agent sessions for sub-agent lifecycle
        if (parsed.isAgentProgress) {
          this.subagentSessions.add(sessionId);
        }

        // turn_duration = Claude finished the turn → buffered idle
        if (parsed.isTurnComplete) {
          this.scheduleToolDoneIdle(sessionId);
          continue;
        }

        // New tool starting → cancel any pending tool-done idle
        if (parsed.state === "coding" || parsed.state === "reading" || parsed.state === "thinking") {
          this.cancelToolDoneTimer(sessionId);
        }

        this.emit({
          sessionId,
          state: parsed.state,
          toolName: parsed.toolName,
          isSubagent: this.subagentSessions.has(sessionId),
          timestamp: Date.now(),
        });
      }

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
    this.toolDoneTimers.forEach(t => clearTimeout(t));
    this.toolDoneTimers.clear();
    this.fileSizes.clear();
    this.hookDeliveredSessions.clear();
    this.subagentSessions.clear();
  }
}
