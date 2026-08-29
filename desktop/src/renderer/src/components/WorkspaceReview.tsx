import { useState } from "react";
import type { AgentSession } from "../../../shared/contracts";

interface WorkspaceReviewProps {
  agent: AgentSession;
  onChanged(): Promise<void>;
  onError(message: string): void;
}

export function WorkspaceReview({ agent, onChanged, onError }: WorkspaceReviewProps) {
  const changes = agent.workspace.changes;
  const [tracked, setTracked] = useState(() => new Set(changes?.files ?? []));
  const [untracked, setUntracked] = useState(() => new Set(changes?.untrackedFiles ?? []));
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!window.confirm("Apply the selected files to the clean source repository?")) return;
    setBusy(true); onError("");
    try { await window.orbi.agents.applyWorkspace({ id: agent.id, files: [...tracked], untrackedFiles: [...untracked] }); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function discard() {
    if (!window.confirm("Permanently discard this preserved worktree and all of its unmerged changes?")) return;
    setBusy(true); onError("");
    try { await window.orbi.agents.discardWorkspace({ id: agent.id }); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  return (
    <section className="workspace-review" aria-label="Preserved workspace changes">
      <strong>Changes preserved for review</strong>
      <span>{agent.workspace.path}</span>
      <span>{changes?.diffStat || "Recovered after restart. Change details could not be refreshed automatically."}</span>
      {[...(changes?.files ?? [])].map((file) => <label key={`t-${file}`}><input aria-label={`Apply tracked file ${file}`} type="checkbox" checked={tracked.has(file)} onChange={() => setTracked(toggle(tracked, file))} /> tracked · {file}</label>)}
      {[...(changes?.untrackedFiles ?? [])].map((file) => <label key={`u-${file}`}><input aria-label={`Apply new file ${file}`} type="checkbox" checked={untracked.has(file)} onChange={() => setUntracked(toggle(untracked, file))} /> new · {file}</label>)}
      <div className="workspace-actions"><button type="button" disabled={busy || tracked.size + untracked.size === 0} onClick={() => void apply()}>Apply selected</button><button className="danger" type="button" disabled={busy} onClick={() => void discard()}>Discard worktree</button></div>
    </section>
  );
}

function toggle(current: Set<string>, value: string): Set<string> {
  const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next;
}
