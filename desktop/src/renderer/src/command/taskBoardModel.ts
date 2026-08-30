import type { HiveSnapshot } from "../../../shared/contracts";

export type HiveTask = HiveSnapshot["tasks"][number];
export const TASK_COLUMNS = [
  { id: "queued", label: "Queued", statuses: ["pending", "assigned"] },
  { id: "active", label: "Active", statuses: ["in-progress"] },
  { id: "blocked", label: "Blocked", statuses: ["blocked"] },
  { id: "done", label: "Done", statuses: ["completed", "failed"] },
] as const;

export function groupTasks(tasks: HiveTask[]): Array<{ id: string; label: string; tasks: HiveTask[] }> {
  return TASK_COLUMNS.map((column) => ({ ...column, tasks: tasks.filter((task) => column.statuses.includes(task.status as never)) }));
}

export function dependencySummary(task: HiveTask, tasks: HiveTask[]): string {
  if (!task.dependencyIds.length) return "No dependencies";
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  const unresolved = task.dependencyIds.filter((id) => byId.get(id)?.status !== "completed");
  return unresolved.length ? `${unresolved.length}/${task.dependencyIds.length} dependencies unresolved` : `${task.dependencyIds.length} dependencies complete`;
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

export function taskHealth(task: HiveTask, tasks: HiveTask[]): string {
  if (task.status === "failed") return "Failed — review required";
  if (task.status === "blocked") return "Blocked — operator action required";
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  if (task.dependencyIds.some((id) => byId.get(id)?.status !== "completed")) return "Waiting on dependencies";
  if (task.attempt > 1) return `Retry ${task.attempt} of ${task.maxAttempts}`;
  if (task.status === "completed") return "Completed";
  if (task.status === "in-progress") return "Running";
  return "Ready";
}
