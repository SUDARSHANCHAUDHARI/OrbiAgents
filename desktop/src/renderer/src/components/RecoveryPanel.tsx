import { useEffect, useState } from "react";
import type { RecoveryReport } from "../../../shared/contracts";

export function RecoveryPanel({ onError }: { onError(message: string): void }) {
  const [report, setReport] = useState<RecoveryReport | null>(null); const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false);
  async function refresh() { setBusy(true); try { setReport(await window.orbi.recovery.status()); setLoaded(true); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  useEffect(() => { void refresh(); }, []);
  return <section className="command-panel recovery-panel" aria-label="Startup recovery report">
    <div className="section-title"><span>Startup recovery</span><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh report</button></div>
    <p className="mission-policy">Read-only inventory. Recovery never restarts commands, delivers tasks, changes worktrees, or decides approvals.</p>
    {!loaded ? <p className="empty">Loading recovery report…</p> : report?.items.length ? <><p><strong>{report.items.length} item{report.items.length === 1 ? "" : "s"} need review.</strong>{report.truncated ? " The bounded report was truncated." : ""}</p><ul>{report.items.map((entry) => <li key={entry.id}><strong>{entry.title}</strong><small>{label(entry.kind)} · {new Date(entry.detectedAt).toLocaleString()}</small><span>{entry.detail}{entry.projectPath ? `\n${entry.projectPath}` : ""}</span></li>)}</ul></> : <p className="empty">No interrupted sessions or unfinished durable work were detected.</p>}
    {report ? <small>Inventory generated {new Date(report.generatedAt).toLocaleString()}</small> : null}
  </section>;
}
function label(kind: string): string { return kind.replaceAll("-", " "); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
