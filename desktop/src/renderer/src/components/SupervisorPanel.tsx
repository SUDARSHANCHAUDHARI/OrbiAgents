import { useEffect, useRef, useState } from "react";
import type { AgentSession, HiveSnapshot, LocalModelEndpoint, SupervisorRun } from "../../../shared/contracts";
import { useI18n } from "../i18n";

export function SupervisorPanel({ projectPath, agents, onSnapshot, onError }: { projectPath: string; agents: AgentSession[]; onSnapshot(snapshot: HiveSnapshot): void; onError(message: string): void }) {
  const { t } = useI18n(); const [endpoints, setEndpoints] = useState<LocalModelEndpoint[]>([]);
  const [endpoint, setEndpoint] = useState(""); const [model, setModel] = useState(""); const [brief, setBrief] = useState("");
  const [run, setRun] = useState<SupervisorRun | null>(null); const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null); const report = useRef(onError); report.current = onError;
  const publishSnapshot = useRef(onSnapshot); publishSnapshot.current = onSnapshot;
  useEffect(() => {
    let current = true; let signature = ""; let refreshing = false;
    void window.orbi.localModels.list().then((next) => { if (current) { setEndpoints(next); setEndpoint(next[0]?.id ?? ""); setModel(next[0]?.defaultModel ?? ""); } }).catch((error) => { if (current) report.current(String(error)); });
    const refresh = async () => {
      if (refreshing) return; refreshing = true;
      try {
        const next = await window.orbi.hive.supervisorStatus({ projectPath }); if (!current) return; setRun(next);
        const nextSignature = JSON.stringify(next);
        if (signature !== nextSignature) { const snapshot = await window.orbi.hive.snapshot({ projectPath }); if (current) { publishSnapshot.current(snapshot); signature = nextSignature; } }
      } catch (error) { if (current) report.current(String(error)); } finally { refreshing = false; }
    };
    void refresh(); const timer = setInterval(() => { void refresh(); }, 2000);
    return () => { current = false; clearInterval(timer); const id = requestId.current; requestId.current = null; if (id) void window.orbi.localModels.cancel({ requestId: id }).catch(() => undefined); };
  }, [projectPath]);
  async function generate(event: React.FormEvent) {
    event.preventDefault(); if (requestId.current) return;
    const id = crypto.randomUUID(); requestId.current = id; setBusy(true); onError("");
    try { const next = await window.orbi.hive.plan({ projectPath, id: endpoint, model, requestId: id, prompt: brief }); if (requestId.current === id) setRun(next); }
    catch (error) { if (requestId.current === id) onError(String(error)); }
    finally { if (requestId.current === id) { requestId.current = null; setBusy(false); } }
  }
  async function decide(action: "approvePlan" | "cancelPlan" | "resumePlan") {
    if (!run || busy) return; setBusy(true);
    try { setRun(await window.orbi.hive[action]({ projectPath, runId: run.id })); onError(""); }
    catch (error) { onError(String(error)); } finally { setBusy(false); }
  }
  return <section className="command-panel" aria-label={t("supervisor")}><h3>{t("supervisor")}</h3><p className="mission-policy">{t("supervisorPolicy")}</p>
    {endpoints.length ? <form className="model-execution-form" onSubmit={(event) => void generate(event)}>
      <label>{t("planningEndpoint")}<select aria-label={t("planningEndpoint")} value={endpoint} disabled={busy} onChange={(event) => { setEndpoint(event.target.value); setModel(endpoints.find((item) => item.id === event.target.value)?.defaultModel ?? ""); }}>{endpoints.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>{t("defaultModel")}<input aria-label={t("defaultModel")} value={model} onChange={(event) => setModel(event.target.value)} disabled={busy} maxLength={200} required /></label>
      <label>{t("missionBrief")}<textarea aria-label={t("missionBrief")} value={brief} onChange={(event) => setBrief(event.target.value)} disabled={busy} maxLength={12000} required /></label>
      <div className="mission-actions"><button type="submit" disabled={busy || !model.trim() || !brief.trim() || run?.status === "running" || run?.status === "paused"}>{t(busy ? "generatingPlan" : "generatePlan")}</button><button type="button" disabled={!requestId.current} onClick={() => { const id = requestId.current; if (id) void window.orbi.localModels.cancel({ requestId: id }).catch((error) => onError(String(error))); }}>{t("cancelInference")}</button></div>
    </form> : <p className="empty">{t("noEndpoints")}</p>}
    {run ? <><p role="status">{run.status}</p><ol className="supervisor-steps">{run.steps.map((step, index) => <li key={index}><strong>{step.title}</strong><p>{step.detail}</p><small>{agents.find((agent) => agent.id === step.agentId)?.name ?? step.agentId}{step.taskId ? ` · ${step.taskId}` : ""}</small></li>)}</ol><div className="mission-actions">{run.status === "paused" ? <button type="button" disabled={busy} onClick={() => void decide("resumePlan")}>{t("retry")}</button> : null}{run.status === "review" ? <button type="button" disabled={busy} onClick={() => void decide("approvePlan")}>{t("approvePlan")}</button> : null}{run.status !== "completed" && run.status !== "cancelled" ? <button type="button" disabled={busy} onClick={() => void decide("cancelPlan")}>{t("cancelPlan")}</button> : null}</div>{run.summary ? <label>{t("supervisorSummary")}<textarea aria-label={t("supervisorSummary")} value={run.summary} readOnly /></label> : null}</> : <p className="empty">{t("noSupervisorPlan")}</p>}
  </section>;
}
