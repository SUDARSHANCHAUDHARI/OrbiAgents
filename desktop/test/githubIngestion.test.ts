import assert from "node:assert/strict";
import test from "node:test";
import { GitHubIngestion, sanitizedEnvironment, type GhRunner } from "../src/main/github/githubIngestion";

test("GitHub ingestion uses fixed bounded read-only gh commands", async () => {
  const calls: Array<{ args: string[]; cwd?: string }> = [];
  const runner: GhRunner = { async run(args, cwd) { calls.push({ args, cwd }); if (args[0] === "auth") return { code: 0, stdout: "" }; if (args[0] === "repo") return { code: 0, stdout: JSON.stringify({ nameWithOwner: "owner/repo", url: "https://github.com/owner/repo" }) }; if (args[0] === "issue") return { code: 0, stdout: JSON.stringify([{ number: 3, title: "Fix bug", state: "OPEN", updatedAt: "2026-08-28T00:00:00Z", url: "https://github.com/owner/repo/issues/3", labels: [{ name: "bug" }] }]) }; return { code: 0, stdout: JSON.stringify([{ databaseId: 9, name: "test", workflowName: "CI", status: "completed", conclusion: "success", headBranch: "main", event: "push", updatedAt: "2026-08-28T00:00:00Z", url: "https://github.com/owner/repo/actions/runs/9" }]) }; } };
  const snapshot = await new GitHubIngestion(runner, () => 123).snapshot("/repo");
  assert.equal(snapshot.repository.nameWithOwner, "owner/repo"); assert.equal(snapshot.issues[0]?.labels[0], "bug"); assert.equal(snapshot.runs[0]?.conclusion, "success"); assert.equal(snapshot.fetchedAt, 123);
  assert.deepEqual(calls.map((call) => call.args.slice(0, 2)), [["auth", "status"], ["repo", "view"], ["issue", "list"], ["run", "list"]]);
  assert.equal(calls.slice(1).every((call) => call.cwd === "/repo"), true);
});

test("GitHub ingestion distinguishes missing and unauthenticated local CLI", async () => {
  const missing = new GitHubIngestion({ async run() { const error = new Error("missing") as NodeJS.ErrnoException; error.code = "ENOENT"; throw error; } });
  assert.deepEqual(await missing.authStatus(), { installed: false, authenticated: false });
  const signedOut = new GitHubIngestion({ async run() { return { code: 1, stdout: "token detail" }; } });
  assert.deepEqual(await signedOut.authStatus(), { installed: true, authenticated: false });
  await assert.rejects(signedOut.snapshot("/repo"), /gh auth login locally/);
});

test("GitHub ingestion rejects malformed or untrusted responses", async () => {
  let count = 0; const ingestion = new GitHubIngestion({ async run() { count += 1; if (count === 1) return { code: 0, stdout: "" }; return { code: 0, stdout: JSON.stringify({ nameWithOwner: "owner/repo", url: "https://evil.test/owner/repo" }) }; } });
  await assert.rejects(ingestion.snapshot("/repo"), /repository response is invalid/);
});

test("GitHub child environment excludes token overrides and unrelated secrets", () => {
  assert.deepEqual(sanitizedEnvironment({ PATH: "/bin", HOME: "/home", GH_TOKEN: "secret", GITHUB_TOKEN: "secret", APP_SECRET: "secret" }), { PATH: "/bin", HOME: "/home", NO_COLOR: "1" });
});
