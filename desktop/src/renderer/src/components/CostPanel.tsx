import { useEffect, useState } from "react";
import type { ActivityEvent, AgentSession, CostLedgerSnapshot } from "../../../shared/contracts";
import { costOverview, filterCostEntries } from "../command/costViewModel";
import { runtimeUsage } from "../command/usageViewModel";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";
import { useI18n } from "../i18n";

export function CostPanel({ events, agents, onError }: { events: ActivityEvent[]; agents: AgentSession[]; onError(message: string): void }) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<CostLedgerSnapshot | null>(null); const [busy, setBusy] = useState(false);
  const [projectPath, setProjectPath] = useState("");
  async function refresh() { setBusy(true); try { const next = await window.orbi.costs.snapshot(); setSnapshot(next); setProjectPath((current) => current && !next.entries.some((entry) => entry.projectPath === current) ? "" : current); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  useEffect(() => { void refresh(); }, []);
  const entries = snapshot ? filterCostEntries(snapshot.entries, projectPath) : [];
  const projects = snapshot ? [...new Set(snapshot.entries.map((entry) => entry.projectPath))].sort() : [];
  const usage = runtimeUsage(events, agents);
  const overview = snapshot ? costOverview(snapshot) : null;
  return <PixelPanel title={t("usageCosts")} eyebrow={t("measuredTelemetry")} ariaLabel={t("usageCosts")} className="cost-panel" action={<PixelButton type="button" variant="ghost" disabled={busy} onClick={() => void refresh()}>{t("refreshLedger")}</PixelButton>}>
    <div className="usage-summary"><strong>{usage.providerSignals}</strong><span>{t("providerSignals")}</span><strong>{usage.activeMinutes}</strong><span>{t("agentMinutes")}</span><strong>{usage.totalSignals}</strong><span>{t("allSignals")}</span></div>
    <div className="usage-summary"><strong>{number(usage.reportedInputTokens)}</strong><span>{t("reportedInputTokens")}</span><strong>{number(usage.reportedOutputTokens)}</strong><span>{t("reportedOutputTokens")}</span><strong>{usd(usage.reportedCostUsd)}</strong><span>{t("reportedCost")}</span></div>
    <p className="mission-policy">{t("reportedTelemetryPolicy")}</p>
    {usage.byState.length ? <p className="empty">{t("observedWork")}: {usage.byState.map((entry) => `${entry.state} ${entry.count}`).join(" · ")}</p> : <p className="empty">{t("noProviderActivity")}</p>}
    <p className="mission-policy">{t("estimatePolicy")}</p>
    {snapshot?.corrupted ? <div className="error-banner" role="alert">{t("ledgerCorrupt")}</div> : null}
    {snapshot && overview ? <><p><strong>{usd(snapshot.totalAuthorizedEstimateUsd)}</strong> {t("ledgerEstimate")}</p><p className="empty" aria-live="polite">{overview.entries ? `${overview.entries} ${t("verifiedEntries")} · ${overview.projects} ${t("projectsCount")} · ${usd(overview.visibleEstimateUsd)} ${t("visibleEstimate")}${overview.truncated ? ` · ${t("boundedSet")}` : ""}` : t("noCostAuthorizations")} · {t("showing")} {entries.length}</p>{projects.length > 1 ? <label className="cost-filter">{t("project")}<select aria-label={t("filterCostsProject")} value={projectPath} onChange={(event) => setProjectPath(event.target.value)}><option value="">{t("allLoadedProjects")}</option>{projects.map((path) => <option key={path} value={path}>{path}</option>)}</select></label> : null}{entries.length ? <ul>{entries.map((entry) => <li key={entry.id}><strong>{entry.title}</strong><small>{usd(entry.amountUsd)} · {t("approvedEstimate")} · {new Date(entry.createdAt).toLocaleString()}</small><span>{entry.projectPath}\n{t("mission")} {entry.missionId} · {t("run")} {entry.runId}</span></li>)}</ul> : <p className="empty">{t("noCostMatches")}</p>}{snapshot.truncated ? <small>{t("costTruncated")}</small> : null}</> : <p className="empty">{t("loadingLedger")}</p>}
  </PixelPanel>;
}
function usd(value: number): string { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value); }
function number(value: number): string { return new Intl.NumberFormat().format(value); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
