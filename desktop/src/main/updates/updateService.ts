import { autoUpdater } from "electron-updater";
import type { UpdateState } from "../../shared/contracts";

interface UpdateInfoLike { version: string; releaseName?: string | null; releaseNotes?: string | Array<{ note: string | null }> | null; files?: Array<{ size?: number | null }>; }
interface UpdateCheckResultLike { updateInfo: UpdateInfoLike; }
export interface UpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  currentVersion: { version: string };
  checkForUpdates(): Promise<UpdateCheckResultLike | null>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export class UpdateService {
  private state: UpdateState;

  constructor(private readonly updater: UpdaterLike = autoUpdater, private readonly blockers: () => Promise<string[]> = async () => []) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    this.state = { phase: "idle", currentVersion: updater.currentVersion.version };
  }

  status(): UpdateState { return { ...this.state }; }

  async check(): Promise<UpdateState> {
    this.state = { phase: "checking", currentVersion: this.updater.currentVersion.version };
    try {
      const result = await this.updater.checkForUpdates();
      if (!result) return this.set({ phase: "not-available", message: "OrbiAgents is up to date." });
      const info = result.updateInfo;
      const comparison = compareVersions(info.version, this.updater.currentVersion.version);
      if (comparison === 0) return this.set({ phase: "not-available", message: "OrbiAgents is up to date." });
      if (comparison < 0) throw new Error(`Update provider offered a downgrade to ${bounded(info.version, 50) ?? "an invalid version"}`);
      return this.set({ phase: "available", availableVersion: info.version, releaseName: bounded(info.releaseName, 200), releaseNotes: releaseNotes(info.releaseNotes), artifactSize: totalSize(info.files) });
    } catch (error) { return this.fail(error, "Update check failed"); }
  }

  async download(): Promise<UpdateState> {
    if (this.state.phase !== "available") throw new Error("Check for an available update before downloading");
    const available = { availableVersion: this.state.availableVersion, releaseName: this.state.releaseName, releaseNotes: this.state.releaseNotes, artifactSize: this.state.artifactSize };
    this.state = { ...this.state, phase: "downloading", message: undefined };
    try { await this.updater.downloadUpdate(); return this.set({ ...available, phase: "downloaded", message: "Update downloaded. Restart explicitly when the fleet is safe." }); }
    catch (error) { return this.fail(error, "Update download failed", available); }
  }

  async install(): Promise<void> {
    if (this.state.phase !== "downloaded") throw new Error("Download an update before installing it");
    const reasons = await this.blockers();
    if (reasons.length) throw new Error(`Update restart is blocked: ${reasons.join("; ")}`);
    this.updater.quitAndInstall(false, true);
  }

  private set(next: Omit<UpdateState, "currentVersion">): UpdateState {
    this.state = { currentVersion: this.updater.currentVersion.version, ...next };
    return this.status();
  }

  private fail(error: unknown, fallback: string, retained: Partial<UpdateState> = {}): UpdateState {
    const message = error instanceof Error && error.message ? error.message.slice(0, 500) : fallback;
    return this.set({ ...retained, phase: "error", message });
  }
}

function bounded(value: string | null | undefined, max: number): string | undefined { return typeof value === "string" && value ? value.slice(0, max) : undefined; }
function releaseNotes(value: UpdateInfoLike["releaseNotes"]): string | undefined { if (typeof value === "string") return value.slice(0, 10_000); if (Array.isArray(value)) return value.flatMap((item) => item.note ?? []).join("\n\n").slice(0, 10_000) || undefined; return undefined; }
function totalSize(files: UpdateInfoLike["files"]): number | undefined { const sizes = files?.map((file) => file.size).filter((size): size is number => typeof size === "number" && Number.isSafeInteger(size) && size > 0); return sizes?.length ? sizes.reduce((sum, size) => sum + size, 0) : undefined; }
function compareVersions(candidate: string, current: string): number {
  const parse = (value: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value.trim());
    if (!match) throw new Error("Update provider returned an invalid version");
    return { numbers: match.slice(1, 4).map(Number), prerelease: match[4] };
  };
  const left = parse(candidate); const right = parse(current);
  for (let index = 0; index < 3; index += 1) if (left.numbers[index] !== right.numbers[index]) return left.numbers[index] > right.numbers[index] ? 1 : -1;
  if (left.prerelease === right.prerelease) return 0;
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;
  return left.prerelease.localeCompare(right.prerelease, undefined, { numeric: true });
}
