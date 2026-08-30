import assert from "node:assert/strict";
import test from "node:test";
import { commandsForAgent, createCommandEntry, terminalPayload, updateCommandEntry } from "../src/renderer/src/command/commandComposerModel";

test("command composer validates bounded terminal payloads", () => {
  const entry = createCommandEntry("alpha", "  Run the focused tests  ", 10, "one");
  assert.deepEqual(entry, { id: "one", agentId: "alpha", body: "Run the focused tests", status: "queued", createdAt: 10 });
  assert.equal(terminalPayload(entry), "Run the focused tests\r");
  assert.throws(() => createCommandEntry("alpha", "   ", 10, "two"), /required/);
  assert.throws(() => createCommandEntry("alpha", "😀".repeat(3_000), 10, "three"), /8 KB/);
});

test("command composer isolates agent queues and retains a bounded session history", () => {
  let entries = [createCommandEntry("alpha", "A", 1, "a"), createCommandEntry("beta", "B", 2, "b")];
  entries = updateCommandEntry(entries, "a", "sent");
  assert.deepEqual(commandsForAgent(entries, "alpha").map((entry) => entry.status), ["sent"]);
  assert.deepEqual(commandsForAgent(entries, "beta").map((entry) => entry.body), ["B"]);
  for (let index = 0; index < 105; index += 1) entries = [...entries, createCommandEntry("alpha", String(index), index, `entry-${index}`)].slice(-100);
  assert.equal(entries.length, 100);
});

test("command composer adds only bounded workspace-relative attachments to payloads", () => {
  const entry = createCommandEntry("alpha", "Review these files", 1, "files", ["src/app.ts", "test/app.test.ts"]);
  assert.match(terminalPayload(entry), /Attached workspace files:\n- "src\/app.ts"\n- "test\/app.test.ts"\r$/);
  assert.throws(() => createCommandEntry("alpha", "Unsafe", 1, "bad", ["../.env"]), /attachments/);
  assert.throws(() => createCommandEntry("alpha", "Too many", 1, "many", ["1", "2", "3", "4", "5", "6"]), /attachments/);
});
