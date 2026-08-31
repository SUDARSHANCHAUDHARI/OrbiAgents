import assert from "node:assert/strict";
import test from "node:test";
import type { CostLedgerEntry, CostLedgerSnapshot } from "../src/shared/contracts";
import { costOverview, filterCostEntries } from "../src/renderer/src/command/costViewModel";

function entry(id: string, projectPath: string, amountUsd: number): CostLedgerEntry {
  return { id, eventKey: id.padEnd(64, "0"), kind: "authorization-estimate", basis: "operator-approved-scheduled-mission-estimate", currency: "USD", amountUsd, projectPath, missionId: "mission", runId: id, approvalId: "approval", title: id, createdAt: 1, checksum: id.padEnd(64, "1") };
}

test("cost overview distinguishes visible bounded entries from the ledger total", () => {
  const snapshot: CostLedgerSnapshot = { entries: [entry("a", "/one", 0.1), entry("b", "/two", 0.2)], totalAuthorizedEstimateUsd: 9, corrupted: false, truncated: true };
  assert.deepEqual(costOverview(snapshot), { entries: 2, projects: 2, visibleEstimateUsd: 0.3, truncated: true });
});

test("cost filtering applies only to loaded verified entries", () => {
  const entries = [entry("a", "/one", 0.1), entry("b", "/two", 0.2)];
  assert.deepEqual(filterCostEntries(entries, "/two").map(({ id }) => id), ["b"]);
  assert.equal(filterCostEntries(entries, "").length, 2);
});
