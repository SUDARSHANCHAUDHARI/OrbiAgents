import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { db } from "../db";
import { sendMessage } from "../mailboxStore";
import { writeMemory } from "../memoryStore";

test("memory and mailbox records survive a database client restart", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user = await db.user.create({
    data: { email: `restart-${suffix}@example.com`, password: "test-password" },
  });
  const memory = await writeMemory({
    userId: user.id,
    scope: "agent",
    agentId: "2",
    content: "Persist this across restarts",
  });
  const message = await sendMessage({
    userId: user.id,
    senderAgentId: "3",
    recipientAgentId: "2",
    kind: "inform",
    body: "Persistent mailbox message",
  });

  await db.$disconnect();
  const restartedClient = new PrismaClient();
  try {
    const [storedMemory, storedMessage] = await Promise.all([
      restartedClient.memoryEntry.findUnique({ where: { id: memory.id } }),
      restartedClient.mailboxMessage.findUnique({ where: { id: message.id } }),
    ]);
    assert.equal(storedMemory?.content, "Persist this across restarts");
    assert.equal(storedMessage?.body, "Persistent mailbox message");
  } finally {
    await restartedClient.$disconnect();
  }
});
