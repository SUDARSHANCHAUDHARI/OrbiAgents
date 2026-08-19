import { db } from "./db";

export type MemoryScope = "agent" | "shared";

export interface WriteMemoryInput {
  userId: string;
  projectKey?: string;
  scope: MemoryScope;
  agentId?: string;
  content: string;
}

export function validateMemory(input: WriteMemoryInput): void {
  if (!input.content.trim()) throw new Error("Memory content is required");
  if (input.content.length > 10_000) throw new Error("Memory content is too long");
  if (input.scope === "agent" && !input.agentId?.trim()) {
    throw new Error("agentId is required for agent memory");
  }
  if (input.scope === "shared" && input.agentId) {
    throw new Error("Shared memory cannot have an agentId");
  }
}

export async function writeMemory(input: WriteMemoryInput) {
  validateMemory(input);
  return db.memoryEntry.create({
    data: {
      userId: input.userId,
      projectKey: input.projectKey?.trim() || "default",
      scope: input.scope,
      agentId: input.agentId?.trim() || null,
      content: input.content.trim(),
    },
  });
}

export async function listMemory(
  userId: string,
  options: { projectKey?: string; scope?: MemoryScope; agentId?: string; limit?: number } = {}
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  return db.memoryEntry.findMany({
    where: {
      userId,
      projectKey: options.projectKey ?? "default",
      scope: options.scope,
      agentId: options.agentId,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
