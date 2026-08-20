import OpenAI from "openai";
import { createHash } from "node:crypto";

export interface MemoryEmbedder { readonly cacheKey?: string; embed(texts: string[]): Promise<number[][]> }
export interface EmbeddingCache {
  get(keys: string[]): Promise<Map<string, number[]>>;
  set(entries: Array<{ key: string; vector: number[] }>): Promise<void>;
}

export class OpenAIMemoryEmbedder implements MemoryEmbedder {
  private readonly client: OpenAI;
  constructor(apiKey: string, private readonly model = "text-embedding-3-small") { this.client = new OpenAI({ apiKey }); }
  get cacheKey(): string { return `openai:${this.model}`; }
  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({ model: this.model, input: texts });
    return response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}

export function configuredMemoryEmbedder(env: NodeJS.ProcessEnv = process.env): MemoryEmbedder | null {
  if (env.MEMORY_EMBEDDINGS_ENABLED !== "true" || !env.OPENAI_API_KEY) return null;
  return new OpenAIMemoryEmbedder(env.OPENAI_API_KEY, env.MEMORY_EMBEDDING_MODEL || undefined);
}

export async function rankByEmbeddings<T>(entries: T[], query: string, content: (entry: T) => string, embedder: MemoryEmbedder, limit = 20): Promise<T[]> {
  if (entries.length === 0) return [];
  const vectors = await embedder.embed([query, ...entries.map(content)]);
  if (vectors.length !== entries.length + 1) throw new Error("Embedding response length mismatch");
  return entries.map((entry, index) => ({ entry, score: vectorCosine(vectors[0], vectors[index + 1]) })).sort((a, b) => b.score - a.score).slice(0, limit).map(({ entry }) => entry);
}

export async function rankByCachedEmbeddings<T>(entries: T[], query: string, content: (entry: T) => string, embedder: MemoryEmbedder, cache: EmbeddingCache, limit = 20): Promise<T[]> {
  if (entries.length === 0) return [];
  const texts = [query, ...entries.map(content)];
  const keys = texts.map((text) => createHash("sha256").update(`${embedder.cacheKey ?? "default"}\0${text}`).digest("hex"));
  const cached = await cache.get(keys);
  const missingIndexes = keys.map((key, index) => cached.has(key) ? -1 : index).filter((index) => index >= 0);
  if (missingIndexes.length) {
    const vectors = await embedder.embed(missingIndexes.map((index) => texts[index]));
    if (vectors.length !== missingIndexes.length) throw new Error("Embedding response length mismatch");
    await cache.set(missingIndexes.map((index, vectorIndex) => ({ key: keys[index], vector: vectors[vectorIndex] })));
    missingIndexes.forEach((index, vectorIndex) => cached.set(keys[index], vectors[vectorIndex]));
  }
  const vectors = keys.map((key) => cached.get(key)!);
  return entries.map((entry, index) => ({ entry, score: vectorCosine(vectors[0], vectors[index + 1]) })).sort((a, b) => b.score - a.score).slice(0, limit).map(({ entry }) => entry);
}

function vectorCosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Embedding dimensions do not match");
  let dot = 0; let ma = 0; let mb = 0;
  for (let index = 0; index < a.length; index += 1) { dot += a[index] * b[index]; ma += a[index] ** 2; mb += b[index] ** 2; }
  return ma && mb ? dot / Math.sqrt(ma * mb) : 0;
}
