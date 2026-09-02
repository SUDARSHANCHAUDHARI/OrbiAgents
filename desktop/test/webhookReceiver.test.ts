import assert from "node:assert/strict";
import test from "node:test";
import { WebhookReceiver } from "../src/main/webhooks/webhookReceiver";

test("webhook receiver is explicit, loopback-only, authenticated, and replay-safe", async () => {
  const receiver = new WebhookReceiver();
  assert.deepEqual(receiver.status(), { enabled: false, events: [] });
  const started = await receiver.start();
  assert.match(started.endpoint!, /^http:\/\/127\.0\.0\.1:\d+\/v1\/events$/);
  const secret = receiver.copySecret(); assert.ok(secret.length >= 40); assert.equal(JSON.stringify(started).includes(secret), false);
  const unauthorized = await fetch(started.endpoint!, { method: "POST", body: JSON.stringify({ title: "Build", detail: "Run tests" }) });
  assert.equal(unauthorized.status, 401);
  const headers = { authorization: `Bearer ${secret}`, "x-orbi-event-id": "event-0001", "content-type": "application/json" };
  const accepted = await fetch(started.endpoint!, { method: "POST", headers, body: JSON.stringify({ title: "Build", detail: "Run tests", source: "CI" }) });
  assert.equal(accepted.status, 202);
  const replay = await fetch(started.endpoint!, { method: "POST", headers, body: JSON.stringify({ title: "Changed", detail: "Must not replace" }) });
  assert.equal(replay.status, 409);
  assert.deepEqual(receiver.status().events.map(({ title, detail, source }) => ({ title, detail, source })), [{ title: "Build", detail: "Run tests", source: "CI" }]);
  assert.equal(receiver.event("event-0001").title, "Build");
  assert.equal(receiver.attachWorker("event-0001", "webhook-worker").events[0].workerAgentId, "webhook-worker");
  assert.throws(() => receiver.event("event-0001"), /already has a worker/);
  const completed = receiver.completeWorker("event-0001"); assert.equal(completed.workerAgentId, "webhook-worker"); assert.ok(completed.status.events[0]?.completedAt);
  assert.throws(() => receiver.completeWorker("event-0001"), /cannot be completed/);
  assert.deepEqual(await receiver.stop(), { enabled: false, events: receiver.status().events });
  assert.throws(() => receiver.copySecret(), /not enabled/);
});

test("webhook receiver rejects malformed identifiers and payloads", async () => {
  const receiver = new WebhookReceiver(); const status = await receiver.start(); const authorization = `Bearer ${receiver.copySecret()}`;
  try {
    const missingId = await fetch(status.endpoint!, { method: "POST", headers: { authorization }, body: "{}" }); assert.equal(missingId.status, 400);
    const invalid = await fetch(status.endpoint!, { method: "POST", headers: { authorization, "x-orbi-event-id": "event-0002" }, body: JSON.stringify({ title: "", detail: "x" }) }); assert.equal(invalid.status, 422);
  } finally { await receiver.stop(); }
});
