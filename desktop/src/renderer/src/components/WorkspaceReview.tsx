import { useState } from "react";
import type { AgentSession } from "../../../shared/contracts";
import { useI18n } from "../i18n";

interface WorkspaceReviewProps {
  agent: AgentSession;
  onChanged(): Promise<void>;
  onError(message: string): void;
}

export function WorkspaceReview({ agent, onChanged, onError }: WorkspaceReviewProps) {
  const { t } = useI18n();
  const changes = agent.workspace.changes;
  const [tracked, setTracked] = useState(() => new Set(changes?.files ?? []));
  const [untracked, setUntracked] = useState(() => new Set(changes?.untrackedFiles ?? []));
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!window.confirm(t("applyWorkspaceConfirm"))) return;
    setBusy(true); onError("");
    try { await window.orbi.agents.applyWorkspace({ id: agent.id, files: [...tracked], untrackedFiles: [...untracked] }); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  async function discard() {
    if (!window.confirm(t("discardWorkspaceConfirm"))) return;
    setBusy(true); onError("");
    try { await window.orbi.agents.discardWorkspace({ id: agent.id }); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  return (
    <section className="workspace-review" aria-label={t("preservedChanges")}>
      <strong>{t("changesPreserved")}</strong>
      <span>{agent.workspace.path}</span>
      <span>{changes?.diffStat || t("recoveryDetailsMissing")}</span>
      {[...(changes?.files ?? [])].map((file) => <label key={`t-${file}`}><input aria-label={`${t("applyTrackedFile")} ${file}`} type="checkbox" checked={tracked.has(file)} onChange={() => setTracked(toggle(tracked, file))} /> {t("tracked")} · {file}</label>)}
      {[...(changes?.untrackedFiles ?? [])].map((file) => <label key={`u-${file}`}><input aria-label={`${t("applyNewFile")} ${file}`} type="checkbox" checked={untracked.has(file)} onChange={() => setUntracked(toggle(untracked, file))} /> {t("newFile")} · {file}</label>)}
      <div className="workspace-actions"><button type="button" disabled={busy || tracked.size + untracked.size === 0} onClick={() => void apply()}>{t("applySelected")}</button><button className="danger" type="button" disabled={busy} onClick={() => void discard()}>{t("discardWorktree")}</button></div>
    </section>
  );
}

function toggle(current: Set<string>, value: string): Set<string> {
  const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next;
}
