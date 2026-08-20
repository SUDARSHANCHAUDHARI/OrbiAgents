import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceRegistry } from "../workspaceRegistry";
import { WorkspaceOperations } from "../workspaceOperations";
import { db } from "../db";
import { PrismaClient } from "@prisma/client";

test("workspace registry survives a fresh client and isolates records by user", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const [userA, userB] = await Promise.all([
    db.user.create({ data: { email: `workspace-a-${suffix}@test.local`, password: "test" } }),
    db.user.create({ data: { email: `workspace-b-${suffix}@test.local`, password: "test" } }),
  ]);
  const registry = new WorkspaceRegistry(db);
  const first = await registry.register({ userId: userA.id, runId: "run", nodeId: "coder", path: `/worktrees/a-${suffix}` });
  await registry.register({ userId: userB.id, runId: "run", nodeId: "coder", path: `/worktrees/b-${suffix}` });
  const restartedClient = new PrismaClient();
  try {
    const restartedRegistry = new WorkspaceRegistry(restartedClient);
    assert.deepEqual((await restartedRegistry.list(userA.id)).map((record) => record.id), [first.id]);
    assert.equal(await restartedRegistry.get(userB.id, first.id), null);
    assert.equal(await restartedRegistry.remove(userB.id, first.id), false);
    assert.equal(await restartedRegistry.remove(userA.id, first.id), true);
  } finally {
    await restartedClient.$disconnect();
    await db.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  }
});

test("workspace operations inspect only paths below the configured root", async () => {
  const calls: string[][] = [];
  const operations = new WorkspaceOperations("/repo", "/managed/worktrees", {
    async run(request) {
      calls.push(request.args);
      const stdout = request.args.includes("--short") ? " M file.ts\n" : request.args.includes("--name-only") ? "file.ts\0" : " file.ts | 1 +\n";
      return { stdout, stderr: "", exitCode: 0 };
    },
  });
  const result = await operations.inspect("/managed/worktrees/run-node");
  assert.match(result.status, /file.ts/);
  assert.deepEqual(result.files, ["file.ts"]);
  assert.equal(calls.length, 4);
  await assert.rejects(operations.inspect("/repo"), /outside the managed root/);
});

test("workspace apply validates paths, checks a clean target, and applies only selected tracked files", async () => {
  const calls: Array<{ args: string[]; stdin?: string }> = [];
  const operations = new WorkspaceOperations("/repo", "/managed/worktrees", {
    async run(request) {
      calls.push({ args: request.args, stdin: request.stdin });
      const isDiff = request.args.includes("diff");
      return { stdout: isDiff ? "diff --git a/src/a.ts b/src/a.ts\n" : "", stderr: "", exitCode: 0 };
    },
  });
  await operations.applyFiles("/managed/worktrees/run-node", ["src/a.ts"]);
  assert.deepEqual(calls.map((call) => call.args), [
    ["-C", "/repo", "status", "--porcelain"],
    ["-C", "/managed/worktrees/run-node", "diff", "--binary", "--", "src/a.ts"],
    ["-C", "/repo", "apply", "--check", "-"],
    ["-C", "/repo", "apply", "-"],
  ]);
  assert.match(calls[2].stdin ?? "", /diff --git/);
  await assert.rejects(operations.applyFiles("/managed/worktrees/run-node", ["../secret"]), /Unsafe file path/);
});

test("workspace apply refuses a dirty target repository", async () => {
  const operations = new WorkspaceOperations("/repo", "/managed/worktrees", {
    async run() { return { stdout: " M user-change.ts\n", stderr: "", exitCode: 0 }; },
  });
  await assert.rejects(operations.applyFiles("/managed/worktrees/run-node", ["src/a.ts"]), /must be clean/);
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
