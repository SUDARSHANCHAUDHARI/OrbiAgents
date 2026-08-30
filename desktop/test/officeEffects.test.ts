import assert from "node:assert/strict";
import test from "node:test";
import { activityBubbleForState, pointOnOfficeLink } from "../src/renderer/src/office/officeEffects";

test("activity bubbles expose bounded operational labels for every runtime state", () => {
  assert.deepEqual(["idle", "thinking", "reading", "coding", "permission-waiting", "done", "failed"].map((state) => activityBubbleForState(state as Parameters<typeof activityBubbleForState>[0])), ["STANDBY", "PLAN", "READ", "CODE", "APPROVE?", "DONE", "ERROR"]);
});

test("Hive traffic points interpolate deterministically and clamp to the link", () => {
  const from = { x: 10, y: 20 }; const to = { x: 50, y: 60 };
  assert.deepEqual(pointOnOfficeLink(from, to, -.5), from);
  assert.deepEqual(pointOnOfficeLink(from, to, .5), { x: 30, y: 40 });
  assert.deepEqual(pointOnOfficeLink(from, to, 2), to);
});
