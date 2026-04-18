import { _electron as electron, ElectronApplication, Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface VSCodeSession {
  app: ElectronApplication;
  window: Page;
  tmpHome: string;
  cleanup: () => Promise<void>;
}

/**
 * Launch a VS Code window with OrbiAgents loaded in a temp workspace.
 * Isolated HOME prevents touching the real user's Claude settings.
 */
export async function launchVSCode(testTitle: string): Promise<VSCodeSession> {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "orbiagents-e2e-"));
  const tmpWorkspace = path.join(tmpHome, "workspace");
  fs.mkdirSync(tmpWorkspace, { recursive: true });

  // Point to locally installed VS Code or vscode-test binary
  const vscodeExecutable = process.env.VSCODE_EXECUTABLE_PATH ?? "code";

  const app = await electron.launch({
    executablePath: vscodeExecutable,
    args: [
      "--extensionDevelopmentPath=" + path.resolve(__dirname, "../../"),
      "--user-data-dir=" + path.join(tmpHome, ".vscode-user"),
      "--no-sandbox",
      tmpWorkspace,
    ],
    env: {
      ...process.env,
      HOME: tmpHome,
    },
  });

  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");

  return {
    app,
    window,
    tmpHome,
    cleanup: async () => {
      await app.close().catch(() => {});
      fs.rmSync(tmpHome, { recursive: true, force: true });
    },
  };
}

/** Wait until the VS Code workbench shell is rendered. */
export async function waitForWorkbench(window: Page): Promise<void> {
  await window.waitForSelector(".monaco-workbench", { timeout: 30_000 });
}
