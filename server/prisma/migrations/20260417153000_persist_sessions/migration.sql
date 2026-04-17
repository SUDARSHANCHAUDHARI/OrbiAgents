PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StoredSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task" TEXT NOT NULL,
    "frames" TEXT NOT NULL,
    "totalCostUsd" REAL NOT NULL DEFAULT 0,
    "shareToken" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StoredSession" ("createdAt", "frames", "id", "task", "userId")
SELECT "createdAt", "frames", "id", "task", "userId" FROM "StoredSession";
DROP TABLE "StoredSession";
ALTER TABLE "new_StoredSession" RENAME TO "StoredSession";
CREATE UNIQUE INDEX "StoredSession_shareToken_key" ON "StoredSession"("shareToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
