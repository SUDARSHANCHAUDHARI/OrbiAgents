import { useEffect, useMemo, useState } from "react";
import type { AgentSession, ScheduledMission } from "../../../shared/contracts";
import { missionOverview, missionStatus } from "../command/missionViewModel";

export function MissionPanel({ projectPath, agents, onError }: { projectPath: string; agents: AgentSession[]; onError(message: string): void }) {
  const [missions, setMissions] = useState<ScheduledMission[]>([]); const [title, setTitle] = useState(""); const [detail, setDetail] = useState("");
  const [agentId, setAgentId] = useState(""); const [intervalMinutes, setIntervalMinutes] = useState(60); const [estimatedCostUsd, setEstimatedCostUsd] = useState(0.25); const [busy, setBusy] = useState(false);
  const projectAgents = useMemo(() => agents.filter((agent) => agent.workspace.sourcePath === projectPath), [agents, projectPath]);
  const agentNames = useMemo(() => new Map(projectAgents.map((agent) => [agent.id, agent.name])), [projectAgents]);

  async function refresh() { if (!projectPath) return setMissions([]); try { setMissions(await window.orbi.missions.list({ projectPath })); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  useEffect(() => { setAgentId(projectAgents[0]?.id ?? ""); void refresh(); }, [projectPath, projectAgents.map((agent) => agent.id).join("|")]);

  async function create(event: React.FormEvent) { event.preventDefault(); setBusy(true); try { setMissions(await window.orbi.missions.create({ projectPath, title, detail, agentId, intervalMinutes, estimatedCostUsd })); setTitle(""); setDetail(""); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function enable(mission: ScheduledMission) { setBusy(true); try { setMissions(await window.orbi.missions.setEnabled({ projectPath, id: mission.id, enabled: !mission.enabled })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function run(mission: ScheduledMission) { setBusy(true); try { setMissions(await window.orbi.missions.run({ projectPath, id: mission.id })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }

  if (!projectPath) return <section className="command-panel"><div className="section-title">Scheduled missions</div><p className="empty">Select an agent to manage its project missions.</p></section>;
  return <section className="command-panel mission-panel" aria-label="Scheduled missions and heartbeat">
    <div className="section-title"><span>Scheduled missions</span><button type="button" onClick={() => void refresh()}>Refresh</button></div>
    <p className="mission-policy">Disabled by default. Heartbeat only requests a run-bound spend approval; execution still requires approval and an explicit Run action.</p>
    <p className="empty" aria-live="polite">{missionOverview(missions)}</p>
    <form className="mission-create" onSubmit={create}><input aria-label="Mission title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mission title" maxLength={200} required /><textarea aria-label="Mission instructions" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Mission instructions" maxLength={20000} required /><select aria-label="Mission agent" value={agentId} onChange={(event) => setAgentId(event.target.value)} required><option value="" disabled>Select project agent</option>{projectAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><label>Every minutes<input aria-label="Mission interval in minutes" type="number" min={5} max={10080} value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} /></label><label>Estimated USD<input aria-label="Mission estimated cost in USD" type="number" min="0.0001" max="1000" step="0.0001" value={estimatedCostUsd} onChange={(event) => setEstimatedCostUsd(Number(event.target.value))} /></label><button type="submit" disabled={busy || !agentId}>Create disabled</button></form>
    {missions.length ? <ul>{missions.map((mission) => <li key={mission.id}><strong>{mission.title}</strong><small>{mission.enabled ? "enabled" : "disabled"} · every {mission.intervalMinutes}m · ${mission.estimatedCostUsd.toFixed(4)} · {agentNames.get(mission.agentId) ?? mission.agentId}</small><span>{missionStatus(mission)}</span><span>Next due: {new Date(mission.nextRunAt).toLocaleString()}{mission.lastRunAt ? ` · last run ${new Date(mission.lastRunAt).toLocaleString()}` : ""}</span><span className="mission-actions"><button type="button" disabled={busy} onClick={() => void enable(mission)}>{mission.enabled ? "Disable" : "Enable"}</button>{mission.pendingApprovalId ? <button type="button" disabled={busy} onClick={() => void run(mission)}>Run if approved</button> : null}</span></li>)}</ul> : null}
  </section>;
}
