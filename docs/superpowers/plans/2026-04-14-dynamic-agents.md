# Dynamic Agent Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 5 hard-coded idle agents with dynamic agent creation/removal — one character spawns when a Claude Code session starts, disappears when it ends. The office shows exactly the agents that are actually running.

**Architecture:** `extension.ts` manages a `Map<sessionId, AgentUpdate>` instead of a fixed array. Hook events `SessionStart`/`SessionEnd` drive lifecycle (create/remove). The JSONL fallback creates an agent on the first activity for an unknown session and removes it after 30s of inactivity. `transcriptWatcher.ts` adds an `onNewSession` callback so extension.ts can create agents from the JSONL path too. The webview receives the same `{ type: "agents", agents: AgentUpdate[] }` message — no webview changes needed, it already renders variable-length arrays.

**Tech Stack:** TypeScript, VS Code Extension API, existing hooks pipeline (HookServer, hookInstaller, agentMapper), chokidar (JSONL fallback)

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `extension/src/extension.ts` | **Modify** | Replace fixed array + slotForSession with Map-based dynamic lifecycle |
| `extension/src/transcriptWatcher.ts` | **Modify** | Add `onNewSession` callback fired on `"add"` event; extend inactivity timer to 30s for JSONL-only sessions |

No other files need changes — `agentMapper.ts`, `hookServer.ts`, `hookInstaller.ts`, `panel.ts`, `webview-ui/` are all unchanged.

---

## Task 1: Dynamic Agent Map in extension.ts

Replace the fixed `makeAgents()` / `slotForSession()` / round-robin system with a `Map<string, AgentUpdate>` keyed by `sessionId`. Add `createAgentForSession`, `removeAgentForSession`, and `broadcastAgents` helpers. Wire `SessionStart` to create and `SessionEnd` to remove.

**Files:**
- Modify: `extension/src/extension.ts`

- [ ] **Step 1: Replace the full contents of extension.ts**

