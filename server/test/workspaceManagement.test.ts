import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceRegistry } from "../workspaceRegistry";
import { WorkspaceOperations } from "../workspaceOperations";

test("workspace registry isolates records by user", () => {
  const registry = new WorkspaceRegistry();
  const first = registry.register({ userId: "user-a", runId: "run", nodeId: "coder", path: "/worktrees/a" });
  registry.register({ userId: "user-b", runId: "run", nodeId: "coder", path: "/worktrees/b" });
  assert.deepEqual(registry.list("user-a").map((record) => record.id), [first.id]);
  assert.equal(registry.get("user-b", first.id), null);
  assert.equal(registry.remove("user-b", first.id), false);
  assert.equal(registry.remove("user-a", first.id), true);
});

test("workspace operations inspect only paths below the configured root", async () => {
  const calls: string[][] = [];
  const operations = new WorkspaceOperations("/repo", "/managed/worktrees", {
    async run(request) {
      calls.push(request.args);
      return { stdout: request.args.includes("--short") ? " M file.ts\n" : " file.ts | 1 +\n", stderr: "", exitCode: 0 };
    },
  });
  const result = await operations.inspect("/managed/worktrees/run-node");
  assert.match(result.status, /file.ts/);
  assert.equal(calls.length, 2);
  await assert.rejects(operations.inspect("/repo"), /outside the managed root/);
});

test("workspace discard uses an explicit force-removal argument for a managed record", async () => {
  let args: string[] = [];
  const operations = new WorkspaceOperations("/repo", "/managed/worktrees", {
    async run(request) {
      args = request.args;
      return { stdout: "", stderr: "", exitCode: 0 };
    },
  });
  await operations.discard("/managed/worktrees/run-node");
  assert.deepEqual(args, ["-C", "/repo", "worktree", "remove", "--force", "/managed/worktrees/run-node"]);
});
