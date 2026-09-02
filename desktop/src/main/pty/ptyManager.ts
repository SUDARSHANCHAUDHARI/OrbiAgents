import type { ActivityEvent, ActivitySource, AgentActivityState, AgentSession, RuntimeAdapterDescriptor, RuntimeId, TerminalExitEvent, TerminalOutputEvent } from "../../shared/contracts";
import { normalizeClaudeHook, normalizeCodexJsonLine, type NormalizedProviderActivity } from "../activity/providerActivity";
import { AgentRegistry } from "../agents/agentRegistry";
import type { ValidatedCreateAgentRequest } from "../security/validators";
import type { WorkspaceLease, WorkspaceProvider } from "../workspaces/workspaceManager";
import type { PtyAdapter, PtyProcess } from "./ptyTypes";
import { DesktopCircuitBreaker, type DesktopCircuitDecision } from "./desktopCircuitBreaker";

const MAX_OUTPUT_TAIL = 256 * 1024;
const FORCE_STOP_AFTER_MS = 5_000;

import { BUILTIN_RUNTIME_ADAPTERS } from "../providers/runtimeAdapterStore";

export interface RuntimeHookConfig {
  port: number;
  token: string;
}

export interface RuntimeAdapterProvider { get(id: RuntimeId): RuntimeAdapterDescriptor | undefined; }

export interface PtyManagerEvents {
  output(event: TerminalOutputEvent): void;
  exit(event: TerminalExitEvent): void;
  activity(event: ActivityEvent): void;
}

export class PtyManager {
  private readonly processes = new Map<string, PtyProcess>();
  private readonly forceStopTimers = new Map<string, NodeJS.Timeout>();
  private readonly circuitBreakers = new Map<string, DesktopCircuitBreaker>();
  private readonly circuitTimers = new Map<string, NodeJS.Timeout[]>();
  private readonly leases = new Map<string, WorkspaceLease>();
  private readonly lastOutputActivity = new Map<string, number>();
  private readonly startingAgentIds = new Set<string>();
  private readonly startingRuntimeCounts = new Map<RuntimeId, number>();
  private activitySequence = 0;

  constructor(
    private readonly adapter: PtyAdapter,
    private readonly registry: AgentRegistry,
    private readonly events: PtyManagerEvents,
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly workspaces: WorkspaceProvider = directWorkspaceProvider,
    private readonly hookConfig?: RuntimeHookConfig,
    private readonly runtimeAdapters: RuntimeAdapterProvider = builtinRuntimeProvider,
    private readonly circuitFactory: (budgetMinutes: number) => DesktopCircuitBreaker = DesktopCircuitBreaker.forBudgetMinutes,
  ) {}

  async create(request: ValidatedCreateAgentRequest): Promise<AgentSession> {
    if (this.startingAgentIds.has(request.id) || this.processes.has(request.id) || this.registry.get(request.id)) {
      throw new Error(`Agent ${request.id} already exists`);
    }

    const runtime = this.runtimeAdapters.get(request.runtimeId);
    if (!runtime) throw new Error(`Runtime adapter ${request.runtimeId} is not configured`);
    this.startingAgentIds.add(request.id);
    this.startingRuntimeCounts.set(request.runtimeId, (this.startingRuntimeCounts.get(request.runtimeId) ?? 0) + 1);
    this.emitActivity(request.id, "session-starting", `Preparing ${request.runtimeId} agent`);
    let lease: WorkspaceLease;
    try { lease = await this.workspaces.acquire(request.id, request.cwd, request.isolateWorkspace); }
    catch (error) { this.finishStarting(request.id, request.runtimeId); throw error; }
    this.leases.set(request.id, lease);
    const session = this.registry.add({
      id: request.id,
      name: request.name,
      runtimeId: request.runtimeId,
      cwd: lease.workspace.path,
      status: "starting",
      outputTail: "",
      startedAt: Date.now(),
      workspace: lease.workspace,
      profile: request.profile,
    });

    try {
      const child = this.adapter.spawn(runtime.command, this.runtimeArgs(runtime), {
        cwd: lease.workspace.path,
        cols: request.cols,
        rows: request.rows,
        env: this.runtimeEnvironment(request.id),
      });
      this.processes.set(request.id, child);
      child.onData((data) => this.handleOutput(request.id, data));
      child.onExit((event) => this.handleExit(request.id, event.exitCode, event.signal));
      const running = this.registry.update(request.id, { status: "running", pid: child.pid });
      const budgetMinutes = request.profile?.budgetMinutes ?? 60;
      const circuit = this.circuitFactory(budgetMinutes);
      this.circuitBreakers.set(request.id, circuit);
      this.scheduleRuntimeCircuitChecks(request.id, circuit, budgetMinutes);
      this.emitActivity(request.id, "session-started", `${request.name} started in ${lease.workspace.status === "active" ? "an isolated worktree" : "the selected workspace"}`);
      this.finishStarting(request.id, request.runtimeId);
      return running;
    } catch (error) {
      this.registry.update(request.id, { status: "failed", exitedAt: Date.now() });
      this.emitActivity(request.id, "session-failed", error instanceof Error ? error.message : "Agent failed to start");
      await lease.release().catch(() => undefined);
      this.leases.delete(request.id);
      this.finishStarting(request.id, request.runtimeId);
      throw error;
    }
  }

