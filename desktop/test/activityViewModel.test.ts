import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityEvent } from "../src/shared/contracts";
import { activityOverview, eventOffset, filterActivity, runtimeBudget } from "../src/renderer/src/command/activityViewModel";

function signal(id: string, agentId: string, source: ActivityEvent["source"], state?: ActivityEvent["state"]): ActivityEvent {
  return { id, agentId, source, state, type: source === "lifecycle" ? "session-started" : "provider-activity", summary: id, timestamp: Number(id) };
}

test("activity waterfall offsets and runtime budgets use measured timestamps", () => {
  const events = [signal("1000", "a", "lifecycle"), signal("6000", "a", "codex-jsonl")];
  assert.equal(eventOffset(events, events[1]!), 5_000);
  assert.deepEqual(runtimeBudget(0, 10, 3 * 60_000), { elapsedMinutes: 3, percent: 30 });
  assert.equal(runtimeBudget(0, 10, 20 * 60_000).percent, 100);
});

test("activity filters combine verified agent, source, and normalized state fields", () => {
  const events = [signal("1", "a", "lifecycle", "idle"), signal("2", "a", "codex-jsonl", "coding"), signal("3", "b", "claude-hook", "coding")];
  assert.deepEqual(filterActivity(events, { agentId: "a", source: "codex-jsonl", state: "coding" }).map(({ id }) => id), ["2"]);
  assert.deepEqual(filterActivity(events, { agentId: "", source: "", state: "coding" }).map(({ id }) => id), ["3", "2"]);
});

test("activity overview reports session-scoped signal and attention counts", () => {
  const events = [signal("1", "a", "lifecycle", "idle"), signal("2", "a", "codex-jsonl", "permission-waiting"), signal("3", "b", "claude-hook", "failed")];
  assert.deepEqual(activityOverview(events), { signals: 3, agents: 2, providerEvents: 2, attention: 2 });
  assert.deepEqual(activityOverview([]), { signals: 0, agents: 0, providerEvents: 0, attention: 0 });
});
