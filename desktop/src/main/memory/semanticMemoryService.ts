import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import type { SemanticMemoryResult, SemanticMemoryStatus } from "../../shared/contracts";
import { findExecutable } from "../onboarding/prerequisiteChecker";

type CommandResult = { stdout: string; stderr: string };
interface SemanticMemoryOptions {
  findBin?: () => Promise<string | undefined>;
  run?: (file: string, args: string[], env: NodeJS.ProcessEnv) => Promise<CommandResult>;
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
}

export class SemanticMemoryService {
  private indexQueue = Promise.resolve();
  constructor(private readonly palaceRoot: string, private readonly options: SemanticMemoryOptions = {}) {}

  async status(): Promise<SemanticMemoryStatus> {
    const available = Boolean(await this.bin());
    return available
      ? { available, active: true, provider: "mempalace", model: "minilm", detail: "Local MemPalace semantic search is available." }
      : { available, active: false, provider: "keyword", model: "minilm", detail: "MemPalace is unavailable; searches use deterministic local text ranking." };
  }

  async index(projectPath: string, memoryRoot: string): Promise<SemanticMemoryStatus> {
    const bin = await this.bin();
    if (!bin) return this.status();
    const operation = this.indexQueue.catch(() => undefined).then(() => this.execute(bin, ["mine", memoryRoot, "--wing", wing(projectPath), "--agent", "orbi-prime"]));
    this.indexQueue = operation.then(() => undefined, () => undefined);
    await operation;
    return this.status();
  }

  async search(projectPath: string, query: string, limit: number, fallback: () => Promise<string>): Promise<SemanticMemoryResult> {
    const bin = await this.bin();
    if (!bin) return { status: await this.status(), output: await fallback() };
    try {
      const result = await this.execute(bin, ["search", query, "--results", String(limit), "--wing", wing(projectPath)]);
      return { status: await this.status(), output: result.stdout.trim().slice(0, 100_000) };
    } catch {
      return {
        status: { available: true, active: false, provider: "keyword", model: "minilm", detail: "MemPalace search failed; deterministic local text ranking was used." },
        output: await fallback(),
      };
    }
  }

  private async bin(): Promise<string | undefined> {
    if (this.options.findBin) return this.options.findBin();
    const environment = this.options.environment ?? process.env;
    const searchPath = [environment.PATH, "/opt/homebrew/bin", "/usr/local/bin", environment.HOME ? path.join(environment.HOME, ".local", "bin") : undefined].filter(Boolean).join(path.delimiter);
    return findExecutable("mempalace", searchPath);
  }

  private execute(file: string, args: string[]): Promise<CommandResult> {
    const environment = this.options.environment ?? process.env;
    const env = { ...environment, MEMPALACE_PALACE_PATH: this.palaceRoot, MEMPALACE_EMBEDDING_MODEL: "minilm", ...((this.options.platform ?? process.platform) === "darwin" && !environment.MEMPALACE_EMBEDDING_DEVICE ? { MEMPALACE_EMBEDDING_DEVICE: "cpu" } : {}) };
    if (this.options.run) return this.options.run(file, args, env);
    return new Promise((resolve, reject) => execFile(file, args, { env, timeout: 120_000, maxBuffer: 120_000, windowsHide: true }, (error, stdout, stderr) => error ? reject(new Error(String(stderr || error.message).trim().slice(0, 2_000))) : resolve({ stdout, stderr })));
  }
}

function wing(projectPath: string): string { return `project-${createHash("sha256").update(projectPath).digest("hex").slice(0, 16)}`; }
