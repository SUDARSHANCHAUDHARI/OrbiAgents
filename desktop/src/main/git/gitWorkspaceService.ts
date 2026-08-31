import { spawn } from "node:child_process";
import type { GitWorkspaceSnapshot } from "../../shared/contracts";

const MAX_OUTPUT = 512 * 1024;
export interface GitResult { code: number; stdout: string; }
export interface GitRunner { run(args: string[], cwd: string): Promise<GitResult>; }

export class GitWorkspaceService {
  constructor(private readonly runner: GitRunner = new NativeGitRunner(), private readonly now: () => number = Date.now) {}
  async snapshot(workspace: string): Promise<GitWorkspaceSnapshot> {
    const [status, log, diff] = await Promise.all([
      this.runner.run(["status", "--short", "--branch", "--untracked-files=normal"], workspace),
      this.runner.run(["log", "-20", "--format=%h%x09%ct%x09%s"], workspace),
      this.runner.run(["diff", "--stat", "--no-ext-diff", "HEAD"], workspace),
    ]);
    if (status.code !== 0) throw new Error("Selected workspace is not a readable Git repository");
    const lines = status.stdout.split(/\r?\n/).filter(Boolean); const header = lines.shift() ?? "";
    const branch = parseBranch(header); const changes = lines.slice(0, 200).map(parseChange);
    return { ...branch, changes, commits: log.code === 0 ? parseCommits(log.stdout) : [], diffStat: diff.code === 0 ? diff.stdout.slice(0, 20_000).trim() : "", fetchedAt: this.now(), truncated: lines.length > 200 };
  }
}

class NativeGitRunner implements GitRunner {
  run(args: string[], cwd: string): Promise<GitResult> { return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, shell: false, env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG, NO_COLOR: "1", GIT_OPTIONAL_LOCKS: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let bytes = 0; const timer = setTimeout(() => child.kill("SIGTERM"), 10_000);
    const consume = (chunk: Buffer, keep: boolean) => { bytes += chunk.byteLength; if (bytes > MAX_OUTPUT) child.kill("SIGTERM"); else if (keep) stdout += chunk.toString("utf8"); };
    child.stdout.on("data", (chunk: Buffer) => consume(chunk, true)); child.stderr.on("data", (chunk: Buffer) => consume(chunk, false)); child.once("error", reject);
    child.once("close", (code) => { clearTimeout(timer); if (bytes > MAX_OUTPUT) reject(new Error("Git output exceeded 512 KB")); else resolve({ code: code ?? 1, stdout }); });
  }); }
}

function parseBranch(header: string): Pick<GitWorkspaceSnapshot, "branch" | "upstream" | "ahead" | "behind"> {
  if (!header.startsWith("## ")) return { branch: "detached", ahead: 0, behind: 0 };
  const text = header.slice(3); const match = /^(.*?)\.\.\.([^ ]+)(?: \[(.*?)\])?$/.exec(text);
  if (!match) return { branch: clean(text.split(" ")[0] ?? "detached", 200), ahead: 0, behind: 0 };
  const tracking = match[3] ?? ""; return { branch: clean(match[1], 200), upstream: clean(match[2], 300), ahead: count(tracking, "ahead"), behind: count(tracking, "behind") };
}
function parseChange(line: string): GitWorkspaceSnapshot["changes"][number] { if (line.length < 4) throw new Error("Git status output is invalid"); return { status: clean(line.slice(0, 2), 2), path: clean(line.slice(3), 1_000) }; }
function parseCommits(raw: string): GitWorkspaceSnapshot["commits"] { return raw.split(/\r?\n/).filter(Boolean).slice(0, 20).map((line) => { const [hash, timestamp, ...subject] = line.split("\t"); if (!/^[0-9a-f]{4,40}$/.test(hash ?? "") || !/^\d+$/.test(timestamp ?? "")) throw new Error("Git log output is invalid"); return { hash: hash!, timestamp: Number(timestamp) * 1_000, subject: clean(subject.join(" "), 500) }; }); }
function count(value: string, label: string): number { const match = new RegExp(`${label} (\\d+)`).exec(value); return match ? Math.min(Number(match[1]), 1_000_000) : 0; }
function clean(value: string, max: number): string { if (!value || value.length > max || /[\0\r\n]/.test(value)) throw new Error("Git output is invalid"); return value; }
