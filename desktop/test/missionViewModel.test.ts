import assert from "node:assert/strict";
import test from "node:test";
import type { ScheduledMission } from "../src/shared/contracts";
import { missionOverview, missionStatus } from "../src/renderer/src/command/missionViewModel";

function mission(id: string, enabled = true): ScheduledMission {
  return { id, title: id, detail: id, agentId: "agent", intervalMinutes: 60, estimatedCostUsd: 0.25, enabled, nextRunAt: 2, createdAt: 1, updatedAt: 1 };
}

test("mission overview totals enabled estimates and real pending runs", () => {
  const pending = { ...mission("pending"), pendingRunId: "run", pendingApprovalId: "approval" };
  assert.equal(missionOverview([mission("active"), pending, mission("off", false)]), "3 missions · 2 enabled · 1 pending runs · $0.5000 enabled-run estimate");
});

test("mission status does not mistake an approval record for approval", () => {
  assert.equal(missionStatus(mission("off", false)), "Disabled — no heartbeat runs");
  assert.equal(missionStatus({ ...mission("request"), pendingRunId: "run", pendingApprovalId: "approval" }), "Approval requested — execution remains gated");
  assert.equal(missionStatus({ ...mission("task"), pendingRunId: "run", pendingApprovalId: "approval", pendingTaskId: "task" }), "Task dispatch pending");
});
