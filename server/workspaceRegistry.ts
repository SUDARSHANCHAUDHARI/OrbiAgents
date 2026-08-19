import { randomUUID } from "node:crypto";

export interface PreservedWorkspace {
  id: string;
  userId: string;
  runId: string;
  nodeId: string;
  path: string;
  createdAt: number;
}

export class WorkspaceRegistry {
  private readonly records = new Map<string, PreservedWorkspace>();

  register(input: Omit<PreservedWorkspace, "id" | "createdAt">): PreservedWorkspace {
    const record = { ...input, id: randomUUID(), createdAt: Date.now() };
    this.records.set(record.id, record);
    return record;
  }

  list(userId: string): PreservedWorkspace[] {
    return [...this.records.values()]
      .filter((record) => record.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  get(userId: string, id: string): PreservedWorkspace | null {
    const record = this.records.get(id);
    return record?.userId === userId ? record : null;
  }

  remove(userId: string, id: string): boolean {
    if (!this.get(userId, id)) return false;
    return this.records.delete(id);
  }
}

export const workspaceRegistry = new WorkspaceRegistry();
