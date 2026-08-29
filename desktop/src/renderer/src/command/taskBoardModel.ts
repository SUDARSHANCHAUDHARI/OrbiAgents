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
