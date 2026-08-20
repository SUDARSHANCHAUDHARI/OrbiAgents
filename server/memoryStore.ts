import { db } from "./db";
import { configuredMemoryEmbedder, rankByCachedEmbeddings } from "./memoryEmbedding";
import { pruneEmbeddingCache } from "./embeddingCache";

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

export interface RankableMemory { content: string; updatedAt: Date }

export function rankMemoryEntries<T extends RankableMemory>(entries: T[], query: string, limit = 20): T[] {
  const queryTerms = termFrequency(query);
  if (queryTerms.size === 0) return entries.slice(0, limit);
  return entries.map((entry, index) => ({ entry, index, score: cosineSimilarity(queryTerms, termFrequency(entry.content)) }))
    .sort((a, b) => b.score - a.score || b.entry.updatedAt.getTime() - a.entry.updatedAt.getTime() || a.index - b.index)
    .slice(0, limit).map(({ entry }) => entry);
}

function termFrequency(value: string): Map<string, number> {
  const terms = value.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  const frequencies = new Map<string, number>();
  for (const term of terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  return frequencies;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0; let aMagnitude = 0; let bMagnitude = 0;
  for (const value of a.values()) aMagnitude += value * value;
  for (const [term, value] of b) { bMagnitude += value * value; dot += value * (a.get(term) ?? 0); }
  return aMagnitude && bMagnitude ? dot / Math.sqrt(aMagnitude * bMagnitude) : 0;
}

export async function buildRelevantMemoryContext(userId: string, projectKey: string, agentId: string, query: string): Promise<string> {
  const entries = await db.memoryEntry.findMany({
    where: { userId, projectKey, OR: [{ scope: "shared" }, { scope: "agent", agentId }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }] },
    orderBy: { updatedAt: "desc" }, take: 100,
  });
  const embedder = configuredMemoryEmbedder();
  let ranked = rankMemoryEntries(entries, query);
  if (embedder) {
    try {
      await pruneEmbeddingCache(userId);
      const model = embedder.cacheKey ?? "default";
      ranked = await rankByCachedEmbeddings(entries, query, (entry) => entry.content, embedder, {
        async get(keys) {
          const rows = await db.memoryEmbeddingCache.findMany({ where: { userId, model, contentHash: { in: keys } } });
          return new Map(rows.map((row) => [row.contentHash, JSON.parse(row.vector) as number[]]));
        },
        async set(values) {
          await db.$transaction(values.map(({ key, vector }) => db.memoryEmbeddingCache.upsert({
            where: { userId_model_contentHash: { userId, model, contentHash: key } },
            create: { userId, model, contentHash: key, vector: JSON.stringify(vector) },
            update: { vector: JSON.stringify(vector) },
          })));
        },
      });
    }
    catch (error) { console.warn(`[memory] Embedding retrieval failed; using local ranking: ${error instanceof Error ? error.message : String(error)}`); }
  }
  const content = ranked.map((entry) => `- ${entry.content}`).join("\n").slice(0, 8_000);
  return content ? `Relevant durable memory:\n${content}` : "";
}
