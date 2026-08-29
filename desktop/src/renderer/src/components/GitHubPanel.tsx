import { useEffect, useState } from "react";
import type { GitHubAuthStatus, GitHubSnapshot } from "../../../shared/contracts";

export function GitHubPanel({ agentId, onError }: { agentId: string | null; onError(message: string): void }) {
  const [auth, setAuth] = useState<GitHubAuthStatus | null>(null); const [snapshot, setSnapshot] = useState<GitHubSnapshot | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { setSnapshot(null); setAuth(null); }, [agentId]);
  async function checkAuth() { setBusy(true); try { setAuth(await window.orbi.github.authStatus()); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  async function refresh() { if (!agentId) return; setBusy(true); try { const next = await window.orbi.github.snapshot({ agentId }); setSnapshot(next); setAuth({ installed: true, authenticated: true }); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  if (!agentId) return <section className="command-panel"><div className="section-title">GitHub</div><p className="empty">Select an agent to ingest its workspace repository.</p></section>;
  return <section className="command-panel github-panel" aria-label="GitHub issue and CI ingestion">
    <div className="section-title"><span>GitHub issues and CI</span><span className="mission-actions"><button type="button" disabled={busy} onClick={() => void checkAuth()}>Check local auth</button><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh repository</button></span></div>
    <p className="mission-policy">Read-only and operator-triggered. Uses the locally authenticated `gh` CLI without token IPC, login automation, polling, or workflow mutation.</p>
    {auth ? <p>{auth.installed ? auth.authenticated ? "GitHub CLI is locally authenticated." : "GitHub CLI is not authenticated. Run gh auth login in your terminal." : "GitHub CLI is not installed."}</p> : null}
    {snapshot ? <><h3>{snapshot.repository.nameWithOwner}</h3><small>Fetched {new Date(snapshot.fetchedAt).toLocaleString()}</small><div className="github-grid"><div><h4>Open issues</h4>{snapshot.issues.length ? <ul>{snapshot.issues.map((issue) => <li key={issue.number}><strong>#{issue.number} · {issue.title}</strong><small>{issue.state} · {new Date(issue.updatedAt).toLocaleString()}</small><span>{issue.labels.join(", ") || "No labels"}</span></li>)}</ul> : <p className="empty">No open issues.</p>}</div><div><h4>Recent Actions runs</h4>{snapshot.runs.length ? <ul>{snapshot.runs.map((run) => <li key={run.id}><strong>{run.workflowName || run.name}</strong><small>{run.status} · {run.conclusion || "pending"}</small><span>{run.headBranch} · {run.event} · {new Date(run.updatedAt).toLocaleString()}</span></li>)}</ul> : <p className="empty">No recent workflow runs.</p>}</div></div></> : <p className="empty">Check authentication, then explicitly refresh the selected repository.</p>}
  </section>;
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
