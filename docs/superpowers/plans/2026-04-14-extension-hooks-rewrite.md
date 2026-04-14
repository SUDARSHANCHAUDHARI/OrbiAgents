# Extension Hooks Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace JSONL-only agent detection with a real-time Claude Code hooks pipeline — a local HTTP server receives hook events from Claude Code, updating agent animations instantly, with JSONL watching as fallback.

**Architecture:** The extension starts a local HTTP server on 127.0.0.1 (random port) and writes `~/.orbiagents/server.json` for hook script discovery. On activate, a compiled JS hook script is copied to `~/.orbiagents/hooks/claude-hook.js` and registered in `~/.claude/settings.json` for all 10 Claude Code hook events. When Claude Code fires a hook, it runs the script which reads stdin JSON and POSTs to the server — giving the extension instant session state. The existing JSONL `TranscriptWatcher` keeps running but its inactivity-idle timer is suppressed for sessions that have already received a hook event (`hookDelivered` flag), so the two systems never conflict.

**Tech Stack:** TypeScript, Node.js `http` module (no third-party HTTP library), chokidar (existing, JSONL fallback), esbuild (two build contexts: extension host + standalone hook script), VS Code Extension API

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `extension/src/hooks/claude-hook.ts` | **Create** | Standalone hook script: reads Claude Code stdin → POST to local server |
| `extension/src/hookServer.ts` | **Create** | HTTP server on 127.0.0.1, server.json discovery, auth token, multi-window safe |
| `extension/src/hookInstaller.ts` | **Create** | Read/write `~/.claude/settings.json`, copy hook script to `~/.orbiagents/hooks/` |
| `extension/src/agentMapper.ts` | **Modify** | Add `hookEventToState()` mapping hook event names to `AgentState` |
| `extension/src/transcriptWatcher.ts` | **Modify** | Add `markHookDelivered(sessionId)` — suppresses inactivity idle when hooks active |
| `extension/src/extension.ts` | **Modify** | Wire hook server + installer on activate, route events → agent state |
| `extension/esbuild.mjs` | **Modify** | Add second build context for hook script → `out/hooks/claude-hook.js` |

---

## Task 1: Hook Script Source + esbuild Second Bundle

The hook script is a standalone Node.js program (no VS Code dependencies) that Claude Code executes for each hook event. It reads JSON from stdin, finds the server via `~/.orbiagents/server.json`, and POSTs the event. It must be compiled to a self-contained CJS bundle so it runs with plain `node` from any directory.

**Files:**
- Create: `extension/src/hooks/claude-hook.ts`
- Modify: `extension/esbuild.mjs`

- [ ] **Step 1: Create the hooks source directory and hook script**

Create `extension/src/hooks/claude-hook.ts`:

```typescript
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";

const SERVER_JSON = path.join(os.homedir(), ".orbiagents", "server.json");

interface ServerConfig {
  port: number;
  token: string;
}

async function main(): Promise<void> {
  // Read the hook event payload that Claude Code writes to stdin
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0); // Malformed JSON — exit silently
  }

  // Discover the running OrbiAgents server
  let server: ServerConfig;
  try {
    server = JSON.parse(fs.readFileSync(SERVER_JSON, "utf-8")) as ServerConfig;
  } catch {
    process.exit(0); // No server running — exit silently, don't block Claude
  }

  const body = JSON.stringify(data);
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: server.port,
        path: "/api/hooks/claude",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${server.token}`,
        },
        timeout: 2000,
      },
      () => resolve(),
    );
    req.on("error", () => resolve());
    req.on("timeout", () => {
      req.destroy();
      resolve();
    });
    req.end(body);
  });
}

main().catch(() => {}).finally(() => process.exit(0));
```

- [ ] **Step 2: Add the hook script build context to esbuild.mjs**

Replace the full contents of `extension/esbuild.mjs`:

```javascript
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

// Extension host bundle — external: vscode (provided by VS Code runtime)
const extCtx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode", "fsevents"],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  logLevel: "info",
});

// Hook script bundle — standalone CJS, no externals, runs in plain node
const hookCtx = await esbuild.context({
  entryPoints: ["src/hooks/claude-hook.ts"],
  bundle: true,
  outfile: "out/hooks/claude-hook.js",
  format: "cjs",
  platform: "node",
  sourcemap: false,
  logLevel: "info",
});

