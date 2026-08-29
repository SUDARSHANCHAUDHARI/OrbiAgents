import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ApprovalQueue } from "../src/main/hive/approvalQueue";
import { MissionScheduler } from "../src/main/schedules/missionScheduler";
import { MissionStore } from "../src/main/schedules/missionStore";

test("heartbeat creates one mission-bound spend approval and never executes work", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-scheduler-"));
  const store = new MissionStore(root); const approvals = new ApprovalQueue(root); const scheduler = new MissionScheduler();
  const mission = await store.create({ title: "Audit", detail: "Review changes", agentId: "agent-a", intervalMinutes: 5, estimatedCostUsd: 0.2 }, 0);
  await store.setEnabled(mission.id, true, 0); scheduler.register("project", store, approvals);
  await scheduler.tick(300_000); await scheduler.tick(600_000);
  const saved = (await store.list())[0]!; const requests = await approvals.list();
  assert.ok(saved.pendingRunId); assert.equal(saved.pendingApprovalId, requests[0]?.id);
  assert.equal(requests.length, 1); assert.equal(requests[0]?.taskId, saved.pendingRunId); assert.equal(requests[0]?.category, "spend-increase");
  assert.equal(saved.lastRunAt, undefined);
});

test("heartbeat recovers an approval created before mission attachment", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-scheduler-"));
  const store = new MissionStore(root); const approvals = new ApprovalQueue(root); const scheduler = new MissionScheduler();
  const mission = await store.create({ title: "Audit", detail: "Review", agentId: "agent-a", intervalMinutes: 5, estimatedCostUsd: 0.1 }, 0);
  await store.setEnabled(mission.id, true, 0); const due = (await store.claimDue(300_000))[0]!;
  const approval = await approvals.request({ category: "spend-increase", title: "Existing", rationale: "Created before attachment", requestedByAgentId: "orbi-prime", taskId: due.pendingRunId, estimatedAdditionalCostUsd: 0.1 });
  scheduler.register("project", store, approvals); await scheduler.tick(300_001);
  assert.equal((await store.list())[0]?.pendingApprovalId, approval?.id);
  assert.equal((await approvals.list()).length, 1);
});
