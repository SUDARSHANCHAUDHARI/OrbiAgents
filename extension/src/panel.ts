import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface AgentUpdate {
  id: string;
  name: string;
  agentState: string;
  paused: boolean;
  paletteIndex: number;
  activeToolName?: string;
}

type WebviewMessageCallback = (msg: Record<string, unknown>) => void;
const webviewListeners: WebviewMessageCallback[] = [];

/** Register a listener for messages posted by any webview (panel or view). Returns dispose fn. */
export function onWebviewMessage(cb: WebviewMessageCallback): () => void {
  webviewListeners.push(cb);
  return () => {
    const idx = webviewListeners.indexOf(cb);
    if (idx !== -1) webviewListeners.splice(idx, 1);
  };
}

function dispatchMessage(msg: Record<string, unknown>): void {
  for (const cb of webviewListeners) cb(msg);
}

// ── Shared HTML generation ────────────────────────────────────────────────

// Base options shared by both panel and view provider
function buildBaseOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "webview-ui", "dist")],
  };
}

// Panel-specific options (includes retainContextWhenHidden which is WebviewPanelOptions)
function buildPanelOptions(extensionUri: vscode.Uri): vscode.WebviewPanelOptions & vscode.WebviewOptions {
  return { ...buildBaseOptions(extensionUri), retainContextWhenHidden: true };
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const distUri = vscode.Uri.joinPath(extensionUri, "webview-ui", "dist");
  const indexPath = path.join(distUri.fsPath, "index.html");

  if (!fs.existsSync(indexPath)) {
    return fallbackHtml("Webview not built yet. Run: pnpm build");
  }

  let html: string;
  try {
    html = fs.readFileSync(indexPath, "utf8");
  } catch {
    return fallbackHtml("Could not read webview. Try rebuilding.");
  }

  // Rewrite asset paths to webview-safe URIs
  const distWebUri = webview.asWebviewUri(distUri).toString();
  html = html.replace(/(src|href)="(\/[^"]*|\.\/[^"]*|assets\/[^"]*)"/g, (_, attr, p) => {
    const bare = p.startsWith("/") ? p.slice(1) : p.startsWith("./") ? p.slice(2) : p;
    return `${attr}="${distWebUri}/${bare}"`;
  });
  return html;
}

function fallbackHtml(message: string): string {
  return `<html><body style="background:#0d0907;color:#a78bfa;font-family:monospace;padding:24px">
    <h2>OrbiAgents</h2><p>${message}</p>
  </body></html>`;
}

// ── WebviewPanel (tab opened by command) ─────────────────────────────────

export class OrbiPanel {
  static currentPanel: OrbiPanel | undefined;

  /** For backward compat: wires extension.ts message handling. */
  static onWebviewMessage(cb: WebviewMessageCallback): () => void {
    return onWebviewMessage(cb);
  }

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri): OrbiPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (OrbiPanel.currentPanel) {
      OrbiPanel.currentPanel.panel.reveal(column);
      return OrbiPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "orbiagents",
      "OrbiAgents",
      column,
      buildPanelOptions(extensionUri),
    );

    OrbiPanel.currentPanel = new OrbiPanel(panel, extensionUri);
    return OrbiPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.panel.webview.html = getWebviewHtml(panel.webview, extensionUri);
    this.panel.onDidDispose(() => this.dispose());
    this.panel.webview.onDidReceiveMessage(
      (msg: Record<string, unknown>) => dispatchMessage(msg),
      undefined,
      this.disposables,
    );
  }

  sendAgents(agents: AgentUpdate[]): void {
    this.panel.webview.postMessage({ type: "agents", agents });
  }

  sendDiagnostics(payload: Record<string, unknown>): void {
    this.panel.webview.postMessage({ type: "diagnostics", payload });
  }

  dispose(): void {
    if (!OrbiPanel.currentPanel) return;
    OrbiPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}

// ── WebviewViewProvider (VS Code panel / sidebar view) ───────────────────

export class OrbiViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "orbiagents.panelView";
  static currentView: vscode.WebviewView | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    OrbiViewProvider.currentView = webviewView;

    webviewView.webview.options = buildBaseOptions(this.extensionUri);
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri);

    webviewView.webview.onDidReceiveMessage(
      (msg: Record<string, unknown>) => dispatchMessage(msg),
    );

    webviewView.onDidDispose(() => {
      OrbiViewProvider.currentView = undefined;
    });
  }

  sendAgents(agents: AgentUpdate[]): void {
    OrbiViewProvider.currentView?.webview.postMessage({ type: "agents", agents });
  }

  sendDiagnostics(payload: Record<string, unknown>): void {
    OrbiViewProvider.currentView?.webview.postMessage({ type: "diagnostics", payload });
  }
}
