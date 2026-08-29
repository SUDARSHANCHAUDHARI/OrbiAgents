import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ApprovalQueue, requiresApproval } from "../src/main/hive/approvalQueue";

test("critical Hive action categories always require durable approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-approval-"));
  const queue = new ApprovalQueue(root);
  for (const category of ["destructive-operation", "scope-expansion"] as const) {
    const request = await queue.request({ category, title: `Request ${category}`, rationale: "Required to complete the assigned task", requestedByAgentId: "prime" });
    assert.equal(request?.status, "pending");
  }
  const spend = await queue.request({ category: "spend-increase", title: "Increase budget", rationale: "One additional review pass", requestedByAgentId: "prime", estimatedAdditionalCostUsd: 2.5 });
  assert.equal(spend?.status, "pending");
  assert.equal((await queue.list("pending")).length, 3);
});

test("routine actions bypass the queue while critical actions fail closed", async () => {
  const queue = new ApprovalQueue(await mkdtemp(join(tmpdir(), "orbi-approval-")));
  assert.equal(requiresApproval({ category: "routine", title: "Read tests", rationale: "Understand behavior", requestedByAgentId: "prime" }), false);
  assert.equal(await queue.request({ category: "routine", title: "Read tests", rationale: "Understand behavior", requestedByAgentId: "prime" }), null);
  await assert.rejects(queue.request({ category: "spend-increase", title: "More budget", rationale: "Continue", requestedByAgentId: "prime" }), /positive finite cost/);
  await assert.rejects(queue.assertApproved("missing"), /does not have operator approval/);
});

test("operator decisions are single-use and approval can be asserted", async () => {
  const queue = new ApprovalQueue(await mkdtemp(join(tmpdir(), "orbi-approval-")));
  const request = await queue.request({ category: "scope-expansion", title: "Add documentation", rationale: "Requested work does not include documentation", requestedByAgentId: "prime" });
  assert.ok(request);
  const approved = await queue.decide(request.id, "approved", "Operator accepted the expanded scope");
  assert.equal((await queue.assertApproved(request.id)).status, "approved");
  assert.equal(approved.decisionReason, "Operator accepted the expanded scope");
  await assert.rejects(queue.decide(request.id, "rejected", "Changed mind"), /already decided/);
});

test("concurrent approval requests are all preserved", async () => {
  const queue = new ApprovalQueue(await mkdtemp(join(tmpdir(), "orbi-approval-")));
  await Promise.all(Array.from({ length: 12 }, (_, index) => queue.request({ category: "destructive-operation", title: `Delete generated item ${index}`, rationale: "Cleanup requested output", requestedByAgentId: "prime" })));
  assert.equal((await queue.list()).length, 12);
});
