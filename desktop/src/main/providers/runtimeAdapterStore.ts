import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import type { RuntimeAdapterCreateRequest, RuntimeAdapterDescriptor, RuntimeId } from "../../shared/contracts";

const MAX_ADAPTERS = 20;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;
const MAX_ARG_LENGTH = 1_000;
const MAX_ARGS = 32;

export const BUILTIN_RUNTIME_ADAPTERS: RuntimeAdapterDescriptor[] = [
  { id: "codex", name: "Codex", command: "codex", args: [], builtin: true },
  { id: "claude", name: "Claude", command: "claude", args: [], builtin: true },
  { id: "gemini", name: "Gemini", command: "gemini", args: [], builtin: true },
  { id: "antigravity", name: "Antigravity", command: "agy", args: [], builtin: true },
  { id: "grok", name: "Grok", command: "grok", args: [], builtin: true },
  { id: "kimi", name: "Kimi Code", command: "kimi", args: [], builtin: true },
  { id: "qwen", name: "Qwen", command: "qwen", args: [], builtin: true },
  { id: "opencode", name: "OpenCode", command: "opencode", args: [], builtin: true },
  { id: "crush", name: "Crush", command: "crush", args: [], builtin: true },
  { id: "pi", name: "pi.dev", command: "pi", args: [], builtin: true },
  { id: "copilot", name: "GitHub Copilot", command: "copilot", args: [], builtin: true },
  { id: "cursor", name: "Cursor", command: "cursor-agent", args: [], builtin: true },
];

export class RuntimeAdapterStore {
  private custom: RuntimeAdapterDescriptor[] = [];
  private saveQueue = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<RuntimeAdapterDescriptor[]> {
    const raw = await readFile(this.filePath, "utf8").catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? "[]" : Promise.reject(error));
    try {
      const value: unknown = JSON.parse(raw);
      const parsed = Array.isArray(value) ? value.flatMap((candidate) => parseStoredAdapter(candidate) ?? []) : [];
      this.custom = parsed.filter((adapter, index) => parsed.findIndex((candidate) => candidate.id === adapter.id) === index).slice(0, MAX_ADAPTERS);
    } catch {
      this.custom = [];
    }
    return this.list();
  }

  list(): RuntimeAdapterDescriptor[] {
    return [...BUILTIN_RUNTIME_ADAPTERS, ...this.custom].map(copyAdapter);
  }

  get(id: RuntimeId): RuntimeAdapterDescriptor | undefined {
    return this.list().find((adapter) => adapter.id === id);
  }

  async create(request: RuntimeAdapterCreateRequest): Promise<RuntimeAdapterDescriptor[]> {
    if (this.custom.length >= MAX_ADAPTERS) throw new Error(`Custom adapter limit is ${MAX_ADAPTERS}`);
    const id = validateCustomAdapterId(request.id);
    if (this.get(id)) throw new Error(`Runtime adapter ${id} already exists`);
    const adapter: RuntimeAdapterDescriptor = {
      id,
      name: validateAdapterName(request.name),
      command: await validateExecutable(request.command),
      args: validateAdapterArgs(request.args),
      builtin: false,
    };
    const next = [...this.custom, adapter];
    await this.save(next);
    this.custom = next;
    return this.list();
  }

  async remove(id: RuntimeId, isInUse: (id: RuntimeId) => boolean): Promise<RuntimeAdapterDescriptor[]> {
    const adapter = this.get(id);
    if (!adapter) throw new Error(`Unknown runtime adapter ${id}`);
    if (adapter.builtin) throw new Error("Built-in runtime adapters cannot be removed");
    if (isInUse(id)) throw new Error("Stop all agents using this adapter before removing it");
    const next = this.custom.filter((candidate) => candidate.id !== id);
    await this.save(next);
    this.custom = next;
    return this.list();
  }

  private save(adapters: RuntimeAdapterDescriptor[]): Promise<void> {
    const snapshot = adapters.map(copyAdapter);
    this.saveQueue = this.saveQueue.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.tmp`;
      await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.filePath);
    });
    return this.saveQueue;
  }
}

export function validateCustomAdapterId(value: unknown): RuntimeId {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw new Error("Adapter id must be 1-48 lowercase letters, numbers, or hyphens");
  return `custom:${value}`;
}

export function validateAdapterName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80) throw new Error("Adapter name must be 1-80 characters");
  return value.trim();
}

export async function validateExecutable(value: unknown): Promise<string> {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw new Error("Custom adapter executable must be an absolute path");
  const resolved = path.resolve(value);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isFile()) throw new Error("Custom adapter executable must be an existing file");
  await access(resolved, constants.X_OK).catch(() => { throw new Error("Custom adapter executable is not executable"); });
  return resolved;
}

export function validateAdapterArgs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_ARGS) throw new Error(`Adapter arguments must contain at most ${MAX_ARGS} entries`);
  return value.map((argument) => {
    if (typeof argument !== "string" || argument.length > MAX_ARG_LENGTH || argument.includes("\0")) throw new Error("Adapter argument is invalid");
    return argument;
  });
}

function parseStoredAdapter(value: unknown): RuntimeAdapterDescriptor[] | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id.startsWith("custom:") || !ID_PATTERN.test(row.id.slice(7))) return null;
  try {
    return [{ id: row.id as RuntimeId, name: validateAdapterName(row.name), command: storedAbsoluteCommand(row.command), args: validateAdapterArgs(row.args), builtin: false }];
  } catch { return null; }
}

function storedAbsoluteCommand(value: unknown): string {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw new Error("Invalid stored executable");
  return path.resolve(value);
}

function copyAdapter(adapter: RuntimeAdapterDescriptor): RuntimeAdapterDescriptor { return { ...adapter, args: [...adapter.args] }; }
