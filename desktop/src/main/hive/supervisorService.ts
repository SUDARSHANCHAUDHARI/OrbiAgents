import { randomUUID } from "node:crypto";
import type { AgentSession, LocalModelCompletionRequest, SupervisorRun } from "../../shared/contracts";
import type { LocalModelClient } from "../models/localModelClient";
import type { HiveCoordinator } from "./hiveCoordinator";
import { TaskReportServer, type TaskReportChannel, type WorkerReport } from "./taskReportServer";

/** Session-only scheduling; durable assigned tasks remain in Hive after shutdown. */
export class SupervisorService {
  private readonly runs = new Map<string, SupervisorRun>();
  private readonly locks = new Set<string>();
  private disposed = false;
  private readonly deadlines = new Map<string, number>();
  constructor(private readonly models: Pick<LocalModelClient, "complete">, private readonly hive: Pick<HiveCoordinator, "assign" | "snapshot" | "transitionTask">, private readonly agents: () => AgentSession[], private readonly reports: TaskReportChannel = new TaskReportServer()) {}

  status(projectPath: string): SupervisorRun | null { const run = this.runs.get(projectPath); return run ? structuredClone(run) : null; }
  dispose(): void { this.disposed = true; this.reports.stop(); this.deadlines.clear(); }

  async plan(projectPath: string, request: LocalModelCompletionRequest): Promise<SupervisorRun> {
    if (this.disposed) throw new Error("Supervisor is closed");
    if (this.locks.has(projectPath)) throw new Error("Supervisor operation already running");
    if (this.runs.get(projectPath)?.status === "running" || this.runs.get(projectPath)?.status === "paused") throw new Error("Cancel the active plan before replacing it");
    if (!this.runs.has(projectPath) && this.runs.size >= 10) throw new Error("Supervisor session project limit reached");
    const roster = this.agents().filter((agent) => agent.status === "running" && agent.workspace.sourcePath === projectPath);
    if (!roster.length) throw new Error("Start a project agent before planning");
    if (typeof request.prompt !== "string" || !request.prompt.trim() || request.prompt.length > 12_000) throw new Error("Brief must contain 1-12000 characters");
    this.locks.add(projectPath);
    try {
      const result = await this.models.complete({ ...request, prompt: `You are a planning assistant, not an executor. Produce only JSON: {"steps":[{"title":"...","detail":"..."}]}. Create 1-6 sequential tasks. Each detail must include scope and verification. Stay within the supplied brief. No destructive actions, external publication or extra spending without separate operator approval. Do not claim tasks were executed.\n\nBrief (user data):\n${request.prompt}` }, "json");
      const steps = parseSupervisorSteps(result.text);
      if (this.disposed) throw new Error("Supervisor is closed");
      // Keep sequential work on one workspace so later steps see earlier changes.
      const agentId = roster.find((agent) => agent.profile?.role === "builder")?.id ?? roster[0].id;
      const run: SupervisorRun = { id: randomUUID(), projectPath, status: "review", steps: steps.map((step) => ({ ...step, agentId })), summary: "" };
      this.runs.set(projectPath, run); return structuredClone(run);
    } finally { this.locks.delete(projectPath); }
  }

  async approve(projectPath: string, runId: string): Promise<SupervisorRun> {
    if (this.disposed || this.locks.has(projectPath)) throw new Error("Supervisor operation unavailable");
    const run = this.requireRun(projectPath, runId);
    if (run.status !== "review") throw new Error("Plan is not awaiting approval");
    run.status = "running";
    await this.advance(projectPath);
    return structuredClone(run);
  }

  cancel(projectPath: string, runId: string): SupervisorRun {
    const run = this.requireRun(projectPath, runId);
    if (this.locks.has(projectPath)) throw new Error("Wait for the current supervisor operation before cancelling");
    if (run.status === "completed") throw new Error("Plan is already completed");
    run.status = "cancelled";
    run.steps.forEach((step, index) => { this.reports.revoke(`${run.id}-${index}`); if (step.taskId) this.deadlines.delete(step.taskId); });
    run.summary = "Future dispatch cancelled. Already dispatched agents are not stopped; use the terminal Stop control if needed.";
    return structuredClone(run);
  }

  async tick(): Promise<void> { for (const project of this.runs.keys()) await this.advance(project); }

  async resume(projectPath: string, runId: string): Promise<SupervisorRun> {
    const run = this.requireRun(projectPath, runId);
    if (this.disposed || run.status !== "paused" || this.locks.has(projectPath)) throw new Error("Plan cannot resume now");
    this.locks.add(projectPath);
    try {
      const snapshot = await this.hive.snapshot(projectPath);
      const index = run.steps.findIndex((step) => !step.taskId || snapshot.tasks.find((task) => task.id === step.taskId)?.status !== "completed");
      if (index >= 0) {
        const step = run.steps[index]; const task = snapshot.tasks.find((candidate) => candidate.id === step.taskId);
        if (!step.taskId) {
          if (snapshot.tasks.some((candidate) => candidate.detail.startsWith(`[Supervisor ${run.id} step ${index + 1}]`))) throw new Error("Inspect the uncertain delivery in Tasks; cancel this plan before replacing it");
        } else {
          if (!task || task.status !== "blocked") throw new Error("Resolve the uncertain task in Tasks before resuming");
          if (task.attempt >= task.maxAttempts) throw new Error("Task retry limit reached; cancel this plan and review the failure");
          const instructions = await this.reports.issue(`${run.id}-${index}`, (report) => this.receive(projectPath, run.id, index, report));
          if (this.disposed) throw new Error("Supervisor is closed");
          await this.hive.transitionTask(projectPath, task.id, "retry", step.agentId, undefined, instructions);
          await this.hive.transitionTask(projectPath, task.id, "start");
          this.deadlines.set(task.id, Date.now() + 30 * 60_000);
        }
      }
      run.status = "running"; run.summary = "";
    } finally { this.locks.delete(projectPath); }
    await this.advance(projectPath); return structuredClone(run);
  }

