# OrbiAgents VS Code Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone VS Code extension that shows a live pixel office canvas inside the editor, with agents that animate automatically by watching Claude Code transcript files — no server required.

**Architecture:** The extension host (`extension/src/`) watches `~/.claude/projects/**/*.jsonl` for Claude Code activity, maps tool calls to agent states, and posts messages to a React webview. The webview (`extension/webview-ui/`) reuses the existing `shared/` engine (tile map, renderer, game loop, sprites) to render the pixel office. Communication is one-way: extension host → webview via `postMessage`.

**Tech Stack:** TypeScript, VS Code Extension API (`vscode`), esbuild (extension host bundler), Vite + React (webview bundler), `shared/` engine (already built), `fs.watch` / `chokidar` for file watching.

---

## File Structure

```
extension/
├── package.json                  ← Extension manifest (contributes commands, views)
├── tsconfig.json                 ← Extension host TS config
├── esbuild.mjs                   ← Bundles extension host to out/extension.js
├── src/
│   ├── extension.ts              ← Activation, command registration, status bar
│   ├── transcriptWatcher.ts      ← Watches ~/.claude/projects/ JSONL files
│   ├── agentMapper.ts            ← Maps tool call names → agent state strings
│   └── panel.ts                  ← Creates/shows WebviewPanel, sends messages
└── webview-ui/
    ├── package.json              ← React + Vite deps
    ├── vite.config.ts            ← Vite config pointing to shared/ alias
    ├── index.html                ← Webview HTML entry
    └── src/
        ├── main.tsx              ← React root, acquires VS Code API
        ├── App.tsx               ← Pixel office canvas + agent state
        └── vscode.d.ts           ← Type shim for acquireVsCodeApi
```

**Shared engine** (already exists, do NOT modify):
- `shared/engine/gameLoop.ts` — `createGameLoop(tileMap, homeTiles, onFrame)`
- `shared/engine/renderer.ts` — `renderFrame(ctx, tileMap, furniture, chars, ox, oy, zoom)`
- `shared/engine/tileMap.ts` — `buildTileMap()`, `buildFurnitureInstances()`, `AGENT_HOME_TILES`
- `shared/sprites/characters.ts` — `getCharacterSprites(paletteIndex)`
- `shared/types.ts` — `CharacterRenderState`, `AgentInput`, `Direction`, `CharacterState`

---

## Task 1: Extension scaffold — package.json + tsconfig + esbuild

