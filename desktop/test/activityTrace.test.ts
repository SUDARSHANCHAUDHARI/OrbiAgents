import assert from "node:assert/strict";
import test from "node:test";
import { activityTraceJson } from "../src/main/activity/activityTrace";

test("activity trace exports bounded OTLP-compatible spans without summaries or usage", () => {
  const trace = JSON.parse(activityTraceJson([{ id: "event-1", agentId: "alpha", type: "provider-activity", source: "codex-jsonl", state: "coding", summary: "sensitive file name", timestamp: 1_000, usage: { scope: "event", inputTokens: 10, outputTokens: 2 } }]));
  const span = trace.resourceSpans[0].scopeSpans[0].spans[0];
  assert.equal(trace.resourceSpans[0].resource.attributes[0].value.stringValue, "OrbiAgents");
  assert.equal(span.name, "provider-activity"); assert.equal(span.startTimeUnixNano, "1000000000");
  assert.equal(JSON.stringify(trace).includes("sensitive file name"), false); assert.equal(JSON.stringify(trace).includes("inputTokens"), false);
});

test("activity trace rejects malformed and unbounded renderer input", () => {
  assert.throws(() => activityTraceJson([{ id: "x", agentId: "../escape", type: "session-started", source: "lifecycle", summary: "x", timestamp: 1 }]), /invalid/);
  assert.throws(() => activityTraceJson(Array.from({ length: 501 }, () => null)), /invalid/);
});
