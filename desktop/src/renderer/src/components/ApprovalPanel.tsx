import { useEffect } from "react";
import type { HiveSnapshot } from "../../../shared/contracts";

export function ApprovalPanel({ projectPath, snapshot, onSnapshot, onError }: { projectPath: string; snapshot: HiveSnapshot | null; onSnapshot(snapshot: HiveSnapshot): void; onError(message: string): void }) {
  useEffect(() => { if (projectPath) void window.orbi.hive.snapshot({ projectPath }).then(onSnapshot).catch((error) => onError(error instanceof Error ? error.message : String(error))); }, [projectPath]);
  async function decide(id: string, decision: "approved" | "rejected") {
    const reason = window.prompt(`${decision === "approved" ? "Approval" : "Rejection"} reason`);
    if (!reason) return;
    try {
      onSnapshot(await window.orbi.hive.decideApproval({ projectPath, id, decision, reason }));
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }
  const approvals = snapshot?.approvals ?? [];
  return <section className="command-panel" aria-label="Operator approvals">
    <div className="section-title">Operator approvals</div>
    {approvals.length ? <ul>{approvals.map((approval) => <li key={approval.id}><strong>{approval.title}</strong><small>{approval.category} · {approval.status}</small><span>{approval.rationale}</span>{approval.status === "pending" ? <span className="approval-actions"><button type="button" disabled={!projectPath} onClick={() => void decide(approval.id, "approved")}>Approve</button><button type="button" disabled={!projectPath} onClick={() => void decide(approval.id, "rejected")}>Reject</button></span> : null}</li>)}</ul> : <p className="empty">No approval requests for this project.</p>}
  </section>;
}