  list(): AgentSession[] {
    return this.registry.list();
  }

  workspaceRoot(id: string): string {
    const session = this.registry.require(id);
    if (session.workspace.status === "cleaned") throw new Error("Agent workspace is no longer available");
    return session.workspace.path;
  }

  write(id: string, data: string): void {
    this.requireRunning(id).write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    this.requireRunning(id).resize(cols, rows);
  }

  stop(id: string): void {
    this.requestStop(id, "Stop requested by operator");
  }

  private requestStop(id: string, summary: string): void {
    const process = this.requireRunning(id);
    this.registry.update(id, { status: "stopping" });
    this.emitActivity(id, "session-stopping", summary);
    process.kill();
    const timer = setTimeout(() => {
      if (this.processes.get(id) === process) process.kill("SIGKILL");
      this.forceStopTimers.delete(id);
    }, FORCE_STOP_AFTER_MS);
    timer.unref();
    this.forceStopTimers.set(id, timer);
  }

  stopAll(): void {
    for (const id of this.processes.keys()) {
      const session = this.registry.get(id);
      if (session?.status === "running") this.stop(id);
    }
  }

  isRuntimeInUse(runtimeId: RuntimeId): boolean {
    return (this.startingRuntimeCounts.get(runtimeId) ?? 0) > 0 || this.registry.list().some((session) => session.runtimeId === runtimeId && ["starting", "running", "stopping"].includes(session.status));
  }

  private finishStarting(agentId: string, runtimeId: RuntimeId): void {
    this.startingAgentIds.delete(agentId);
    const remaining = (this.startingRuntimeCounts.get(runtimeId) ?? 1) - 1;
    if (remaining > 0) this.startingRuntimeCounts.set(runtimeId, remaining); else this.startingRuntimeCounts.delete(runtimeId);
  }

  ingestProviderEvent(provider: "claude" | "codex", payload: unknown): void {
    if (!payload || typeof payload !== "object") return;
    const agentId = (payload as Record<string, unknown>).orbi_agent_id;
    if (typeof agentId !== "string") return;
    const session = this.registry.get(agentId);
    if (!session || session.runtimeId !== provider || session.status !== "running") return;
    const normalized = provider === "claude"
      ? normalizeClaudeHook(payload)
      : normalizeCodexJsonLine(JSON.stringify(payload));
    if (normalized) this.emitProviderActivity(agentId, normalized);
  }

  resolveRunningCodex(cwd: string, modifiedAt: number): string | undefined {
    const matches = this.registry.list().filter((session) => session.runtimeId === "codex" && session.status === "running" && session.cwd === cwd && modifiedAt >= session.startedAt - 5_000);
    return matches.length === 1 ? matches[0].id : undefined;
  }

  ingestCodexRollout(agentId: string, event: NormalizedProviderActivity): void {
    const session = this.registry.get(agentId);
    if (session?.runtimeId === "codex" && session.status === "running" && event.source === "codex-jsonl") this.emitProviderActivity(agentId, event);
  }

