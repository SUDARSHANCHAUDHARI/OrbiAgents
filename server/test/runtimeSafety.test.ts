import assert from "node:assert/strict";
import test from "node:test";
import { CircuitOpenError, WorkflowCircuitBreaker } from "../circuitBreaker";
import { ApiRuntimeAdapter, LocalCliRuntimeAdapter } from "../runtimeAdapter";
import { GitWorktreeIsolation } from "../workspaceIsolation";

test("API runtime remains the available default", async () => {
  const adapter = new ApiRuntimeAdapter();
  assert.equal(adapter.kind, "api");
  assert.equal(await adapter.isAvailable(), true);
});

test("local CLI runtime is disabled unless explicitly configured", async () => {
  const adapter = new LocalCliRuntimeAdapter({ id: "codex-cli", command: "codex", enabled: false });
  assert.equal(await adapter.isAvailable(), false);
  await assert.rejects(
    adapter.execute({ systemPrompt: "x", userMessage: "y", onChunk: () => {} }),
    /not enabled/
  );
});

test("worktree isolation sanitizes names and releases once", async () => {
  const calls: string[] = [];
  const isolation = new GitWorktreeIsolation("/repo", "/tmp/orbi-worktrees", {
    async add(_repo, target, branch) { calls.push(`add:${target}:${branch}`); },
    async remove(_repo, target) { calls.push(`remove:${target}`); },
  });
  const lease = await isolation.acquire("run/one", "coder:primary");
  assert.equal(lease.path, "/tmp/orbi-worktrees/run-one-coder-primary");
  await lease.release();
  await lease.release();
  assert.equal(calls.length, 2);
});

test("circuit breaker opens on runtime, retry, token, cost, and failure limits", () => {
  const limits = { maxRuntimeMs: 10, maxRetriesPerNode: 0, maxTotalTokens: 5, maxCostUsd: 1, maxConsecutiveFailures: 1 };
  assert.throws(() => new WorkflowCircuitBreaker(limits, 0).check(11), CircuitOpenError);
  assert.throws(() => new WorkflowCircuitBreaker(limits).recordRetry("node"), /Retry limit/);
  assert.throws(() => new WorkflowCircuitBreaker(limits).recordSuccess(3, 3, 0), /token budget/);
  assert.throws(() => new WorkflowCircuitBreaker(limits).recordSuccess(1, 1, 2), /cost budget/);
  assert.throws(() => new WorkflowCircuitBreaker(limits).recordFailure(), /failure limit/);
});
