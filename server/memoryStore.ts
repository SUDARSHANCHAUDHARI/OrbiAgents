import { db } from "./db";

export type MemoryScope = "agent" | "shared";

export interface WriteMemoryInput {
  userId: string;
  projectKey?: string;
  scope: MemoryScope;
  agentId?: string;
  content: string;
  retentionDays?: number;
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
  if (input.retentionDays !== undefined && (!Number.isInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 3650)) {
    throw new Error("retentionDays must be an integer from 1 to 3650");
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
      expiresAt: input.retentionDays ? new Date(Date.now() + input.retentionDays * 86_400_000) : null,
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
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function updateMemory(userId: string, id: string, content: string, retentionDays?: number) {
  const existing = await db.memoryEntry.findFirst({ where: { id, userId } });
  if (!existing) return null;
  validateMemory({ userId, scope: existing.scope as MemoryScope, agentId: existing.agentId ?? undefined, content, retentionDays });
  return db.memoryEntry.update({ where: { id }, data: { content: content.trim(), expiresAt: retentionDays ? new Date(Date.now() + retentionDays * 86_400_000) : existing.expiresAt } });
}

export async function deleteMemory(userId: string, id: string): Promise<boolean> {
  return (await db.memoryEntry.deleteMany({ where: { id, userId } })).count === 1;
}

export async function buildMemoryContext(userId: string, projectKey: string, agentId: string): Promise<string> {
  const entries = await db.memoryEntry.findMany({
    where: { userId, projectKey, OR: [{ scope: "shared" }, { scope: "agent", agentId }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }] },
    orderBy: { updatedAt: "desc" }, take: 20,
  });
  const content = entries.map((entry) => `- ${entry.content}`).join("\n").slice(0, 8_000);
  return content ? `Relevant durable memory:\n${content}` : "";
}
