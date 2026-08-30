import type { GitHubIssue, GitHubRun, GitHubSnapshot } from "../../../shared/contracts";

export type RunFilter = "" | "active" | "success" | "attention";

export function runCategory(run: GitHubRun): Exclude<RunFilter, ""> {
  if (run.status !== "completed") return "active";
  return run.conclusion === "success" ? "success" : "attention";
}

export function filterIssues(issues: GitHubIssue[], label: string): GitHubIssue[] {
  return label ? issues.filter((issue) => issue.labels.includes(label)) : issues;
}

export function filterRuns(runs: GitHubRun[], filter: RunFilter): GitHubRun[] {
  return filter ? runs.filter((run) => runCategory(run) === filter) : runs;
}

export function githubOverview(snapshot: GitHubSnapshot): string {
  const active = snapshot.runs.filter((run) => runCategory(run) === "active").length;
  const attention = snapshot.runs.filter((run) => runCategory(run) === "attention").length;
  return `${snapshot.issues.length} open issues · ${snapshot.runs.length} recent runs · ${active} active · ${attention} non-success completed`;
}
