import path from "node:path";
import { copyFile, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { ProcessRunner, SpawnProcessRunner } from "./processRunner";

export class WorkspaceOperations {
  constructor(
    private readonly repoPath: string,
    private readonly worktreeRoot: string,
    private readonly runner: ProcessRunner = new SpawnProcessRunner(new Set(["git"]))
  ) {}

  async inspect(worktreePath: string): Promise<{ status: string; diffStat: string; patch: string; files: string[]; untrackedFiles: string[]; untrackedPreviews: UntrackedPreview[] }> {
    this.assertManagedPath(worktreePath);
    const [status, diffStat, patch, names, untracked] = await Promise.all([
      this.runner.run({ command: "git", args: ["-C", worktreePath, "status", "--short"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--stat"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--no-color"], cwd: this.repoPath, maxOutputBytes: 512_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "diff", "--name-only", "-z"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
      this.runner.run({ command: "git", args: ["-C", worktreePath, "ls-files", "--others", "--exclude-standard", "-z"], cwd: this.repoPath, maxOutputBytes: 256_000 }),
    ]);
    const untrackedFiles = untracked.stdout.split("\0").filter(Boolean);
    const untrackedPreviews = await Promise.all(untrackedFiles.map((file) => this.previewUntracked(worktreePath, file).catch(() => ({ path: file, kind: "unavailable" as const, size: 0 }))));
    return { status: status.stdout, diffStat: diffStat.stdout, patch: patch.stdout, files: names.stdout.split("\0").filter(Boolean), untrackedFiles, untrackedPreviews };
  }

  private async previewUntracked(worktreePath: string, file: string): Promise<UntrackedPreview> {
    const safeFile = validateRelativeFile(file); const resolvedRoot = await realpath(worktreePath); const resolvedFile = await realpath(path.resolve(worktreePath, safeFile));
    if (!isInside(resolvedRoot, resolvedFile)) throw new Error("Preview path escapes workspace");
    const stat = await lstat(resolvedFile); if (!stat.isFile()) return { path: safeFile, kind: "unavailable", size: stat.size };
    const handle = await open(resolvedFile, "r");
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, 4096)); await handle.read(buffer, 0, buffer.length, 0);
      const image = detectImage(buffer); const binary = buffer.includes(0) || image !== null;
      if (image && stat.size <= 64 * 1024) {
        const full = Buffer.alloc(stat.size); await handle.read(full, 0, full.length, 0);
        const dimensions = imageDimensions(full, image);
        return { path: safeFile, kind: "image", size: stat.size, mimeType: image, imagePreview: `data:${image};base64,${full.toString("base64")}`, ...dimensions };
      }
      return { path: safeFile, kind: binary ? "binary" : "text", size: stat.size, ...(binary ? { mimeType: "application/octet-stream" } : { preview: buffer.toString("utf8"), truncated: stat.size > buffer.length }) };
    } finally { await handle.close(); }
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

function detectImage(buffer: Buffer): "image/png" | "image/jpeg" | "image/gif" | "image/webp" | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

function imageDimensions(buffer: Buffer, mimeType: string): { width?: number; height?: number } {
  if (mimeType === "image/png" && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mimeType === "image/gif" && buffer.length >= 10) return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  return {};
}

export interface UntrackedPreview { path: string; kind: "text" | "binary" | "image" | "unavailable"; size: number; preview?: string; mimeType?: string; imagePreview?: string; width?: number; height?: number; truncated?: boolean }

export function configuredWorkspaceOperations(env: NodeJS.ProcessEnv = process.env): WorkspaceOperations {
  if (env.LOCAL_CLI_ENABLED !== "true" || !env.LOCAL_CLI_REPO_PATH || !env.LOCAL_CLI_WORKTREE_ROOT) {
    throw new Error("Local workspace operations are not enabled");
  }
  return new WorkspaceOperations(env.LOCAL_CLI_REPO_PATH, env.LOCAL_CLI_WORKTREE_ROOT);
}
