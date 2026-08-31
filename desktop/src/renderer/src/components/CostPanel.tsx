import { useEffect, useState } from "react";
import type { ActivityEvent, AgentSession, CostLedgerSnapshot } from "../../../shared/contracts";
import { costOverview, filterCostEntries } from "../command/costViewModel";
import { runtimeUsage } from "../command/usageViewModel";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";

export function CostPanel({ events, agents, onError }: { events: ActivityEvent[]; agents: AgentSession[]; onError(message: string): void }) {
  const [snapshot, setSnapshot] = useState<CostLedgerSnapshot | null>(null); const [busy, setBusy] = useState(false);
  const [projectPath, setProjectPath] = useState("");
  async function refresh() { setBusy(true); try { const next = await window.orbi.costs.snapshot(); setSnapshot(next); setProjectPath((current) => current && !next.entries.some((entry) => entry.projectPath === current) ? "" : current); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  useEffect(() => { void refresh(); }, []);
  const entries = snapshot ? filterCostEntries(snapshot.entries, projectPath) : [];
  const projects = snapshot ? [...new Set(snapshot.entries.map((entry) => entry.projectPath))].sort() : [];
  const usage = runtimeUsage(events, agents);
  return <PixelPanel title="Usage and cost controls" eyebrow="measured session telemetry" ariaLabel="Usage and cost controls" className="cost-panel" action={<PixelButton type="button" variant="ghost" disabled={busy} onClick={() => void refresh()}>Refresh ledger</PixelButton>}>
    <div className="usage-summary"><strong>{usage.providerSignals}</strong><span>provider signals</span><strong>{usage.activeMinutes}</strong><span>agent-minutes</span><strong>{usage.totalSignals}</strong><span>all signals</span></div>
    <p className="mission-policy">Session telemetry counts sanitized runtime signals and elapsed agent time. Providers do not expose consistent token or tool totals here, so OrbiAgents does not fabricate them.</p>
    {usage.byState.length ? <p className="empty">Observed work: {usage.byState.map((entry) => `${entry.state} ${entry.count}`).join(" · ")}</p> : <p className="empty">No provider activity has been measured in this desktop session.</p>}
    <p className="mission-policy">Local operator-authorized estimates only. These values are not token measurements, provider invoices, or actual charges.</p>
    {snapshot?.corrupted ? <div className="error-banner" role="alert">Ledger integrity is uncertain. The verified prefix is shown and new cost entries are blocked.</div> : null}
    {snapshot ? <><p><strong>{usd(snapshot.totalAuthorizedEstimateUsd)}</strong> ledger-wide authorized estimate across every verified entry.</p><p className="empty" aria-live="polite">{costOverview(snapshot)} · showing {entries.length}</p>{projects.length > 1 ? <label className="cost-filter">Project<select aria-label="Filter costs by project" value={projectPath} onChange={(event) => setProjectPath(event.target.value)}><option value="">All loaded projects</option>{projects.map((path) => <option key={path} value={path}>{path}</option>)}</select></label> : null}{entries.length ? <ul>{entries.map((entry) => <li key={entry.id}><strong>{entry.title}</strong><small>{usd(entry.amountUsd)} · operator-approved estimate · {new Date(entry.createdAt).toLocaleString()}</small><span>{entry.projectPath}\nMission {entry.missionId} · run {entry.runId}</span></li>)}</ul> : <p className="empty">No loaded entries match this project.</p>}{snapshot.truncated ? <small>Showing only the newest 200 verified entries; the ledger-wide total above includes the complete verified chain.</small> : null}</> : <p className="empty">Loading cost ledger…</p>}
  </PixelPanel>;
}
function usd(value: number): string { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
