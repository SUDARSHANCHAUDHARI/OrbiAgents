import assert from "node:assert/strict";
import { test } from "node:test";
import { ActivityHookServer } from "../src/main/activity/activityHookServer";

test("activity hook server accepts only authenticated bounded provider events", async () => {
  const received: Array<[string, unknown]> = [];
  const server = new ActivityHookServer((provider, payload) => received.push([provider, payload]));
  const config = await server.start();
  try {
    const endpoint = `http://127.0.0.1:${config.port}/api/activity/claude`;
    assert.equal((await fetch(endpoint, { method: "POST", body: "{}" })).status, 401);
    assert.equal((await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${config.token}` }, body: "broken" })).status, 400);
    assert.equal((await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${config.token}` }, body: JSON.stringify({ hook_event_name: "Stop" }) })).status, 204);
    assert.deepEqual(received, [["claude", { hook_event_name: "Stop" }]]);
  } finally {
    await server.stop();
  }
});
