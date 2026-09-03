import { createHash } from "node:crypto";
import { join } from "node:path";
import type { HiveSnapshot, ScheduledMission } from "../../shared/contracts";
import type { PtyManager } from "../pty/ptyManager";
import { ApprovalQueue } from "./approvalQueue";
import { HiveMailbox } from "./hiveMailbox";
import { OrbiPrime } from "./orbiPrime";
import { HiveState } from "./hiveState";
import type { HiveTask } from "./hiveState";
import { MarkdownMemoryStore } from "../memory/markdownMemoryStore";
import { SemanticMemoryService } from "../memory/semanticMemoryService";
import type { MemoryRecord } from "../../shared/contracts";
import { MissionStore } from "../schedules/missionStore";
import { MissionScheduler } from "../schedules/missionScheduler";
import type { RecoveryProjectState } from "../persistence/recoveryStore";
import { CostLedger } from "../costs/costLedger";
import type { CostLedgerSnapshot } from "../../shared/contracts";

interface ProjectHive { state: HiveState; mailbox: HiveMailbox; approvals: ApprovalQueue; prime: OrbiPrime; memory: MarkdownMemoryStore; memoryRoot: string; missions: MissionStore; }

export class HiveCoordinator {
  private readonly projects = new Map<string, ProjectHive>();
  private readonly scheduler = new MissionScheduler();
  private readonly semantic: SemanticMemoryService;
  constructor(private readonly root: string, private readonly agents: PtyManager, private readonly costs = new CostLedger(join(root, "costs")), semantic?: SemanticMemoryService) { this.semantic = semantic ?? new SemanticMemoryService(join(root, "semantic-palace")); }

  async snapshot(projectPath: string): Promise<HiveSnapshot> {
    const hive = this.project(projectPath);
    return { tasks: await hive.state.listTasks(), approvals: await hive.approvals.list(), blackboard: await hive.state.readBlackboard(), primeInbox: await hive.mailbox.readInbox("orbi-prime") };
  }

  async assign(projectPath: string, input: { title: string; detail: string; agentId: string }, deliveryInstructions?: string): Promise<HiveSnapshot> {
    if (!this.runningAgentBelongsToProject(projectPath, input.agentId)) throw new Error("A running project agent is required");
    const hive = this.project(projectPath);
    const task = await hive.prime.assign(input);
    await this.deliver(hive, task, "New Orbi-Prime assignment", deliveryInstructions);
    return this.snapshot(projectPath);
  }

  async transitionTask(projectPath: string, taskId: string, action: "start" | "block" | "retry" | "complete", agentId?: string, result?: string, deliveryInstructions?: string): Promise<HiveSnapshot> {
    const hive = this.project(projectPath);
    if (action === "start") await hive.prime.start(taskId);
    else if (action === "block") await hive.prime.block(taskId);
    else if (action === "retry") {
      if (!agentId || !this.runningAgentBelongsToProject(projectPath, agentId)) throw new Error("A running project agent is required for retry");
      await this.deliver(hive, await hive.prime.retry(taskId, agentId), "Orbi-Prime retry assignment", deliveryInstructions);
    } else {
      const task = (await hive.state.listTasks()).find((candidate) => candidate.id === taskId);
      if (!task?.assigneeAgentId) throw new Error("Assigned task not found");
      await hive.prime.complete(taskId, task.assigneeAgentId, result ?? "");
    }
    return this.snapshot(projectPath);
  }

  async decideApproval(projectPath: string, id: string, decision: "approved" | "rejected", reason: string): Promise<HiveSnapshot> {
    await this.project(projectPath).approvals.decide(id, decision, reason);
    return this.snapshot(projectPath);
  }

  async listMemory(projectPath: string): Promise<MemoryRecord[]> { return this.project(projectPath).memory.list(); }
  async searchMemory(projectPath: string, query: string, limit?: number): Promise<MemoryRecord[]> { return this.project(projectPath).memory.search(query, limit); }
  async captureMemory(projectPath: string, input: { title: string; content: string; source: string; authorAgentId: string }): Promise<MemoryRecord[]> { const hive = this.project(projectPath); await hive.memory.capture(input); void this.semantic.index(projectPath, hive.memoryRoot).catch(() => undefined); return hive.memory.list(); }
  async semanticMemoryStatus() { return this.semantic.status(); }
  async indexSemanticMemory(projectPath: string) { const hive = this.project(projectPath); return this.semantic.index(projectPath, hive.memoryRoot); }
  async searchSemanticMemory(projectPath: string, query: string, limit = 5) { const hive = this.project(projectPath); return this.semantic.search(projectPath, query, limit, async () => (await hive.memory.search(query, limit)).map((record) => `# ${record.title}\n${record.content}`).join("\n\n")); }

