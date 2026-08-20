import path from "node:path";
import { ProcessRunner, SpawnProcessRunner } from "./processRunner";

export class WorkspaceOperations {
  constructor(
    private readonly repoPath: string,
    private readonly worktreeRoot: string,
    private readonly runner: ProcessRunner = new SpawnProcessRunner(new Set(["git"]))
  ) {}

  async inspect(worktreePath: string): Promise<{ status: string; diffStat: string; patch: string; files: string[] }> {
    this.assertManagedPath(worktreePath);
    const [status, diffStat, patch, names] = await Promise.all([
      this.runner.run({ command: "git", args: ["-C", worktreePath, "status", "--short"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--stat"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--no-color"], cwd: this.repoPath, maxOutputBytes: 512_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--name-only", "-z"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
    ]);
    return { status: status.stdout, diffStat: diffStat.stdout, patch: patch.stdout, files: names.stdout.split("\0").filter(Boolean) };
  }

  async applyFiles(worktreePath: string, files: string[]): Promise<void> {
    this.assertManagedPath(worktreePath);
    const safeFiles = files.map(validateRelativeFile);
    if (safeFiles.length === 0) throw new Error("At least one file is required");
    const targetStatus = await this.runner.run({ command: "git", args: ["-C", this.repoPath, "status", "--porcelain"], cwd: this.repoPath });
    if (targetStatus.stdout.trim()) throw new Error("Target repository must be clean before applying agent changes");
    const diff = await this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--binary", "--", ...safeFiles], cwd: this.repoPath, maxOutputBytes: 2 * 1024 * 1024 });
    if (!diff.stdout.trim()) throw new Error("Selected files have no tracked changes");
    await this.runner.run({ command: "git", args: ["-C", this.repoPath, "apply", "--check", "-"], cwd: this.repoPath, stdin: diff.stdout });
    await this.runner.run({ command: "git", args: ["-C", this.repoPath, "apply", "-"], cwd: this.repoPath, stdin: diff.stdout });
  }

  async discard(worktreePath: string): Promise<void> {
    this.assertManagedPath(worktreePath);
    await this.runner.run({
      command: "git",
      args: ["-C", this.repoPath, "worktree", "remove", "--force", worktreePath],
      cwd: this.repoPath,
    });
  }

  private assertManagedPath(worktreePath: string): void {
    const root = path.resolve(this.worktreeRoot) + path.sep;
    const resolved = path.resolve(worktreePath);
    if (!resolved.startsWith(root)) throw new Error("Workspace path is outside the managed root");
  }
}

function validateRelativeFile(file: string): string {
  const normalized = file.trim();
  if (!normalized || path.isAbsolute(normalized) || normalized.split(/[\\/]/).includes("..")) {
    throw new Error(`Unsafe file path: ${file}`);
  }
  return normalized;
}

export function configuredWorkspaceOperations(env: NodeJS.ProcessEnv = process.env): WorkspaceOperations {
  if (env.LOCAL_CLI_ENABLED !== "true" || !env.LOCAL_CLI_REPO_PATH || !env.LOCAL_CLI_WORKTREE_ROOT) {
    throw new Error("Local workspace operations are not enabled");
  }
  return new WorkspaceOperations(env.LOCAL_CLI_REPO_PATH, env.LOCAL_CLI_WORKTREE_ROOT);
}
