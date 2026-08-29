import { useEffect, useMemo, useState } from "react";
import type { AgentSession, HiveSnapshot } from "../../../shared/contracts";
import { dependencySummary, groupTasks, type HiveTask } from "../command/taskBoardModel";

export function HivePanel({ projectPath, agents, onSnapshot, onError }: { projectPath: string; agents: AgentSession[]; onSnapshot(snapshot: HiveSnapshot | null): void; onError(message: string): void }) {
  const [snapshot, setSnapshot] = useState<HiveSnapshot | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const matchingAgents = useMemo(() => agents.filter((agent) => agent.status === "running" && agent.workspace.sourcePath === projectPath), [agents, projectPath]);
  const [agentId, setAgentId] = useState("");
  function updateSnapshot(next: HiveSnapshot | null) { setSnapshot(next); onSnapshot(next); }
  async function refresh() { if (!projectPath) return updateSnapshot(null); try { updateSnapshot(await window.orbi.hive.snapshot({ projectPath })); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  useEffect(() => { setAgentId(matchingAgents[0]?.id ?? ""); updateSnapshot(null); void refresh(); }, [projectPath, matchingAgents.map((agent) => agent.id).join("|")]);
  async function assign(event: React.FormEvent) { event.preventDefault(); try { updateSnapshot(await window.orbi.hive.assign({ projectPath, title, detail, agentId })); setTitle(""); setDetail(""); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  async function decide(id: string, decision: "approved" | "rejected") { const reason = window.prompt(`${decision === "approved" ? "Approval" : "Rejection"} reason`); if (!reason) return; try { updateSnapshot(await window.orbi.hive.decideApproval({ projectPath, id, decision, reason })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  async function transition(taskId: string, action: "start" | "block" | "retry" | "complete") { const prompted = action === "complete" ? window.prompt("Completed task result") : undefined; if (action === "complete" && !prompted) return; const result = prompted ?? undefined; try { updateSnapshot(await window.orbi.hive.transitionTask({ projectPath, taskId, action, agentId: action === "retry" ? agentId : undefined, result })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  if (!projectPath) return <section className="hive-panel"><div className="section-title">Orbi Hive</div><p className="empty">Select or launch an agent to open its project Hive.</p></section>;
  return <section className="hive-panel" aria-label="Orbi Hive operator panel">
    <div className="section-title"><span>Orbi Hive</span><button type="button" onClick={() => void refresh()}>Refresh</button></div>
    <form className="hive-assign" onSubmit={assign}><input aria-label="Task title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task for Orbi-Prime" maxLength={300} required /><textarea aria-label="Task details" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Task details" maxLength={20000} /><select aria-label="Assigned project agent" value={agentId} onChange={(event) => setAgentId(event.target.value)} required><option value="" disabled>Select project agent</option>{matchingAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><button type="submit" disabled={!agentId}>Assign through Orbi-Prime</button></form>
    <div className="hive-grid">
      <TaskBoard tasks={snapshot?.tasks ?? []} canRetry={Boolean(agentId)} transition={transition} />
      <div><h3>Approvals</h3>{snapshot?.approvals.length ? <ul>{snapshot.approvals.map((approval) => <li key={approval.id}><strong>{approval.title}</strong><span>{approval.category} · {approval.status}</span>{approval.status === "pending" ? <span className="approval-actions"><button type="button" onClick={() => void decide(approval.id, "approved")}>Approve</button><button type="button" onClick={() => void decide(approval.id, "rejected")}>Reject</button></span> : null}</li>)}</ul> : <p className="empty">No approvals.</p>}</div>
      <HiveList title="Prime inbox" empty="No messages." items={snapshot?.primeInbox.map((message) => ({ id: message.id, title: `${message.senderAgentId} · ${message.kind}`, detail: message.body })) ?? []} />
      <HiveList title="Blackboard" empty="No shared results." items={snapshot ? Object.values(snapshot.blackboard).map((entry) => ({ id: entry.key, title: entry.key, detail: entry.value })) : []} />
    </div>
  </section>;
}

function TaskBoard({ tasks, canRetry, transition }: { tasks: HiveTask[]; canRetry: boolean; transition(taskId: string, action: "start" | "block" | "retry" | "complete"): Promise<void> }) {
  return <div className="task-board"><h3>Dependency task board</h3><div className="task-columns">{groupTasks(tasks).map((column) => <section key={column.id} aria-label={`${column.label} tasks`}><h4>{column.label}<span>{column.tasks.length}</span></h4>{column.tasks.length ? <ul>{column.tasks.map((task) => <li key={task.id}><strong>{task.title}</strong><span>{task.status} · {task.assigneeAgentId ?? "unassigned"}</span><span>{dependencySummary(task, tasks)} · attempt {task.attempt}/{task.maxAttempts}</span><span className="task-actions">{task.status === "assigned" ? <button type="button" onClick={() => void transition(task.id, "start")}>Start</button> : null}{task.status === "assigned" || task.status === "in-progress" ? <button type="button" onClick={() => void transition(task.id, "block")}>Block</button> : null}{task.status === "in-progress" ? <button type="button" onClick={() => void transition(task.id, "complete")}>Complete</button> : null}{task.status === "blocked" ? <button type="button" disabled={!canRetry} onClick={() => void transition(task.id, "retry")}>Retry</button> : null}</span></li>)}</ul> : <p className="empty">No tasks</p>}</section>)}</div></div>;
}

function HiveList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; detail: string }> }) {
  return <div><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ul> : <p className="empty">{empty}</p>}</div>;
}
