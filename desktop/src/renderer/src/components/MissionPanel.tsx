import { useEffect, useMemo, useState } from "react";
import type { AgentSession, ScheduledMission } from "../../../shared/contracts";
import { missionOverview, missionStatus, type MissionStatus } from "../command/missionViewModel";
import { useI18n, type MessageKey } from "../i18n";

const STATUS_KEYS: Record<MissionStatus, MessageKey> = { disabled: "missionDisabledStatus", "task-pending": "taskDispatchPending", "approval-requested": "approvalExecutionGated", "preparing-approval": "preparingApproval", waiting: "waitingHeartbeat" };

export function MissionPanel({ projectPath, agents, onError }: { projectPath: string; agents: AgentSession[]; onError(message: string): void }) {
  const { t } = useI18n();
  const [missions, setMissions] = useState<ScheduledMission[]>([]); const [title, setTitle] = useState(""); const [detail, setDetail] = useState("");
  const [agentId, setAgentId] = useState(""); const [intervalMinutes, setIntervalMinutes] = useState(60); const [estimatedCostUsd, setEstimatedCostUsd] = useState(0.25); const [busy, setBusy] = useState(false);
  const projectAgents = useMemo(() => agents.filter((agent) => agent.workspace.sourcePath === projectPath), [agents, projectPath]);
  const agentNames = useMemo(() => new Map(projectAgents.map((agent) => [agent.id, agent.name])), [projectAgents]);

  async function refresh() { if (!projectPath) return setMissions([]); try { setMissions(await window.orbi.missions.list({ projectPath })); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } }
  useEffect(() => { setAgentId(projectAgents[0]?.id ?? ""); void refresh(); }, [projectPath, projectAgents.map((agent) => agent.id).join("|")]);

  async function create(event: React.FormEvent) { event.preventDefault(); setBusy(true); try { setMissions(await window.orbi.missions.create({ projectPath, title, detail, agentId, intervalMinutes, estimatedCostUsd })); setTitle(""); setDetail(""); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function enable(mission: ScheduledMission) { setBusy(true); try { setMissions(await window.orbi.missions.setEnabled({ projectPath, id: mission.id, enabled: !mission.enabled })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function run(mission: ScheduledMission) { setBusy(true); try { setMissions(await window.orbi.missions.run({ projectPath, id: mission.id })); onError(""); } catch (error) { onError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }

  const overview = missionOverview(missions);
  if (!projectPath) return <section className="command-panel"><div className="section-title">{t("scheduledMissions")}</div><p className="empty">{t("selectMissions")}</p></section>;
  return <section className="command-panel mission-panel" aria-label={t("missionsHeartbeat")}>
    <div className="section-title"><span>{t("scheduledMissions")}</span><button type="button" onClick={() => void refresh()}>{t("refresh")}</button></div>
    <p className="mission-policy">{t("missionPolicy")}</p>
    <p className="empty" aria-live="polite">{overview.missions ? `${overview.missions} ${t("missionsCount")} · ${overview.enabled} ${t("enabledCount")} · ${overview.pendingRuns} ${t("pendingRuns")} · $${overview.enabledEstimateUsd.toFixed(4)} ${t("enabledRunEstimate")}` : t("noScheduledMissions")}</p>
    <form className="mission-create" onSubmit={create}><input aria-label={t("missionTitle")} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("missionTitle")} maxLength={200} required /><textarea aria-label={t("missionInstructions")} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={t("missionInstructions")} maxLength={20000} required /><select aria-label={t("missionAgent")} value={agentId} onChange={(event) => setAgentId(event.target.value)} required><option value="" disabled>{t("selectProjectAgent")}</option>{projectAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><label>{t("everyMinutes")}<input aria-label={t("missionInterval")} type="number" min={5} max={10080} value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} /></label><label>{t("estimatedUsd")}<input aria-label={t("missionEstimate")} type="number" min="0.0001" max="1000" step="0.0001" value={estimatedCostUsd} onChange={(event) => setEstimatedCostUsd(Number(event.target.value))} /></label><button type="submit" disabled={busy || !agentId}>{t("createDisabled")}</button></form>
    {missions.length ? <ul>{missions.map((mission) => <li key={mission.id}><strong>{mission.title}</strong><small>{mission.enabled ? t("enabled") : t("disabled")} · {t("every")} {mission.intervalMinutes}m · ${mission.estimatedCostUsd.toFixed(4)} · {agentNames.get(mission.agentId) ?? mission.agentId}</small><span>{t(STATUS_KEYS[missionStatus(mission)])}</span><span>{t("nextDue")}: {new Date(mission.nextRunAt).toLocaleString()}{mission.lastRunAt ? ` · ${t("lastRun")} ${new Date(mission.lastRunAt).toLocaleString()}` : ""}</span><span className="mission-actions"><button type="button" disabled={busy} onClick={() => void enable(mission)}>{mission.enabled ? t("disable") : t("enable")}</button>{mission.pendingApprovalId ? <button type="button" disabled={busy} onClick={() => void run(mission)}>{t("runApproved")}</button> : null}</span></li>)}</ul> : null}
  </section>;
}
