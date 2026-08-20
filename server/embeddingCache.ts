import { db } from "./db";

export function embeddingCacheLimits(env: NodeJS.ProcessEnv = process.env) {
  return { ttlDays: Math.max(1, Number(env.MEMORY_EMBEDDING_CACHE_TTL_DAYS ?? 30)), maxEntries: Math.max(10, Number(env.MEMORY_EMBEDDING_CACHE_MAX_ENTRIES ?? 1000)) };
}
export async function pruneEmbeddingCache(userId: string): Promise<{ entries: number; removed: number }> {
  const { ttlDays, maxEntries } = embeddingCacheLimits(); const cutoff = new Date(Date.now() - ttlDays * 86_400_000);
  let removed = (await db.memoryEmbeddingCache.deleteMany({ where: { userId, updatedAt: { lt: cutoff } } })).count;
  const overflow = await db.memoryEmbeddingCache.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, skip: maxEntries, select: { id: true } });
  if (overflow.length) removed += (await db.memoryEmbeddingCache.deleteMany({ where: { id: { in: overflow.map((row) => row.id) } } })).count;
  return { entries: await db.memoryEmbeddingCache.count({ where: { userId } }), removed };
}
export async function clearEmbeddingCache(userId: string): Promise<number> { return (await db.memoryEmbeddingCache.deleteMany({ where: { userId } })).count; }