if (watch) {
  await extCtx.watch();
  await hookCtx.watch();
  console.log("Watching...");
} else {
  await extCtx.rebuild();
  await hookCtx.rebuild();
  await extCtx.dispose();
  await hookCtx.dispose();
}
```

- [ ] **Step 3: Build and verify the hook script is generated**

Run from `extension/`:
```bash
cd extension && node esbuild.mjs
```

Expected output (both bundles logged):
```
[watch] build finished (extension.js)
[watch] build finished (claude-hook.js)
```

Then verify:
```bash
ls extension/out/hooks/claude-hook.js
```
Expected: file exists, size > 0.

- [ ] **Step 4: Smoke-test the compiled hook script**

```bash
echo '{"hook_event_name":"Stop","session_id":"test-123"}' | node extension/out/hooks/claude-hook.js
```

Expected: exits immediately (server.json doesn't exist yet) with exit code 0, no error printed.

- [ ] **Step 5: Commit**

```bash
cd extension
git add src/hooks/claude-hook.ts esbuild.mjs out/hooks/claude-hook.js
git commit -m "feat: add hook script source and second esbuild bundle"
```

---

## Task 2: HTTP Hook Server (hookServer.ts)

The server listens on a random port on 127.0.0.1, validates requests with a Bearer token, and fires a callback for each valid hook event. It writes `~/.orbiagents/server.json` for discovery and is multi-window safe: if another VS Code window already owns a server (same PID alive in server.json), this instance reuses that config without starting a new server.

**Files:**
- Create: `extension/src/hookServer.ts`

- [ ] **Step 1: Create hookServer.ts**

Create `extension/src/hookServer.ts`:

```typescript
import * as crypto from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";

export interface ServerConfig {
  port: number;
  pid: number;
  token: string;
  startedAt: number;
}

export type HookEventCallback = (event: Record<string, unknown>) => void;

const SERVER_JSON_PATH = path.join(os.homedir(), ".orbiagents", "server.json");
const HOOK_API_PREFIX = "/api/hooks";
const MAX_HOOK_BODY_SIZE = 65_536; // 64 KB

export class HookServer {
  private server: http.Server | null = null;
  private config: ServerConfig | null = null;
  private ownsServer = false;
  private callback: HookEventCallback | null = null;
  private startedAt = 0;

  onHookEvent(cb: HookEventCallback): void {
    this.callback = cb;
  }

