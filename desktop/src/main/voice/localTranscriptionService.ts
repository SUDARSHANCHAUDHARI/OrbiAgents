import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { VoiceTranscript, VoiceTranscriptionRequest, VoiceTranscriptionStatus } from "../../shared/contracts";
import type { VoicePolicyStore } from "./voicePolicyStore";
import { findExecutable } from "../onboarding/prerequisiteChecker";

const run = promisify(execFile);
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_TRANSCRIPT_BYTES = 64 * 1024;

export class LocalTranscriptionService {
  private modelPath?: string;
  private whisperPath?: string;
  private ffmpegPath?: string;

  constructor(private readonly configPath: string, private readonly transcriptRoot: string, private readonly policy: VoicePolicyStore, private readonly environment: NodeJS.ProcessEnv = process.env, private readonly now: () => number = Date.now) {}

  async load(): Promise<VoiceTranscriptionStatus> {
    const searchPath = [this.environment.PATH, "/opt/homebrew/bin", "/usr/local/bin", this.environment.HOME ? path.join(this.environment.HOME, ".local", "bin") : undefined].filter(Boolean).join(path.delimiter);
    [this.whisperPath, this.ffmpegPath] = await Promise.all([findExecutable("whisper-cli", searchPath), findExecutable("ffmpeg", searchPath)]);
    try {
      const row = JSON.parse(await readFile(this.configPath, "utf8")) as Record<string, unknown>;
      if (Object.keys(row).length === 1 && typeof row.modelPath === "string") await this.validateModel(row.modelPath);
    } catch { this.modelPath = undefined; }
    await this.pruneExpired();
    return this.status();
  }

  status(): VoiceTranscriptionStatus {
    const available = Boolean(this.whisperPath && this.ffmpegPath && this.modelPath);
    this.policy.setRuntimeAvailable(available);
    return { available, modelConfigured: Boolean(this.modelPath), ...(this.modelPath ? { modelName: path.basename(this.modelPath) } : {}), detail: !this.whisperPath ? "Install whisper-cli locally." : !this.ffmpegPath ? "Install ffmpeg locally." : !this.modelPath ? "Choose a local whisper.cpp GGML model." : "Local transcription is ready." };
  }

  async setModel(modelPath: string): Promise<VoiceTranscriptionStatus> {
    try { await this.validateModel(modelPath); } catch { throw new Error("The selected whisper model is invalid"); }
    await mkdir(path.dirname(this.configPath), { recursive: true, mode: 0o700 });
    const temporary = `${this.configPath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ modelPath }, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.configPath);
    return this.status();
  }

  async clearRetained(): Promise<void> { await rm(this.transcriptRoot, { recursive: true, force: true }); }

  async transcribe(value: unknown): Promise<VoiceTranscript> {
    const request = parseRequest(value);
    const policy = this.policy.get();
    if (!policy.consent) throw new Error("Voice consent is required");
    if (!this.status().available || !this.whisperPath || !this.ffmpegPath || !this.modelPath) throw new Error("Local transcription is not configured");
    const work = path.join(os.tmpdir(), `orbi-voice-${randomUUID()}`); await mkdir(work, { mode: 0o700 });
    try {
      const input = path.join(work, request.mimeType === "audio/mp4" ? "capture.m4a" : "capture.webm");
      const wav = path.join(work, "capture.wav"); const output = path.join(work, "transcript");
      await writeFile(input, request.audio, { mode: 0o600 });
      await run(this.ffmpegPath, ["-nostdin", "-v", "error", "-i", input, "-ar", "16000", "-ac", "1", "-y", wav], { timeout: 30_000, maxBuffer: 256 * 1024 });
      await run(this.whisperPath, ["-m", this.modelPath, "-f", wav, "-otxt", "-of", output], { timeout: 120_000, maxBuffer: 256 * 1024 });
      const text = (await readFile(`${output}.txt`, "utf8")).trim();
      if (!text || Buffer.byteLength(text) > MAX_TRANSCRIPT_BYTES) throw new Error("Local transcription returned invalid text");
      const createdAt = this.now(); const retainedUntil = policy.retention === "24-hours" ? createdAt + 86_400_000 : undefined;
      if (policy.retention !== "none") { await mkdir(this.transcriptRoot, { recursive: true, mode: 0o700 }); const prefix = policy.retention === "session" ? "session" : String(createdAt); await writeFile(path.join(this.transcriptRoot, `${prefix}-${randomUUID()}.txt`), `${text}\n`, { mode: 0o600 }); }
      return { text, createdAt, ...(retainedUntil ? { retainedUntil } : {}) };
    } catch (error) { throw new Error(error instanceof Error && error.message === "Local transcription returned invalid text" ? error.message : "Local transcription failed"); }
    finally { await rm(work, { recursive: true, force: true }); }
  }

  private async validateModel(value: string): Promise<void> {
    if (!path.isAbsolute(value) || !/\.bin$/i.test(value)) throw new Error("Choose a whisper.cpp GGML .bin model");
    const stat = await lstat(value); if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1_000_000 || stat.size > 4_000_000_000) throw new Error("The selected whisper model is invalid");
    await access(value, constants.R_OK); this.modelPath = value;
  }

  private async pruneExpired(): Promise<void> {
    // Session-retained files are removed on the next app launch; 24-hour files use their timestamp prefix.
    const entries = await import("node:fs/promises").then(({ readdir }) => readdir(this.transcriptRoot).catch(() => []));
    for (const entry of entries) { const prefix = entry.split("-")[0]; const createdAt = Number(prefix); if (prefix === "session" || !Number.isFinite(createdAt) || this.now() - createdAt > 86_400_000) await rm(path.join(this.transcriptRoot, entry), { force: true }); }
  }
}

function parseRequest(value: unknown): VoiceTranscriptionRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Voice recording is invalid");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["audio", "mimeType"].includes(key)) || !(row.audio instanceof Uint8Array) || row.audio.byteLength < 100 || row.audio.byteLength > MAX_AUDIO_BYTES || (row.mimeType !== "audio/webm" && row.mimeType !== "audio/mp4")) throw new Error("Voice recording is invalid");
  return { audio: row.audio, mimeType: row.mimeType };
}
