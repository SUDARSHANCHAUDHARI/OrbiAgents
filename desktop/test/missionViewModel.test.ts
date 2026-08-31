import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduledMission } from "../src/shared/contracts";
import { missionOverview, missionStatus } from "../src/renderer/src/command/missionViewModel";

function mission(id: string, enabled = true): ScheduledMission {
  return { id, title: id, detail: id, agentId: "agent", intervalMinutes: 60, estimatedCostUsd: 0.25, enabled, nextRunAt: 2, createdAt: 1, updatedAt: 1 };
}

test("mission overview totals enabled estimates and real pending runs", () => {
  const pending = { ...mission("pending"), pendingRunId: "run", pendingApprovalId: "approval" };
  assert.deepEqual(missionOverview([mission("active"), pending, mission("off", false)]), { missions: 3, enabled: 2, pendingRuns: 1, enabledEstimateUsd: 0.5 });
});

test("mission status does not mistake an approval record for approval", () => {
  assert.equal(missionStatus(mission("off", false)), "disabled");
  assert.equal(missionStatus({ ...mission("request"), pendingRunId: "run", pendingApprovalId: "approval" }), "approval-requested");
  assert.equal(missionStatus({ ...mission("task"), pendingRunId: "run", pendingApprovalId: "approval", pendingTaskId: "task" }), "task-pending");
});