  /**
   * Start the HTTP server. If another VS Code window already owns a server
   * (detected via server.json PID check), reuses its config.
   */
  async start(): Promise<ServerConfig> {
    const existing = this.readServerJson();
    if (existing && isProcessRunning(existing.pid)) {
      this.config = existing;
      this.ownsServer = false;
      console.log(`[OrbiAgents] Reusing server on port ${existing.port} (PID ${existing.pid})`);
      return existing;
    }

    const token = crypto.randomUUID();
    this.startedAt = Date.now();

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));
      this.server.on("error", reject);
      this.server.setTimeout(5000);

      // port 0 = OS picks a free port
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server?.address();
        if (addr && typeof addr === "object") {
          this.config = {
            port: addr.port,
            pid: process.pid,
            token,
            startedAt: this.startedAt,
          };
          this.ownsServer = true;
          this.writeServerJson(this.config);
          this.server!.removeListener("error", reject);
          this.server!.on("error", (err) =>
            console.error(`[OrbiAgents] Server error: ${err}`),
          );
          console.log(`[OrbiAgents] Server listening on 127.0.0.1:${addr.port}`);
          resolve(this.config);
        } else {
          reject(new Error("Failed to get server address"));
        }
      });
    });
  }

  /** Stop the server and remove server.json (only if we own it). */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (this.ownsServer) {
      this.deleteServerJson();
    }
    this.config = null;
    this.ownsServer = false;
  }

  getConfig(): ServerConfig | null {
    return this.config;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url ?? "";

    if (req.method === "GET" && url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          pid: process.pid,
          uptime: Math.floor((Date.now() - this.startedAt) / 1000),
        }),
      );
      return;
    }

    if (req.method === "POST" && url.startsWith(HOOK_API_PREFIX + "/")) {
      this.handleHookRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  }

  private handleHookRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Timing-safe token comparison prevents side-channel attacks
    const authHeader = req.headers["authorization"] ?? "";
    const expectedToken = `Bearer ${this.config?.token ?? ""}`;
    const authBuf = Buffer.from(authHeader);
    const expectedBuf = Buffer.from(expectedToken);
    if (
      authBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(authBuf, expectedBuf)
    ) {
      res.writeHead(401);
      res.end("unauthorized");
      return;
    }

    let body = "";
    let bodySize = 0;
    let responded = false;

    req.on("data", (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_HOOK_BODY_SIZE && !responded) {
        responded = true;
        res.writeHead(413);
        res.end("payload too large");
        req.destroy();
        return;
      }
      if (!responded) body += chunk.toString();
    });

    req.on("end", () => {
      if (responded) return;
      try {
        const event = JSON.parse(body) as Record<string, unknown>;
        // Only dispatch events that have the required fields
        if (event.session_id && event.hook_event_name) {
          this.callback?.(event);
        }
        res.writeHead(200);
        res.end("ok");
      } catch {
        res.writeHead(400);
        res.end("invalid json");
      }
    });
  }

  private readServerJson(): ServerConfig | null {
    try {
      if (!fs.existsSync(SERVER_JSON_PATH)) return null;
      return JSON.parse(fs.readFileSync(SERVER_JSON_PATH, "utf-8")) as ServerConfig;
    } catch {
      return null;
    }
  }

  private writeServerJson(config: ServerConfig): void {
    const dir = path.dirname(SERVER_JSON_PATH);
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmpPath = SERVER_JSON_PATH + ".tmp";
      // Restricted permissions: only owner can read (contains auth token)
      fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), { mode: 0o600 });
      fs.renameSync(tmpPath, SERVER_JSON_PATH);
    } catch (e) {
      console.error(`[OrbiAgents] Failed to write server.json: ${e}`);
    }
  }

  private deleteServerJson(): void {
    try {
      if (!fs.existsSync(SERVER_JSON_PATH)) return;
      const existing = JSON.parse(
        fs.readFileSync(SERVER_JSON_PATH, "utf-8"),
      ) as ServerConfig;
      // Only delete if our PID owns it — don't stomp on another window's server
      if (existing.pid === process.pid) fs.unlinkSync(SERVER_JSON_PATH);
    } catch {
      // File may already be gone
    }
  }
}

/** Check if a process is alive by sending signal 0 (no-op, just checks existence). */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Verify the server starts and responds**

Build first:
```bash
cd extension && node esbuild.mjs
```

Then write and run a quick manual test script (do not commit):
```javascript
// /tmp/test-hookserver.js
const { HookServer } = require("./extension/out/extension.js");
// NOTE: HookServer is not exported from out/extension.js directly.
// Test manually by launching the extension with F5 and checking:
//   cat ~/.orbiagents/server.json
// Expected: JSON with port, pid, token, startedAt
```

Since HookServer is internal to the extension bundle, test it via F5 (see Task 6 integration test). For now, build must succeed:

```bash
cd extension && node esbuild.mjs 2>&1 | grep -E "error|warning|built"
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd extension
git add src/hookServer.ts
git commit -m "feat: add HookServer — local HTTP server for Claude Code hook events"
```

---

## Task 3: Hook Installer (hookInstaller.ts)

Reads and writes `~/.claude/settings.json` to install/uninstall 11 hook entries (one per event). Also copies the compiled `out/hooks/claude-hook.js` to `~/.orbiagents/hooks/` so Claude Code can find and run it. All writes are atomic (tmp file + rename) to avoid corrupting Claude's settings.

**Files:**
- Create: `extension/src/hookInstaller.ts`

- [ ] **Step 1: Create hookInstaller.ts**

Create `extension/src/hookInstaller.ts`:

