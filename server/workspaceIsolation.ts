import path from "node:path";
import { ProcessRunner } from "./processRunner";

export interface WorkspaceLease {
  id: string;
  path: string;
  release(): Promise<void>;
}

export interface WorkspaceIsolation {
  acquire(runId: string, agentId: string): Promise<WorkspaceLease>;
}

export class NoopWorkspaceIsolation implements WorkspaceIsolation {
  constructor(private readonly workspacePath: string) {}

  async acquire(runId: string, agentId: string): Promise<WorkspaceLease> {
    return {
      id: `${runId}:${agentId}`,
      path: this.workspacePath,
      async release() {},
    };
  }
}

export interface WorktreeCommandRunner {
  add(repoPath: string, worktreePath: string, branchName: string): Promise<void>;
  remove(repoPath: string, worktreePath: string): Promise<void>;
}

export class GitCliWorktreeCommandRunner implements WorktreeCommandRunner {
  constructor(private readonly processRunner: ProcessRunner) {}

  async add(repoPath: string, worktreePath: string, branchName: string): Promise<void> {
    await this.processRunner.run({
      command: "git",
      args: ["-C", repoPath, "worktree", "add", "-b", branchName, worktreePath, "HEAD"],
      cwd: repoPath,
    });
  }

  async remove(repoPath: string, worktreePath: string): Promise<void> {
    await this.processRunner.run({
      command: "git",
      args: ["-C", repoPath, "worktree", "remove", worktreePath],
      cwd: repoPath,
    });
  }
}

export class GitWorktreeIsolation implements WorkspaceIsolation {
  constructor(
    private readonly repoPath: string,
    private readonly worktreeRoot: string,
    private readonly runner: WorktreeCommandRunner
  ) {}

  async acquire(runId: string, agentId: string): Promise<WorkspaceLease> {
    const safeRun = safeSegment(runId);
    const safeAgent = safeSegment(agentId);
    const leaseId = `${safeRun}-${safeAgent}`;
    const worktreePath = path.resolve(this.worktreeRoot, leaseId);
    const root = path.resolve(this.worktreeRoot) + path.sep;
    if (!worktreePath.startsWith(root)) throw new Error("Worktree path escaped isolation root");
    const branchName = `orbi/${leaseId}`;
    await this.runner.add(this.repoPath, worktreePath, branchName);
    let released = false;
    return {
      id: leaseId,
      path: worktreePath,
      release: async () => {
        if (released) return;
        released = true;
        await this.runner.remove(this.repoPath, worktreePath);
      },
    };
  }
}

function safeSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error("Invalid workspace isolation identifier");
  }
  return normalized.slice(0, 64);
}
