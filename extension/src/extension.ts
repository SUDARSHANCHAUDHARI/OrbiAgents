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
    return sessionSlots.get(sessionId) ?? 0;
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
