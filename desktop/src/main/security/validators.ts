import { stat } from "node:fs/promises";
import path from "node:path";
import { RUNTIME_IDS, type CreateAgentRequest, type RuntimeId } from "../../shared/contracts";

const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const MAX_NAME_LENGTH = 80;
const MAX_INPUT_BYTES = 64 * 1024;

export function validateAgentId(value: unknown): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new Error("Agent id must be 1-64 letters, numbers, underscores, or hyphens");
  }
  return value;
}

export function validateAgentName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Agent name is required");
  const name = value.trim();
  if (!name || name.length > MAX_NAME_LENGTH) throw new Error("Agent name must be 1-80 characters");
  return name;
}

export function validateRuntimeId(value: unknown): RuntimeId {
  if (typeof value !== "string" || (!RUNTIME_IDS.includes(value as (typeof RUNTIME_IDS)[number]) && !/^custom:[a-z0-9][a-z0-9-]{0,47}$/.test(value))) {
    throw new Error("Unsupported agent runtime");
  }
  return value as RuntimeId;
}

export function validateDimension(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 2 || (value as number) > 500) {
    throw new Error("Terminal dimensions must be integers between 2 and 500");
  }
  return value as number;
}

export async function validateWorkspace(value: unknown): Promise<string> {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw new Error("Workspace must be an absolute path");
  const info = await stat(value).catch(() => null);
  if (!info?.isDirectory()) throw new Error("Workspace directory does not exist");
  return path.resolve(value);
}

export function validateTerminalInput(value: unknown): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > MAX_INPUT_BYTES) {
    throw new Error("Terminal input must be a string no larger than 64 KB");
  }
  return value;
}

export function validateRelativeFiles(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("Workspace files must be an array of at most 200 paths");
  return value.map((candidate) => {
    if (typeof candidate !== "string" || !candidate.trim() || path.isAbsolute(candidate) || candidate.split(/[\\/]/).includes("..")) {
      throw new Error("Workspace file path is unsafe");
    }
    return candidate.trim();
  });
}

export type ValidatedCreateAgentRequest = Required<Omit<CreateAgentRequest, "isolateWorkspace">> & { isolateWorkspace: boolean };

export async function validateCreateAgentRequest(value: unknown): Promise<ValidatedCreateAgentRequest> {
  if (!value || typeof value !== "object") throw new Error("Agent request is required");
  const request = value as Record<string, unknown>;
  return {
    id: validateAgentId(request.id),
    name: validateAgentName(request.name),
    runtimeId: validateRuntimeId(request.runtimeId),
    cwd: await validateWorkspace(request.cwd),
    cols: validateDimension(request.cols, 100),
    rows: validateDimension(request.rows, 30),
    isolateWorkspace: request.isolateWorkspace === true,
  };
}
