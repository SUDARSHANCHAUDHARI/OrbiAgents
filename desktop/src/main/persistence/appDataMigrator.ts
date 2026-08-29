import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface AppDataMigration {
  fromVersion: number;
  toVersion: number;
  migrate(root: string): Promise<void>;
}

interface SchemaManifest { version: number; migratedAt: number; }
interface BackupFile { path: string; bytes: number; sha256: string; }
interface BackupManifest { id: string; fromVersion: number; toVersion: number; createdAt: number; managedPaths: string[]; presentPaths: string[]; files: BackupFile[]; }
export interface MigrationFailure { backupId: string; fromVersion: number; toVersion: number; failedAt: number; message: string; rollbackCompleted: boolean; }
export interface MigrationResult { version: number; migrated: boolean; backupId?: string; }

const STATE_FILE = "schema.json";
const FAILURE_FILE = "migration-failure.json";
const BACKUP_ROOT = "migration-backups";

export class AppDataMigrator {
  private readonly managedPaths: string[];

  constructor(
    private readonly root: string,
    managedPaths: string[],
    private readonly migrations: AppDataMigration[],
    private readonly options: { maxBackupFiles?: number; maxBackupBytes?: number; keepBackups?: number; now?: () => number } = {},
  ) {
    this.managedPaths = validateManagedPaths(managedPaths);
    validateMigrations(migrations);
    if (options.maxBackupFiles !== undefined && (!Number.isInteger(options.maxBackupFiles) || options.maxBackupFiles < 1)) throw new Error("Backup file limit is invalid");
    if (options.maxBackupBytes !== undefined && (!Number.isFinite(options.maxBackupBytes) || options.maxBackupBytes < 1)) throw new Error("Backup byte limit is invalid");
    if (options.keepBackups !== undefined && (!Number.isInteger(options.keepBackups) || options.keepBackups < 1)) throw new Error("Backup retention is invalid");
  }

  async run(targetVersion: number): Promise<MigrationResult> {
    if (!Number.isInteger(targetVersion) || targetVersion < 0) throw new Error("Target schema version is invalid");
    await mkdir(this.root, { recursive: true });
    const current = await this.readSchema();
    if (current.version > targetVersion) throw new Error("App data was created by a newer OrbiAgents version");
    if (current.version === targetVersion) return { version: current.version, migrated: false };
    const chain = this.resolveChain(current.version, targetVersion);
    const backup = await this.createBackup(current.version, targetVersion);
    try {
      for (const migration of chain) await migration.migrate(this.root);
      await atomicJson(path.join(this.root, STATE_FILE), { version: targetVersion, migratedAt: this.now() } satisfies SchemaManifest);
      await rm(path.join(this.root, FAILURE_FILE), { force: true });
      await this.pruneBackups();
      return { version: targetVersion, migrated: true, backupId: backup.id };
    } catch (error) {
      let rollbackCompleted = false;
      try { await this.restoreBackup(backup); rollbackCompleted = true; } catch { rollbackCompleted = false; }
      const failure: MigrationFailure = { backupId: backup.id, fromVersion: current.version, toVersion: targetVersion, failedAt: this.now(), message: boundedError(error), rollbackCompleted };
      await atomicJson(path.join(this.root, FAILURE_FILE), failure);
      throw new Error(rollbackCompleted ? "App data migration failed and was rolled back" : "App data migration failed and rollback was incomplete", { cause: error });
    }
  }

  async readFailure(): Promise<MigrationFailure | null> {
    try {
      const value = JSON.parse(await readFile(path.join(this.root, FAILURE_FILE), "utf8")) as Partial<MigrationFailure>;
      return typeof value.backupId === "string" && Number.isInteger(value.fromVersion) && Number.isInteger(value.toVersion) && typeof value.failedAt === "number" && typeof value.message === "string" && typeof value.rollbackCompleted === "boolean" ? value as MigrationFailure : null;
    } catch { return null; }
  }

  private now(): number { return this.options.now?.() ?? Date.now(); }

