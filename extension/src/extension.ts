import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { AgentUpdate, OrbiPanel, OrbiViewProvider, onWebviewMessage } from "./panel";
import { TranscriptWatcher } from "./transcriptWatcher";
import { HookServer } from "./hookServer";
import { installHooks, uninstallHooks, copyHookScript } from "./hookInstaller";
import { hookEventToState, isExemptTool } from "./agentMapper";
import { PermissionTimer } from "./permissionTimer";

// 5 named agents matching the web app
const AGENT_NAMES = ["Orbi-Alpha", "Orbi-Beta", "Orbi-Gamma", "Orbi-Delta", "Orbi-Epsilon"];
// Sub-agent names cycle through this list
const SUB_AGENT_NAMES = ["Sub-A", "Sub-B", "Sub-C", "Sub-D", "Sub-E", "Sub-F", "Sub-G", "Sub-H"];

const ASSET_PACK_FILENAME = "orbiagents-pack.json";

interface AssetPackItem {
  id: string;
  label: string;
}

interface AssetPack {
  version: number;
  items: AssetPackItem[];
}

function makeAgents(): AgentUpdate[] {
  return AGENT_NAMES.map((name, i) => ({
    id: String(i + 1),
    name,
    agentState: "idle",
    paused: false,
    paletteIndex: i,
  }));
}

/** Pick a workspace folder. Shows a quick pick when multiple folders are open. */
async function pickWorkspaceFolder(): Promise<string | null> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;
  if (folders.length === 1) return folders[0].uri.fsPath;

  const picked = await vscode.window.showWorkspaceFolderPick({
    placeHolder: "Select workspace folder for OrbiAgents",
  });
  return picked?.uri.fsPath ?? null;
}

/** Scan the workspace root for an external asset pack config file. */
function loadAssetPack(workspaceRoot: string): AssetPack | null {
  const packPath = path.join(workspaceRoot, ASSET_PACK_FILENAME);
  try {
    if (!fs.existsSync(packPath)) return null;
    const raw = fs.readFileSync(packPath, "utf-8");
    return JSON.parse(raw) as AssetPack;
  } catch {
    return null;
  }
}

