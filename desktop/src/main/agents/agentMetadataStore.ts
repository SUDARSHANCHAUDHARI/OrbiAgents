import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { RUNTIME_IDS, type AgentSession, type AgentWorkspace, type RuntimeId } from "../../shared/contracts";

interface StoredAgent {
  id: string;
  name: string;
  runtimeId: RuntimeId;
  cwd: string;
  status: AgentSession["status"];
  startedAt: number;
  exitedAt?: number;
  exitCode?: number;
  signal?: number;
  workspace: AgentWorkspace;
}

export interface InterruptedAgentSession { id: string; name: string; runtimeId: RuntimeId; sourcePath: string; workspacePath: string; startedAt: number; recoveredAt: number; }
export interface AgentMetadataLoadResult { sessions: AgentSession[]; interrupted: InterruptedAgentSession[]; }

export class AgentMetadataStore {
  private saveQueue = Promise.resolve();

  constructor(private readonly filePath: string, private readonly now: () => number = Date.now) {}

  async load(): Promise<AgentSession[]> {
    return (await this.loadWithRecovery()).sessions;
  }

  async loadWithRecovery(): Promise<AgentMetadataLoadResult> {
    const raw = await readFile(this.filePath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "[]";
      throw error;
    });
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return { sessions: [], interrupted: [] }; }
    if (!Array.isArray(value)) return { sessions: [], interrupted: [] };
    const interrupted: InterruptedAgentSession[] = [];
    const sessions = value.flatMap((candidate) => {
      const stored = parseStoredAgent(candidate);
      if (!stored) return [];
      const wasInterrupted = ["starting", "running", "stopping"].includes(stored.status);
      const recoveredAt = this.now();
      if (wasInterrupted) interrupted.push({ id: stored.id, name: stored.name, runtimeId: stored.runtimeId, sourcePath: stored.workspace.sourcePath, workspacePath: stored.workspace.path, startedAt: stored.startedAt, recoveredAt });
      const workspace = wasInterrupted && stored.workspace.status === "active"
        ? { ...stored.workspace, status: "preserved" as const }
        : stored.workspace;
      return [{
        ...stored,
        status: wasInterrupted ? "exited" as const : stored.status,
        exitCode: wasInterrupted ? -1 : stored.exitCode,
        exitedAt: wasInterrupted ? recoveredAt : stored.exitedAt,
        outputTail: "",
        workspace,
      }];
    });
    return { sessions, interrupted };
  }

  save(sessions: AgentSession[]): Promise<void> {
    const stored: StoredAgent[] = sessions.map(({ outputTail: _outputTail, pid: _pid, ...session }) => session);
    this.saveQueue = this.saveQueue.catch(() => undefined).then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.tmp`;
      await writeFile(temporary, `${JSON.stringify(stored, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.filePath);
    });
    return this.saveQueue;
  }
}

function parseStoredAgent(value: unknown): StoredAgent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.cwd !== "string" ||
    typeof row.runtimeId !== "string" ||
    (!RUNTIME_IDS.includes(row.runtimeId as (typeof RUNTIME_IDS)[number]) && !/^custom:[a-z0-9][a-z0-9-]{0,47}$/.test(row.runtimeId)) ||
    typeof row.status !== "string" ||
    !["starting", "running", "stopping", "exited", "failed"].includes(row.status) ||
    typeof row.startedAt !== "number"
  ) return null;
  const workspace = parseWorkspace(row.workspace, row.cwd);
  return { ...(row as unknown as Omit<StoredAgent, "workspace">), workspace };
}

function parseWorkspace(value: unknown, cwd: unknown): AgentWorkspace {
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.sourcePath === "string" && typeof row.path === "string" && typeof row.status === "string" && ["direct", "active", "cleaned", "preserved"].includes(row.status)) {
      return row as unknown as AgentWorkspace;
    }
  }
  const path = typeof cwd === "string" ? cwd : "";
  return { sourcePath: path, path, status: "direct" };
}
