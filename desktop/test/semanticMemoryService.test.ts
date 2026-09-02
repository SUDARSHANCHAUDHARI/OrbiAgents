import assert from "node:assert/strict";
import test from "node:test";
import { SemanticMemoryService } from "../src/main/memory/semanticMemoryService";

test("semantic memory invokes MemPalace with bounded literal arguments and local CPU embeddings on macOS", async () => {
  const calls: Array<{ file: string; args: string[]; env: NodeJS.ProcessEnv }> = [];
  const service = new SemanticMemoryService("/private/palace", { platform: "darwin", environment: { PATH: "/tools" }, findBin: async () => "/tools/mempalace", run: async (file, args, env) => { calls.push({ file, args, env }); return { stdout: "semantic result", stderr: "" }; } });
  assert.equal((await service.index("/repo", "/private/memory")).active, true);
  const result = await service.search("/repo", "release safety", 5, async () => "fallback");
  assert.equal(result.output, "semantic result"); assert.equal(calls.length, 2); assert.equal(calls[0]?.file, "/tools/mempalace");
  assert.deepEqual(calls[0]?.args.slice(0, 2), ["mine", "/private/memory"]); assert.deepEqual(calls[1]?.args.slice(0, 2), ["search", "release safety"]);
  assert.equal(calls[0]?.env.MEMPALACE_PALACE_PATH, "/private/palace"); assert.equal(calls[0]?.env.MEMPALACE_EMBEDDING_DEVICE, "cpu");
});

test("semantic memory reports and returns deterministic fallback when MemPalace is absent", async () => {
  const service = new SemanticMemoryService("/palace", { findBin: async () => undefined });
  assert.deepEqual(await service.status(), { available: false, active: false, provider: "keyword", model: "minilm", detail: "MemPalace is unavailable; searches use deterministic local text ranking." });
  const result = await service.search("/repo", "query", 5, async () => "# Verified memory\nFallback result");
  assert.equal(result.status.provider, "keyword"); assert.equal(result.output, "# Verified memory\nFallback result");
});

test("semantic memory serializes index writers", async () => {
  let active = 0; let peak = 0;
  const service = new SemanticMemoryService("/palace", { findBin: async () => "/mempalace", run: async () => { active += 1; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 5)); active -= 1; return { stdout: "", stderr: "" }; } });
  await Promise.all([service.index("/one", "/memory/one"), service.index("/two", "/memory/two")]);
  assert.equal(peak, 1);
});
