import type { HiveSnapshot } from "../../../shared/contracts";

export type HiveTask = HiveSnapshot["tasks"][number];
export const TASK_COLUMNS = [
  { id: "queued", statuses: ["pending", "assigned"] },
  { id: "active", statuses: ["in-progress"] },
  { id: "blocked", statuses: ["blocked"] },
  { id: "done", statuses: ["completed", "failed"] },
] as const;

export type TaskColumnId = typeof TASK_COLUMNS[number]["id"];
export function groupTasks(tasks: HiveTask[]): Array<{ id: TaskColumnId; tasks: HiveTask[] }> {
  return TASK_COLUMNS.map((column) => ({ ...column, tasks: tasks.filter((task) => column.statuses.includes(task.status as never)) }));
}

export interface DependencyStatus { total: number; unresolved: number; }
export function dependencyStatus(task: HiveTask, tasks: HiveTask[]): DependencyStatus {
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  return { total: task.dependencyIds.length, unresolved: task.dependencyIds.filter((id) => byId.get(id)?.status !== "completed").length };
}

export interface TaskOperationsSummary {
  total: number;
  actionable: number;
  blocked: number;
  unresolvedDependencies: number;
  retryPressure: number;
  completed: number;
  failed: number;
}

export function taskOperationsSummary(tasks: HiveTask[]): TaskOperationsSummary {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return tasks.reduce<TaskOperationsSummary>((summary, task) => {
    summary.total += 1;
    if (task.status === "assigned" || task.status === "in-progress") summary.actionable += 1;
    if (task.status === "blocked") summary.blocked += 1;
    if (task.status === "completed") summary.completed += 1;
    if (task.status === "failed") summary.failed += 1;
    if (task.attempt > 1 && task.status !== "completed") summary.retryPressure += 1;
    if (task.dependencyIds.some((id) => byId.get(id)?.status !== "completed")) summary.unresolvedDependencies += 1;
    return summary;
  }, { total: 0, actionable: 0, blocked: 0, unresolvedDependencies: 0, retryPressure: 0, completed: 0, failed: 0 });
}

export type TaskHealthStatus = { kind: "failed" | "blocked" | "waiting" | "completed" | "running" | "ready" } | { kind: "retry"; attempt: number; maxAttempts: number };
export function taskHealthStatus(task: HiveTask, tasks: HiveTask[]): TaskHealthStatus {
  if (task.status === "failed") return { kind: "failed" };
  if (task.status === "blocked") return { kind: "blocked" };
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  if (task.dependencyIds.some((id) => byId.get(id)?.status !== "completed")) return { kind: "waiting" };
  if (task.attempt > 1) return { kind: "retry", attempt: task.attempt, maxAttempts: task.maxAttempts };
  if (task.status === "completed") return { kind: "completed" };
  if (task.status === "in-progress") return { kind: "running" };
  return { kind: "ready" };
}
