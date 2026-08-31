import { useEffect, useMemo, useState } from "react";
import type { AgentSession, HiveSnapshot } from "../../../shared/contracts";
import { dependencyStatus, groupTasks, taskHealthStatus, taskOperationsSummary, type HiveTask, type TaskColumnId, type TaskHealthStatus } from "../command/taskBoardModel";
import { useI18n, type MessageKey } from "../i18n";

const COLUMN_KEYS: Record<TaskColumnId, MessageKey> = { queued: "queuedColumn", active: "activeColumn", blocked: "blockedColumn", done: "doneColumn" };

export function HivePanel({ projectPath, agents, onSnapshot, onError }: { projectPath: string; agents: AgentSession[]; onSnapshot(snapshot: HiveSnapshot | null): void; onError(message: string): void }) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<HiveSnapshot | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const matchingAgents = useMemo(() => agents.filter((agent) => agent.status === "running" && agent.workspace.sourcePath === projectPath), [agents, projectPath]);
  const [agentId, setAgentId] = useState("");
  function updateSnapshot(next: HiveSnapshot | null) { setSnapshot(next); onSnapshot(next); }
  async function refresh() { if (!projectPath) return updateSnapshot(null); try { updateSnapshot(await window.orbi.hive.snapshot({ projectPath })); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  useEffect(() => { setAgentId(matchingAgents[0]?.id ?? ""); updateSnapshot(null); void refresh(); }, [projectPath, matchingAgents.map((agent) => agent.id).join("|")]);
  async function assign(event: React.FormEvent) { event.preventDefault(); try { updateSnapshot(await window.orbi.hive.assign({ projectPath, title, detail, agentId })); setTitle(""); setDetail(""); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  async function decide(id: string, decision: "approved" | "rejected") { const reason = window.prompt(t(decision === "approved" ? "approvalReason" : "rejectionReason")); if (!reason) return; try { updateSnapshot(await window.orbi.hive.decideApproval({ projectPath, id, decision, reason })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  async function transition(taskId: string, action: "start" | "block" | "retry" | "complete") { const prompted = action === "complete" ? window.prompt(t("completedResult")) : undefined; if (action === "complete" && !prompted) return; const result = prompted ?? undefined; try { updateSnapshot(await window.orbi.hive.transitionTask({ projectPath, taskId, action, agentId: action === "retry" ? agentId : undefined, result })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  if (!projectPath) return <section className="hive-panel"><div className="section-title">{t("orbiHive")}</div><p className="empty">{t("selectHive")}</p></section>;
  return <section className="hive-panel" aria-label={t("hiveOperatorPanel")}>
    <div className="section-title"><span>{t("orbiHive")}</span><button type="button" onClick={() => void refresh()}>{t("refresh")}</button></div>
    <form className="hive-assign" onSubmit={assign}><input aria-label={t("taskTitle")} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("taskForPrime")} maxLength={300} required /><textarea aria-label={t("taskDetails")} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={t("taskDetails")} maxLength={20000} /><select aria-label={t("assignedAgent")} value={agentId} onChange={(event) => setAgentId(event.target.value)} required><option value="" disabled>{t("selectProjectAgent")}</option>{matchingAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><button type="submit" disabled={!agentId}>{t("assignPrime")}</button></form>
    <div className="hive-grid">
      <TaskBoard tasks={snapshot?.tasks ?? []} agents={matchingAgents} canRetry={Boolean(agentId)} transition={transition} />
      <div><h3>{t("approvalsTitle")}</h3>{snapshot?.approvals.length ? <ul>{snapshot.approvals.map((approval) => <li key={approval.id}><strong>{approval.title}</strong><span>{approval.category} · {approval.status}</span>{approval.status === "pending" ? <span className="approval-actions"><button type="button" onClick={() => void decide(approval.id, "approved")}>{t("approve")}</button><button type="button" onClick={() => void decide(approval.id, "rejected")}>{t("reject")}</button></span> : null}</li>)}</ul> : <p className="empty">{t("noApprovals")}</p>}</div>
      <HiveList title={t("primeInbox")} empty={t("noMessages")} items={snapshot?.primeInbox.map((message) => ({ id: message.id, title: `${message.senderAgentId} · ${message.kind}`, detail: message.body })) ?? []} />
      <HiveList title={t("blackboard")} empty={t("noSharedResults")} items={snapshot ? Object.values(snapshot.blackboard).map((entry) => ({ id: entry.key, title: entry.key, detail: entry.value })) : []} />
    </div>
  </section>;
}

function TaskBoard({ tasks, agents, canRetry, transition }: { tasks: HiveTask[]; agents: AgentSession[]; canRetry: boolean; transition(taskId: string, action: "start" | "block" | "retry" | "complete"): Promise<void> }) {
  const { t } = useI18n();
  const summary = taskOperationsSummary(tasks);
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
  const overview = tasks.length
    ? `${summary.actionable} ${t("actionable")} · ${summary.blocked} ${t("blockedCount")} · ${summary.unresolvedDependencies} ${t("waitingDependencies")} · ${summary.completed} ${t("completedCount")}${summary.failed ? ` · ${summary.failed} ${t("failedCount")}` : ""}${summary.retryPressure ? ` · ${summary.retryPressure} ${t("retriedCount")}` : ""}`
    : t("noTasksAssigned");
  return <div className="task-board"><h3>{t("taskOperations")} · {summary.total} {t("total")}</h3><p className="empty" aria-live="polite">{overview}</p><div className="task-columns">{groupTasks(tasks).map((column) => { const columnLabel = t(COLUMN_KEYS[column.id]); return <section key={column.id} aria-label={`${columnLabel} ${t("tasksSuffix")}`}><h4>{columnLabel}<span>{column.tasks.length}</span></h4>{column.tasks.length ? <ul>{column.tasks.map((task) => <li key={task.id}><strong>{task.title}</strong>{task.detail ? <span>{task.detail}</span> : null}<span>{task.status} · {task.assigneeAgentId ? agentNames.get(task.assigneeAgentId) ?? task.assigneeAgentId : t("unassigned")}</span><span>{healthLabel(taskHealthStatus(task, tasks), t)} · {dependencyLabel(dependencyStatus(task, tasks), t)} · {t("attempt")} {task.attempt}/{task.maxAttempts}</span><span className="task-actions">{task.status === "assigned" ? <button type="button" onClick={() => void transition(task.id, "start")}>{t("start")}</button> : null}{task.status === "assigned" || task.status === "in-progress" ? <button type="button" onClick={() => void transition(task.id, "block")}>{t("block")}</button> : null}{task.status === "in-progress" ? <button type="button" onClick={() => void transition(task.id, "complete")}>{t("complete")}</button> : null}{task.status === "blocked" ? <button type="button" disabled={!canRetry} onClick={() => void transition(task.id, "retry")}>{t("retry")}</button> : null}</span></li>)}</ul> : <p className="empty">{t("noTasks")}</p>}</section>; })}</div></div>;
}

function healthLabel(status: TaskHealthStatus, t: (key: MessageKey) => string): string { if (status.kind === "retry") return `${t("healthRetry")} ${status.attempt} ${t("of")} ${status.maxAttempts}`; return t(({ failed: "healthFailed", blocked: "healthBlocked", waiting: "healthWaiting", completed: "healthCompleted", running: "healthRunning", ready: "healthReady" } as const)[status.kind]); }
function dependencyLabel(status: { total: number; unresolved: number }, t: (key: MessageKey) => string): string { if (!status.total) return t("noDependencies"); return status.unresolved ? `${status.unresolved}/${status.total} ${t("dependenciesUnresolved")}` : `${status.total} ${t("dependenciesComplete")}`; }

function HiveList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; detail: string }> }) {
  return <div><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ul> : <p className="empty">{empty}</p>}</div>;
}