  startHeartbeat(): void { this.scheduler.start(); }
  stopHeartbeat(): void { this.scheduler.stop(); }
  async processHeartbeat(now?: number): Promise<void> { await this.scheduler.tick(now); }
  async listMissions(projectPath: string): Promise<ScheduledMission[]> { return this.project(projectPath).missions.list(); }
  async recoveryState(projectPath: string): Promise<RecoveryProjectState> { const snapshot = await this.snapshot(projectPath); return { projectPath, tasks: snapshot.tasks, approvals: snapshot.approvals, missions: await this.listMissions(projectPath) }; }
  async costSnapshot(limit?: number): Promise<CostLedgerSnapshot> { return this.costs.snapshot(limit); }
  async createMission(projectPath: string, input: { title: string; detail: string; agentId: string; intervalMinutes: number; estimatedCostUsd: number }): Promise<ScheduledMission[]> { if (!this.agentBelongsToProject(projectPath, input.agentId)) throw new Error("A recorded project agent is required"); const store = this.project(projectPath).missions; await store.create(input); return store.list(); }
  async setMissionEnabled(projectPath: string, id: string, enabled: boolean): Promise<ScheduledMission[]> { const hive = this.project(projectPath); await hive.missions.setEnabled(id, enabled); return hive.missions.list(); }
  async runMission(projectPath: string, id: string): Promise<ScheduledMission[]> {
    const hive = this.project(projectPath); const mission = (await hive.missions.list()).find((candidate) => candidate.id === id);
    if (!mission?.pendingRunId || !mission.pendingApprovalId) throw new Error("Mission has no approved pending run");
    const approval = await hive.approvals.assertApproved(mission.pendingApprovalId);
    if (approval.taskId !== mission.pendingRunId || approval.category !== "spend-increase" || approval.estimatedAdditionalCostUsd !== mission.estimatedCostUsd) throw new Error("Mission approval does not match the pending run");
    if (!this.runningAgentBelongsToProject(projectPath, mission.agentId)) throw new Error("Mission requires its running project agent");
    await this.costs.recordAuthorization({ projectPath, missionId: mission.id, runId: mission.pendingRunId, approvalId: approval.id, title: mission.title, estimatedCostUsd: mission.estimatedCostUsd });
    const marker = `[Mission Run: ${mission.pendingRunId}]`;
    const tasks = await hive.state.listTasks();
    let task = mission.pendingTaskId ? tasks.find((candidate) => candidate.id === mission.pendingTaskId) : tasks.find((candidate) => candidate.assigneeAgentId === mission.agentId && candidate.detail.startsWith(marker));
    if (!task) task = await hive.prime.assign({ title: mission.title, detail: `${marker}\n${mission.detail}`, agentId: mission.agentId });
    if (mission.pendingTaskId !== task.id) await hive.missions.attachTask(mission.id, mission.pendingRunId, task.id);
    await this.deliver(hive, task, "Approved scheduled mission");
    await hive.missions.completeRun(mission.id, mission.pendingRunId);
    return hive.missions.list();
  }

  private project(projectPath: string): ProjectHive {
    const existing = this.projects.get(projectPath);
    if (existing) return existing;
    const projectRoot = join(this.root, createHash("sha256").update(projectPath).digest("hex"));
    const state = new HiveState(projectRoot);
    const approvals = new ApprovalQueue(projectRoot);
    const mailbox = new HiveMailbox(projectRoot, (agentId) => agentId === "orbi-prime" || this.agentBelongsToProject(projectPath, agentId));
    const missions = new MissionStore(join(projectRoot, "schedules"));
    const memoryRoot = join(projectRoot, "memory");
    const hive = { state, approvals, mailbox, prime: new OrbiPrime(state, mailbox, approvals), memory: new MarkdownMemoryStore(memoryRoot), memoryRoot, missions };
    this.scheduler.register(projectPath, missions, approvals);
    this.projects.set(projectPath, hive);
    return hive;
  }

  private agentBelongsToProject(projectPath: string, agentId: string): boolean {
    return this.agents.list().some((agent) => agent.id === agentId && agent.workspace.sourcePath === projectPath);
  }

  private runningAgentBelongsToProject(projectPath: string, agentId: string): boolean {
    return this.agents.list().some((agent) => agent.id === agentId && agent.status === "running" && agent.workspace.sourcePath === projectPath);
  }

  private async deliver(hive: ProjectHive, task: HiveTask, heading: string, deliveryInstructions = "Begin this task now and report the result to the operator."): Promise<void> {
    if (!task.assigneeAgentId) throw new Error("Assigned task has no recipient");
    const message = (await hive.mailbox.readInbox(task.assigneeAgentId)).find((candidate) => candidate.conversationId === task.id && candidate.status === "delivered");
    if (!message) throw new Error("Durable assignment message was not found");
    this.agents.write(task.assigneeAgentId, `\n[${heading}]\nTask ID: ${task.id}\n${message.body}\n\n${deliveryInstructions}\r`);
    await hive.mailbox.acknowledge(task.assigneeAgentId, message.id);
  }
}
