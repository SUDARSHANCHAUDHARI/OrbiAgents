import type { CostLedgerEntry, CostLedgerSnapshot } from "../../../shared/contracts";

export function filterCostEntries(entries: CostLedgerEntry[], projectPath: string): CostLedgerEntry[] {
  return projectPath ? entries.filter((entry) => entry.projectPath === projectPath) : entries;
}

export function costOverview(snapshot: CostLedgerSnapshot): string {
  if (!snapshot.entries.length) return "No verified cost authorizations";
  const projects = new Set(snapshot.entries.map((entry) => entry.projectPath)).size;
  const visibleTotal = snapshot.entries.reduce((total, entry) => total + entry.amountUsd, 0);
  const visible = `${snapshot.entries.length} verified entries · ${projects} project${projects === 1 ? "" : "s"} · ${usd(visibleTotal)} visible estimate`;
  return snapshot.truncated ? `${visible} · newest bounded set` : visible;
}

function usd(value: number): string { return `$${value.toFixed(4)}`; }
