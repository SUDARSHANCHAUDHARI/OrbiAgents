import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MissionStore } from "../src/main/schedules/missionStore";

const input = { title: "Dependency review", detail: "Review dependency changes", agentId: "agent-a", intervalMinutes: 60, estimatedCostUsd: 0.25 };

test("missions are disabled by default and survive restart", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-missions-"));
  const mission = await new MissionStore(root).create(input, 1_000);
  assert.equal(mission.enabled, false);
  assert.equal(mission.nextRunAt, 3_601_000);
  assert.equal((await new MissionStore(root).list())[0]?.id, mission.id);
});

test("heartbeat claims one outstanding run and suppresses duplicates", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-missions-"));
  const store = new MissionStore(root);
  const mission = await store.create(input, 0);
  await store.setEnabled(mission.id, true, 0);
  assert.equal((await store.claimDue(3_600_000)).length, 1);
  assert.equal((await store.claimDue(7_200_000)).length, 0);
  assert.ok((await new MissionStore(root).list())[0]?.pendingRunId);
});

test("mission completion advances from actual dispatch time", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-missions-"));
  const store = new MissionStore(root);
  const mission = await store.create(input, 0); await store.setEnabled(mission.id, true, 0);
  const due = (await store.claimDue(3_600_000))[0]!;
  await store.attachApproval(due.id, due.pendingRunId!, "approval-a", 3_600_001);
  const completed = await store.completeRun(due.id, due.pendingRunId!, 4_000_000);
  assert.equal(completed.lastRunAt, 4_000_000);
  assert.equal(completed.nextRunAt, 7_600_000);
  assert.equal(completed.pendingRunId, undefined);
});

test("disabling a mission clears every outstanding run reference", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-missions-")); const store = new MissionStore(root);
  const mission = await store.create(input, 0); await store.setEnabled(mission.id, true, 0); const due = (await store.claimDue(3_600_000))[0]!;
  await store.attachApproval(due.id, due.pendingRunId!, "approval-a"); await store.attachTask(due.id, due.pendingRunId!, "task-a");
  const disabled = await store.setEnabled(due.id, false);
  assert.equal(disabled.pendingRunId, undefined); assert.equal(disabled.pendingApprovalId, undefined); assert.equal(disabled.pendingTaskId, undefined);
});

test("mission store validates bounds, limits, and corrupted persistence", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-missions-"));
  const store = new MissionStore(root, 1);
  await assert.rejects(store.create({ ...input, intervalMinutes: 1 }), /interval/);
  await store.create(input);
  await assert.rejects(store.create(input), /limit/);
  await writeFile(join(root, "missions.json"), "not-json", "utf8");
  assert.deepEqual(await new MissionStore(root).list(), []);
  await writeFile(join(root, "missions.json"), JSON.stringify([{ id: "bad", title: "Bad", detail: "Bad", agentId: "agent-a", intervalMinutes: 0, estimatedCostUsd: -1, enabled: true, nextRunAt: 0, createdAt: 0, updatedAt: 0 }]), "utf8");
  assert.deepEqual(await new MissionStore(root).list(), []);
});
