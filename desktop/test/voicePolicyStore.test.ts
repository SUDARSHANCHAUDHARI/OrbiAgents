import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { VoicePolicyStore } from "../src/main/voice/voicePolicyStore";

test("voice policy is denied by default and persists explicit consent without enabling capture", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "orbi-voice-")); const file = path.join(root, "policy.json"); const store = new VoicePolicyStore(file, () => 123);
  assert.deepEqual(await store.load(), { consent: false, retention: "none", captureEnabled: false, updatedAt: 0 });
  assert.deepEqual(await store.update({ consent: true, retention: "session" }), { consent: true, retention: "session", captureEnabled: false, updatedAt: 123 });
  assert.equal((await readFile(file, "utf8")).includes('"captureEnabled": false'), true);
  assert.deepEqual(await new VoicePolicyStore(file).load(), { consent: true, retention: "session", captureEnabled: false, updatedAt: 123 });
});

test("revoking consent clears retention and malformed policy fails closed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "orbi-voice-")); const file = path.join(root, "policy.json"); const store = new VoicePolicyStore(file, () => 456);
  await store.update({ consent: true, retention: "24-hours" });
  assert.deepEqual(await store.update({ consent: false, retention: "24-hours" }), { consent: false, retention: "none", captureEnabled: false, updatedAt: 456 });
  await assert.rejects(store.update({ consent: true, retention: "forever" }), /invalid/);
});
