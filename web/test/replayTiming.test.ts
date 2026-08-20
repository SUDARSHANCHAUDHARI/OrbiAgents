import assert from "node:assert/strict";
import test from "node:test";
import { eventsThroughFrame, replayDelay } from "../lib/replayTiming";

test("replay delay follows recorded frame spacing with safe bounds and speed", () => {
  const frames = [{ timestamp: 100, agents: [] }, { timestamp: 1_100, agents: [] }];
  assert.equal(replayDelay(frames, 0, 2), 500);
  assert.equal(replayDelay([{ timestamp: 0, agents: [] }, { timestamp: 10_000, agents: [] }], 0, 1), 2_000);
});

test("replay events are revealed only through the current frame", () => {
  const events = [{ type: "started", timestamp: 100 }, { type: "done", timestamp: 300 }];
  assert.deepEqual(eventsThroughFrame(events, { timestamp: 200, agents: [] }).map((event) => event.type), ["started"]);
});
