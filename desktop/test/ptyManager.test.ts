import assert from "node:assert/strict";
import test from "node:test";
import { AgentRegistry } from "../src/main/agents/agentRegistry";
import { PtyManager } from "../src/main/pty/ptyManager";
import type { PtyAdapter, PtyExitEvent, PtyProcess, PtySpawnOptions } from "../src/main/pty/ptyTypes";
import type { ActivityEvent } from "../src/shared/contracts";

class FakeProcess implements PtyProcess {
  readonly pid = 123;
  writes: string[] = [];
  resizes: Array<[number, number]> = [];
  kills: Array<string | undefined> = [];
  private dataListener: (data: string) => void = () => undefined;
  private exitListener: (event: PtyExitEvent) => void = () => undefined;
  write(data: string) { this.writes.push(data); }
  resize(cols: number, rows: number) { this.resizes.push([cols, rows]); }
  kill(signal?: string) { this.kills.push(signal); }
  onData(listener: (data: string) => void) { this.dataListener = listener; return { dispose() {} }; }
  onExit(listener: (event: PtyExitEvent) => void) { this.exitListener = listener; return { dispose() {} }; }
  emitData(data: string) { this.dataListener(data); }
  emitExit(event: PtyExitEvent) { this.exitListener(event); }
}

test("manager owns a complete PTY lifecycle without exposing arbitrary commands", async () => {
  const process = new FakeProcess();
  let spawn: { command: string; args: string[]; options: PtySpawnOptions } | undefined;
  const adapter: PtyAdapter = { spawn(command, args, options) { spawn = { command, args, options }; return process; } };
  const output: string[] = [];
  const exits: number[] = [];
  const activity: ActivityEvent["type"][] = [];
  const manager = new PtyManager(adapter, new AgentRegistry(), {
    output: (event) => output.push(event.data),
    exit: (event) => exits.push(event.exitCode),
    activity: (event) => activity.push(event.type),
  }, { PATH: "/bin", OPENAI_API_KEY: "must-not-leak", APP_SECRET: "must-not-leak" });

  const session = await manager.create({ id: "alpha", name: "Alpha", runtimeId: "codex", cwd: "/workspace", cols: 80, rows: 24, isolateWorkspace: false });
  assert.equal(spawn?.command, "codex");
  assert.deepEqual(spawn?.args, []);
  assert.deepEqual(spawn?.options.env, { PATH: "/bin" });
  assert.equal(session.status, "running");

  manager.write("alpha", "hello");
  manager.resize("alpha", 90, 30);
  process.emitData("world");
  assert.deepEqual(process.writes, ["hello"]);
  assert.deepEqual(process.resizes, [[90, 30]]);
  assert.deepEqual(output, ["world"]);
  assert.equal(manager.list()[0].outputTail, "world");

  manager.stop("alpha");
  assert.deepEqual(process.kills, [undefined]);
  assert.equal(manager.list()[0].status, "stopping");
  process.emitExit({ exitCode: 0 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(manager.list()[0].status, "exited");
  assert.deepEqual(exits, [0]);
  assert.deepEqual(activity, ["session-starting", "session-started", "terminal-output", "session-stopping", "session-exited"]);
  assert.throws(() => manager.write("alpha", "again"), /not running/);
});

test("manager launches inside an isolated lease and preserves its final workspace state", async () => {
  const process = new FakeProcess();
  let spawnedCwd = "";
  const registry = new AgentRegistry();
  const manager = new PtyManager({ spawn(_command, _args, options) { spawnedCwd = options.cwd; return process; } }, registry, { output() {}, exit() {}, activity() {} }, {}, {
    async acquire() {
      return {
        workspace: { sourcePath: "/repo", path: "/worktrees/alpha", branch: "codex/orbi-alpha", status: "active" },
        async release() { return { sourcePath: "/repo", path: "/worktrees/alpha", branch: "codex/orbi-alpha", status: "preserved", changes: { status: " M file.ts\n", diffStat: "file.ts | 1 +\n", files: ["file.ts"], untrackedFiles: [] } }; },
      };
    },
  });
  await manager.create({ id: "isolated", name: "Isolated", runtimeId: "codex", cwd: "/repo", cols: 80, rows: 24, isolateWorkspace: true });
  assert.equal(spawnedCwd, "/worktrees/alpha");
  process.emitExit({ exitCode: 0 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registry.require("isolated").workspace.status, "preserved");
  assert.deepEqual(registry.require("isolated").workspace.changes?.files, ["file.ts"]);
});

test("manager records spawn failures", async () => {
  const manager = new PtyManager({ spawn() { throw new Error("missing binary"); } }, new AgentRegistry(), { output() {}, exit() {}, activity() {} });
  await assert.rejects(
    manager.create({ id: "alpha", name: "Alpha", runtimeId: "claude", cwd: "/workspace", cols: 80, rows: 24, isolateWorkspace: false }),
    /missing binary/,
  );
  assert.equal(manager.list()[0].status, "failed");
});

test("manager launches Gemini and custom adapters only through configured descriptors", async () => {
  const spawns: Array<{ command: string; args: string[] }> = [];
  const adapters = {
    get(id: string) {
      if (id === "gemini") return { id: "gemini" as const, name: "Gemini", command: "gemini", args: [], builtin: true };
      if (id === "custom:safe") return { id: "custom:safe" as const, name: "Safe", command: "/opt/safe-agent", args: ["--mode", "review"], builtin: false };
      return undefined;
    },
  };
  const manager = new PtyManager({ spawn(command, args) { spawns.push({ command, args }); return new FakeProcess(); } }, new AgentRegistry(), { output() {}, exit() {}, activity() {} }, {}, undefined, undefined, adapters);
  await manager.create({ id: "gemini-one", name: "Gemini", runtimeId: "gemini", cwd: "/workspace", cols: 80, rows: 24, isolateWorkspace: false });
  await manager.create({ id: "custom-one", name: "Custom", runtimeId: "custom:safe", cwd: "/workspace", cols: 80, rows: 24, isolateWorkspace: false });
  assert.deepEqual(spawns, [{ command: "gemini", args: [] }, { command: "/opt/safe-agent", args: ["--mode", "review"] }]);
  await assert.rejects(manager.create({ id: "missing", name: "Missing", runtimeId: "custom:missing", cwd: "/workspace", cols: 80, rows: 24, isolateWorkspace: false }), /not configured/);
});

test("manager reserves adapter and agent ids while workspace acquisition is pending", async () => {
  let releaseAcquire!: () => void;
  const pending = new Promise<void>((resolve) => { releaseAcquire = resolve; });
  const runtime = { id: "custom:safe" as const, name: "Safe", command: "/opt/safe-agent", args: [], builtin: false };
  const manager = new PtyManager({ spawn() { return new FakeProcess(); } }, new AgentRegistry(), { output() {}, exit() {}, activity() {} }, {}, {
    async acquire(_agentId, sourcePath) { await pending; const workspace = { sourcePath, path: sourcePath, status: "direct" as const }; return { workspace, async release() { return workspace; } }; },
  }, undefined, { get: (id) => id === runtime.id ? runtime : undefined });
  const launch = manager.create({ id: "pending", name: "Pending", runtimeId: runtime.id, cwd: "/workspace", cols: 80, rows: 24, isolateWorkspace: false });
  assert.equal(manager.isRuntimeInUse(runtime.id), true);
  await assert.rejects(manager.create({ id: "pending", name: "Duplicate", runtimeId: runtime.id, cwd: "/workspace", cols: 80, rows: 24, isolateWorkspace: false }), /already exists/);
  releaseAcquire(); await launch;
});

test("manager routes authenticated provider facts only to their live matching agent", async () => {
  const process = new FakeProcess();
  let spawn: { args: string[]; options: PtySpawnOptions } | undefined;
  const adapter: PtyAdapter = { spawn(_command, args, options) { spawn = { args, options }; return process; } };
  const activity: ActivityEvent[] = [];
  const manager = new PtyManager(adapter, new AgentRegistry(), { output() {}, exit() {}, activity: (event) => activity.push(event) }, {}, undefined, { port: 1234, token: "test-token" });
  await manager.create({ id: "claude-one", name: "Claude One", runtimeId: "claude", cwd: "/workspace", cols: 80, rows: 24, isolateWorkspace: false });

  assert.deepEqual(spawn?.args.slice(0, 1), ["--settings"]);
  assert.equal(spawn?.options.env.ORBIAGENTS_AGENT_ID, "claude-one");
  assert.equal(spawn?.options.env.ORBIAGENTS_HOOK_TOKEN, "test-token");
  manager.ingestProviderEvent("claude", { orbi_agent_id: "claude-one", hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "/private" } });
  manager.ingestProviderEvent("codex", { orbi_agent_id: "claude-one", type: "turn.started" });

  const providerEvents = activity.filter((event) => event.type === "provider-activity");
  assert.equal(providerEvents.length, 1);
  assert.equal(providerEvents[0].state, "reading");
  assert.equal(providerEvents[0].summary, "Claude PreToolUse");
});