```typescript
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const HOOK_SCRIPTS_DIR = path.join(os.homedir(), ".orbiagents", "hooks");
const HOOK_SCRIPT_NAME = "claude-hook.js";
// String present in every hook command we install — used to identify our entries
const HOOK_SCRIPT_MARKER = "claude-hook.js";

const CLAUDE_HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "Stop",
  "PermissionRequest",
  "Notification",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SubagentStart",
  "SubagentStop",
] as const;

interface ClaudeHookEntry {
  matcher: string;
  hooks: Array<{ type: string; command: string; timeout?: number }>;
}

interface ClaudeSettings {
  hooks?: Record<string, ClaudeHookEntry[]>;
  [key: string]: unknown;
}

function readSettings(): ClaudeSettings {
  try {
    if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf-8")) as ClaudeSettings;
    }
  } catch (e) {
    console.error(`[OrbiAgents] Failed to read Claude settings: ${e}`);
  }
  return {};
}

function writeSettings(settings: ClaudeSettings): void {
  const dir = path.dirname(CLAUDE_SETTINGS_PATH);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmpPath = CLAUDE_SETTINGS_PATH + ".orbiagents-tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), "utf-8");
    fs.renameSync(tmpPath, CLAUDE_SETTINGS_PATH);
  } catch (e) {
    console.error(`[OrbiAgents] Failed to write Claude settings: ${e}`);
  }
}

function isOurEntry(entry: ClaudeHookEntry): boolean {
  return entry.hooks.some((h) => h.command.includes(HOOK_SCRIPT_MARKER));
}

function makeHookEntry(): ClaudeHookEntry {
  return {
    matcher: "",
    hooks: [
      {
        type: "command",
        command: `node "${path.join(HOOK_SCRIPTS_DIR, HOOK_SCRIPT_NAME)}"`,
        timeout: 5,
      },
    ],
  };
}

/** Returns true if all 11 hook events have an OrbiAgents entry in Claude settings. */
export function areHooksInstalled(): boolean {
  const settings = readSettings();
  if (!settings.hooks) return false;
  return CLAUDE_HOOK_EVENTS.every((event) => {
    const entries = settings.hooks?.[event];
    return Array.isArray(entries) && entries.some(isOurEntry);
  });
}

/**
 * Install OrbiAgents hook entries in ~/.claude/settings.json.
 * Idempotent: removes any existing OrbiAgents entries before inserting fresh ones
 * (handles the case where the script path changed between extension versions).
 */
export function installHooks(): void {
  const settings = readSettings();
  if (!settings.hooks) settings.hooks = {};

  let changed = false;
  for (const event of CLAUDE_HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
    const entries = settings.hooks[event];
    const filtered = entries.filter((e) => !isOurEntry(e));
    filtered.push(makeHookEntry());
    if (JSON.stringify(filtered) !== JSON.stringify(entries)) {
      settings.hooks[event] = filtered;
      changed = true;
    }
  }

  if (changed) {
    writeSettings(settings);
    console.log("[OrbiAgents] Hooks installed in ~/.claude/settings.json");
  }
}

/** Remove all OrbiAgents hook entries from ~/.claude/settings.json. Cleans up empty arrays. */
export function uninstallHooks(): void {
  const settings = readSettings();
  if (!settings.hooks) return;

  let changed = false;
  for (const event of Object.keys(settings.hooks)) {
    const entries = settings.hooks[event];
    if (!Array.isArray(entries)) continue;
    const filtered = entries.filter((e) => !isOurEntry(e));
    if (filtered.length !== entries.length) {
      settings.hooks[event] = filtered;
      changed = true;
    }
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  if (changed) {
    writeSettings(settings);
    console.log("[OrbiAgents] Hooks removed from ~/.claude/settings.json");
  }
}

/**
 * Copy the compiled hook script from the extension's out/hooks/ to ~/.orbiagents/hooks/.
 * Called after hookServer.start() so the script is in place before any Claude session fires.
 */
export function copyHookScript(extensionPath: string): void {
  const src = path.join(extensionPath, "out", "hooks", HOOK_SCRIPT_NAME);
  const dst = path.join(HOOK_SCRIPTS_DIR, HOOK_SCRIPT_NAME);

  try {
    if (!fs.existsSync(HOOK_SCRIPTS_DIR)) {
      fs.mkdirSync(HOOK_SCRIPTS_DIR, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(src)) {
      console.warn(`[OrbiAgents] Hook script not found at ${src} — run pnpm build first`);
      return;
    }
    fs.copyFileSync(src, dst);
    fs.chmodSync(dst, 0o700);
    console.log(`[OrbiAgents] Hook script copied to ${dst}`);
  } catch (e) {
    console.error(`[OrbiAgents] Failed to copy hook script: ${e}`);
  }
}
```

