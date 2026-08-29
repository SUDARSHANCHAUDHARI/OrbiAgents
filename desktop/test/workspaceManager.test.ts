import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { NativeGitRunner, WorkspaceManager, type GitRunner } from "../src/main/workspaces/workspaceManager";

const run = promisify(execFile);

class FakeGit implements GitRunner {
  calls: string[][] = [];
  status = "";
  async run(args: string[]) {
    this.calls.push(args);
    if (args.includes("--show-toplevel")) return "/repo\n";
    if (args.includes("--short")) return this.status;
    if (args.includes("--stat")) return this.status ? "src/a.ts | 1 +\n" : "";
    if (args.includes("--name-only")) return this.status ? "src/a.ts\0" : "";
    if (args.includes("--others")) return this.status ? "src/new.ts\0" : "";
    return "";
  }
}

test("direct workspace leaves the selected directory untouched", async () => {
  const git = new FakeGit();
  const lease = await new WorkspaceManager("/managed", git).acquire("alpha", "/repo", false);
  assert.deepEqual(lease.workspace, { sourcePath: "/repo", path: "/repo", status: "direct" });
  assert.equal(git.calls.length, 0);
});

test("isolated workspace creates a scoped worktree and removes it only when clean", async () => {
  const git = new FakeGit();
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-worktrees-"));
  const lease = await new WorkspaceManager(root, git).acquire("alpha", "/repo", true);
  assert.equal(lease.workspace.path, path.join(root, "alpha"));
  assert.equal(lease.workspace.branch, "codex/orbi-alpha");
  const released = await lease.release();
  assert.equal(released.status, "cleaned");
  assert.ok(git.calls.some((args) => args.includes("remove")));
});

test("dirty workspace is preserved with bounded change metadata", async () => {
  const git = new FakeGit();
  git.status = " M src/a.ts\n?? src/new.ts\n";
  const root = await mkdtemp(path.join(os.tmpdir(), "orbi-worktrees-"));
  const lease = await new WorkspaceManager(root, git).acquire("beta", "/repo", true);
  const released = await lease.release();
  assert.equal(released.status, "preserved");
  assert.deepEqual(released.changes?.files, ["src/a.ts"]);
  assert.deepEqual(released.changes?.untrackedFiles, ["src/new.ts"]);
  assert.equal(git.calls.some((args) => args.includes("remove")), false);
});

test("preserved workspace inspection rejects paths outside the managed root", async () => {
  const manager = new WorkspaceManager("/managed", new FakeGit());
  await assert.rejects(manager.inspectPreserved({ sourcePath: "/repo", path: "/outside/alpha", status: "preserved" }), /outside the managed root/);
});

test("native Git isolation creates and preserves a genuinely dirty worktree", async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), "orbi-git-integration-"));
  const repo = path.join(sandbox, "repo");
  const root = path.join(sandbox, "worktrees");
  try {
    await run("git", ["init", repo]);
    await run("git", ["-C", repo, "config", "user.name", "Orbi Test"]);
    await run("git", ["-C", repo, "config", "user.email", "orbi@example.invalid"]);
    await writeFile(path.join(repo, "README.md"), "baseline\n");
    await run("git", ["-C", repo, "add", "README.md"]);
    await run("git", ["-C", repo, "commit", "-m", "baseline"]);
    const lease = await new WorkspaceManager(root, new NativeGitRunner()).acquire("native", repo, true);
    await writeFile(path.join(lease.workspace.path, "README.md"), "changed by agent\n");
    await writeFile(path.join(lease.workspace.path, "new.txt"), "new agent file\n");
    const released = await lease.release();
    assert.equal(released.status, "preserved");
    assert.deepEqual(released.changes?.files, ["README.md"]);
    assert.deepEqual(released.changes?.untrackedFiles, ["new.txt"]);
    const manager = new WorkspaceManager(root, new NativeGitRunner());
    await manager.apply(released, ["README.md"], ["new.txt"]);
    assert.equal(await readFile(path.join(repo, "README.md"), "utf8"), "changed by agent\n");
    assert.equal(await readFile(path.join(repo, "new.txt"), "utf8"), "new agent file\n");
    const discarded = await manager.discard(released);
    assert.equal(discarded.status, "cleaned");
    await assert.rejects(stat(released.path), /ENOENT/);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
