import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { InterruptedAgentSession } from "../agents/agentMetadataStore";
import type { RecoveryItem, RecoveryItemKind, RecoveryReport } from "../../shared/contracts";

export interface RecoveryProjectState {
  projectPath: string;
  tasks: Array<{ id: string; title: string; status: string; assigneeAgentId?: string; updatedAt: number }>;
  approvals: Array<{ id: string; title: string; status: string; taskId?: string; createdAt: number }>;
  missions: Array<{ id: string; title: string; pendingRunId?: string; pendingApprovalId?: string; pendingTaskId?: string; updatedAt: number }>;
}

export class RecoveryStore {
  constructor(private readonly filePath: string, private readonly maxItems = 500, private readonly now: () => number = Date.now) {
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 5_000) throw new Error("Recovery item limit is invalid");
  }

  async create(interrupted: InterruptedAgentSession[], projects: RecoveryProjectState[]): Promise<RecoveryReport> {
    const generatedAt = this.now();
    const candidates: RecoveryItem[] = [];
    for (const session of interrupted) addItem(candidates, "interrupted-session", session.id, session.name, `Process ended during the previous app session; workspace is ${session.workspacePath === session.sourcePath ? "direct" : "preserved for review"}.`, session.recoveredAt, session.sourcePath);
    const previous = await this.load();
    for (const historical of previous?.items.filter((entry) => entry.kind === "interrupted-session") ?? []) if (!candidates.some((entry) => entry.relatedId === historical.relatedId && entry.detectedAt === historical.detectedAt)) candidates.push(historical);
    for (const project of projects) {
      const projectPath = safeBounded(project.projectPath, 4_096);
      if (!projectPath) continue;
      for (const task of project.tasks) if (!["completed", "failed"].includes(task.status)) addItem(candidates, "unfinished-task", task.id, task.title, `Task remains ${safeBounded(task.status, 30) ?? "in an unknown state"}${task.assigneeAgentId ? ` for ${safeBounded(task.assigneeAgentId, 128) ?? "an unknown agent"}` : ""}.`, task.updatedAt, projectPath);
      for (const approval of project.approvals) if (approval.status === "pending") addItem(candidates, "pending-approval", approval.id, approval.title, "Operator decision is still required; no decision was made during recovery.", approval.createdAt, projectPath);
      for (const mission of project.missions) if (mission.pendingRunId) addItem(candidates, "pending-mission", mission.id, mission.title, `Scheduled run ${safeBounded(mission.pendingRunId, 128) ?? "with an invalid identifier"} remains pending${mission.pendingApprovalId ? " with an approval record" : " approval"}${mission.pendingTaskId ? " and a durable task" : ""}.`, mission.updatedAt, projectPath);
    }
    candidates.sort((a, b) => b.detectedAt - a.detectedAt || a.id.localeCompare(b.id));
    const report: RecoveryReport = { version: 1, generatedAt, truncated: candidates.length > this.maxItems, items: candidates.slice(0, this.maxItems) };
    await atomicJson(this.filePath, report);
    return report;
  }

  async load(): Promise<RecoveryReport | null> {
    try {
      const value = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<RecoveryReport>;
      if (value.version !== 1 || typeof value.generatedAt !== "number" || typeof value.truncated !== "boolean" || !Array.isArray(value.items) || value.items.length > this.maxItems || !value.items.every(validItem)) return null;
      return value as RecoveryReport;
    } catch { return null; }
  }
}

function addItem(target: RecoveryItem[], kind: RecoveryItemKind, relatedId: string, title: string, detail: string, detectedAt: number, projectPath?: string): void { try { target.push(item(kind, relatedId, title, detail, detectedAt, projectPath)); } catch { /* Skip malformed historical records without blocking startup. */ } }

function item(kind: RecoveryItemKind, relatedId: string, title: string, detail: string, detectedAt: number, projectPath?: string): RecoveryItem {
  if (!Number.isFinite(detectedAt) || detectedAt < 0) throw new Error("Recovery timestamp is invalid");
  return { id: randomUUID(), kind, relatedId: bounded(relatedId, 128, "Recovery identifier"), title: bounded(title, 300, "Recovery title"), detail: bounded(detail, 1_000, "Recovery detail"), detectedAt, projectPath };
}

function bounded(value: string, max: number, label: string): string { const text = value?.trim(); if (!text || text.length > max) throw new Error(`${label} is invalid`); return text; }
function safeBounded(value: string, max: number): string | null { try { return bounded(value, max, "Recovery field"); } catch { return null; } }
function validItem(value: unknown): value is RecoveryItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<RecoveryItem>;
  return typeof row.id === "string" && /^[0-9a-f-]{36}$/i.test(row.id) && ["interrupted-session", "unfinished-task", "pending-approval", "pending-mission"].includes(row.kind ?? "") && typeof row.relatedId === "string" && row.relatedId.length > 0 && row.relatedId.length <= 128 && typeof row.title === "string" && row.title.length > 0 && row.title.length <= 300 && typeof row.detail === "string" && row.detail.length > 0 && row.detail.length <= 1_000 && typeof row.detectedAt === "number" && Number.isFinite(row.detectedAt) && (row.projectPath === undefined || typeof row.projectPath === "string" && row.projectPath.length > 0 && row.projectPath.length <= 4_096);
}
async function atomicJson(file: string, value: unknown): Promise<void> { await mkdir(path.dirname(file), { recursive: true, mode: 0o700 }); const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`; await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); await rename(temporary, file); }
