import assert from "node:assert/strict";
import test from "node:test";
import { configuredMemoryEmbedder, rankByCachedEmbeddings, rankByEmbeddings } from "../memoryEmbedding";

test("embedding retrieval is opt-in and ranks by vector similarity", async () => {
  assert.equal(configuredMemoryEmbedder({}), null);
  const entries = ["unrelated", "relevant"];
  const ranked = await rankByEmbeddings(entries, "query", (value) => value, { async embed() { return [[1, 0], [0, 1], [0.9, 0.1]]; } });
  assert.deepEqual(ranked, ["relevant", "unrelated"]);
});

test("embedding retrieval reuses cached vectors and embeds only misses", async () => {
  const values = new Map<string, number[]>(); let embedded = 0;
  const cache = { async get(keys: string[]) { return new Map(keys.flatMap((key) => values.has(key) ? [[key, values.get(key)!] as const] : [])); }, async set(entries: Array<{ key: string; vector: number[] }>) { entries.forEach(({ key, vector }) => values.set(key, vector)); } };
  const embedder = { cacheKey: "test", async embed(texts: string[]) { embedded += texts.length; return texts.map((text) => text === "relevant" ? [1, 0] : [0, 1]); } };
  await rankByCachedEmbeddings(["relevant", "other"], "query", String, embedder, cache);
  await rankByCachedEmbeddings(["relevant", "other"], "query", String, embedder, cache);
  assert.equal(embedded, 3);
});
