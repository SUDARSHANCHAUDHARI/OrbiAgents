import { copyFile, lstat, mkdir, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { AgentWorkspace, WorkspaceChanges } from "../../shared/contracts";

export interface GitRunner {
  run(args: string[], cwd: string, maxOutputBytes?: number, stdin?: string): Promise<string>;
}

export interface WorkspaceLease {
  workspace: AgentWorkspace;
  release(): Promise<AgentWorkspace>;
}

export interface WorkspaceProvider {
  acquire(agentId: string, sourcePath: string, isolated: boolean): Promise<WorkspaceLease>;
  apply?(workspace: AgentWorkspace, files: string[], untrackedFiles: string[]): Promise<void>;
  discard?(workspace: AgentWorkspace): Promise<AgentWorkspace>;
}

export class WorkspaceManager implements WorkspaceProvider {
  constructor(private readonly root: string, private readonly git: GitRunner = new NativeGitRunner()) {}

  async acquire(agentId: string, sourcePath: string, isolated: boolean): Promise<WorkspaceLease> {
    if (!isolated) {
      const workspace: AgentWorkspace = { sourcePath, path: sourcePath, status: "direct" };
      return { workspace, async release() { return workspace; } };
    }
    const topLevel = (await this.git.run(["-C", sourcePath, "rev-parse", "--show-toplevel"], sourcePath)).trim();
    if (!topLevel) throw new Error("Workspace is not a Git repository");
    await mkdir(this.root, { recursive: true });
    const worktreePath = path.resolve(this.root, agentId);
    const rootPrefix = path.resolve(this.root) + path.sep;
    if (!worktreePath.startsWith(rootPrefix)) throw new Error("Worktree path escaped the managed root");
    const branch = `codex/orbi-${agentId}`;
    await this.git.run(["-C", topLevel, "worktree", "add", "-b", branch, worktreePath, "HEAD"], topLevel);
    let released = false;
    const active: AgentWorkspace = { sourcePath: topLevel, path: worktreePath, branch, status: "active" };
    let finalWorkspace = active;
    return {
      workspace: active,
      release: async () => {
        if (released) return finalWorkspace;
        released = true;
        const changes = await this.inspect(worktreePath, topLevel);
        if (changes.status.trim()) {
          finalWorkspace = { ...active, status: "preserved", changes };
          return finalWorkspace;
        }
        await this.git.run(["-C", topLevel, "worktree", "remove", worktreePath], topLevel);
        finalWorkspace = { ...active, status: "cleaned", changes };
        return finalWorkspace;
      },
    };
  }

  async inspectPreserved(workspace: AgentWorkspace): Promise<AgentWorkspace> {
    if (workspace.status !== "preserved") return workspace;
    this.assertManagedPath(workspace.path);
    const changes = await this.inspect(workspace.path, workspace.sourcePath);
    return { ...workspace, changes };
  }

  async apply(workspace: AgentWorkspace, files: string[], untrackedFiles: string[]): Promise<void> {
    if (workspace.status !== "preserved") throw new Error("Only preserved workspaces can be applied");
    this.assertManagedPath(workspace.path);
    if (files.length + untrackedFiles.length === 0) throw new Error("Select at least one changed file");
    const targetStatus = await this.git.run(["-C", workspace.sourcePath, "status", "--porcelain"], workspace.sourcePath);
    if (targetStatus.trim()) throw new Error("Target repository must be clean before applying agent changes");
    const patch = files.length ? await this.git.run(["-C", workspace.path, "diff", "--binary", "--", ...files], workspace.sourcePath, 2 * 1024 * 1024) : "";
    if (files.length && !patch.trim()) throw new Error("Selected tracked files have no changes");
    if (patch) await this.git.run(["-C", workspace.sourcePath, "apply", "--check", "-"], workspace.sourcePath, 2 * 1024 * 1024, patch);
    const copies = await Promise.all(untrackedFiles.map((file) => this.preflightCopy(workspace, file)));
    const copied: string[] = [];
    try {
      for (const item of copies) { await mkdir(path.dirname(item.target), { recursive: true }); await copyFile(item.source, item.target, 1); copied.push(item.target); }
      if (patch) await this.git.run(["-C", workspace.sourcePath, "apply", "-"], workspace.sourcePath, 2 * 1024 * 1024, patch);
    } catch (error) {
      await Promise.allSettled(copied.map((file) => unlink(file)));
      throw error;
    }
  }

  async discard(workspace: AgentWorkspace): Promise<AgentWorkspace> {
    if (workspace.status !== "preserved") throw new Error("Only preserved workspaces can be discarded");
    this.assertManagedPath(workspace.path);
    await this.git.run(["-C", workspace.sourcePath, "worktree", "remove", "--force", workspace.path], workspace.sourcePath);
    return { ...workspace, status: "cleaned" };
  }

  private async inspect(worktreePath: string, repoPath: string): Promise<WorkspaceChanges> {
    const [status, diffStat, names, untracked] = await Promise.all([
      this.git.run(["-C", worktreePath, "status", "--short"], repoPath, 256_000),
      this.git.run(["-C", worktreePath, "diff", "--stat"], repoPath, 256_000),
      this.git.run(["-C", worktreePath, "diff", "--name-only", "-z"], repoPath, 256_000),
      this.git.run(["-C", worktreePath, "ls-files", "--others", "--exclude-standard", "-z"], repoPath, 256_000),
    ]);
    return { status, diffStat, files: splitNull(names), untrackedFiles: splitNull(untracked) };
  }

  private assertManagedPath(worktreePath: string): void {
    const root = path.resolve(this.root) + path.sep;
    if (!path.resolve(worktreePath).startsWith(root)) throw new Error("Workspace path is outside the managed root");
  }

  private async preflightCopy(workspace: AgentWorkspace, file: string): Promise<{ source: string; target: string }> {
    const worktree = await realpath(workspace.path); const repo = await realpath(workspace.sourcePath); const source = await realpath(path.resolve(worktree, file));
    if (!isInside(worktree, source)) throw new Error(`Untracked file escapes workspace: ${file}`);
    const info = await lstat(source);
    if (!info.isFile() || info.size > 1024 * 1024) throw new Error(`Untracked file must be a regular file under 1 MB: ${file}`);
    const target = path.resolve(repo, file);
    if (!isInside(repo, target)) throw new Error(`Target file escapes repository: ${file}`);
    let parent = repo;
    for (const segment of file.split(/[\\/]/).slice(0, -1)) {
      parent = path.join(parent, segment);
      try { if ((await lstat(parent)).isSymbolicLink()) throw new Error(`Target path contains a symbolic link: ${file}`); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") break; throw error; }
    }
    try { await lstat(target); throw new Error(`Target file already exists: ${file}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    return { source, target };
  }
}

export class NativeGitRunner implements GitRunner {
  run(args: string[], cwd: string, maxOutputBytes = 512_000, stdin = ""): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn("git", args, { cwd, shell: false, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = ""; let stderr = ""; let bytes = 0;
      const append = (target: "stdout" | "stderr", chunk: Buffer) => {
        bytes += chunk.byteLength;
        if (bytes > maxOutputBytes) { child.kill("SIGTERM"); return; }
        if (target === "stdout") stdout += chunk.toString("utf8"); else stderr += chunk.toString("utf8");
      };
      child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
      child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
      child.once("error", reject);
      child.once("close", (code) => bytes > maxOutputBytes
        ? reject(new Error(`Git output exceeded ${maxOutputBytes} bytes`))
        : code === 0 ? resolve(stdout) : reject(new Error(`Git exited with code ${code}: ${stderr.trim()}`)));
      child.stdin.end(stdin);
    });
  }
}

function splitNull(value: string): string[] { return value.split("\0").filter(Boolean); }

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
