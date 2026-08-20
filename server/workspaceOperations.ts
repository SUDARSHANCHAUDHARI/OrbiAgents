import path from "node:path";
import { ProcessRunner, SpawnProcessRunner } from "./processRunner";

export class WorkspaceOperations {
  constructor(
    private readonly repoPath: string,
    private readonly worktreeRoot: string,
    private readonly runner: ProcessRunner = new SpawnProcessRunner(new Set(["git"]))
  ) {}

  async inspect(worktreePath: string): Promise<{ status: string; diffStat: string }> {
    this.assertManagedPath(worktreePath);
    const [status, diffStat] = await Promise.all([
      this.runner.run({ command: "git", args: ["-C", worktreePath, "status", "--short"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--stat"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
    ]);
    return { status: status.stdout, diffStat: diffStat.stdout };
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

export function configuredWorkspaceOperations(env: NodeJS.ProcessEnv = process.env): WorkspaceOperations {
  if (env.LOCAL_CLI_ENABLED !== "true" || !env.LOCAL_CLI_REPO_PATH || !env.LOCAL_CLI_WORKTREE_ROOT) {
    throw new Error("Local workspace operations are not enabled");
  }
  return new WorkspaceOperations(env.LOCAL_CLI_REPO_PATH, env.LOCAL_CLI_WORKTREE_ROOT);
}
