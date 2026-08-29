import { spawn } from "node:child_process";
import type { GitHubAuthStatus, GitHubIssue, GitHubRun, GitHubSnapshot } from "../../shared/contracts";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const TIMEOUT_MS = 10_000;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

export interface GhResult { code: number; stdout: string; }
export interface GhRunner { run(args: string[], cwd?: string): Promise<GhResult>; }

export class GitHubIngestion {
  constructor(private readonly runner: GhRunner = new NativeGhRunner(), private readonly now: () => number = Date.now) {}

  async authStatus(): Promise<GitHubAuthStatus> {
    try { const result = await this.runner.run(["auth", "status", "--hostname", "github.com"]); return { installed: true, authenticated: result.code === 0 }; }
    catch (error) { return { installed: !isMissingExecutable(error), authenticated: false }; }
  }

  async snapshot(workspace: string): Promise<GitHubSnapshot> {
    const auth = await this.authStatus();
    if (!auth.installed) throw new Error("GitHub CLI is not installed");
    if (!auth.authenticated) throw new Error("GitHub CLI is not authenticated; run gh auth login locally");
    const repoResult = await this.runner.run(["repo", "view", "--json", "nameWithOwner,url"], workspace);
    if (repoResult.code !== 0) throw new Error("Could not resolve a GitHub repository for this workspace");
    const repository = parseRepository(repoResult.stdout);
    const [issuesResult, runsResult] = await Promise.all([
      this.runner.run(["issue", "list", "--repo", repository.nameWithOwner, "--state", "open", "--limit", "50", "--json", "number,title,state,updatedAt,url,labels"], workspace),
      this.runner.run(["run", "list", "--repo", repository.nameWithOwner, "--limit", "30", "--json", "databaseId,name,workflowName,status,conclusion,headBranch,event,updatedAt,url"], workspace),
    ]);
    if (issuesResult.code !== 0 || runsResult.code !== 0) throw new Error("GitHub issue or CI ingestion failed");
    return { repository, issues: parseIssues(issuesResult.stdout), runs: parseRuns(runsResult.stdout), fetchedAt: this.now() };
  }
}

export class NativeGhRunner implements GhRunner {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env, private readonly timeoutMs = TIMEOUT_MS) {}
  run(args: string[], cwd?: string): Promise<GhResult> {
    return new Promise((resolve, reject) => {
      const child = spawn("gh", args, { cwd, shell: false, env: sanitizedEnvironment(this.environment), stdio: ["ignore", "pipe", "pipe"] });
      let stdout = ""; let bytes = 0; let exceeded = false; let timedOut = false;
      let forceTimer: NodeJS.Timeout | undefined;
      const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); forceTimer = setTimeout(() => child.kill("SIGKILL"), 1_000); }, this.timeoutMs);
      const consume = (chunk: Buffer, keep: boolean) => { bytes += chunk.byteLength; if (bytes > MAX_OUTPUT_BYTES) { exceeded = true; child.kill("SIGTERM"); return; } if (keep) stdout += chunk.toString("utf8"); };
      child.stdout.on("data", (chunk: Buffer) => consume(chunk, true)); child.stderr.on("data", (chunk: Buffer) => consume(chunk, false));
      child.once("error", (error) => { clearTimeout(timer); if (forceTimer) clearTimeout(forceTimer); reject(error); });
      child.once("close", (code) => { clearTimeout(timer); if (forceTimer) clearTimeout(forceTimer); if (timedOut) reject(new Error("GitHub CLI request timed out")); else if (exceeded) reject(new Error("GitHub CLI output exceeded 1 MB")); else resolve({ code: code ?? 1, stdout }); });
    });
  }
}

function parseRepository(raw: string): GitHubSnapshot["repository"] {
  const value = parseJson(raw); if (!value || typeof value !== "object") throw new Error("GitHub repository response is invalid"); const row = value as Record<string, unknown>;
  if (typeof row.nameWithOwner !== "string" || !REPOSITORY_PATTERN.test(row.nameWithOwner) || !validGitHubUrl(row.url)) throw new Error("GitHub repository response is invalid");
  return { nameWithOwner: row.nameWithOwner, url: row.url as string };
}
function parseIssues(raw: string): GitHubIssue[] { const value = parseJson(raw); if (!Array.isArray(value)) throw new Error("GitHub issue response is invalid"); return value.slice(0, 50).map((item) => { const row = record(item, "issue"); return { number: boundedInteger(row.number, "issue number"), title: boundedString(row.title, 300, "issue title"), state: boundedString(row.state, 30, "issue state"), updatedAt: isoDate(row.updatedAt), url: githubUrl(row.url), labels: Array.isArray(row.labels) ? row.labels.slice(0, 20).map((label) => boundedString(record(label, "label").name, 100, "label")) : [] }; }); }
function parseRuns(raw: string): GitHubRun[] { const value = parseJson(raw); if (!Array.isArray(value)) throw new Error("GitHub run response is invalid"); return value.slice(0, 30).map((item) => { const row = record(item, "run"); return { id: boundedInteger(row.databaseId, "run id"), name: boundedString(row.name, 200, "run name", true), workflowName: boundedString(row.workflowName, 200, "workflow name", true), status: boundedString(row.status, 30, "run status"), conclusion: boundedString(row.conclusion, 30, "run conclusion", true), headBranch: boundedString(row.headBranch, 200, "run branch", true), event: boundedString(row.event, 50, "run event", true), updatedAt: isoDate(row.updatedAt), url: githubUrl(row.url) }; }); }
function parseJson(raw: string): unknown { try { return JSON.parse(raw); } catch { throw new Error("GitHub CLI returned invalid JSON"); } }
function record(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object") throw new Error(`GitHub ${label} response is invalid`); return value as Record<string, unknown>; }
function boundedString(value: unknown, max: number, label: string, empty = false): string { if (typeof value !== "string" || (!empty && !value) || value.length > max || /[\0]/.test(value)) throw new Error(`GitHub ${label} is invalid`); return value.replace(/[\r\n]/g, " "); }
function boundedInteger(value: unknown, label: string): number { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`GitHub ${label} is invalid`); return Number(value); }
function isoDate(value: unknown): string { const text = boundedString(value, 50, "date"); if (!Number.isFinite(Date.parse(text))) throw new Error("GitHub date is invalid"); return text; }
function validGitHubUrl(value: unknown): value is string { if (typeof value !== "string" || value.length > 2_048) return false; try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "github.com" && !url.username && !url.password && !url.search && !url.hash; } catch { return false; } }
function githubUrl(value: unknown): string { if (!validGitHubUrl(value)) throw new Error("GitHub URL is invalid"); return value; }
function isMissingExecutable(error: unknown): boolean { return (error as NodeJS.ErrnoException)?.code === "ENOENT"; }
export function sanitizedEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv { const allowed = new Set(["PATH", "HOME", "USER", "LOGNAME", "TMPDIR", "LANG", "LC_ALL", "XDG_CONFIG_HOME", "GH_CONFIG_DIR"]); return { ...Object.fromEntries(Object.entries(environment).filter(([key, value]) => allowed.has(key) && typeof value === "string")), NO_COLOR: "1" }; }