  async applyWorkspace(id: string, files: string[], untrackedFiles: string[]): Promise<AgentSession> {
    const session = this.registry.require(id);
    if (session.status === "running" || session.status === "starting" || session.status === "stopping") throw new Error("Stop the agent before applying workspace changes");
    if (!this.workspaces.apply) throw new Error("Workspace apply is unavailable");
    await this.workspaces.apply(session.workspace, files, untrackedFiles);
    this.emitActivity(id, "workspace-applied", "Selected workspace changes applied to the source repository");
    return this.registry.require(id);
  }

  async discardWorkspace(id: string): Promise<AgentSession> {
    const session = this.registry.require(id);
    if (session.status === "running" || session.status === "starting" || session.status === "stopping") throw new Error("Stop the agent before discarding a workspace");
    if (!this.workspaces.discard) throw new Error("Workspace discard is unavailable");
    const workspace = await this.workspaces.discard(session.workspace);
    const updated = this.registry.update(id, { workspace });
    this.emitActivity(id, "workspace-cleaned", "Preserved worktree discarded after operator confirmation");
    return updated;
  }

  private requireRunning(id: string): PtyProcess {
    const process = this.processes.get(id);
    const session = this.registry.require(id);
    if (!process || session.status !== "running") throw new Error(`Agent ${id} is not running`);
    return process;
  }

  private handleOutput(id: string, data: string): void {
    const session = this.registry.require(id);
    const combined = session.outputTail + data;
    const outputTail = combined.length > MAX_OUTPUT_TAIL ? combined.slice(-MAX_OUTPUT_TAIL) : combined;
    this.registry.update(id, { outputTail });
    const now = Date.now();
    if (now - (this.lastOutputActivity.get(id) ?? 0) >= 500) {
      this.lastOutputActivity.set(id, now);
      this.emitActivity(id, "terminal-output", "Terminal activity received");
    }
    this.events.output({ id, data });
    this.handleCircuitDecision(id, this.circuitBreakers.get(id)?.recordOutput(Buffer.byteLength(data, "utf8")));
  }

  private handleExit(id: string, exitCode: number, signal?: number): void {
    const timer = this.forceStopTimers.get(id);
    if (timer) clearTimeout(timer);
    this.forceStopTimers.delete(id);
    for (const circuitTimer of this.circuitTimers.get(id) ?? []) clearTimeout(circuitTimer);
    this.circuitTimers.delete(id);
    this.circuitBreakers.delete(id);
    this.processes.delete(id);
    this.lastOutputActivity.delete(id);
    void this.finalizeExit(id, exitCode, signal);
  }

  private async finalizeExit(id: string, exitCode: number, signal?: number): Promise<void> {
    let workspace = this.registry.require(id).workspace;
    const lease = this.leases.get(id);
    if (lease) {
      try { workspace = await lease.release(); }
      catch (error) { workspace = { ...workspace, status: "preserved" }; this.emitActivity(id, "workspace-preserved", `Workspace cleanup failed: ${error instanceof Error ? error.message : String(error)}`); }
      this.leases.delete(id);
      if (workspace.status === "cleaned") this.emitActivity(id, "workspace-cleaned", "Clean worktree removed");
      if (workspace.status === "preserved") this.emitActivity(id, "workspace-preserved", "Workspace changes preserved for review");
    }
    this.registry.update(id, { status: "exited", exitCode, signal, exitedAt: Date.now(), workspace });
    this.emitActivity(id, "session-exited", `Agent exited with code ${exitCode}`);
    this.events.exit({ id, exitCode, signal });
  }

  private emitActivity(agentId: string, type: ActivityEvent["type"], summary: string): void {
    const { source, state } = activityMetadata(type);
    this.events.activity({ id: `${Date.now()}-${++this.activitySequence}`, agentId, type, source, state, summary, timestamp: Date.now() });
  }

  private emitProviderActivity(agentId: string, event: NormalizedProviderActivity): void {
    this.events.activity({ id: `${Date.now()}-${++this.activitySequence}`, agentId, type: "provider-activity", source: event.source, state: event.state, summary: event.summary, timestamp: Date.now(), ...(event.usage ? { usage: event.usage } : {}) });
    this.handleCircuitDecision(agentId, this.circuitBreakers.get(agentId)?.recordProviderState(event.state));
  }

