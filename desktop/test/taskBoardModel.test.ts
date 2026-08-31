import assert from "node:assert/strict";
import test from "node:test";
import { dependencyStatus, groupTasks, taskHealthStatus, taskOperationsSummary, type HiveTask } from "../src/renderer/src/command/taskBoardModel";

function task(id: string, status: string, dependencyIds: string[] = []): HiveTask {
  return { id, title: id, detail: "", status, dependencyIds, attempt: 1, maxAttempts: 3, createdAt: 1, updatedAt: 1 };
}

test("task board groups durable lifecycle states without losing tasks", () => {
  const tasks = [task("a", "assigned"), task("b", "in-progress"), task("c", "blocked"), task("d", "completed")];
  assert.deepEqual(groupTasks(tasks).map((column) => column.tasks.map(({ id }) => id)), [["a"], ["b"], ["c"], ["d"]]);
});

test("dependency summary distinguishes resolved and unresolved prerequisites", () => {
  const tasks = [task("a", "completed"), task("b", "blocked"), task("c", "assigned", ["a", "b"])];
  assert.deepEqual(dependencyStatus(tasks[2]!, tasks), { total: 2, unresolved: 1 });
  assert.deepEqual(dependencyStatus(task("d", "assigned", ["a"]), tasks), { total: 1, unresolved: 0 });
});

test("task operations summary reports only durable lifecycle signals", () => {
  const retried = { ...task("retry", "in-progress"), attempt: 2 };
  const tasks = [task("ready", "assigned"), retried, task("blocked", "blocked", ["ready"]), task("done", "completed"), task("failed", "failed")];
  assert.deepEqual(taskOperationsSummary(tasks), {
    total: 5,
    actionable: 2,
    blocked: 1,
    unresolvedDependencies: 1,
    retryPressure: 1,
    completed: 1,
    failed: 1,
  });
});

test("task health prioritizes failure, blocking, dependencies, and retries", () => {
  const dependency = task("dependency", "assigned");
  assert.deepEqual(taskHealthStatus(task("failed", "failed"), []), { kind: "failed" });
  assert.deepEqual(taskHealthStatus(task("blocked", "blocked"), []), { kind: "blocked" });
  assert.deepEqual(taskHealthStatus(task("waiting", "assigned", [dependency.id]), [dependency]), { kind: "waiting" });
  assert.deepEqual(taskHealthStatus({ ...task("retry", "in-progress"), attempt: 2 }, []), { kind: "retry", attempt: 2, maxAttempts: 3 });
  assert.deepEqual(taskHealthStatus(task("active", "in-progress"), []), { kind: "running" });
});