**Files:**
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/esbuild.mjs`

- [ ] **Step 1: Create `extension/package.json`**

```json
{
  "name": "orbiagents",
  "displayName": "OrbiAgents",
  "description": "Live pixel office showing your Claude Code agents",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "orbiagents.openPanel",
        "title": "OrbiAgents: Open Panel"
      }
    ],
    "menus": {
      "commandPalette": [
        { "command": "orbiagents.openPanel" }
      ]
    }
  },
  "scripts": {
    "build": "node esbuild.mjs && pnpm --prefix webview-ui build",
    "watch": "node esbuild.mjs --watch",
    "vscode:prepublish": "pnpm build"
  },
  "dependencies": {
    "chokidar": "^3.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "esbuild": "^0.20.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `extension/esbuild.mjs`**

```js
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
  console.log("Watching...");
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
```

- [ ] **Step 4: Install dependencies**

```bash
cd extension && pnpm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add extension/package.json extension/tsconfig.json extension/esbuild.mjs
git commit -m "feat(extension): scaffold — package.json, tsconfig, esbuild"
```

---

## Task 2: Agent mapper — tool call → agent state

**Files:**
- Create: `extension/src/agentMapper.ts`

- [ ] **Step 1: Create `extension/src/agentMapper.ts`**

This file maps Claude Code tool call names to the `agentState` strings that the shared game loop understands (`"idle"`, `"thinking"`, `"coding"`, `"done"`).

```typescript
export type AgentState = "idle" | "thinking" | "coding" | "done";

// Maps tool name → agent state
const TOOL_STATE_MAP: Record<string, AgentState> = {
  // Reading/exploring → thinking
  Read:   "thinking",
  Grep:   "thinking",
  Glob:   "thinking",
  LS:     "thinking",
  WebFetch: "thinking",
  WebSearch: "thinking",
  // Writing/running → coding
  Write:  "coding",
  Edit:   "coding",
  Bash:   "coding",
  NotebookEdit: "coding",
  // Agent delegation → thinking (orchestrating)
  Agent:  "thinking",
  // Task tracking → thinking
  TodoWrite: "thinking",
};

export function toolCallToState(toolName: string): AgentState {
  return TOOL_STATE_MAP[toolName] ?? "thinking";
}

// A line of JSONL from a Claude Code transcript
export interface TranscriptLine {
  type: string;
  message?: {
    role?: string;
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
```

- [ ] **Step 2: Verify it compiles**

```bash
cd extension && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/agentMapper.ts
git commit -m "feat(extension): agent mapper — tool call → agent state"
```

---

## Task 3: Transcript watcher

**Files:**
- Create: `extension/src/transcriptWatcher.ts`

- [ ] **Step 1: Create `extension/src/transcriptWatcher.ts`**

Watches `~/.claude/projects/**/*.jsonl`. When a file changes, reads the last line and emits an agent state update.

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

  private readonly watchDir = path.join(os.homedir(), ".claude", "projects");
  private readonly INACTIVITY_MS = 5000; // 5s no activity → idle

  onActivity(cb: ActivityCallback) {
    this.callbacks.push(cb);
  }

  private emit(activity: AgentActivity) {
    this.callbacks.forEach(cb => cb(activity));
  }

  private sessionIdFromPath(filePath: string): string {
    // Use the parent folder name as a stable session ID
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
      stat = fs.statSync(filePath);
    } catch {
      return [];
    }
    if (stat.size <= prevSize) return [];

    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(stat.size - prevSize);
    fs.readSync(fd, buf, 0, buf.length, prevSize);
    fs.closeSync(fd);
    this.fileSizes.set(filePath, stat.size);

    return buf.toString("utf8").split("\n").filter(l => l.trim().length > 0);
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
      const sessionId = this.sessionIdFromPath(filePath);
      for (const line of lines) {
        const state = parseTranscriptLine(line);
        if (state) {
          this.emit({ sessionId, state, timestamp: Date.now() });
          this.scheduleIdle(filePath);
        }
      }
    });

    this.watcher.on("add", (filePath: string) => {
      this.fileSizes.set(filePath, 0);
    });
  }

  stop() {
    this.watcher?.close();
    this.inactivityTimers.forEach(t => clearTimeout(t));
    this.inactivityTimers.clear();
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd extension && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/transcriptWatcher.ts
git commit -m "feat(extension): transcript watcher — JSONL file watching + idle timer"
```

---

## Task 4: Panel — WebviewPanel manager

**Files:**
- Create: `extension/src/panel.ts`

- [ ] **Step 1: Create `extension/src/panel.ts`**

Creates and manages the VS Code `WebviewPanel`. Sends agent state updates to the webview via `postMessage`.

```typescript
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface AgentUpdate {
  id: string;
  name: string;
  agentState: string;
  paused: boolean;
  paletteIndex: number;
}

export class OrbiPanel {
  static currentPanel: OrbiPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (OrbiPanel.currentPanel) {
      OrbiPanel.currentPanel.panel.reveal(column);
      return OrbiPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "orbiagents",
      "OrbiAgents",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "webview-ui", "dist")],
      }
    );

    OrbiPanel.currentPanel = new OrbiPanel(panel, extensionUri);
    return OrbiPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml(extensionUri);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  sendAgents(agents: AgentUpdate[]) {
    this.panel.webview.postMessage({ type: "agents", agents });
  }

  private getHtml(extensionUri: vscode.Uri): string {
    const distUri = vscode.Uri.joinPath(extensionUri, "webview-ui", "dist");
    const indexPath = path.join(distUri.fsPath, "index.html");

    if (!fs.existsSync(indexPath)) {
      return `<html><body style="background:#0d0907;color:#a78bfa;font-family:monospace;padding:24px">
        <h2>OrbiAgents</h2><p>Webview not built yet. Run: pnpm build</p>
      </body></html>`;
    }

    let html = fs.readFileSync(indexPath, "utf8");
    // Rewrite asset paths to webview URIs
    const distWebUri = this.panel.webview.asWebviewUri(distUri).toString();
    html = html.replace(/(src|href)="\/([^"]*)"/g, `$1="${distWebUri}/$2"`);
    html = html.replace(/(src|href)="\.\//g, `$1="${distWebUri}/`);
    return html;
  }

  dispose() {
    OrbiPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd extension && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/panel.ts
git commit -m "feat(extension): panel — WebviewPanel manager with postMessage"
```

---

## Task 5: Extension host entry point

**Files:**
- Create: `extension/src/extension.ts`

- [ ] **Step 1: Create `extension/src/extension.ts`**

Wires together the transcript watcher, agent state manager, panel, and status bar.

```typescript
import * as vscode from "vscode";
import { OrbiPanel, AgentUpdate } from "./panel";
import { TranscriptWatcher } from "./transcriptWatcher";

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
    return sessionSlots.get(sessionId)!;
  }

  // Transcript watcher → agent state updates
  watcher.onActivity(({ sessionId, state }) => {
    const slot = slotForSession(sessionId);
    agents = agents.map((a, i) =>
      i === slot ? { ...a, agentState: state } : a
    );

    // Update status bar to show active count
    const active = agents.filter(a => a.agentState !== "idle").length;
    statusBar.text = active > 0
      ? `$(robot) OrbiAgents ● ${active} active`
      : "$(robot) OrbiAgents";

    OrbiPanel.currentPanel?.sendAgents(agents);
  });

  watcher.start();
  context.subscriptions.push({ dispose: () => watcher.stop() });

  // Register command
  const cmd = vscode.commands.registerCommand("orbiagents.openPanel", () => {
    const panel = OrbiPanel.createOrShow(context.extensionUri);
    panel.sendAgents(agents);
  });
  context.subscriptions.push(cmd);
}

export function deactivate() {}
```

- [ ] **Step 2: Build extension host**

```bash
cd extension && node esbuild.mjs
```

Expected: `out/extension.js` created, no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/extension.ts
git commit -m "feat(extension): host entry point — watcher + panel + status bar"
```

---

## Task 6: Webview UI scaffold — Vite + React

**Files:**
- Create: `extension/webview-ui/package.json`
- Create: `extension/webview-ui/vite.config.ts`
- Create: `extension/webview-ui/index.html`
- Create: `extension/webview-ui/src/vscode.d.ts`
- Create: `extension/webview-ui/src/main.tsx`

- [ ] **Step 1: Create `extension/webview-ui/package.json`**

```json
{
  "name": "orbiagents-webview",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `extension/webview-ui/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "shared": path.resolve(__dirname, "../../shared"),
    },
  },
});
```

- [ ] **Step 3: Create `extension/webview-ui/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OrbiAgents</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0d0907; overflow: hidden; }
    #root { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create `extension/webview-ui/src/vscode.d.ts`**

```typescript
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};
```

- [ ] **Step 5: Create `extension/webview-ui/src/main.tsx`**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
```

- [ ] **Step 6: Install webview deps**

```bash
cd extension/webview-ui && pnpm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add extension/webview-ui/
git commit -m "feat(extension): webview scaffold — Vite + React + shared alias"
```

---

## Task 7: Webview App — pixel canvas using shared engine

**Files:**
- Create: `extension/webview-ui/src/App.tsx`

- [ ] **Step 1: Create `extension/webview-ui/src/App.tsx`**

This is the webview React component. It receives agent state via `window.addEventListener("message")` and renders the pixel office canvas using the same shared engine as the web app.

```tsx
import React, { useEffect, useRef, useState } from "react";
import { buildTileMap, buildFurnitureInstances, AGENT_HOME_TILES } from "shared/engine/tileMap";
import { createGameLoop } from "shared/engine/gameLoop";
import { renderFrame } from "shared/engine/renderer";
import type { AgentInput } from "shared/engine/gameLoop";
import type { CharacterRenderState } from "shared/types";

const tileMap = buildTileMap();
const furniture = buildFurnitureInstances();
const ZOOM = 2;

interface AgentUpdate {
  id: string;
  name: string;
  agentState: string;
  paused: boolean;
  paletteIndex: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loopRef = useRef<ReturnType<typeof createGameLoop> | null>(null);
  const latestChars = useRef<CharacterRenderState[]>([]);
  const [agents, setAgents] = useState<AgentUpdate[]>([]);
  const agentsRef = useRef<AgentUpdate[]>([]);
  agentsRef.current = agents;

  // Init game loop once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const loop = createGameLoop(tileMap, AGENT_HOME_TILES, (chars) => {
      latestChars.current = chars;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderFrame(ctx, tileMap, furniture, chars, 0, 0, ZOOM);
    });

    loopRef.current = loop;
    loop.start();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      loop.stop();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Feed agents to game loop when state changes
  useEffect(() => {
    const inputs: AgentInput[] = agents.map(a => ({
      id: a.id,
      name: a.name,
      agentState: a.agentState,
      paused: a.paused,
      paletteIndex: a.paletteIndex,
    }));
    loopRef.current?.setAgents(inputs);
  }, [agents]);

  // Listen for messages from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as { type: string; agents?: AgentUpdate[] };
      if (msg.type === "agents" && msg.agents) {
        setAgents(msg.agents);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
```

- [ ] **Step 2: Build the webview**

```bash
cd extension/webview-ui && pnpm build
```

Expected: `dist/index.html` and `dist/assets/index.js` created, no errors.

- [ ] **Step 3: Do a full extension build**

```bash
cd extension && pnpm build
```

Expected: `out/extension.js` + `webview-ui/dist/` both present, no errors.

- [ ] **Step 4: Commit**

```bash
git add extension/webview-ui/src/App.tsx
git commit -m "feat(extension): webview App — pixel canvas using shared engine"
```

---

## Task 8: Wire tsconfig paths for shared/ in webview

The Vite alias handles runtime, but TypeScript needs the path too.

**Files:**
- Create: `extension/webview-ui/tsconfig.json`

- [ ] **Step 1: Create `extension/webview-ui/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "shared/*": ["../../shared/*"]
    }
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Verify webview TypeScript**

```bash
cd extension/webview-ui && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/webview-ui/tsconfig.json
git commit -m "feat(extension): webview tsconfig — shared/ path alias"
```

---

## Task 9: Manual install + smoke test

**Files:** none created

- [ ] **Step 1: Build everything**

```bash
cd extension && pnpm build
```

Expected: `out/extension.js` + `webview-ui/dist/index.html` present.

- [ ] **Step 2: Open extension in VS Code**

In VS Code, open the `extension/` folder. Press `F5` to launch the Extension Development Host window.

Expected: new VS Code window opens.

- [ ] **Step 3: Open panel**

In the Extension Development Host window, open Command Palette (`Cmd+Shift+P`) → type `OrbiAgents: Open Panel` → press Enter.

Expected: pixel office canvas opens in an editor tab, 5 agents visible and idle.

- [ ] **Step 4: Trigger a live agent**

In the Extension Development Host window, open a terminal and run any Claude Code command (or manually append a JSONL line to a file in `~/.claude/projects/` to simulate):

```bash
echo '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Bash","id":"x","input":{}}]}}' >> ~/.claude/projects/test-session/test.jsonl
```

Expected: one agent in the canvas changes state from idle to `coding` within 1-2 seconds.

- [ ] **Step 5: Verify idle timer**

Wait 6 seconds after Step 4.

Expected: agent returns to `idle` state automatically.

- [ ] **Step 6: Commit**

```bash
git add extension/
git commit -m "feat(extension): complete — transcript watcher + pixel canvas in VS Code"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Extension host activates on startup — `activationEvents: onStartupFinished`
- ✅ `orbiagents.openPanel` command — `extension.ts`
- ✅ Status bar item — `extension.ts`
- ✅ Watches `~/.claude/projects/*.jsonl` — `transcriptWatcher.ts`
- ✅ Maps tool calls → agent states — `agentMapper.ts`
- ✅ 5s idle timer — `transcriptWatcher.ts`
- ✅ WebviewPanel — `panel.ts`
- ✅ Pixel canvas using shared engine — `App.tsx`
- ✅ Session → agent slot mapping (round-robin) — `extension.ts`

**Placeholder scan:** None found.

**Type consistency:**
- `AgentInput` (from `shared/engine/gameLoop.ts`) used correctly in `App.tsx`
- `AgentUpdate` interface defined in both `panel.ts` and `App.tsx` — identical shape
- `AgentState` from `agentMapper.ts` flows through `TranscriptWatcher` → `extension.ts` → `panel.ts` → webview
