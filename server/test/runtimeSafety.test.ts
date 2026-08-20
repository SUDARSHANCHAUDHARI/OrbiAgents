import assert from "node:assert/strict";
import test from "node:test";
import { CircuitOpenError, WorkflowCircuitBreaker } from "../circuitBreaker";
import { ApiRuntimeAdapter, codexCliDescriptor, LocalCliRuntimeAdapter } from "../runtimeAdapter";
import { SpawnProcessRunner } from "../processRunner";
import { GitWorktreeIsolation } from "../workspaceIsolation";
import { availableRuntimeIds, createRuntimeExecution } from "../runtimeConfig";
import { validateServerEnv } from "../env";

test("API runtime remains the available default", async () => {
  const adapter = new ApiRuntimeAdapter();
  assert.equal(adapter.kind, "api");
  assert.equal(await adapter.isAvailable(), true);
});

test("local CLI runtime is disabled unless explicitly configured", async () => {
  const adapter = new LocalCliRuntimeAdapter(codexCliDescriptor(false));
  assert.equal(await adapter.isAvailable(), false);
  await assert.rejects(
    adapter.execute({ systemPrompt: "x", userMessage: "y", onChunk: () => {} }),
    /not enabled/
  );
});

test("local CLI runtime sends prompts through an injected no-shell runner", async () => {
  const calls: Array<{ command: string; args: string[]; cwd: string; stdin?: string }> = [];
  const adapter = new LocalCliRuntimeAdapter(codexCliDescriptor(true), {
    async run(request) {
      calls.push(request);
      await request.onStdout?.("working");
      return { stdout: "complete", stderr: "", exitCode: 0 };
    },
  });
  const chunks: string[] = [];
  const result = await adapter.execute({
    systemPrompt: "system",
    userMessage: "task",
    workspacePath: "/isolated/repo",
    onChunk: (chunk) => { chunks.push(chunk); },
  });
  assert.equal(await adapter.isAvailable(), true);
  assert.equal(calls[0].command, "codex");
  assert.deepEqual(calls[0].args.slice(0, 2), ["exec", "-"]);
  assert.equal(calls[0].cwd, "/isolated/repo");
  assert.equal(calls[0].stdin, "system\n\ntask");
  assert.deepEqual(chunks, ["working"]);
  assert.equal(result.text, "complete");
});

test("spawn runner rejects commands outside its allowlist before spawning", async () => {
  const runner = new SpawnProcessRunner(new Set(["codex"]));
  await assert.rejects(
    runner.run({ command: "sh", args: ["-c", "echo unsafe"], cwd: "/tmp" }),
    /not allowlisted/
  );
});

test("spawn runner streams output and aborts a running child", async () => {
  const runner = new SpawnProcessRunner(new Set([process.execPath]));
  const chunks: string[] = [];
  const completed = await runner.run({
    command: process.execPath,
    args: ["-e", "process.stdout.write('hello')"],
    cwd: "/tmp",
    onStdout: (chunk) => { chunks.push(chunk); },
  });
  assert.equal(completed.stdout, "hello");
  assert.equal(chunks.join(""), "hello");

  const controller = new AbortController();
  const running = runner.run({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    cwd: "/tmp",
    signal: controller.signal,
  });
  controller.abort(new Error("cancelled by test"));
  await assert.rejects(running, /cancelled by test/);
});

test("spawn runner terminates output beyond its configured bound", async () => {
  const runner = new SpawnProcessRunner(new Set([process.execPath]));
  await assert.rejects(
    runner.run({
      command: process.execPath,
      args: ["-e", "process.stdout.write('123456789')"],
      cwd: "/tmp",
      maxOutputBytes: 4,
    }),
    /output exceeded 4 bytes/
  );
});

test("worktree isolation sanitizes names and releases once", async () => {
  const calls: string[] = [];
  const isolation = new GitWorktreeIsolation("/repo", "/tmp/orbi-worktrees", {
    async add(_repo, target, branch) { calls.push(`add:${target}:${branch}`); },
    async isClean(_repo, target) { calls.push(`clean:${target}`); return true; },
    async remove(_repo, target) { calls.push(`remove:${target}`); },
  });
  const lease = await isolation.acquire("run/one", "coder:primary");
  assert.equal(lease.path, "/tmp/orbi-worktrees/run-one-coder-primary");
  await lease.release();
  await lease.release();
  assert.equal(calls.length, 3);
});

test("worktree isolation preserves dirty agent changes", async () => {
  let removed = false;
  const isolation = new GitWorktreeIsolation("/repo", "/tmp/orbi-worktrees", {
    async add() {},
    async isClean() { return false; },
    async remove() { removed = true; },
  });
  const lease = await isolation.acquire("run", "coder");
  await lease.release();
  assert.equal(removed, false);
});

test("circuit breaker opens on runtime, retry, token, cost, and failure limits", () => {
  const limits = { maxRuntimeMs: 10, maxRetriesPerNode: 0, maxTotalTokens: 5, maxCostUsd: 1, maxConsecutiveFailures: 1 };
  assert.throws(() => new WorkflowCircuitBreaker(limits, 0).check(11), CircuitOpenError);
  assert.throws(() => new WorkflowCircuitBreaker(limits).recordRetry("node"), /Retry limit/);
  assert.throws(() => new WorkflowCircuitBreaker(limits).recordSuccess(3, 3, 0), /token budget/);
  assert.throws(() => new WorkflowCircuitBreaker(limits).recordSuccess(1, 1, 2), /cost budget/);
  assert.throws(() => new WorkflowCircuitBreaker(limits).recordFailure(), /failure limit/);
});

test("local runtimes are opt-in and require absolute isolation paths", () => {
  assert.deepEqual(availableRuntimeIds({}), ["provider-api"]);
  assert.throws(() => createRuntimeExecution("codex-cli", {}), /not enabled/);
  assert.throws(
    () => createRuntimeExecution("codex-cli", { LOCAL_CLI_ENABLED: "true" }),
    /LOCAL_CLI_REPO_PATH is required/
  );
  const execution = createRuntimeExecution("claude-cli", {
    LOCAL_CLI_ENABLED: "true",
    LOCAL_CLI_REPO_PATH: "/repo",
    LOCAL_CLI_WORKTREE_ROOT: "/tmp/orbi-worktrees",
  });
  assert.equal(execution.runtime.id, "claude-cli");
  assert.ok(execution.workspaceIsolation);
});

test("environment validation rejects unsafe local CLI configuration", () => {
  assert.throws(() => validateServerEnv({ MAX_PARALLEL_AGENTS: "not-a-number" }), /MAX_PARALLEL_AGENTS/);
  assert.throws(() => validateServerEnv({ TRUST_PROXY: "sometimes" }), /TRUST_PROXY must be true or false/);
  assert.throws(
    () => validateServerEnv({ LOCAL_CLI_ENABLED: "yes" }),
    /must be true or false/
  );
  assert.throws(
    () => validateServerEnv({ LOCAL_CLI_ENABLED: "true", LOCAL_CLI_REPO_PATH: "relative", LOCAL_CLI_WORKTREE_ROOT: "/tmp/worktrees" }),
    /LOCAL_CLI_REPO_PATH must be an absolute normalized path/
  );
  assert.throws(
    () => validateServerEnv({ LOCAL_CLI_ENABLED: "true", LOCAL_CLI_REPO_PATH: "/repo", LOCAL_CLI_WORKTREE_ROOT: "/repo/worktrees" }),
    /must be outside/
  );
});
