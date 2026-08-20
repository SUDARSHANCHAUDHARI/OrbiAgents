import assert from "node:assert/strict";
import test from "node:test";
import { configuredMemoryEmbedder, rankByEmbeddings } from "../memoryEmbedding";

test("embedding retrieval is opt-in and ranks by vector similarity", async () => {
  assert.equal(configuredMemoryEmbedder({}), null);
  const entries = ["unrelated", "relevant"];
  const ranked = await rankByEmbeddings(entries, "query", (value) => value, { async embed() { return [[1, 0], [0, 1], [0.9, 0.1]]; } });
  assert.deepEqual(ranked, ["relevant", "unrelated"]);
});
