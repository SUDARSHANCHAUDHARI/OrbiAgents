import assert from "node:assert/strict";
import test from "node:test";
import { dependencySummary, groupTasks, taskHealth, taskOperationsSummary, type HiveTask } from "../src/renderer/src/command/taskBoardModel";

function task(id: string, status: string, dependencyIds: string[] = []): HiveTask {
  return { id, title: id, detail: "", status, dependencyIds, attempt: 1, maxAttempts: 3, createdAt: 1, updatedAt: 1 };
}

test("task board groups durable lifecycle states without losing tasks", () => {
  const tasks = [task("a", "assigned"), task("b", "in-progress"), task("c", "blocked"), task("d", "completed")];
  assert.deepEqual(groupTasks(tasks).map((column) => column.tasks.map(({ id }) => id)), [["a"], ["b"], ["c"], ["d"]]);
});

test("dependency summary distinguishes resolved and unresolved prerequisites", () => {
  const tasks = [task("a", "completed"), task("b", "blocked"), task("c", "assigned", ["a", "b"])];
  assert.equal(dependencySummary(tasks[2]!, tasks), "1/2 dependencies unresolved");
  assert.equal(dependencySummary(task("d", "assigned", ["a"]), tasks), "1 dependencies complete");
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
  assert.equal(taskHealth(task("failed", "failed"), []), "Failed — review required");
  assert.equal(taskHealth(task("blocked", "blocked"), []), "Blocked — operator action required");
  assert.equal(taskHealth(task("waiting", "assigned", [dependency.id]), [dependency]), "Waiting on dependencies");
  assert.equal(taskHealth({ ...task("retry", "in-progress"), attempt: 2 }, []), "Retry 2 of 3");
  assert.equal(taskHealth(task("active", "in-progress"), []), "Running");
});
