import assert from "node:assert/strict";
import test from "node:test";
import type { GitHubIssue, GitHubRun, GitHubSnapshot } from "../src/shared/contracts";
import { filterIssues, filterRuns, githubOverview, runCategory } from "../src/renderer/src/command/githubViewModel";

function run(id: number, status: string, conclusion: string): GitHubRun { return { id, name: "CI", workflowName: "CI", status, conclusion, headBranch: "main", event: "push", updatedAt: "2026-08-30T00:00:00Z", url: `https://github.com/o/r/actions/runs/${id}` }; }
function issue(number: number, labels: string[]): GitHubIssue { return { number, title: "Issue", state: "OPEN", updatedAt: "2026-08-30T00:00:00Z", url: `https://github.com/o/r/issues/${number}`, labels }; }

test("run categories distinguish active, successful, and other completed outcomes", () => {
  assert.equal(runCategory(run(1, "in_progress", "")), "active");
  assert.equal(runCategory(run(2, "completed", "success")), "success");
  assert.equal(runCategory(run(3, "completed", "cancelled")), "attention");
  assert.deepEqual(filterRuns([run(1, "queued", ""), run(2, "completed", "success")], "active").map(({ id }) => id), [1]);
});

test("GitHub overview and issue filters use only the bounded snapshot", () => {
  const snapshot: GitHubSnapshot = { repository: { nameWithOwner: "o/r", url: "https://github.com/o/r" }, issues: [issue(1, ["bug"]), issue(2, ["docs"])], runs: [run(1, "in_progress", ""), run(2, "completed", "failure")], fetchedAt: 1 };
  assert.equal(githubOverview(snapshot), "2 open issues · 2 recent runs · 1 active · 1 non-success completed");
  assert.deepEqual(filterIssues(snapshot.issues, "bug").map(({ number }) => number), [1]);
});
