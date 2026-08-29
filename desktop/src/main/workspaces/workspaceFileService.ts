import { createHash, randomUUID } from "node:crypto";
import { lstat, open, readdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceFileDocument, WorkspaceFileEntry, WorkspaceFileRevision } from "../../shared/contracts";
import { NativeGitRunner, type GitRunner } from "./workspaceManager";

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TREE_ENTRIES = 2_000;
const MAX_DEPTH = 20;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const REVISION_PATTERN = /^[a-f0-9]{40,64}$/;
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "out", "dist", "build", ".next", "coverage"]);
const SENSITIVE_NAMES = new Set(["auth.json", "local.properties", "secure.properties", "keystore.properties", ".npmrc", ".pypirc", ".netrc", "credentials", "id_rsa", "id_ed25519"]);
const SENSITIVE_EXTENSIONS = new Set([".pem", ".key", ".p12", ".jks", ".keystore"]);

export class WorkspaceFileService {
  constructor(private readonly git: GitRunner = new NativeGitRunner()) {}

  async list(rootPath: string): Promise<WorkspaceFileEntry[]> {
    const root = await realpath(rootPath); const entries: WorkspaceFileEntry[] = [];
    const visit = async (directory: string, relativeDirectory: string, depth: number): Promise<void> => {
      if (depth > MAX_DEPTH || entries.length >= MAX_TREE_ENTRIES) return;
      const children = (await readdir(directory, { withFileTypes: true })).sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
      for (const child of children) {
        if (entries.length >= MAX_TREE_ENTRIES) break;
        if (child.isSymbolicLink() || isSensitiveName(child.name) || (child.isDirectory() && IGNORED_DIRECTORIES.has(child.name))) continue;
        const relative = relativeDirectory ? `${relativeDirectory}/${child.name}` : child.name; const absolute = path.join(directory, child.name);
        if (child.isDirectory()) { entries.push({ path: relative, name: child.name, type: "directory", depth }); await visit(absolute, relative, depth + 1); }
        else if (child.isFile()) { const info = await lstat(absolute); entries.push({ path: relative, name: child.name, type: "file", depth, size: info.size, editable: info.size <= MAX_FILE_BYTES }); }
      }
    };
    await visit(root, "", 0); return entries;
  }

  async read(rootPath: string, relativePath: unknown): Promise<WorkspaceFileDocument> {
    const { relative, absolute } = await resolveFile(rootPath, relativePath); const bytes = await boundedRead(absolute);
    return document(relative, decodeText(bytes), bytes);
  }

  async write(rootPath: string, relativePath: unknown, content: unknown, expectedHash: unknown): Promise<WorkspaceFileDocument> {
    if (typeof content !== "string" || Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error("File content must be UTF-8 text no larger than 1 MB");
    if (typeof expectedHash !== "string" || !HASH_PATTERN.test(expectedHash)) throw new Error("Expected file hash is invalid");
    const { relative, absolute } = await resolveFile(rootPath, relativePath); const current = await boundedRead(absolute);
    if (hash(current) !== expectedHash) throw new Error("File changed since it was opened; reload before saving");
    const info = await lstat(absolute); const temporary = path.join(path.dirname(absolute), `.${path.basename(absolute)}.orbi-${randomUUID()}.tmp`);
    try { await writeFile(temporary, content, { encoding: "utf8", mode: info.mode }); await rename(temporary, absolute); }
    catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
    const bytes = Buffer.from(content); return document(relative, content, bytes);
  }

  async history(rootPath: string, relativePath: unknown): Promise<WorkspaceFileRevision[]> {
    const relative = validateRelativePath(relativePath); await resolveFile(rootPath, relative);
    const output = await this.git.run(["-C", rootPath, "log", "-n", "30", "--format=%H%x1f%ct%x1f%s%x1e", "--", relative], rootPath, 128_000);
    return output.split("\x1e").flatMap((row) => { const [revision, seconds, ...subject] = row.replace(/^\n+/, "").split("\x1f"); return REVISION_PATTERN.test(revision ?? "") && /^\d+$/.test(seconds ?? "") ? [{ revision: revision!, timestamp: Number(seconds) * 1_000, subject: subject.join(" ").replace(/[\r\n]/g, " ").slice(0, 300) }] : []; });
  }

  async readRevision(rootPath: string, relativePath: unknown, revision: unknown): Promise<WorkspaceFileDocument> {
    const relative = validateRelativePath(relativePath);
    if (typeof revision !== "string" || !REVISION_PATTERN.test(revision)) throw new Error("Git revision is invalid");
    const prefix = await this.git.run(["-C", rootPath, "rev-parse", "--show-prefix"], rootPath, 4_096);
    const content = await this.git.run(["-C", rootPath, "show", `${revision}:${prefix.trim()}${relative}`], rootPath, MAX_FILE_BYTES);
    const bytes = Buffer.from(content); return { ...document(relative, content, bytes), readOnly: true };
  }
}

async function resolveFile(rootPath: string, value: unknown): Promise<{ relative: string; absolute: string }> {
  const relative = validateRelativePath(value); const root = await realpath(rootPath); let current = root;
  for (const segment of relative.split("/")) { current = path.join(current, segment); const info = await lstat(current); if (info.isSymbolicLink()) throw new Error("Workspace file path contains a symbolic link"); }
  const info = await lstat(current); if (!info.isFile()) throw new Error("Workspace path is not a regular file");
  const resolved = await realpath(current); if (!isInside(root, resolved)) throw new Error("Workspace file escaped its root");
  return { relative, absolute: resolved };
}
function validateRelativePath(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 1_000 || path.isAbsolute(value) || value.includes("\\") || value.split("/").some((part) => !part || part === "." || part === "..") || isSensitiveName(path.basename(value))) throw new Error("Workspace file path is unsafe");
  return value;
}
async function boundedRead(file: string): Promise<Buffer> { const handle = await open(file, "r"); try { const info = await handle.stat(); if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error("Workspace file must be a regular file no larger than 1 MB"); return await readFile(handle); } finally { await handle.close(); } }
function decodeText(bytes: Buffer): string { if (bytes.includes(0)) throw new Error("Binary files cannot be opened in the editor"); try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("File is not valid UTF-8 text"); } }
function hash(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function document(relative: string, content: string, bytes: Uint8Array): WorkspaceFileDocument { return { path: relative, content, hash: hash(bytes), language: languageFor(relative) }; }
function languageFor(file: string): string { return ({ ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript", ".json": "json", ".md": "markdown", ".css": "css", ".html": "html", ".py": "python", ".kt": "kotlin", ".swift": "swift", ".rs": "rust", ".yml": "yaml", ".yaml": "yaml" } as Record<string, string>)[path.extname(file).toLowerCase()] ?? "plaintext"; }
function isSensitiveName(name: string): boolean { const lower = name.toLowerCase(); return lower === ".env" || lower.startsWith(".env.") || SENSITIVE_NAMES.has(lower) || SENSITIVE_EXTENSIONS.has(path.extname(lower)); }
function isInside(root: string, candidate: string): boolean { const relative = path.relative(root, candidate); return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); }