export function activate(context: vscode.ExtensionContext) {
  let agents = makeAgents();
  const watcher = new TranscriptWatcher();
  const hookServer = new HookServer();
  const permissionTimer = new PermissionTimer();
  const viewProvider = new OrbiViewProvider(context.extensionUri);
  let statusBar: vscode.StatusBarItem;
  let hookEventsReceived = 0;
  let activeSessionCount = 0;
  let selectedWorkspaceFolder: string | null = null;
  let assetPack: AssetPack | null = null;
  let terminalCounter = 0;

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

  // Sub-agents keyed by parent sessionId
  const subAgentsBySession = new Map<string, AgentUpdate[]>();
  let subAgentCounter = 0;

  function slotForSession(sessionId: string): number {
    if (!sessionSlots.has(sessionId)) {
      sessionSlots.set(sessionId, nextSlot % AGENT_NAMES.length);
      nextSlot++;
      activeSessionCount = sessionSlots.size;
    }
    return sessionSlots.get(sessionId) ?? 0;
  }

  function allAgents(): AgentUpdate[] {
    const subs: AgentUpdate[] = [];
    for (const list of subAgentsBySession.values()) subs.push(...list);
    return [...agents, ...subs];
  }

  function broadcast() {
    const all = allAgents();
    const active = all.filter(a => a.agentState !== "idle").length;
    statusBar.text = active > 0
      ? `$(robot) OrbiAgents ● ${active} active`
      : "$(robot) OrbiAgents";
    OrbiPanel.currentPanel?.sendAgents(all);
    viewProvider.sendAgents(all);
  }

  function updateAgentState(sessionId: string, state: string, toolName?: string) {
    const slot = slotForSession(sessionId);
    agents = agents.map((a, i) =>
      i === slot
        ? { ...a, agentState: state, activeToolName: toolName ?? (state === "idle" ? undefined : a.activeToolName) }
        : a
    );
    broadcast();
  }

  function spawnSubAgent(parentSessionId: string) {
    const id = `sub-${parentSessionId}-${++subAgentCounter}`;
    const name = SUB_AGENT_NAMES[subAgentCounter % SUB_AGENT_NAMES.length];
    const paletteIndex = (AGENT_NAMES.length + subAgentCounter) % 5;
    const sub: AgentUpdate = { id, name, agentState: "thinking", paused: false, paletteIndex };
    const existing = subAgentsBySession.get(parentSessionId) ?? [];
    subAgentsBySession.set(parentSessionId, [...existing, sub]);
    broadcast();
  }

  function despawnSubAgent(parentSessionId: string) {
    const existing = subAgentsBySession.get(parentSessionId);
    if (!existing || existing.length === 0) return;
    subAgentsBySession.set(parentSessionId, existing.slice(0, -1));
    broadcast();
  }

  function buildDiagnostics() {
    const cfg = hookServer.getConfig();
    const hooksInstalled = (() => {
      try {
        const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
        if (!fs.existsSync(settingsPath)) return false;
        const raw = JSON.parse(fs.readFileSync(settingsPath, "utf-8")) as { hooks?: Record<string, unknown[]> };
        if (!raw.hooks) return false;
        return Object.values(raw.hooks).some(arr =>
          Array.isArray(arr) && arr.some((e: unknown) =>
            typeof e === "object" && e !== null &&
            "hooks" in e && Array.isArray((e as Record<string, unknown>).hooks) &&
            ((e as Record<string, unknown[]>).hooks as Array<{ command?: string }>).some(h =>
              typeof h.command === "string" && h.command.includes("claude-hook.js")
            )
          )
        );
      } catch {
        return false;
      }
    })();

    return {
      hookServerPort: cfg?.port ?? null,
      hookServerOwner: hookServer.ownsServer,
      hookServerPid: cfg?.pid ?? null,
      hookEventsReceived,
      activeSessions: activeSessionCount,
      hooksInstalled,
      watcherRunning: true,
      uptime: cfg?.startedAt ? Math.floor((Date.now() - cfg.startedAt) / 1000) : 0,
      workspaceFolder: selectedWorkspaceFolder,
      assetPackLoaded: assetPack !== null,
      assetPackItems: assetPack?.items.length ?? 0,
    };
  }

  // ── Hook events (primary, real-time) ──────────────────────────────────
  hookServer.onHookEvent((event) => {
    hookEventsReceived++;
    const sessionId = event.session_id as string;
    const eventName = event.hook_event_name as string;
    const toolName = event.tool_name as string | undefined;
    const notifType = event.notification_type as string | undefined;

    if (eventName === "SubagentStart") {
      watcher.markHookDelivered(sessionId);
      spawnSubAgent(sessionId);
      return;
    }
    if (eventName === "SubagentStop") {
      watcher.markHookDelivered(sessionId);
      despawnSubAgent(sessionId);
      return;
    }

    if (eventName === "PreToolUse" && toolName) {
      if (isExemptTool(toolName)) {
        permissionTimer.clear(sessionId);
      } else {
        permissionTimer.start(sessionId, () => updateAgentState(sessionId, "permission-waiting"));
      }
    } else if (
      eventName === "PostToolUse" ||
      eventName === "PostToolUseFailure" ||
      eventName === "PermissionRequest" ||
      eventName === "Stop" ||
      eventName === "SessionEnd" ||
      (eventName === "Notification" && notifType === "idle_prompt")
    ) {
      permissionTimer.clear(sessionId);
    }

    if (eventName === "SessionEnd") {
      sessionSlots.delete(sessionId);
      activeSessionCount = sessionSlots.size;
    }

    const state = hookEventToState(eventName, toolName, notifType);
    if (!state) return;

    watcher.markHookDelivered(sessionId);
    updateAgentState(sessionId, state, eventName === "PreToolUse" ? toolName : undefined);
  });

  // ── JSONL transcript watcher (fallback) ────────────────────────────────
  watcher.onActivity(({ sessionId, state, toolName }) => {
    if (state === "coding") {
      permissionTimer.start(sessionId, () => updateAgentState(sessionId, "permission-waiting"));
    } else {
      permissionTimer.clear(sessionId);
    }
    updateAgentState(sessionId, state, toolName);
  });

  watcher.start();
  context.subscriptions.push({ dispose: () => watcher.stop() });

  hookServer.start().then(() => {
    if (copyHookScript(context.extensionPath)) {
      installHooks();
    }
  }).catch((e: unknown) => {
    console.error("[OrbiAgents] Failed to start hook server:", e);
  });

  context.subscriptions.push({
    dispose: () => {
      hookServer.stop();
      permissionTimer.clearAll();
      uninstallHooks();
    },
  });

  // Handle messages coming from any webview surface (panel tab or view provider)
  context.subscriptions.push({
    dispose: onWebviewMessage((msg) => {
      if (msg.type === "requestDiagnostics") {
        const payload = buildDiagnostics() as unknown as Record<string, unknown>;
        OrbiPanel.currentPanel?.sendDiagnostics(payload);
        viewProvider.sendDiagnostics(payload);
      }

      if (msg.type === "launchAgent") {
        const folder = selectedWorkspaceFolder ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!folder) {
          vscode.window.showWarningMessage("OrbiAgents: No workspace folder found. Use 'OrbiAgents: Pick Workspace Folder' first.");
          return;
        }
        terminalCounter++;
        const terminal = vscode.window.createTerminal({
          name: `Claude Code #${terminalCounter}`,
          cwd: folder,
        });
        terminal.sendText("claude");
        terminal.show();
      }
    }),
  });

  // ── View provider (VS Code panel/sidebar view) ────────────────────────
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(OrbiViewProvider.viewId, viewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // ── Commands ──────────────────────────────────────────────────────────

  // Open panel
  const cmdOpen = vscode.commands.registerCommand("orbiagents.openPanel", () => {
    const panel = OrbiPanel.createOrShow(context.extensionUri);
    panel.sendAgents(allAgents());
  });
  context.subscriptions.push(cmdOpen);

  // Launch Claude without permission prompts
  const cmdBypass = vscode.commands.registerCommand("orbiagents.launchWithoutPermissions", async () => {
    const folder = selectedWorkspaceFolder ?? await pickWorkspaceFolder();
    if (!folder) {
      vscode.window.showWarningMessage("OrbiAgents: No workspace folder selected.");
      return;
    }
    const confirm = await vscode.window.showWarningMessage(
      "Launch Claude Code with --dangerously-skip-permissions? This bypasses all permission checks.",
      { modal: true },
      "Launch"
    );
    if (confirm !== "Launch") return;

    const terminal = vscode.window.createTerminal({
      name: "Claude (no-permissions)",
      cwd: folder,
    });
    terminal.sendText("claude --dangerously-skip-permissions");
    terminal.show();
  });
  context.subscriptions.push(cmdBypass);

  // Pick workspace folder for OrbiAgents to track
  const cmdPickFolder = vscode.commands.registerCommand("orbiagents.pickWorkspaceFolder", async () => {
    const folder = await pickWorkspaceFolder();
    if (!folder) return;
    selectedWorkspaceFolder = folder;

    // Try to load an asset pack from the selected folder
    const pack = loadAssetPack(folder);
    if (pack) {
      assetPack = pack;
      vscode.window.showInformationMessage(
        `OrbiAgents: Asset pack loaded — ${pack.items.length} custom items from ${ASSET_PACK_FILENAME}`
      );
    }

    vscode.window.showInformationMessage(`OrbiAgents: Tracking workspace folder "${path.basename(folder)}"`);
    statusBar.tooltip = `OrbiAgents — ${path.basename(folder)}`;
  });
  context.subscriptions.push(cmdPickFolder);

  // Show connection diagnostics in notification
  const cmdDiag = vscode.commands.registerCommand("orbiagents.showDiagnostics", async () => {
    const diag = buildDiagnostics();
    const lines = [
      `Hook server: ${diag.hookServerPort ? `port ${diag.hookServerPort} (${diag.hookServerOwner ? "owner" : "secondary"})` : "stopped"}`,
      `Events received: ${diag.hookEventsReceived}`,
      `Active sessions: ${diag.activeSessions}`,
      `Hooks installed: ${diag.hooksInstalled ? "yes" : "no"}`,
      `Asset pack: ${diag.assetPackLoaded ? `${diag.assetPackItems} items` : "none"}`,
    ];
    vscode.window.showInformationMessage(`OrbiAgents Diagnostics — ${lines.join(" | ")}`);
  });
  context.subscriptions.push(cmdDiag);

  // Auto-pick single workspace folder at startup (multi-root: wait for explicit pick)
  if (vscode.workspace.workspaceFolders?.length === 1) {
    selectedWorkspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const pack = loadAssetPack(selectedWorkspaceFolder);
    if (pack) {
      assetPack = pack;
      console.log(`[OrbiAgents] Asset pack loaded: ${pack.items.length} items from ${selectedWorkspaceFolder}`);
    }
  }
}

export function deactivate() {}
