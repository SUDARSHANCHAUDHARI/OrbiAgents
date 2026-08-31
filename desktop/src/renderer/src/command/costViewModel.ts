import type { CostLedgerEntry, CostLedgerSnapshot } from "../../../shared/contracts";

export function filterCostEntries(entries: CostLedgerEntry[], projectPath: string): CostLedgerEntry[] {
  return projectPath ? entries.filter((entry) => entry.projectPath === projectPath) : entries;
}

export interface CostOverview { entries: number; projects: number; visibleEstimateUsd: number; truncated: boolean; }
export function costOverview(snapshot: CostLedgerSnapshot): CostOverview { const total = snapshot.entries.reduce((sum, entry) => sum + entry.amountUsd, 0); return { entries: snapshot.entries.length, projects: new Set(snapshot.entries.map((entry) => entry.projectPath)).size, visibleEstimateUsd: Math.round(total * 10_000) / 10_000, truncated: snapshot.truncated }; }
