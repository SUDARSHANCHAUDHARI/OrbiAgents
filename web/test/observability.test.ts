import assert from "node:assert/strict";
import test from "node:test";
import { describeWorkflowEvent, isSupervisorActive } from "../lib/observability";

test("observability labels expose real node and retry details", () => {
  assert.equal(
    describeWorkflowEvent({ type: "node-retrying", timestamp: 1, nodeId: "review", detail: "attempt 2" }),
    "Orbi-Prime scheduled a retry · review · attempt 2"
  );
});

test("supervisor activity follows workflow terminal events", () => {
  assert.equal(isSupervisorActive([{ type: "workflow-started", timestamp: 1 }]), true);
  assert.equal(isSupervisorActive([
    { type: "workflow-started", timestamp: 1 },
    { type: "workflow-completed", timestamp: 2 },
  ]), false);
});
