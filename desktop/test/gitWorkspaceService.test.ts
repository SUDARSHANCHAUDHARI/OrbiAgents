import assert from "node:assert/strict";
import test from "node:test";
import { GitWorkspaceService, type GitRunner } from "../src/main/git/gitWorkspaceService";

test("Git workspace snapshot uses fixed read-only commands and parses bounded facts", async () => {
  const calls: string[][] = []; const runner: GitRunner = { async run(args) { calls.push(args); if (args[0] === "status") return { code: 0, stdout: "## feature...origin/feature [ahead 2, behind 1]\n M src/app.ts\n?? note.md\n" }; if (args[0] === "log") return { code: 0, stdout: "abc123\tdef456 789abc\t100\tAdd feature\n" }; if (args.includes("--stat")) return { code: 0, stdout: " src/app.ts | 2 +-\n" }; return { code: 0, stdout: "diff --git a/src/app.ts b/src/app.ts\n" }; } };
  const result = await new GitWorkspaceService(runner, () => 7).snapshot("/repo");
  assert.deepEqual(result, { branch: "feature", upstream: "origin/feature", ahead: 2, behind: 1, changes: [{ status: " M", path: "src/app.ts" }, { status: "??", path: "note.md" }], commits: [{ hash: "abc123", parentHashes: ["def456", "789abc"], timestamp: 100_000, subject: "Add feature" }], diffStat: "src/app.ts | 2 +-", diff: "diff --git a/src/app.ts b/src/app.ts", fetchedAt: 7, truncated: false });
  assert.deepEqual(calls.map((args) => args[0]), ["status", "log", "diff", "diff"]);
  assert.equal(calls[3].some((value) => value.includes(".env")), true);
});

test("Git workspace snapshot rejects non-repositories and malformed output", async () => {
  const failed: GitRunner = { async run() { return { code: 1, stdout: "" }; } }; await assert.rejects(new GitWorkspaceService(failed).snapshot("/repo"), /not a readable Git repository/);
  let index = 0; const malformed: GitRunner = { async run() { index += 1; return index === 1 ? { code: 0, stdout: "## main\nM\n" } : { code: 0, stdout: "" }; } }; await assert.rejects(new GitWorkspaceService(malformed).snapshot("/repo"), /status output is invalid/);
});

test("Git branch operations use only verified local refs and refuse dirty checkout", async () => {
  const calls: string[][] = [];
  const runner: GitRunner = { async run(args) { calls.push(args); if (args[0] === "for-each-ref") return { code: 0, stdout: "main\nfeature/safe\n" }; if (args[0] === "status") return { code: 0, stdout: " M src/app.ts\n" }; return { code: 0, stdout: "bounded branch diff" }; } };
  const service = new GitWorkspaceService(runner);
  assert.deepEqual(await service.branches("/repo"), ["main", "feature/safe"]);
  assert.equal(await service.compare("/repo", "feature/safe"), "bounded branch diff");
  await assert.rejects(service.checkout("/repo", "feature/safe"), /clean working tree/);
  await assert.rejects(service.compare("/repo", "missing"), /not a local branch/);
  assert.deepEqual(calls.find((args) => args[0] === "diff")?.slice(0, 4), ["diff", "--no-ext-diff", "--unified=3", "HEAD...feature/safe"]);
  assert.equal(calls.some((args) => args[0] === "switch"), false);
});
