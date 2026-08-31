import { useEffect } from "react";
import type { HiveSnapshot } from "../../../shared/contracts";
import { useI18n } from "../i18n";

export function ApprovalPanel({ projectPath, snapshot, onSnapshot, onError }: { projectPath: string; snapshot: HiveSnapshot | null; onSnapshot(snapshot: HiveSnapshot): void; onError(message: string): void }) {
  const { t } = useI18n();
  useEffect(() => { if (projectPath) void window.orbi.hive.snapshot({ projectPath }).then(onSnapshot).catch((error) => onError(error instanceof Error ? error.message : String(error))); }, [projectPath]);
  async function decide(id: string, decision: "approved" | "rejected") {
    const reason = window.prompt(t(decision === "approved" ? "approvalReason" : "rejectionReason"));
    if (!reason) return;
    try {
      onSnapshot(await window.orbi.hive.decideApproval({ projectPath, id, decision, reason }));
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }
  const approvals = snapshot?.approvals ?? [];
  return <section className="command-panel" aria-label={t("operatorApprovals")}>
    <div className="section-title">{t("operatorApprovals")}</div>
    {approvals.length ? <ul>{approvals.map((approval) => <li key={approval.id}><strong>{approval.title}</strong><small>{approval.category} · {approval.status}</small><span>{approval.rationale}</span>{approval.status === "pending" ? <span className="approval-actions"><button type="button" disabled={!projectPath} onClick={() => void decide(approval.id, "approved")}>{t("approve")}</button><button type="button" disabled={!projectPath} onClick={() => void decide(approval.id, "rejected")}>{t("reject")}</button></span> : null}</li>)}</ul> : <p className="empty">{t("noProjectApprovals")}</p>}
  </section>;
}