- [ ] **Step 2: Build and manually verify installHooks works**

```bash
cd extension && node esbuild.mjs
```

Verify by running a quick node script:
```bash
node -e "
const path = require('path');
// Temporarily test install logic against a temp settings path
// (real test happens via F5 in Task 6)
console.log('hookInstaller compiled successfully');
"
```

Check the build produced no TypeScript errors:
```bash
cd extension && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd extension
git add src/hookInstaller.ts
git commit -m "feat: add hookInstaller — manages Claude Code hooks in ~/.claude/settings.json"
```

---

## Task 4: Hook Event → Agent State Mapping (agentMapper.ts)

Add `hookEventToState()` to the existing `agentMapper.ts`. This function converts a hook event name (plus optional tool name and notification type) into an `AgentState`. For `PreToolUse` it reuses the existing `toolCallToState()` so the same tool→state logic is shared between JSONL and hook paths.

**Files:**
- Modify: `extension/src/agentMapper.ts`

- [ ] **Step 1: Add hookEventToState to the end of agentMapper.ts**

The full updated file `extension/src/agentMapper.ts`:

```typescript
// "done" is not emitted here — reserved for future task completion signals.
// Idle transitions are handled by the inactivity timer in transcriptWatcher.ts.
export type AgentState = "idle" | "thinking" | "coding" | "done";

// Maps tool name → agent state
const TOOL_STATE_MAP: Record<string, AgentState> = {
  // Reading/exploring → thinking
  Read:      "thinking",
  Grep:      "thinking",
  Glob:      "thinking",
  LS:        "thinking",
  WebFetch:  "thinking",
  WebSearch: "thinking",
  Skill:     "thinking",
  ToolSearch:"thinking",
  // Writing/running → coding
  Write:       "coding",
  Edit:        "coding",
  Bash:        "coding",
  NotebookEdit:"coding",
  // Agent delegation + task tracking → thinking
  Agent:     "thinking",
  TodoWrite: "thinking",
};

export function toolCallToState(toolName: string): AgentState {
  if (TOOL_STATE_MAP[toolName]) return TOOL_STATE_MAP[toolName];
  // MCP tools (mcp__server__tool) are side-effectful actions → coding
  if (toolName.startsWith("mcp__")) return "coding";
  return "thinking";
}

// A line of JSONL from a Claude Code transcript
export interface TranscriptLine {
  type: string;
  message?: {
    content?: Array<{ type: string; name?: string }>;
  };
}

// Returns the agent state derived from a transcript line, or null if irrelevant
export function parseTranscriptLine(raw: string): AgentState | null {
  try {
    const line = JSON.parse(raw) as TranscriptLine;
    if (line.type !== "assistant") return null;
    const content = line.message?.content ?? [];
    for (const block of content) {
      if (block.type === "tool_use" && block.name) {
        return toolCallToState(block.name);
      }
    }
    // Assistant text message with no tool use = thinking
    if (content.some(b => b.type === "text")) return "thinking";
    return null;
  } catch {
    return null;
  }
}

/**
 * Map a Claude Code hook event to an AgentState.
 *
 * @param eventName     - hook_event_name field (e.g. "PreToolUse", "Stop")
 * @param toolName      - tool_name field for PreToolUse events (optional)
 * @param notifType     - notification_type field for Notification events (optional)
 * @returns AgentState, or null if the event does not trigger a state change
 */
export function hookEventToState(
  eventName: string,
  toolName?: string,
  notifType?: string,
): AgentState | null {
  switch (eventName) {
    case "PreToolUse":
      // Reuse same tool→state logic as JSONL path
      return toolName ? toolCallToState(toolName) : "thinking";
    case "Stop":
    case "SessionEnd":
      return "idle";
    case "Notification":
      // idle_prompt means Claude finished and is waiting for user input
      return notifType === "idle_prompt" ? "idle" : "thinking";
    case "UserPromptSubmit":
    case "SessionStart":
    case "PermissionRequest":
    case "SubagentStop":
      return "thinking";
    case "SubagentStart":
      return "coding";
    case "PostToolUse":
    case "PostToolUseFailure":
      // Stop hook handles the idle transition — these don't change state themselves
      return null;
    default:
      return null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles with no errors**

```bash
cd extension && npx tsc --noEmit 2>&1 | head -20
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
cd extension
git add src/agentMapper.ts
git commit -m "feat: add hookEventToState to agentMapper"
```

---

## Task 5: TranscriptWatcher — hookDelivered Suppression

Add a `hookDeliveredSessions` set to `TranscriptWatcher`. When a hook event arrives for a session (called by extension.ts before the JSONL activity callback), the inactivity idle timer for that session is suppressed. This prevents a race where the JSONL watcher fires an idle transition after the hook already set the agent to `coding`.

**Files:**
- Modify: `extension/src/transcriptWatcher.ts`

- [ ] **Step 1: Add hookDeliveredSessions field and markHookDelivered method**

Replace the full contents of `extension/src/transcriptWatcher.ts`:

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
```

