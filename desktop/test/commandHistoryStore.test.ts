import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CommandHistoryStore } from "../src/main/commands/commandHistoryStore";

const encryption = { isAvailable: () => true, encrypt: (value: string) => Buffer.from(value.split("").reverse().join("")), decrypt: (value: Buffer) => value.toString().split("").reverse().join("") };
const entry = (id: string, status: "queued" | "sending" | "sent" | "failed" = "queued") => ({ id, agentId: "alpha", body: `Command ${id}`, status, createdAt: 1 });

test("command history encrypts content at rest and resumes interrupted sends as queued", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-commands-")); const file = path.join(directory, "history.json");
  const store = new CommandHistoryStore(file, encryption);
  await store.upsert(entry("00000000-0000-4000-8000-000000000001", "sending"));
  assert.doesNotMatch(await readFile(file, "utf8"), /Command 000/);
  const loaded = await new CommandHistoryStore(file, encryption).load();
  assert.equal(loaded[0].status, "queued");
});

test("command history fails closed without encryption and ignores corrupted state", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "orbi-commands-")); const file = path.join(directory, "history.json");
  const unavailable = new CommandHistoryStore(file, { ...encryption, isAvailable: () => false });
  assert.deepEqual(await unavailable.load(), []);
  await assert.rejects(unavailable.upsert(entry("00000000-0000-4000-8000-000000000002")), /unavailable/);
  await writeFile(file, "not-json");
  assert.deepEqual(await new CommandHistoryStore(file, encryption).load(), []);
});
