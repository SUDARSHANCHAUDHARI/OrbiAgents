-- CreateTable
CREATE TABLE "MemoryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL DEFAULT 'default',
    "scope" TEXT NOT NULL,
    "agentId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MailboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL DEFAULT 'default',
    "senderAgentId" TEXT NOT NULL,
    "recipientAgentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "replyToId" TEXT,
    "hopCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "MailboxMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MemoryEntry_userId_projectKey_scope_agentId_updatedAt_idx" ON "MemoryEntry"("userId", "projectKey", "scope", "agentId", "updatedAt");
CREATE INDEX "MailboxMessage_userId_projectKey_recipientAgentId_status_createdAt_idx" ON "MailboxMessage"("userId", "projectKey", "recipientAgentId", "status", "createdAt");
CREATE INDEX "MailboxMessage_conversationId_createdAt_idx" ON "MailboxMessage"("conversationId", "createdAt");
