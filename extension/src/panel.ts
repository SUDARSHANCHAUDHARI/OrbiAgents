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