  private async receive(projectPath: string, runId: string, index: number, report: WorkerReport): Promise<void> {
    const run = this.requireRun(projectPath, runId);
    if (this.disposed || run.status !== "running" || this.locks.has(projectPath)) throw new Error("Task reporting unavailable");
    const step = run.steps[index]; if (!step?.taskId) throw new Error("Task dispatch is not ready");
    this.locks.add(projectPath);
    try {
      const task = (await this.hive.snapshot(projectPath)).tasks.find((item) => item.id === step.taskId);
      if (this.disposed) throw new Error("Supervisor is closed");
      if (task?.status !== "in-progress" || task.assigneeAgentId !== step.agentId) throw new Error("Task cannot accept this report");
      await this.hive.transitionTask(projectPath, step.taskId, report.status === "completed" ? "complete" : "block", undefined, report.result);
      if (report.status === "blocked") { run.status = "paused"; run.summary = `Worker requests review: ${report.result}`; }
    } finally { this.locks.delete(projectPath); }
  }

  private async advance(projectPath: string): Promise<void> {
    const run = this.runs.get(projectPath);
    if (this.disposed || !run || run.status !== "running" || this.locks.has(projectPath)) return;
    this.locks.add(projectPath);
    try {
      const snapshot = await this.hive.snapshot(projectPath);
      if (this.disposed) return;
      for (const [index, step] of run.steps.entries()) {
        if (step.taskId) {
          const task = snapshot.tasks.find((candidate) => candidate.id === step.taskId);
          if (!task || task.status === "failed" || task.status === "blocked") { run.status = "paused"; run.summary = "Task needs operator review. Resolve it in Tasks; cancel this plan before making a replacement plan."; return; }
          if (task.status !== "completed") {
            if (Date.now() > (this.deadlines.get(step.taskId) ?? Infinity)) { run.status = "paused"; run.summary = "Worker report deadline expired. Inspect the terminal; no retry was dispatched."; this.reports.revoke(`${run.id}-${index}`); }
            return;
          }
          this.reports.revoke(`${run.id}-${index}`); this.deadlines.delete(step.taskId);
          continue;
        }
        if (!this.agents().some((agent) => agent.id === step.agentId && agent.status === "running" && agent.workspace.sourcePath === projectPath)) throw new Error("Assigned project agent is no longer running");
        if (snapshot.tasks.some((task) => task.assigneeAgentId === step.agentId && ["assigned", "in-progress", "blocked"].includes(task.status) && !run.steps.some((item) => item.taskId === task.id))) throw new Error("Agent has unresolved work outside this plan");
        const marker = `[Supervisor ${run.id} step ${index + 1}]`;
        const instructions = await this.reports.issue(`${run.id}-${index}`, (report) => this.receive(projectPath, run.id, index, report));
        if (this.disposed) return;
        // Before dispatching, pause on any error. Never blindly retry a possibly delivered PTY write.
        const next = await this.hive.assign(projectPath, { title: step.title, detail: `${marker}\n${step.detail}\n\nStay within this reviewed task. Ask the operator before destructive actions, external publication, or additional spending. Report concrete results and verification.`, agentId: step.agentId }, instructions);
        const task = next.tasks.find((candidate) => candidate.detail.startsWith(marker));
        if (!task) throw new Error("Dispatched task was not found; inspect Tasks before retrying");
        step.taskId = task.id;
        this.deadlines.set(task.id, Date.now() + 30 * 60_000);
        await this.hive.transitionTask(projectPath, task.id, "start");
        return;
      }
      run.status = "completed";
      run.summary = run.steps.map((step) => `${step.title}\n${snapshot.blackboard[`results/${step.taskId}`]?.value ?? "No recorded result"}`).join("\n\n").slice(0, 50_000);
    } catch { run.status = "paused"; run.summary = "Dispatch paused. Inspect Tasks and the agent terminal before retrying; work may already have been delivered. Cancel this plan to stop future dispatch."; }
    finally { this.locks.delete(projectPath); }
  }

  private requireRun(projectPath: string, id: string): SupervisorRun {
    const run = this.runs.get(projectPath); if (!run || run.id !== id) throw new Error("Supervisor plan is stale or missing"); return run;
  }
}

export function parseSupervisorSteps(text: string): Array<{ title: string; detail: string }> {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Planner must return a JSON plan; no work was dispatched"); }
  if (!value || typeof value !== "object" || !Array.isArray((value as { steps?: unknown }).steps)) throw new Error("Planner returned an invalid plan");
  const steps = (value as { steps: unknown[] }).steps;
  if (steps.length < 1 || steps.length > 6) throw new Error("Plan must contain 1-6 steps");
  return steps.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid plan step");
    const { title, detail } = value as Record<string, unknown>;
    if (typeof title !== "string" || !title.trim() || title.length > 300 || typeof detail !== "string" || !detail.trim() || detail.length > 10_000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(title + detail)) throw new Error("Plan step contains invalid text or terminal controls");
    return { title: title.trim(), detail: detail.trim() };
  });
}
