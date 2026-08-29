import assert from "node:assert/strict";
import test from "node:test";
import { dependencySummary, groupTasks, type HiveTask } from "../src/renderer/src/command/taskBoardModel";

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
