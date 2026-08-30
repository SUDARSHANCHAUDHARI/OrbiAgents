import assert from "node:assert/strict";
import test from "node:test";
import { commandsForAgent, createCommandEntry, terminalPayload, updateCommandEntry } from "../src/renderer/src/command/commandComposerModel";

test("command composer validates bounded terminal payloads", () => {
  const entry = createCommandEntry("alpha", "  Run the focused tests  ", 10, "one");
  assert.deepEqual(entry, { id: "one", agentId: "alpha", body: "Run the focused tests", status: "queued", createdAt: 10 });
  assert.equal(terminalPayload(entry), "Run the focused tests\r");
  assert.throws(() => createCommandEntry("alpha", "   ", 10, "two"), /required/);
  assert.throws(() => createCommandEntry("alpha", "😀".repeat(20_000), 10, "three"), /64 KB/);
});

test("command composer isolates agent queues and retains a bounded session history", () => {
  let entries = [createCommandEntry("alpha", "A", 1, "a"), createCommandEntry("beta", "B", 2, "b")];
  entries = updateCommandEntry(entries, "a", "sent");
  assert.deepEqual(commandsForAgent(entries, "alpha").map((entry) => entry.status), ["sent"]);
  assert.deepEqual(commandsForAgent(entries, "beta").map((entry) => entry.body), ["B"]);
  for (let index = 0; index < 105; index += 1) entries = [...entries, createCommandEntry("alpha", String(index), index, `entry-${index}`)].slice(-100);
  assert.equal(entries.length, 100);
});
