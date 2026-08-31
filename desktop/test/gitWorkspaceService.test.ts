import assert from "node:assert/strict";
import test from "node:test";
import { GitWorkspaceService, type GitRunner } from "../src/main/git/gitWorkspaceService";

test("Git workspace snapshot uses fixed read-only commands and parses bounded facts", async () => {
  const calls: string[][] = []; const runner: GitRunner = { async run(args) { calls.push(args); if (args[0] === "status") return { code: 0, stdout: "## feature...origin/feature [ahead 2, behind 1]\n M src/app.ts\n?? note.md\n" }; if (args[0] === "log") return { code: 0, stdout: "abc123\t100\tAdd feature\n" }; return { code: 0, stdout: " src/app.ts | 2 +-\n" }; } };
  const result = await new GitWorkspaceService(runner, () => 7).snapshot("/repo");
  assert.deepEqual(result, { branch: "feature", upstream: "origin/feature", ahead: 2, behind: 1, changes: [{ status: " M", path: "src/app.ts" }, { status: "??", path: "note.md" }], commits: [{ hash: "abc123", timestamp: 100_000, subject: "Add feature" }], diffStat: "src/app.ts | 2 +-", fetchedAt: 7, truncated: false });
  assert.deepEqual(calls.map((args) => args[0]), ["status", "log", "diff"]);
});

test("Git workspace snapshot rejects non-repositories and malformed output", async () => {
  const failed: GitRunner = { async run() { return { code: 1, stdout: "" }; } }; await assert.rejects(new GitWorkspaceService(failed).snapshot("/repo"), /not a readable Git repository/);
  let index = 0; const malformed: GitRunner = { async run() { index += 1; return index === 1 ? { code: 0, stdout: "## main\nM\n" } : { code: 0, stdout: "" }; } }; await assert.rejects(new GitWorkspaceService(malformed).snapshot("/repo"), /status output is invalid/);
});