  private scheduleRuntimeCircuitChecks(id: string, circuit: DesktopCircuitBreaker, budgetMinutes: number): void {
    const maxRuntimeMs = budgetMinutes * 60_000;
    const timers = [0.8, 0.9, 1].map((ratio) => {
      const timer = setTimeout(() => this.handleCircuitDecision(id, circuit.checkRuntime()), maxRuntimeMs * ratio);
      timer.unref();
      return timer;
    });
    this.circuitTimers.set(id, timers);
  }

  private handleCircuitDecision(id: string, decision: DesktopCircuitDecision | undefined): void {
    if (!decision || this.registry.get(id)?.status !== "running") return;
    if (decision.action === "steer") {
      this.emitActivity(id, "circuit-steered", decision.summary);
      return;
    }
    if (decision.action === "constrain") {
      this.emitActivity(id, "circuit-constrained", decision.summary);
      this.processes.get(id)?.write("\x03");
      return;
    }
    this.emitActivity(id, "circuit-opened", decision.summary);
    this.requestStop(id, decision.summary);
  }

  private runtimeArgs(runtime: RuntimeAdapterDescriptor): string[] {
    if (runtime.id !== "claude" || !this.hookConfig) return [...runtime.args];
    return [...runtime.args, "--settings", JSON.stringify(claudeHookSettings())];
  }

  private runtimeEnvironment(agentId: string): Record<string, string> {
    const environment = sanitizedEnvironment(this.environment);
    if (!this.hookConfig) return environment;
    return {
      ...environment,
      ORBIAGENTS_AGENT_ID: agentId,
      ORBIAGENTS_HOOK_PORT: String(this.hookConfig.port),
      ORBIAGENTS_HOOK_TOKEN: this.hookConfig.token,
    };
  }
}

function claudeHookSettings(): Record<string, unknown> {
  const hook = { type: "command", command: CLAUDE_HOOK_COMMAND, timeout: 3 };
  const entry = [{ matcher: "", hooks: [hook] }];
  return { hooks: Object.fromEntries(["SessionStart", "SessionEnd", "Stop", "PermissionRequest", "Notification", "UserPromptSubmit", "PreToolUse", "SubagentStart", "SubagentStop"].map((event) => [event, entry])) };
}

const CLAUDE_HOOK_COMMAND = `node -e "let b='';process.stdin.on('data',c=>b+=c).on('end',async()=>{try{let d=JSON.parse(b);d.orbi_agent_id=process.env.ORBIAGENTS_AGENT_ID;await fetch('http://127.0.0.1:'+process.env.ORBIAGENTS_HOOK_PORT+'/api/activity/claude',{method:'POST',headers:{authorization:'Bearer '+process.env.ORBIAGENTS_HOOK_TOKEN,'content-type':'application/json'},body:JSON.stringify(d)})}catch{}})"`;

function activityMetadata(type: ActivityEvent["type"]): { source: ActivitySource; state?: AgentActivityState } {
  if (type === "terminal-output") return { source: "terminal" };
  if (type === "session-starting") return { source: "lifecycle", state: "thinking" };
  if (type === "session-started") return { source: "lifecycle", state: "idle" };
  if (type === "session-failed") return { source: "lifecycle", state: "failed" };
  if (type === "session-exited") return { source: "lifecycle", state: "done" };
  if (type === "circuit-steered" || type === "circuit-constrained") return { source: "lifecycle", state: "permission-waiting" };
  if (type === "circuit-opened") return { source: "lifecycle", state: "failed" };
  return { source: "lifecycle" };
}

const directWorkspaceProvider: WorkspaceProvider = {
  async acquire(_agentId, sourcePath) {
    const workspace = { sourcePath, path: sourcePath, status: "direct" as const };
    return { workspace, async release() { return workspace; } };
  },
};

const builtinRuntimeProvider: RuntimeAdapterProvider = {
  get(id) { return BUILTIN_RUNTIME_ADAPTERS.find((adapter) => adapter.id === id); },
};

function sanitizedEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
  const allowed = new Set(["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "TERM", "COLORTERM", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", "SSH_AUTH_SOCK"]);
  return Object.fromEntries(Object.entries(environment).filter((entry): entry is [string, string] => allowed.has(entry[0]) && typeof entry[1] === "string"));
}
