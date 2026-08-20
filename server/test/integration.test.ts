import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createSession, recordFrame } from "../sessionStore";
import { signToken } from "../auth";
import { db } from "../db";
import { startServer, stopServer } from "../index";
import { Agent } from "../types";
import { PrismaClient } from "@prisma/client";

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

function makeJsonHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
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

test("replay bookmarks persist per owner and reject invalid frames", async () => {
  const sessionId = `bookmark-session-${Date.now()}`;
  const owner = await createTestUser("bookmark-owner");
  const other = await createTestUser("bookmark-other");
  await createSession(sessionId, "Bookmark replay", owner.id);
  recordFrame(sessionId, [makeAgent()]); recordFrame(sessionId, [makeAgent()]);

  const saved = await fetch(`${baseUrl}/replay/${sessionId}/bookmarks`, { method: "PUT", headers: makeJsonHeaders(owner.token), body: JSON.stringify({ bookmarks: [{ frame: 2, label: "Key result", shared: true }, { frame: 1 }] }) });
  assert.equal(saved.status, 200); assert.deepEqual(await saved.json(), { bookmarks: [{ frame: 1, shared: false }, { frame: 2, label: "Key result", shared: true }] });
  assert.deepEqual((await db.replayBookmark.findMany({ where: { userId: owner.id, sessionId }, orderBy: { frame: "asc" } })).map((row) => row.frame), [1, 2]);
  const restartedClient = new PrismaClient();
  try { assert.deepEqual((await restartedClient.replayBookmark.findMany({ where: { userId: owner.id, sessionId }, orderBy: { frame: "asc" } })).map((row) => row.frame), [1, 2]); }
  finally { await restartedClient.$disconnect(); }

  const loaded = await fetch(`${baseUrl}/replay/${sessionId}/bookmarks`, { headers: makeHeaders(owner.token) });
  assert.deepEqual(await loaded.json(), { bookmarks: [{ frame: 1, shared: false }, { frame: 2, label: "Key result", shared: true }] });
  assert.equal((await fetch(`${baseUrl}/replay/${sessionId}/bookmarks`, { headers: makeHeaders(other.token) })).status, 404);
  assert.equal((await fetch(`${baseUrl}/replay/${sessionId}/bookmarks`, { method: "PUT", headers: makeJsonHeaders(owner.token), body: JSON.stringify({ frames: [3] }) })).status, 400);
});

test("health endpoint reports basic server status", async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status: string; uptimeSec: number; runtimes: number };
  assert.equal(body.status, "ok");
  assert.equal(typeof body.uptimeSec, "number");
  assert.equal(typeof body.runtimes, "number");
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

test("workflow stop returns conflict when no run is active", async () => {
  const user = await createTestUser("stop-idle");
  const res = await fetch(`${baseUrl}/workflow/stop`, {
    method: "POST",
    headers: makeHeaders(user.token),
  });

  assert.equal(res.status, 409);
});

test("memory and mailbox APIs persist user-scoped agent context", async () => {
  const user = await createTestUser("memory-mailbox");
  const memoryRes = await fetch(`${baseUrl}/memory`, {
    method: "POST",
    headers: makeJsonHeaders(user.token),
    body: JSON.stringify({ scope: "agent", agentId: "2", content: "Prefer focused tests" }),
  });
  assert.equal(memoryRes.status, 201);

  const memoryList = await fetch(`${baseUrl}/memory?scope=agent&agentId=2`, {
    headers: makeHeaders(user.token),
  });
  const memories = (await memoryList.json()) as Array<{ content: string }>;
  assert.equal(memories[0]?.content, "Prefer focused tests");

  const messageRes = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: makeJsonHeaders(user.token),
    body: JSON.stringify({
      senderAgentId: "3",
      recipientAgentId: "2",
      kind: "request",
      body: "Fix the failing edge case",
    }),
  });
  assert.equal(messageRes.status, 201);
  const message = (await messageRes.json()) as { id: string; conversationId: string };

  const inboxRes = await fetch(`${baseUrl}/messages/2`, { headers: makeHeaders(user.token) });
  const inbox = (await inboxRes.json()) as Array<{ id: string; body: string }>;
  assert.equal(inbox.some((item) => item.id === message.id && item.body === "Fix the failing edge case"), true);

  const readRes = await fetch(`${baseUrl}/messages/${message.id}/read`, {
    method: "POST",
    headers: makeHeaders(user.token),
  });
  assert.equal(readRes.status, 200);

  const replyRes = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: makeJsonHeaders(user.token),
    body: JSON.stringify({
      senderAgentId: "2",
      recipientAgentId: "3",
      kind: "agree",
      body: "I will fix it",
      replyToId: message.id,
      hopCount: 0,
      conversationId: "client-cannot-replace-this",
    }),
  });
  assert.equal(replyRes.status, 201);
  const reply = (await replyRes.json()) as { hopCount: number; conversationId: string };
  assert.equal(reply.hopCount, 1);
  assert.equal(reply.conversationId, message.conversationId);
});
