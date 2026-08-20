ALTER TABLE "ReplayBookmark" ADD COLUMN "label" TEXT;
ALTER TABLE "ReplayBookmark" ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SupervisorPreference" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "enabledPolicies" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupervisorPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkflowProposalHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "proposal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowProposalHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkflowProposalHistory_userId_createdAt_idx" ON "WorkflowProposalHistory"("userId", "createdAt");