- [ ] **Step 2: TypeScript check**

```bash
cd extension && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd extension
git add src/transcriptWatcher.ts
git commit -m "feat: suppress JSONL inactivity idle when hook events are active for a session"
```

---

## Task 6: Wire Hook Server + Installer in extension.ts

Update `extension.ts` to start the `HookServer`, copy the hook script, install hooks, and route incoming hook events to agent state updates. The hook event callback calls `watcher.markHookDelivered(sessionId)` before updating state so the JSONL idle timer is suppressed for that session going forward.

**Files:**
- Modify: `extension/src/extension.ts`

- [ ] **Step 1: Replace extension.ts with the wired version**

Replace the full contents of `extension/src/extension.ts`:

```typescript
import * as vscode from "vscode";
import { OrbiPanel, AgentUpdate } from "./panel";
import { TranscriptWatcher } from "./transcriptWatcher";
import { HookServer } from "./hookServer";
import { installHooks, uninstallHooks, copyHookScript } from "./hookInstaller";
import { hookEventToState } from "./agentMapper";

// 5 named agents matching the web app
const AGENT_NAMES = ["Orbi-Alpha", "Orbi-Beta", "Orbi-Gamma", "Orbi-Delta", "Orbi-Epsilon"];

function makeAgents(): AgentUpdate[] {
  return AGENT_NAMES.map((name, i) => ({
    id: String(i + 1),
    name,
    agentState: "idle",
    paused: false,
    paletteIndex: i,
  }));
}

export function activate(context: vscode.ExtensionContext) {
  let agents = makeAgents();
  const watcher = new TranscriptWatcher();
  const hookServer = new HookServer();
  let statusBar: vscode.StatusBarItem;

  // Status bar item
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(robot) OrbiAgents";
  statusBar.tooltip = "Open OrbiAgents panel";
  statusBar.command = "orbiagents.openPanel";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Map active sessions → agent slots (round-robin)
  const sessionSlots = new Map<string, number>();
  let nextSlot = 0;

  function slotForSession(sessionId: string): number {
    if (!sessionSlots.has(sessionId)) {
      sessionSlots.set(sessionId, nextSlot % AGENT_NAMES.length);
      nextSlot++;
    }
    return sessionSlots.get(sessionId) ?? 0;
  }

  function updateAgentState(sessionId: string, state: string) {
    const slot = slotForSession(sessionId);
    agents = agents.map((a, i) => (i === slot ? { ...a, agentState: state } : a));

    const active = agents.filter(a => a.agentState !== "idle").length;
    statusBar.text = active > 0
      ? `$(robot) OrbiAgents ● ${active} active`
      : "$(robot) OrbiAgents";

    OrbiPanel.currentPanel?.sendAgents(agents);
  }

  // ── Hook events (primary, real-time) ──────────────────────────────────
  hookServer.onHookEvent((event) => {
    const sessionId = event.session_id as string;
    const eventName = event.hook_event_name as string;
    const toolName = event.tool_name as string | undefined;
    const notifType = event.notification_type as string | undefined;

    const state = hookEventToState(eventName, toolName, notifType);
    if (!state) return;

    // Tell the JSONL watcher to stop firing idle timers for this session
    watcher.markHookDelivered(sessionId);
    updateAgentState(sessionId, state);
  });

  // ── JSONL transcript watcher (fallback when hooks unavailable) ─────────
  watcher.onActivity(({ sessionId, state }) => {
    updateAgentState(sessionId, state);
  });

  // Start JSONL watcher
  watcher.start();
  context.subscriptions.push({ dispose: () => watcher.stop() });

  // Start HTTP hook server, then copy hook script and install hooks
  hookServer.start().then(() => {
    copyHookScript(context.extensionPath);
    installHooks();
  }).catch((e: unknown) => {
    console.error("[OrbiAgents] Failed to start hook server:", e);
  });

  context.subscriptions.push({
    dispose: () => {
      hookServer.stop();
      uninstallHooks();
    },
  });

  // Register open-panel command
  const cmd = vscode.commands.registerCommand("orbiagents.openPanel", () => {
    const panel = OrbiPanel.createOrShow(context.extensionUri);
    panel.sendAgents(agents);
  });
  context.subscriptions.push(cmd);
}

export function deactivate() {}
```