```typescript
import * as vscode from "vscode";
import { OrbiPanel, AgentUpdate } from "./panel";
import { TranscriptWatcher } from "./transcriptWatcher";
import { HookServer } from "./hookServer";
import { installHooks, uninstallHooks, copyHookScript } from "./hookInstaller";
import { hookEventToState } from "./agentMapper";

// Palette cycles through 5 colors (0-4), wraps for session 6+
const PALETTE_COUNT = 5;
// Counter for generating sequential agent names: Orbi-1, Orbi-2, …
let agentCounter = 0;

/** Build a new AgentUpdate for a freshly-detected session. */
function createAgent(sessionId: string): AgentUpdate {
  agentCounter++;
  return {
    id: sessionId,
    name: `Orbi-${agentCounter}`,
    agentState: "thinking",
    paused: false,
    paletteIndex: (agentCounter - 1) % PALETTE_COUNT,
  };
}

export function activate(context: vscode.ExtensionContext) {
  /** Live agents keyed by sessionId. Empty = empty office. */
  const agentMap = new Map<string, AgentUpdate>();
  /** Pending removal timers for SessionEnd grace period (prevents flicker on /clear). */
  const removalTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const watcher = new TranscriptWatcher();
  const hookServer = new HookServer();

  // ── Status bar ────────────────────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(robot) OrbiAgents";
  statusBar.tooltip = "Open OrbiAgents panel";
  statusBar.command = "orbiagents.openPanel";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // ── Core helpers ──────────────────────────────────────────────────────

  /** Broadcast current agent map to the panel and update the status bar. */
  function broadcastAgents(): void {
    const agents = [...agentMap.values()];
    const active = agents.filter(a => a.agentState !== "idle").length;
    statusBar.text = active > 0
      ? `$(robot) OrbiAgents ● ${active} active`
      : agents.length > 0
        ? "$(robot) OrbiAgents"
        : "$(robot) OrbiAgents (idle)";
    OrbiPanel.currentPanel?.sendAgents(agents);
  }

  /** Ensure an agent exists for sessionId. Creates one if unknown. Returns the agent. */
  function ensureAgent(sessionId: string): AgentUpdate {
    if (!agentMap.has(sessionId)) {
      agentMap.set(sessionId, createAgent(sessionId));
    }
    return agentMap.get(sessionId)!;
  }

  /** Update state for a session (creates agent if unknown). */
  function updateAgentState(sessionId: string, state: string): void {
    const agent = ensureAgent(sessionId);
    agentMap.set(sessionId, { ...agent, agentState: state });
    broadcastAgents();
  }

  /**
   * Schedule removal of an agent after `delayMs`.
   * Cancels any existing removal timer for the same session first.
   */
  function scheduleRemoval(sessionId: string, delayMs: number): void {
    const existing = removalTimers.get(sessionId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      agentMap.delete(sessionId);
      removalTimers.delete(sessionId);
      broadcastAgents();
    }, delayMs);
    removalTimers.set(sessionId, t);
  }

  /** Cancel a pending removal (e.g., /clear followed by new SessionStart). */
  function cancelRemoval(sessionId: string): void {
    const existing = removalTimers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      removalTimers.delete(sessionId);
    }
  }

  // ── Hook events (primary, real-time) ──────────────────────────────────
  hookServer.onHookEvent((event) => {
    const sessionId = event.session_id as string;
    const eventName = event.hook_event_name as string;
    const toolName = event.tool_name as string | undefined;
    const notifType = event.notification_type as string | undefined;
    const reason = event.reason as string | undefined;

    // Tell the JSONL watcher to stop firing idle timers for this session
    watcher.markHookDelivered(sessionId);

    if (eventName === "SessionStart") {
      // Cancel any pending removal (handles /clear: SessionEnd then SessionStart)
      cancelRemoval(sessionId);
      ensureAgent(sessionId);
      broadcastAgents();
      return;
    }

    if (eventName === "SessionEnd") {
      // /clear and /resume fire SessionEnd then immediately SessionStart.
      // Use a 2s grace window — if SessionStart arrives, cancelRemoval() saves the agent.
      // All other reasons (exit, logout, prompt_input_exit) remove the agent after 500ms.
      const gracePeriod = (reason === "clear" || reason === "resume") ? 2000 : 500;
      scheduleRemoval(sessionId, gracePeriod);
      return;
    }

    const state = hookEventToState(eventName, toolName, notifType);
    if (!state) return;
    updateAgentState(sessionId, state);
  });

  // ── JSONL transcript watcher (fallback when hooks unavailable) ─────────
  watcher.onNewSession((sessionId) => {
    // New .jsonl file detected — create an agent if one doesn't exist yet
    if (!agentMap.has(sessionId)) {
      ensureAgent(sessionId);
      broadcastAgents();
    }
  });

  watcher.onActivity(({ sessionId, state }) => {
    // Cancel any pending removal — activity means the session is still alive
    cancelRemoval(sessionId);
    updateAgentState(sessionId, state);
  });

  // Start JSONL watcher
  watcher.start();
  context.subscriptions.push({ dispose: () => watcher.stop() });

  // Start HTTP hook server, then copy hook script and install hooks
  hookServer.start().then(() => {
    if (copyHookScript(context.extensionPath)) {
      installHooks();
    }
  }).catch((e: unknown) => {
    console.error("[OrbiAgents] Failed to start hook server:", e);
  });

  context.subscriptions.push({
    dispose: () => {
      // Cancel all pending removal timers
      removalTimers.forEach(t => clearTimeout(t));
      removalTimers.clear();
      hookServer.stop();
      uninstallHooks();
    },
  });

  // Register open-panel command
  const cmd = vscode.commands.registerCommand("orbiagents.openPanel", () => {
    const panel = OrbiPanel.createOrShow(context.extensionUri);
    panel.sendAgents([...agentMap.values()]);
  });
  context.subscriptions.push(cmd);
}

export function deactivate() {}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/sudarshan/SUDARSHAN_CODE/sudarshan_repos/Orbiagents/extension && npx tsc --noEmit 2>&1
```

Expected: one error — `watcher.onNewSession is not a function` (added in Task 2). Note it and proceed.

- [ ] **Step 3: Commit (partial — Task 2 will fix the TS error)**

```bash
cd /Users/sudarshan/SUDARSHAN_CODE/sudarshan_repos/Orbiagents
git add extension/src/extension.ts
git commit -m "feat: dynamic agent lifecycle — Map-based session management"
```

---

## Task 2: onNewSession callback in TranscriptWatcher

Add `onNewSession(cb)` to `TranscriptWatcher`. The callback fires when chokidar's `"add"` event fires for a new `.jsonl` file — meaning a new Claude Code session started. Also extend the JSONL-only inactivity timeout to 30s (from 5s) so agents don't vanish too quickly when hooks aren't installed.

