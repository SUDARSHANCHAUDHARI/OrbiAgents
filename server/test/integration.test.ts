import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createSession, recordFrame } from "../sessionStore";
import { signToken } from "../auth";
import { db } from "../db";
import { startServer, stopServer } from "../index";
import { Agent } from "../types";

let baseUrl = "";
let wsUrl = "";

before(() => {
  const { port } = startServer(0);
  baseUrl = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}`;
});

after(async () => {
  await stopServer();
});

function makeHeaders(token?: string): Record<string, string> | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function makeAgent(): Agent {
  return {
    id: "1",
    name: "Orbi-Alpha",
    state: "idle",
    task: "Ready",
    paused: false,
    tokensUsed: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    lastAction: "Initialized",
    logs: ["init"],
    x: 0,
    y: 0,
  };
}

async function createTestUser(prefix: string): Promise<{ id: string; token: string }> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const user = await db.user.create({
    data: {
      email,
      password: "test-password",
    },
  });
  return { id: user.id, token: signToken(user.id) };
}

test("protected replay endpoints enforce session ownership", async () => {
  const sessionId = `session-${Date.now()}`;
  const owner = await createTestUser("owner");
  const other = await createTestUser("other");

  await createSession(sessionId, "Investigate bug", owner.id);
  recordFrame(sessionId, [makeAgent()]);

  const ownerRes = await fetch(`${baseUrl}/replay/${sessionId}`, {
    headers: makeHeaders(owner.token),
  });
  assert.equal(ownerRes.status, 200);

  const otherRes = await fetch(`${baseUrl}/replay/${sessionId}`, {
    headers: makeHeaders(other.token),
  });
  assert.equal(otherRes.status, 404);
});

test("share links can be created by the owner and viewed publicly", async () => {
  const sessionId = `share-session-${Date.now()}`;
  const owner = await createTestUser("share-owner");

  await createSession(sessionId, "Ship feature", owner.id);
  recordFrame(sessionId, [makeAgent()]);

  const shareRes = await fetch(`${baseUrl}/replay/${sessionId}/share`, {
    method: "POST",
    headers: makeHeaders(owner.token),
  });
  assert.equal(shareRes.status, 200);
  const shareBody = (await shareRes.json()) as { token: string; url: string };
  assert.ok(shareBody.token);
  assert.match(shareBody.url, /\/replay\//);

  const publicReplay = await fetch(`${baseUrl}/replay/public/${shareBody.token}`);
  assert.equal(publicReplay.status, 200);
  const session = (await publicReplay.json()) as { id: string };
  assert.equal(session.id, sessionId);
});

test("websocket rejects missing token and accepts authenticated clients", async () => {
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(wsUrl);
    ws.on("close", (code) => {
      assert.equal(code, 1008);
      resolve();
    });
  });

  await new Promise<void>((resolve, reject) => {
    const token = signToken(`ws-user-${Date.now()}`);
    const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

    ws.on("message", (data) => {
      const payload = JSON.parse(data.toString()) as unknown;
      assert.ok(Array.isArray(payload));
      ws.close();
      resolve();
    });

    ws.on("error", reject);
  });
});
