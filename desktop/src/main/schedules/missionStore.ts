import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ScheduledMission } from "../../shared/contracts";

export class MissionStore {
  private queue = Promise.resolve();
  private readonly path: string;
  constructor(root: string, private readonly maxMissions = 50) { this.path = join(root, "missions.json"); }

  async create(input: { title: string; detail: string; agentId: string; intervalMinutes: number; estimatedCostUsd: number }, now = Date.now()): Promise<ScheduledMission> {
    const mission: ScheduledMission = { id: randomUUID(), title: bounded(input.title, "Mission title", 200), detail: bounded(input.detail, "Mission detail", 20_000), agentId: safeId(input.agentId), intervalMinutes: interval(input.intervalMinutes), estimatedCostUsd: cost(input.estimatedCostUsd), enabled: false, nextRunAt: now + input.intervalMinutes * 60_000, createdAt: now, updatedAt: now };
    await this.update((missions) => { if (missions.length >= this.maxMissions) throw new Error("Mission limit reached"); return [...missions, mission]; });
    return mission;
  }

  async list(): Promise<ScheduledMission[]> { return (await this.read()).sort((a, b) => a.createdAt - b.createdAt); }

  async setEnabled(id: string, enabled: boolean, now = Date.now()): Promise<ScheduledMission> {
    let result: ScheduledMission | undefined;
    await this.update((missions) => missions.map((mission) => {
      if (mission.id !== id) return mission;
      result = { ...mission, enabled, nextRunAt: enabled ? now + mission.intervalMinutes * 60_000 : mission.nextRunAt, pendingRunId: undefined, pendingApprovalId: undefined, pendingTaskId: undefined, updatedAt: now };
      return result;
    }));
    if (!result) throw new Error("Mission not found");
    return result;
  }

  async claimDue(now = Date.now()): Promise<ScheduledMission[]> {
    const due: ScheduledMission[] = [];
    await this.update((missions) => missions.map((mission) => {
      if (!mission.enabled || mission.pendingRunId || mission.nextRunAt > now) return mission;
      const claimed = { ...mission, pendingRunId: randomUUID(), updatedAt: now };
      due.push(claimed);
      return claimed;
    }));
    return due;
  }

  async attachApproval(id: string, runId: string, approvalId: string, now = Date.now()): Promise<ScheduledMission> {
    return this.changePending(id, runId, (mission) => ({ ...mission, pendingApprovalId: approvalId, updatedAt: now }));
  }

  async attachTask(id: string, runId: string, taskId: string, now = Date.now()): Promise<ScheduledMission> { return this.changePending(id, runId, (mission) => ({ ...mission, pendingTaskId: taskId, updatedAt: now })); }

  async completeRun(id: string, runId: string, now = Date.now()): Promise<ScheduledMission> {
    return this.changePending(id, runId, (mission) => ({ ...mission, pendingRunId: undefined, pendingApprovalId: undefined, pendingTaskId: undefined, lastRunAt: now, nextRunAt: now + mission.intervalMinutes * 60_000, updatedAt: now }));
  }

  private async changePending(id: string, runId: string, change: (mission: ScheduledMission) => ScheduledMission): Promise<ScheduledMission> {
    let result: ScheduledMission | undefined;
    await this.update((missions) => missions.map((mission) => { if (mission.id !== id) return mission; if (mission.pendingRunId !== runId) throw new Error("Mission run is no longer pending"); result = change(mission); return result; }));
    if (!result) throw new Error("Mission not found");
    return result;
  }

  private async update(change: (missions: ScheduledMission[]) => ScheduledMission[]): Promise<void> { const operation = this.queue.then(async () => atomicWrite(this.path, change(await this.read()))); this.queue = operation.catch(() => undefined); await operation; }
  private async read(): Promise<ScheduledMission[]> { try { const value = JSON.parse(await readFile(this.path, "utf8")); return Array.isArray(value) ? value.filter(validMission) : []; } catch { return []; } }
}

function validMission(value: unknown): value is ScheduledMission { const row = value as Partial<ScheduledMission>; return Boolean(row && /^[0-9a-f-]{36}$/i.test(row.id ?? "") && typeof row.title === "string" && row.title.length > 0 && row.title.length <= 200 && typeof row.detail === "string" && row.detail.length > 0 && row.detail.length <= 20_000 && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(row.agentId ?? "") && Number.isInteger(row.intervalMinutes) && row.intervalMinutes! >= 5 && row.intervalMinutes! <= 10_080 && typeof row.estimatedCostUsd === "number" && Number.isFinite(row.estimatedCostUsd) && row.estimatedCostUsd > 0 && row.estimatedCostUsd <= 1_000 && typeof row.enabled === "boolean" && finiteTime(row.nextRunAt) && finiteTime(row.createdAt) && finiteTime(row.updatedAt)); }
function finiteTime(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function bounded(value: string, label: string, max: number): string { const text = value?.trim(); if (!text || text.length > max) throw new Error(`${label} must contain 1 to ${max} characters`); return text; }
function safeId(value: string): string { const id = value?.trim(); if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) throw new Error("Invalid mission agent"); return id; }
function interval(value: number): number { if (!Number.isInteger(value) || value < 5 || value > 10_080) throw new Error("Mission interval must be between 5 and 10080 minutes"); return value; }
function cost(value: number): number { if (!Number.isFinite(value) || value <= 0 || value > 1_000) throw new Error("Mission estimated cost must be between 0 and 1000 USD"); return value; }
async function atomicWrite(path: string, value: unknown): Promise<void> { await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`; await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); await rename(temporary, path); }
