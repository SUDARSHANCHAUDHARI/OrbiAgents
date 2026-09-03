import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { HiveState } from "../src/main/hive/hiveState";

test("Hive task ledger enforces dependencies and valid lifecycle transitions", async () => {
  const state = new HiveState(await mkdtemp(join(tmpdir(), "orbi-state-")));
  const prerequisite = await state.createTask({ title: "Design contract" });
  const implementation = await state.createTask({ title: "Implement contract", dependencyIds: [prerequisite.id] });
  await assert.rejects(state.assign(implementation.id, "coder"), /dependencies/);
  await state.assign(prerequisite.id, "architect");
  await state.transition(prerequisite.id, "in-progress");
  await state.transition(prerequisite.id, "completed");
  assert.equal((await state.assign(implementation.id, "coder")).status, "assigned");
  assert.equal((await state.transition(implementation.id, "in-progress")).attempt, 1);
  assert.equal((await state.transition(implementation.id, "completed")).status, "completed");
});

test("Hive blackboard uses optimistic versions and preserves concurrent keys", async () => {
  const state = new HiveState(await mkdtemp(join(tmpdir(), "orbi-state-")));
  const first = await state.putBlackboard("architecture/api", "v1", "architect", 0);
  assert.equal(first.version, 1);
  await assert.rejects(state.putBlackboard("architecture/api", "stale", "coder", 0), /version conflict/);
  await Promise.all(Array.from({ length: 8 }, (_, index) => state.putBlackboard(`result/${index}`, `value-${index}`, "coder")));
  assert.equal(Object.keys(await state.readBlackboard()).length, 9);
});

test("Hive task ledger bounds retries and invalid transitions", async () => {
  const state = new HiveState(await mkdtemp(join(tmpdir(), "orbi-state-")));
  const task = await state.createTask({ title: "Flaky task", maxAttempts: 1 });
  await state.assign(task.id, "coder");
  await assert.rejects(state.transition(task.id, "completed"), /Invalid task transition/);
  await state.transition(task.id, "in-progress");
  await state.transition(task.id, "blocked");
  await assert.rejects(state.assign(task.id, "coder"), /retry limit/);
  assert.equal((await state.listTasks())[0].status, "blocked");
});
