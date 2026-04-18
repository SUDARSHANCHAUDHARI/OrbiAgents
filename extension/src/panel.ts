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

export class OrbiPanel {
  static currentPanel: OrbiPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  /** Register a listener for messages posted by the webview. Returns a dispose fn. */
  static onWebviewMessage(cb: WebviewMessageCallback): () => void {
    webviewListeners.push(cb);
    return () => {
      const idx = webviewListeners.indexOf(cb);
      if (idx !== -1) webviewListeners.splice(idx, 1);
    };
  }

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
    this.panel.onDidDispose(() => this.dispose());

    // Forward messages from the webview to registered listeners
    this.panel.webview.onDidReceiveMessage((msg: Record<string, unknown>) => {
      for (const cb of webviewListeners) cb(msg);
    }, undefined, this.disposables);
  }

  sendAgents(agents: AgentUpdate[]) {
    this.panel.webview.postMessage({ type: "agents", agents });
  }

  sendDiagnostics(payload: Record<string, unknown>) {
    this.panel.webview.postMessage({ type: "diagnostics", payload });
  }

  private getHtml(extensionUri: vscode.Uri): string {
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

    // Rewrite asset paths to webview-safe URIs (handles /, ./, and bare relative paths)
    const distWebUri = this.panel.webview.asWebviewUri(distUri).toString();
    html = html.replace(/(src|href)="(\/[^"]*|\.\/[^"]*|assets\/[^"]*)"/g, (_, attr, p) => {
      const bare = p.startsWith("/") ? p.slice(1) : p.startsWith("./") ? p.slice(2) : p;
      return `${attr}="${distWebUri}/${bare}"`;
    });
    return html;
  }

  dispose() {
    if (!OrbiPanel.currentPanel) return;
    OrbiPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

function fallbackHtml(message: string): string {
  return `<html><body style="background:#0d0907;color:#a78bfa;font-family:monospace;padding:24px">
    <h2>OrbiAgents</h2><p>${message}</p>
  </body></html>`;
}
