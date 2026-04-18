import * as vscode from "vscode";
import { OrbiPanel, AgentUpdate } from "./panel";
import { TranscriptWatcher } from "./transcriptWatcher";
import { HookServer } from "./hookServer";
import { installHooks, uninstallHooks, copyHookScript } from "./hookInstaller";
import { hookEventToState, isExemptTool } from "./agentMapper";
import { PermissionTimer } from "./permissionTimer";

// 5 named agents matching the web app
const AGENT_NAMES = ["Orbi-Alpha", "Orbi-Beta", "Orbi-Gamma", "Orbi-Delta", "Orbi-Epsilon"];
// Sub-agent names cycle through this list
const SUB_AGENT_NAMES = ["Sub-A", "Sub-B", "Sub-C", "Sub-D", "Sub-E", "Sub-F", "Sub-G", "Sub-H"];

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
  const permissionTimer = new PermissionTimer();
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

  // Sub-agents keyed by parent sessionId
  const subAgentsBySession = new Map<string, AgentUpdate[]>();
  let subAgentCounter = 0;

  function slotForSession(sessionId: string): number {
    if (!sessionSlots.has(sessionId)) {
      sessionSlots.set(sessionId, nextSlot % AGENT_NAMES.length);
      nextSlot++;
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

  // ── Hook events (primary, real-time) ──────────────────────────────────
  hookServer.onHookEvent((event) => {
    const sessionId = event.session_id as string;
    const eventName = event.hook_event_name as string;
    const toolName = event.tool_name as string | undefined;
    const notifType = event.notification_type as string | undefined;

    // Sub-agent lifecycle handled separately — don't map to a parent agent state
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

    // Permission timer management:
    // - Non-exempt PreToolUse → start 7s countdown
    // - Exempt PreToolUse → clear (no permission needed)
    // - PostToolUse / PermissionRequest / Stop / SessionEnd / idle Notification → clear
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

    const state = hookEventToState(eventName, toolName, notifType);
    if (!state) return;

    // Tell the JSONL watcher to stop firing idle timers for this session
    watcher.markHookDelivered(sessionId);
    // Pass tool name only for PreToolUse events so overlay shows the active tool
    updateAgentState(sessionId, state, eventName === "PreToolUse" ? toolName : undefined);
  });

  // ── JSONL transcript watcher (fallback when hooks unavailable) ─────────
  watcher.onActivity(({ sessionId, state, toolName }) => {
    if (state === "coding") {
      permissionTimer.start(sessionId, () => updateAgentState(sessionId, "permission-waiting"));
    } else {
      permissionTimer.clear(sessionId);
    }
    updateAgentState(sessionId, state, toolName);
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
      permissionTimer.clearAll();
      uninstallHooks();
    },
  });

  // Register open-panel command
  const cmd = vscode.commands.registerCommand("orbiagents.openPanel", () => {
    const panel = OrbiPanel.createOrShow(context.extensionUri);
    panel.sendAgents(allAgents());
  });
  context.subscriptions.push(cmd);
}

export function deactivate() {}
