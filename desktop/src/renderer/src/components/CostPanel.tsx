import { useEffect, useState } from "react";
import type { CostLedgerSnapshot } from "../../../shared/contracts";

export function CostPanel({ onError }: { onError(message: string): void }) {
  const [snapshot, setSnapshot] = useState<CostLedgerSnapshot | null>(null); const [busy, setBusy] = useState(false);
  async function refresh() { setBusy(true); try { setSnapshot(await window.orbi.costs.snapshot()); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  useEffect(() => { void refresh(); }, []);
  return <section className="command-panel cost-panel" aria-label="Authorized cost estimates">
    <div className="section-title"><span>Authorized cost estimates</span><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh ledger</button></div>
    <p className="mission-policy">Local operator-authorized estimates only. These values are not token measurements, provider invoices, or actual charges.</p>
    {snapshot?.corrupted ? <div className="error-banner" role="alert">Ledger integrity is uncertain. The verified prefix is shown and new cost entries are blocked.</div> : null}
    {snapshot ? <><p><strong>{usd(snapshot.totalAuthorizedEstimateUsd)}</strong> total authorized estimate across verified entries.</p>{snapshot.entries.length ? <ul>{snapshot.entries.map((entry) => <li key={entry.id}><strong>{entry.title}</strong><small>{usd(entry.amountUsd)} · authorization estimate · {new Date(entry.createdAt).toLocaleString()}</small><span>{entry.projectPath}\nMission {entry.missionId} · run {entry.runId}</span></li>)}</ul> : <p className="empty">No scheduled mission cost authorizations recorded.</p>}{snapshot.truncated ? <small>Showing the newest bounded set; the total includes all verified entries.</small> : null}</> : <p className="empty">Loading cost ledger…</p>}
  </section>;
}
function usd(value: number): string { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
