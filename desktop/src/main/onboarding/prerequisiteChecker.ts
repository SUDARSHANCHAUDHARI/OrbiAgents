import { access, lstat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { PrerequisiteCheck } from "../../shared/contracts";

export interface PrerequisiteReport { ready: boolean; checkedAt: number; checks: PrerequisiteCheck[]; }
export interface PrerequisiteOptions { platform?: NodeJS.Platform; environment?: NodeJS.ProcessEnv; encryptionAvailable(): boolean; now?: () => number; canExecute?(file: string): Promise<boolean>; }

export class PrerequisiteChecker {
  constructor(private readonly options: PrerequisiteOptions) {}

  async check(): Promise<PrerequisiteReport> {
    const platform = this.options.platform ?? process.platform; const environment = this.options.environment ?? process.env;
    const searchPath = [environment.PATH, "/opt/homebrew/bin", "/usr/local/bin", environment.HOME ? path.join(environment.HOME, ".local", "bin") : undefined].filter(Boolean).join(path.delimiter);
    const executables = await Promise.all(["git", "codex", "claude", "gemini", "gh"].map(async (command) => [command, await findExecutable(command, searchPath, this.options.canExecute)] as const));
    const found = Object.fromEntries(executables) as Record<string, string | undefined>;
    const runtimeNames = ["codex", "claude", "gemini"].filter((name) => found[name]);
    let encryptionAvailable = false; try { encryptionAvailable = this.options.encryptionAvailable(); } catch { encryptionAvailable = false; }
    const checks: PrerequisiteCheck[] = [
      { id: "platform", label: "macOS", required: true, status: platform === "darwin" ? "pass" : "fail", detail: platform === "darwin" ? "Supported macOS desktop platform detected." : `Current platform ${platform} is not yet supported.` },
      { id: "git", label: "Git", required: true, status: found.git ? "pass" : "fail", detail: found.git ? "Git executable is available." : "Install Git to use isolated worktrees and history." },
      { id: "agent-runtime", label: "Agent CLI", required: true, status: runtimeNames.length ? "pass" : "fail", detail: runtimeNames.length ? `Available: ${runtimeNames.join(", ")}.` : "Install at least one of Codex, Claude, or Gemini CLI." },
      ...["codex", "claude", "gemini"].map((name): PrerequisiteCheck => ({ id: name, label: `${name[0]!.toUpperCase()}${name.slice(1)} CLI`, required: false, status: found[name] ? "pass" : "warn", detail: found[name] ? `${name} is available.` : `${name} is optional and was not found.` })),
      { id: "github", label: "GitHub CLI", required: false, status: found.gh ? "pass" : "warn", detail: found.gh ? "gh is available; authentication is checked only on request." : "Install gh to enable GitHub issue and CI ingestion." },
      { id: "secure-storage", label: "Secure credential storage", required: false, status: encryptionAvailable ? "pass" : "warn", detail: encryptionAvailable ? "Operating-system encryption is available." : "Encrypted local model credentials are unavailable on this system." },
    ];
    return { ready: checks.filter((check) => check.required).every((check) => check.status === "pass"), checkedAt: (this.options.now ?? Date.now)(), checks };
  }
}

export async function findExecutable(command: string, pathValue: string | undefined, canExecute: (file: string) => Promise<boolean> = defaultCanExecute): Promise<string | undefined> {
  if (!/^[a-z0-9-]+$/.test(command) || !pathValue) return undefined;
  for (const directory of [...new Set(pathValue.split(path.delimiter).filter((entry) => path.isAbsolute(entry)))]) {
    const candidate = path.join(directory, command); if (await canExecute(candidate)) return candidate;
  }
  return undefined;
}
async function defaultCanExecute(file: string): Promise<boolean> { try { return (await lstat(file)).isFile() && await access(file, constants.X_OK).then(() => true, () => false); } catch { return false; } }
