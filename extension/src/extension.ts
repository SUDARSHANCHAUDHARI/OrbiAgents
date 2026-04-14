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
    if (copyHookScript(context.extensionPath)) {
      installHooks();
    }
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
