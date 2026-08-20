import { db } from "./db";
const telemetry = new Map<string,{hits:number;misses:number}>();
export function recordEmbeddingCacheLookup(userId:string,hits:number,misses:number){const value=telemetry.get(userId)??{hits:0,misses:0};value.hits+=hits;value.misses+=misses;telemetry.set(userId,value);}
export function embeddingCacheTelemetry(userId:string){const value=telemetry.get(userId)??{hits:0,misses:0};const total=value.hits+value.misses;return {...value,hitRate:total?value.hits/total:0};}

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
export async function clearEmbeddingCache(userId: string): Promise<number> { telemetry.delete(userId); return (await db.memoryEmbeddingCache.deleteMany({ where: { userId } })).count; }
