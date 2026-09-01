import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RemoteSkillInstallRequest, RemoteSkillInstallResult } from "../../shared/contracts";
import type { RemoteCatalogClient, VerifiedCatalogArtifact } from "../catalog/remoteCatalogClient";
import { parseSkill } from "./skillCatalog";

const MAX_FILES = 32;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_CONTENT_BYTES = 4 * 1024 * 1024;
const PROVENANCE_FILE = ".orbi-provenance.json";

interface SkillPackage { schemaVersion: 1; id: string; name: string; description: string; version: string; files: Array<{ path: string; content: string }>; }

export class RemoteSkillInstaller {
  constructor(private readonly catalogs: RemoteCatalogClient, private readonly installRoot: string, private readonly now: () => number = Date.now) {}

  async install(input: unknown): Promise<RemoteSkillInstallResult> {
    const request = parseInstallRequest(input);
    const artifact = await this.catalogs.downloadReviewedArtifact(request.catalog, request.entryId); if (artifact.entry.kind !== "skill") throw new Error("Only verified skill artifacts can be installed here");
    const skillPackage = parsePackage(artifact); const root = path.resolve(this.installRoot); await ensureDirectory(root);
    const destination = path.join(root, skillPackage.id); if (await exists(destination)) throw new Error("A skill with this identifier is already installed");
    const temporary = path.join(root, `.install-${randomUUID()}`); await mkdir(temporary, { mode: 0o700 });
    try {
      for (const file of skillPackage.files) { const target = path.join(temporary, file.path); await mkdir(path.dirname(target), { recursive: true, mode: 0o700 }); await writeFile(target, file.content, { encoding: "utf8", flag: "wx", mode: 0o600 }); }
      const installedAt = this.now(); const provenance = { schemaVersion: 1 as const, publisherId: artifact.publisherId, keyId: artifact.keyId, catalogUrl: artifact.catalogUrl, entryId: artifact.entry.id, version: artifact.entry.version, sha256: artifact.entry.sha256, installedAt };
      await writeFile(path.join(temporary, PROVENANCE_FILE), `${JSON.stringify(provenance, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await rename(temporary, destination);
      return { skill: { id: `Orbi:${skillPackage.id}/SKILL.md`, name: skillPackage.name, description: skillPackage.description, source: "Orbi", relativePath: `${skillPackage.id}/SKILL.md` }, provenance };
    } catch (error) { await rm(temporary, { recursive: true, force: true }).catch(() => undefined); throw error; }
  }
}

function parseInstallRequest(value: unknown): RemoteSkillInstallRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Remote skill install request is invalid"); const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["catalog", "entryId", "confirmed"].includes(key)) || !row.catalog || typeof row.catalog !== "object" || typeof row.entryId !== "string" || row.entryId.length > 128) throw new Error("Remote skill install request is invalid");
  if (row.confirmed !== true) throw new Error("Remote skill installation requires explicit confirmation");
  return { catalog: row.catalog as RemoteSkillInstallRequest["catalog"], entryId: row.entryId, confirmed: true };
}

function parsePackage(artifact: VerifiedCatalogArtifact): SkillPackage {
  let value: unknown; try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(artifact.bytes)); } catch { throw new Error("Verified skill package is invalid JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Verified skill package is invalid"); const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["schemaVersion", "id", "name", "description", "version", "files"].includes(key)) || row.schemaVersion !== 1 || row.id !== artifact.entry.id || row.name !== artifact.entry.name || row.description !== artifact.entry.description || row.version !== artifact.entry.version || !Array.isArray(row.files) || !row.files.length || row.files.length > MAX_FILES) throw new Error("Verified skill package metadata does not match the catalog");
  const seen = new Set<string>(); let total = 0; const files = row.files.map((value) => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Verified skill package file is invalid"); const file = value as Record<string, unknown>; if (Object.keys(file).some((key) => !["path", "content"].includes(key)) || typeof file.path !== "string" || typeof file.content !== "string") throw new Error("Verified skill package file is invalid"); const relativePath = safeRelativePath(file.path); const bytes = Buffer.byteLength(file.content); total += bytes; if (bytes > MAX_FILE_BYTES || total > MAX_TOTAL_CONTENT_BYTES || seen.has(relativePath)) throw new Error("Verified skill package files exceed safety limits"); seen.add(relativePath); return { path: relativePath, content: file.content }; });
  const skillFile = files.find((file) => file.path === "SKILL.md"); const parsed = skillFile ? parseSkill(skillFile.content) : null; if (!parsed || parsed.name !== row.name || parsed.description !== row.description) throw new Error("Verified skill package must contain matching SKILL.md metadata");
  return { schemaVersion: 1, id: row.id as string, name: row.name as string, description: row.description as string, version: row.version as string, files };
}

function safeRelativePath(value: string): string { if (!value || value.length > 240 || value === PROVENANCE_FILE || value.startsWith(".") || value.includes("\\") || value.split("/").length > 4 || value.split("/").some((part) => !part || part === "." || part === ".." || part.startsWith(".") || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(part))) throw new Error("Verified skill package path is unsafe"); return value; }
async function ensureDirectory(directory: string): Promise<void> { await mkdir(directory, { recursive: true, mode: 0o700 }); const info = await lstat(directory); if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Remote skill install directory is unsafe"); }
async function exists(target: string): Promise<boolean> { return Boolean(await lstat(target).catch(() => null)); }
