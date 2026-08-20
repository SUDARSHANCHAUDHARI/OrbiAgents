import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceRegistry } from "../workspaceRegistry";
import { WorkspaceOperations } from "../workspaceOperations";
import { db } from "../db";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
      const stdout = request.args.includes("--short") ? " M file.ts\n" : request.args.includes("--name-only") ? "file.ts\0" : request.args.includes("ls-files") ? "new.ts\0" : " file.ts | 1 +\n";
      return { stdout, stderr: "", exitCode: 0 };
    },
  });
  const result = await operations.inspect("/managed/worktrees/run-node");
  assert.match(result.status, /file.ts/);
  assert.deepEqual(result.files, ["file.ts"]);
  assert.deepEqual(result.untrackedFiles, ["new.ts"]);
  assert.equal(calls.length, 5);
  await assert.rejects(operations.inspect("/repo"), /outside the managed root/);
});

test("workspace apply copies an explicitly selected regular untracked file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-workspace-"));
  const repo = path.join(root, "repo"); const worktrees = path.join(root, "worktrees"); const worktree = path.join(worktrees, "run-node");
  await mkdir(path.join(worktree, "src"), { recursive: true }); await mkdir(repo);
  await writeFile(path.join(worktree, "src", "new.ts"), "export const safe = true;\n");
  const operations = new WorkspaceOperations(repo, worktrees, { async run() { return { stdout: "", stderr: "", exitCode: 0 }; } });
  try {
    await operations.applyFiles(worktree, [], ["src/new.ts"]);
    assert.equal(await readFile(path.join(repo, "src", "new.ts"), "utf8"), "export const safe = true;\n");
    await assert.rejects(operations.applyFiles(worktree, [], ["src/new.ts"]), /must be clean|already exists/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("workspace inspection previews new text files and classifies binary files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-preview-")); const repo = path.join(root, "repo"); const worktrees = path.join(root, "worktrees"); const worktree = path.join(worktrees, "run");
  await mkdir(worktree, { recursive: true }); await mkdir(repo); await writeFile(path.join(worktree, "note.txt"), "hello preview"); await writeFile(path.join(worktree, "asset.bin"), Buffer.from([0, 1, 2]));
  const operations = new WorkspaceOperations(repo, worktrees, { async run(request) { return { stdout: request.args.includes("ls-files") ? "note.txt\0asset.bin\0" : "", stderr: "", exitCode: 0 }; } });
  try { const result = await operations.inspect(worktree); assert.equal(result.untrackedPreviews[0].preview, "hello preview"); assert.equal(result.untrackedPreviews[1].kind, "binary"); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test("workspace inspection provides bounded image metadata and previews", async () => {
  const worktree = await mkdtemp(path.join(os.tmpdir(), "orbi-workspace-image-"));
  const image = Buffer.alloc(24); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(image); image.writeUInt32BE(32, 16); image.writeUInt32BE(16, 20);
  await writeFile(path.join(worktree, "preview.png"), image);
  const runner = { async run(request: { args: string[] }) { return { stdout: request.args.includes("ls-files") ? "preview.png\0" : "", stderr: "", exitCode: 0 }; } };
  const operations = new WorkspaceOperations("/repo", path.dirname(worktree), runner);
  try {
    const result = await operations.inspect(worktree); const preview = result.untrackedPreviews[0];
    assert.equal(preview.kind, "image"); assert.equal(preview.mimeType, "image/png"); assert.equal(preview.width, 32); assert.equal(preview.height, 16); assert.match(preview.imagePreview ?? "", /^data:image\/png;base64,/);
  } finally { await rm(worktree, { recursive: true, force: true }); }
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
