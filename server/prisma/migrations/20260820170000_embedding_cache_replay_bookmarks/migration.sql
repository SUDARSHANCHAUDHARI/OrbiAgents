-- CreateTable
CREATE TABLE "MemoryEmbeddingCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "vector" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemoryEmbeddingCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReplayBookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "frame" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReplayBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReplayBookmark_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StoredSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MemoryEmbeddingCache_userId_model_contentHash_key" ON "MemoryEmbeddingCache"("userId", "model", "contentHash");
CREATE INDEX "MemoryEmbeddingCache_userId_updatedAt_idx" ON "MemoryEmbeddingCache"("userId", "updatedAt");
CREATE UNIQUE INDEX "ReplayBookmark_userId_sessionId_frame_key" ON "ReplayBookmark"("userId", "sessionId", "frame");
CREATE INDEX "ReplayBookmark_userId_sessionId_idx" ON "ReplayBookmark"("userId", "sessionId");
