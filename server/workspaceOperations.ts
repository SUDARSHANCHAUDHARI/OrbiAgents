import path from "node:path";
import { copyFile, lstat, mkdir, realpath, unlink } from "node:fs/promises";
import { ProcessRunner, SpawnProcessRunner } from "./processRunner";

export class WorkspaceOperations {
  constructor(
    private readonly repoPath: string,
    private readonly worktreeRoot: string,
    private readonly runner: ProcessRunner = new SpawnProcessRunner(new Set(["git"]))
  ) {}

  async inspect(worktreePath: string): Promise<{ status: string; diffStat: string; patch: string; files: string[]; untrackedFiles: string[] }> {
    this.assertManagedPath(worktreePath);
    const [status, diffStat, patch, names, untracked] = await Promise.all([
      this.runner.run({ command: "git", args: ["-C", worktreePath, "status", "--short"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--stat"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--no-color"], cwd: this.repoPath, maxOutputBytes: 512_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--name-only", "-z"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "ls-files", "--others", "--exclude-standard", "-z"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
    ]);
    return { status: status.stdout, diffStat: diffStat.stdout, patch: patch.stdout, files: names.stdout.split("\0").filter(Boolean), untrackedFiles: untracked.stdout.split("\0").filter(Boolean) };
  }

  async applyFiles(worktreePath: string, files: string[], untrackedFiles: string[] = []): Promise<void> {
    this.assertManagedPath(worktreePath);
    const safeFiles = files.map(validateRelativeFile);
    const safeUntracked = untrackedFiles.map(validateRelativeFile);
    if (safeFiles.length + safeUntracked.length === 0) throw new Error("At least one file is required");
    const targetStatus = await this.runner.run({ command: "git", args: ["-C", this.repoPath, "status", "--porcelain"], cwd: this.repoPath });
    if (targetStatus.stdout.trim()) throw new Error("Target repository must be clean before applying agent changes");
    const diff = safeFiles.length ? await this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--binary", "--", ...safeFiles], cwd: this.repoPath, maxOutputBytes: 2 * 1024 * 1024 }) : null;
    if (safeFiles.length && !diff?.stdout.trim()) throw new Error("Selected files have no tracked changes");
    if (diff) await this.runner.run({ command: "git", args: ["-C", this.repoPath, "apply", "--check", "-"], cwd: this.repoPath, stdin: diff.stdout });
    const copies = await Promise.all(safeUntracked.map((file) => this.preflightUntrackedCopy(worktreePath, file)));
    const copied: string[] = [];
    try {
      for (const item of copies) { await mkdir(path.dirname(item.target), { recursive: true }); await copyFile(item.source, item.target, 1); copied.push(item.target); }
      if (diff) await this.runner.run({ command: "git", args: ["-C", this.repoPath, "apply", "-"], cwd: this.repoPath, stdin: diff.stdout });
    } catch (error) {
      await Promise.allSettled(copied.map((file) => unlink(file)));
      throw error;
    }
  }

  private async preflightUntrackedCopy(worktreePath: string, file: string): Promise<{ source: string; target: string }> {
    const source = path.resolve(worktreePath, file);
    const resolvedWorktree = await realpath(worktreePath); const resolvedRepo = await realpath(this.repoPath); const resolvedSource = await realpath(source);
    const target = path.resolve(resolvedRepo, file);
    if (!isInside(resolvedWorktree, resolvedSource)) throw new Error(`Untracked file escapes workspace: ${file}`);
    const stat = await lstat(resolvedSource);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error(`Untracked file must be a regular file under 1 MB: ${file}`);
    let current = resolvedRepo;
    for (const segment of file.split(/[\\/]/).slice(0, -1)) {
      current = path.join(current, segment);
      try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Target path contains a symbolic link: ${file}`); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") break; throw error; }
    }
    try { await lstat(target); throw new Error(`Target file already exists: ${file}`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    return { source: resolvedSource, target };
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

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

export function configuredWorkspaceOperations(env: NodeJS.ProcessEnv = process.env): WorkspaceOperations {
  if (env.LOCAL_CLI_ENABLED !== "true" || !env.LOCAL_CLI_REPO_PATH || !env.LOCAL_CLI_WORKTREE_ROOT) {
    throw new Error("Local workspace operations are not enabled");
  }
  return new WorkspaceOperations(env.LOCAL_CLI_REPO_PATH, env.LOCAL_CLI_WORKTREE_ROOT);
}
