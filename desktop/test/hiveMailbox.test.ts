import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { HiveMailbox } from "../src/main/hive/hiveMailbox";

test("Hive mailbox durably delivers, wakes, and acknowledges a message", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-hive-"));
  const wakes: string[] = [];
  const mailbox = new HiveMailbox(root, (id) => ["prime", "coder"].includes(id), (id) => wakes.push(id));
  const sent = await mailbox.send({ senderAgentId: "prime", recipientAgentId: "coder", kind: "request", body: "Implement the bounded parser" });
  assert.equal(sent.status, "delivered");
  assert.deepEqual(wakes, ["coder"]);
  assert.deepEqual((await mailbox.readInbox("coder")).map((message) => message.id), [sent.id]);
  const acknowledged = await mailbox.acknowledge("coder", sent.id);
  assert.equal(acknowledged.status, "acknowledged");
  assert.match(await readFile(join(root, "events.jsonl"), "utf8"), /message-acknowledged/);
});

test("Hive mailbox records missing recipients as bounces instead of dropping them", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-hive-"));
  const mailbox = new HiveMailbox(root, () => false);
  const bounced = await mailbox.send({ senderAgentId: "prime", recipientAgentId: "missing", kind: "request", body: "Do work" });
  assert.equal(bounced.status, "bounced");
  assert.equal((await mailbox.readInbox("missing")).length, 0);
  assert.match(await readFile(join(root, "outbox", "prime", `${bounced.id}.json`), "utf8"), /Recipient does not exist/);
});

test("Hive mailbox enforces identifiers, self-send prevention, body bounds, and hop limits", async () => {
  const mailbox = new HiveMailbox(await mkdtemp(join(tmpdir(), "orbi-hive-")), () => true);
  await assert.rejects(mailbox.send({ senderAgentId: "same", recipientAgentId: "same", kind: "request", body: "x" }), /cannot message themselves/);
  await assert.rejects(mailbox.send({ senderAgentId: "prime", recipientAgentId: "coder", kind: "request", body: "x", hopCount: 9, maxHops: 8 }), /hop limit/);
  await assert.rejects(mailbox.send({ senderAgentId: "../prime", recipientAgentId: "coder", kind: "request", body: "x" }), /Invalid Hive identifier/);
});

test("Hive mailbox preserves every event during concurrent delivery", async () => {
  const root = await mkdtemp(join(tmpdir(), "orbi-hive-"));
  const mailbox = new HiveMailbox(root, () => true);
  await Promise.all(Array.from({ length: 10 }, (_, index) => mailbox.send({ senderAgentId: "prime", recipientAgentId: `worker-${index}`, kind: "inform", body: `Task ${index}` })));
  const events = (await readFile(join(root, "events.jsonl"), "utf8")).trim().split("\n");
  assert.equal(events.length, 10);
});