- [ ] **Step 2: Build the extension**

```bash
cd extension && node esbuild.mjs
```
Expected: both bundles build with no errors.

- [ ] **Step 3: TypeScript check**

```bash
cd extension && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 4: Full integration test — F5 launch**

Press **F5** in VS Code (with the `extension/` folder open). The Extension Development Host window opens.

Verify each of the following:

**a) Server started:**
```bash
cat ~/.orbiagents/server.json
```
Expected: JSON with `port`, `pid`, `token`, `startedAt`.

**b) Hook script copied:**
```bash
ls -la ~/.orbiagents/hooks/claude-hook.js
```
Expected: file exists, executable bit set (`-rwx------`).

**c) Hooks installed in Claude settings:**
```bash
cat ~/.claude/settings.json | python3 -m json.tool | grep -A3 "PreToolUse"
```
Expected: entry with `node "/Users/<you>/.orbiagents/hooks/claude-hook.js"`.

**d) Hook script health check:**
```bash
curl -s -w "\n%{http_code}" \
  http://127.0.0.1/api/health  # replace port from server.json
```
Expected: `{"status":"ok",...}` with HTTP 200. Get the port first:
```bash
PORT=$(python3 -c "import json; print(json.load(open('$HOME/.orbiagents/server.json'))['port'])")
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.orbiagents/server.json'))['token'])")
curl -s http://127.0.0.1:$PORT/api/health
```

**e) Manual hook event test:**
```bash
PORT=$(python3 -c "import json; print(json.load(open('$HOME/.orbiagents/server.json'))['port'])")
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.orbiagents/server.json'))['token'])")

# Simulate a PreToolUse event for a session
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"hook_event_name":"PreToolUse","session_id":"test-session-abc","tool_name":"Edit"}' \
  http://127.0.0.1:$PORT/api/hooks/claude
```
Expected: `ok` response. The OrbiAgents panel should show one agent animating in "coding" state.

**f) Real Claude Code hook test:**
Open a new terminal, start a Claude Code session in any directory:
```bash
cd /tmp && claude
```
Type a prompt and observe the OrbiAgents panel — the agent assigned to that session should animate as Claude uses tools, then go idle when Claude finishes (Stop hook).

- [ ] **Step 5: Commit**

```bash
cd extension
git add src/extension.ts
git commit -m "feat: wire hook server and installer into extension activate/deactivate"
```

---

## Final Verification

After all tasks are committed, do one end-to-end smoke test:

- [ ] Run `node esbuild.mjs` — both bundles build cleanly
- [ ] Run `npx tsc --noEmit` — zero type errors
- [ ] F5 → Extension Development Host opens, `server.json` written, hooks in `settings.json`
- [ ] Start Claude Code in any terminal → agent animates in real-time via hooks
- [ ] Close the Extension Development Host → `server.json` deleted, hooks removed from `settings.json`
- [ ] Commit anything not yet committed:
  ```bash
  git log --oneline -6
  ```
  Expected 6 commits in this branch: hook script + esbuild, HookServer, hookInstaller, agentMapper hookEventToState, transcriptWatcher hookDelivered, extension wiring.
