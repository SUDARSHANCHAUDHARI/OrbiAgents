import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type HiveTaskStatus = "pending" | "assigned" | "in-progress" | "blocked" | "completed" | "failed";

export interface HiveTask {
  id: string;
  title: string;
  detail: string;
  status: HiveTaskStatus;
  assigneeAgentId?: string;
  dependencyIds: string[];
  attempt: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
}

export interface BlackboardEntry {
  key: string;
  value: string;
  authorAgentId: string;
  version: number;
  updatedAt: number;
}

export class HiveState {
  private writeQueue = Promise.resolve();

  constructor(private readonly root: string) {}

  async createTask(input: { title: string; detail?: string; dependencyIds?: string[]; maxAttempts?: number }): Promise<HiveTask> {
    const title = input.title.trim();
    if (!title || title.length > 300) throw new Error("Task title must contain 1 to 300 characters");
    const detail = input.detail?.trim() ?? "";
    if (detail.length > 20_000) throw new Error("Task detail is too long");
    const maxAttempts = input.maxAttempts ?? 2;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error("Task maxAttempts must be between 1 and 5");
    const now = Date.now();
    const task: HiveTask = { id: randomUUID(), title, detail, status: "pending", dependencyIds: [...new Set(input.dependencyIds ?? [])], attempt: 0, maxAttempts, createdAt: now, updatedAt: now };
    await this.updateTasks((tasks) => [...tasks, task]);
    return task;
  }

  async assign(taskId: string, agentId: string): Promise<HiveTask> {
    let assigned: HiveTask | undefined;
    await this.updateTasks((tasks) => tasks.map((task) => {
      if (task.id !== taskId) return task;
      const incomplete = task.dependencyIds.filter((id) => tasks.find((candidate) => candidate.id === id)?.status !== "completed");
      if (incomplete.length) throw new Error("Task dependencies are incomplete");
      if (task.status !== "pending" && task.status !== "blocked") throw new Error("Task cannot be assigned from its current status");
      assigned = { ...task, status: "assigned", assigneeAgentId: safeId(agentId), updatedAt: Date.now() };
      return assigned;
    }));
    if (!assigned) throw new Error("Task not found");
    return assigned;
  }

  async transition(taskId: string, status: Extract<HiveTaskStatus, "in-progress" | "blocked" | "completed" | "failed">): Promise<HiveTask> {
    let updated: HiveTask | undefined;
    await this.updateTasks((tasks) => tasks.map((task) => {
      if (task.id !== taskId) return task;
      const allowed: Record<string, HiveTaskStatus[]> = { assigned: ["in-progress", "blocked", "failed"], "in-progress": ["blocked", "completed", "failed"], blocked: ["failed"] };
      if (!allowed[task.status]?.includes(status)) throw new Error("Invalid task transition");
      const attempt = status === "in-progress" ? task.attempt + 1 : task.attempt;
      if (attempt > task.maxAttempts) throw new Error("Task retry limit exceeded");
      updated = { ...task, status, attempt, updatedAt: Date.now() };
      return updated;
    }));
    if (!updated) throw new Error("Task not found");
    return updated;
  }

  async listTasks(): Promise<HiveTask[]> {
    return this.readJson<HiveTask[]>(join(this.root, "tasks.json"), []);
  }

  async putBlackboard(key: string, value: string, authorAgentId: string, expectedVersion?: number): Promise<BlackboardEntry> {
    const safeKey = key.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(safeKey) || safeKey.includes("..")) throw new Error("Invalid blackboard key");
    if (!value.trim() || value.length > 50_000) throw new Error("Blackboard value must contain 1 to 50000 characters");
    let saved: BlackboardEntry | undefined;
    await this.enqueue(async () => {
      const path = join(this.root, "blackboard.json");
      const entries = await this.readJson<Record<string, BlackboardEntry>>(path, {});
      const current = entries[safeKey];
      if (expectedVersion !== undefined && (current?.version ?? 0) !== expectedVersion) throw new Error("Blackboard version conflict");
      saved = { key: safeKey, value, authorAgentId: safeId(authorAgentId), version: (current?.version ?? 0) + 1, updatedAt: Date.now() };
      entries[safeKey] = saved;
      await atomicWrite(path, entries);
    });
    return saved!;
  }

  async readBlackboard(): Promise<Record<string, BlackboardEntry>> {
    return this.readJson(join(this.root, "blackboard.json"), {});
  }

  private async updateTasks(update: (tasks: HiveTask[]) => HiveTask[]): Promise<void> {
    await this.enqueue(async () => {
      const path = join(this.root, "tasks.json");
      await atomicWrite(path, update(await this.readJson(path, [])));
    });
  }

  private async enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.catch(() => undefined);
    await result;
  }

  private async readJson<T>(path: string, fallback: T): Promise<T> {
    try { return JSON.parse(await readFile(path, "utf8")) as T; } catch { return fallback; }
  }
}

function safeId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized)) throw new Error("Invalid Hive identifier");
  return normalized;
}

async function atomicWrite(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}