**Files:**
- Modify: `extension/src/transcriptWatcher.ts`

- [ ] **Step 1: Replace the full contents of transcriptWatcher.ts**

```typescript
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
export type NewSessionCallback = (sessionId: string) => void;

export class TranscriptWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private fileSizes = new Map<string, number>();
  private inactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activityCallbacks: ActivityCallback[] = [];
  private newSessionCallbacks: NewSessionCallback[] = [];
  /** Sessions that have received a hook event — idle timer is suppressed for these. */
  private hookDeliveredSessions = new Set<string>();

  private readonly watchDir = path.join(os.homedir(), ".claude", "projects");
  /** When hooks are active the Stop event owns idle — this timer is only for JSONL-only sessions. */
  private readonly INACTIVITY_MS = 30_000; // 30s no JSONL activity → idle (hooks-free fallback)

  onActivity(cb: ActivityCallback): void {
    this.activityCallbacks.push(cb);
  }

  /**
   * Register a callback invoked when a new .jsonl file appears (new Claude session).
   * Used by extension.ts to create an agent before any activity arrives.
   */
  onNewSession(cb: NewSessionCallback): void {
    this.newSessionCallbacks.push(cb);
  }

  /**
   * Mark a session as hook-delivered. While marked, the 30s inactivity idle timer
   * is suppressed so the hook Stop event (not a timeout) controls the idle transition.
   * Called by extension.ts when any hook event arrives for this session.
   */
  markHookDelivered(sessionId: string): void {
    this.hookDeliveredSessions.add(sessionId);
  }

  private emit(activity: AgentActivity): void {
    this.activityCallbacks.forEach(cb => cb(activity));
  }

  private emitNewSession(sessionId: string): void {
    this.newSessionCallbacks.forEach(cb => cb(sessionId));
  }

  private sessionIdFromPath(filePath: string): string {
    return path.basename(path.dirname(filePath));
  }

  private scheduleIdle(filePath: string): void {
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

  start(): void {
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
      // scheduleIdle returns early when hooks are active for this session.
      this.scheduleIdle(filePath);
    });

    this.watcher.on("add", (filePath: string) => {
      // New .jsonl = new Claude Code session starting
      this.fileSizes.set(filePath, 0);
      const sessionId = this.sessionIdFromPath(filePath);
      this.emitNewSession(sessionId);
    });
  }

  private seedExistingFileSizes(): void {
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

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    this.inactivityTimers.forEach(t => clearTimeout(t));
    this.inactivityTimers.clear();
    this.fileSizes.clear();
    this.hookDeliveredSessions.clear();
  }
}
```

- [ ] **Step 2: TypeScript check — must be zero errors now**

```bash
cd /Users/sudarshan/SUDARSHAN_CODE/sudarshan_repos/Orbiagents/extension && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 3: Build**

```bash
cd /Users/sudarshan/SUDARSHAN_CODE/sudarshan_repos/Orbiagents/extension && node esbuild.mjs 2>&1
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/sudarshan/SUDARSHAN_CODE/sudarshan_repos/Orbiagents
git add extension/src/transcriptWatcher.ts
git commit -m "feat: add onNewSession callback and extend JSONL inactivity to 30s"
```

---

## Integration Test (manual — do after both tasks committed)

- [ ] **Build the full extension**

```bash
cd /Users/sudarshan/SUDARSHAN_CODE/sudarshan_repos/Orbiagents/extension && node esbuild.mjs && pnpm --prefix webview-ui build
```

- [ ] **F5 — open Extension Development Host**

Open OrbiAgents panel: Command Palette → "OrbiAgents: Open Panel"

Expected: **empty canvas** (no agents, no idle dummies).

- [ ] **Start one Claude Code session**

```bash
cd /tmp && claude
```

Expected: **one agent** appears in the canvas, animating as Claude works.

- [ ] **Start a second Claude session in another terminal**

```bash
cd /tmp && claude
```

Expected: **two agents** now visible, each animating independently.

- [ ] **Exit the first session** (type `/exit` or Ctrl+D)

Expected: first agent **disappears** within 500ms. Second agent still animating.

- [ ] **Exit the second session**

Expected: canvas goes **empty** again.

- [ ] **Test /clear behaviour**

In a claude session, type `/clear`. Expected: agent stays (it gets a SessionEnd+SessionStart pair within 2s, so the grace window prevents removal).
