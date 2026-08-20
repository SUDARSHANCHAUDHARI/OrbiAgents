import OpenAI from "openai";

export interface MemoryEmbedder { embed(texts: string[]): Promise<number[][]> }

export class OpenAIMemoryEmbedder implements MemoryEmbedder {
  private readonly client: OpenAI;
  constructor(apiKey: string, private readonly model = "text-embedding-3-small") { this.client = new OpenAI({ apiKey }); }
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

function vectorCosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Embedding dimensions do not match");
  let dot = 0; let ma = 0; let mb = 0;
  for (let index = 0; index < a.length; index += 1) { dot += a[index] * b[index]; ma += a[index] ** 2; mb += b[index] ** 2; }
  return ma && mb ? dot / Math.sqrt(ma * mb) : 0;
}
