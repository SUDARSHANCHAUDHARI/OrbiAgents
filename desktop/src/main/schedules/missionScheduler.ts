import type { ApprovalQueue } from "../hive/approvalQueue";
import type { ScheduledMission } from "../../shared/contracts";
import type { MissionStore } from "./missionStore";

interface ScheduledProject { store: MissionStore; approvals: ApprovalQueue; }

export class MissionScheduler {
  private readonly projects = new Map<string, ScheduledProject>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;

  register(projectId: string, store: MissionStore, approvals: ApprovalQueue): void { this.projects.set(projectId, { store, approvals }); }

  start(intervalMs = 30_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick().catch(() => undefined), intervalMs);
    this.timer.unref();
  }

  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  async tick(now = Date.now()): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      for (const project of this.projects.values()) {
        const existing = (await project.store.list()).filter((mission) => mission.enabled && mission.pendingRunId && !mission.pendingApprovalId);
        const claimed = await project.store.claimDue(now);
        for (const mission of [...existing, ...claimed]) { try { await this.ensureApproval(project, mission, now); } catch { /* retain pending run for the next heartbeat */ } }
      }
    } finally { this.ticking = false; }
  }

  private async ensureApproval(project: ScheduledProject, mission: ScheduledMission, now: number): Promise<void> {
    const runId = mission.pendingRunId;
    if (!runId) return;
    const existing = (await project.approvals.list()).find((approval) => approval.taskId === runId);
    const approval = existing ?? await project.approvals.request({ category: "spend-increase", title: `Run scheduled mission: ${mission.title}`, rationale: `Mission ${mission.id} is due. Estimated run cost: $${mission.estimatedCostUsd.toFixed(4)}.`, requestedByAgentId: "orbi-prime", taskId: runId, estimatedAdditionalCostUsd: mission.estimatedCostUsd });
    if (!approval) throw new Error("Scheduled mission approval was not created");
    await project.store.attachApproval(mission.id, runId, approval.id, now);
  }
}
