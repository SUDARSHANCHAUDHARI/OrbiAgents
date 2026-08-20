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