  private async readSchema(): Promise<SchemaManifest> {
    try {
      const value = JSON.parse(await readFile(path.join(this.root, STATE_FILE), "utf8")) as Partial<SchemaManifest>;
      if (!Number.isInteger(value.version) || value.version! < 0 || typeof value.migratedAt !== "number" || !Number.isFinite(value.migratedAt)) throw new Error("Schema manifest is invalid");
      return value as SchemaManifest;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 0, migratedAt: 0 };
      throw error;
    }
  }

  private resolveChain(from: number, target: number): AppDataMigration[] {
    const chain: AppDataMigration[] = [];
    let version = from;
    while (version < target) {
      const migration = this.migrations.find((candidate) => candidate.fromVersion === version);
      if (!migration || migration.toVersion > target) throw new Error(`Missing app data migration from version ${version}`);
      chain.push(migration);
      version = migration.toVersion;
    }
    if (version !== target) throw new Error(`No exact app data migration path to version ${target}`);
    return chain;
  }

  private async createBackup(fromVersion: number, toVersion: number): Promise<BackupManifest> {
    const id = `${this.now()}-${randomUUID()}`;
    const directory = path.join(this.root, BACKUP_ROOT, id);
    const dataRoot = path.join(directory, "data");
    const files: BackupFile[] = [];
    const presentPaths: string[] = [];
    let totalBytes = 0;
    for (const relative of this.managedPaths) {
      const source = path.join(this.root, relative);
      const info = await lstat(source).catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? null : Promise.reject(error));
      if (!info) continue;
      presentPaths.push(relative);
      await copyChecked(source, path.join(dataRoot, relative), relative, files, (bytes) => {
        totalBytes += bytes;
        if (files.length >= (this.options.maxBackupFiles ?? 10_000) || totalBytes > (this.options.maxBackupBytes ?? 250 * 1024 * 1024)) throw new Error("Managed app data exceeds migration backup limits");
      });
    }
    const manifest: BackupManifest = { id, fromVersion, toVersion, createdAt: this.now(), managedPaths: this.managedPaths, presentPaths, files };
    await atomicJson(path.join(directory, "backup.json"), manifest);
    return manifest;
  }

  private async restoreBackup(backup: BackupManifest): Promise<void> {
    const directory = path.join(this.root, BACKUP_ROOT, backup.id, "data");
    const verified: BackupFile[] = [];
    for (const relative of backup.presentPaths) await inspectChecked(path.join(directory, relative), relative, verified);
    if (JSON.stringify(verified) !== JSON.stringify(backup.files)) throw new Error("Migration backup checksum verification failed");
    for (const relative of backup.managedPaths) await rm(path.join(this.root, relative), { recursive: true, force: true });
    const restored: BackupFile[] = [];
    for (const relative of backup.presentPaths) await copyChecked(path.join(directory, relative), path.join(this.root, relative), relative, restored, () => undefined);
    if (JSON.stringify(restored) !== JSON.stringify(backup.files)) throw new Error("Restored app data checksum verification failed");
  }

  private async pruneBackups(): Promise<void> {
    const keep = this.options.keepBackups ?? 3;
    const root = path.join(this.root, BACKUP_ROOT);
    const entries = await readdir(root, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? [] : Promise.reject(error));
    const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    for (const name of directories.slice(keep)) await rm(path.join(root, name), { recursive: true, force: true });
  }
}

function validateManagedPaths(values: string[]): string[] {
  const unique = [...new Set(values)];
  if (!unique.length || unique.length !== values.length) throw new Error("Managed app data paths must be unique and non-empty");
  for (const value of unique) if (!value || path.isAbsolute(value) || value.split(/[\\/]/).some((part) => !part || part === "." || part === "..") || [STATE_FILE, FAILURE_FILE, BACKUP_ROOT].includes(value.split(/[\\/]/)[0])) throw new Error("Managed app data path is invalid");
  const normalized = unique.map((value) => value.replaceAll("\\", "/"));
  if (normalized.some((value, index) => normalized.some((candidate, candidateIndex) => candidateIndex !== index && value.startsWith(`${candidate}/`)))) throw new Error("Managed app data paths cannot overlap");
  return unique;
}

function validateMigrations(migrations: AppDataMigration[]): void {
  const starts = new Set<number>();
  for (const migration of migrations) {
    if (!Number.isInteger(migration.fromVersion) || !Number.isInteger(migration.toVersion) || migration.fromVersion < 0 || migration.toVersion !== migration.fromVersion + 1 || starts.has(migration.fromVersion)) throw new Error("App data migrations must be unique single-version steps");
    starts.add(migration.fromVersion);
  }
}

async function copyChecked(source: string, destination: string, relative: string, files: BackupFile[], account: (bytes: number) => void): Promise<void> {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in managed app data: ${relative}`);
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true, mode: 0o700 });
    const entries = (await readdir(source, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) await copyChecked(path.join(source, entry.name), path.join(destination, entry.name), path.posix.join(relative.replaceAll("\\", "/"), entry.name), files, account);
    return;
  }
  if (!info.isFile()) throw new Error(`Unsupported managed app data entry: ${relative}`);
  const contents = await readFile(source);
  account(contents.byteLength);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, contents, { mode: 0o600 });
  files.push({ path: relative.replaceAll("\\", "/"), bytes: contents.byteLength, sha256: createHash("sha256").update(contents).digest("hex") });
}

async function inspectChecked(source: string, relative: string, files: BackupFile[]): Promise<void> {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in migration backups: ${relative}`);
  if (info.isDirectory()) {
    const entries = (await readdir(source, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) await inspectChecked(path.join(source, entry.name), path.posix.join(relative.replaceAll("\\", "/"), entry.name), files);
    return;
  }
  if (!info.isFile()) throw new Error(`Unsupported migration backup entry: ${relative}`);
  const contents = await readFile(source);
  files.push({ path: relative.replaceAll("\\", "/"), bytes: contents.byteLength, sha256: createHash("sha256").update(contents).digest("hex") });
}

async function atomicJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
}

function boundedError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown migration failure";
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}
