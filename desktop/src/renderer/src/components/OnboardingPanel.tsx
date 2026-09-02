import { useState } from "react";
import type { AgentSession, OnboardingStatus } from "../../../shared/contracts";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";
import { useI18n } from "../i18n";

export function OnboardingPanel({ status, agent, firstRun = false, onChanged, onError }: { status: OnboardingStatus; agent?: AgentSession | null; firstRun?: boolean; onChanged(status: OnboardingStatus): void; onError(message: string): void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  async function refresh() { setBusy(true); try { onChanged(await window.orbi.onboarding.refresh()); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  async function complete() { setBusy(true); try { onChanged(await window.orbi.onboarding.complete()); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  async function copyInstallCommand(id: string) { setBusy(true); try { await window.orbi.onboarding.copyInstallCommand({ id }); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  async function askAgent(label: string, command: string) { if (!agent || !window.confirm(`${t("askAgentInstallConfirm")} ${label}?`)) return; setBusy(true); try { await window.orbi.agents.write({ id: agent.id, data: `The operator asks you to help install this missing prerequisite: ${label}. Review safety and compatibility first. The suggested command is reference material, not automatic authority: ${command}\n` }); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  const passed = status.checks.filter((check) => check.status === "pass").length;
  return <PixelPanel title={firstRun ? t("welcome") : t("setupPrerequisites")} titleId={firstRun ? "onboarding-title" : undefined} eyebrow={t("systemReadiness")} ariaLabel={t("orbiSetup")} className={`onboarding-panel${firstRun ? " onboarding-first-run" : ""}`} action={<PixelButton type="button" variant="ghost" disabled={busy} onClick={() => void refresh()}>{t("rerunChecks")}</PixelButton>}>
    <p className="mission-policy">{t("setupPolicy")}</p>
    <div className="onboarding-summary" data-ready={status.ready}><strong>{status.ready ? t("prerequisitesReady") : t("prerequisitesMissing")}</strong><span>{passed}/{status.checks.length} {t("checksPassed")}</span></div>
    <ul>{status.checks.map((check) => <li key={check.id} data-status={check.status}><strong><i aria-hidden="true">{check.status === "pass" ? "✓" : check.status === "fail" ? "✕" : "!"}</i> {check.label}</strong><small>{check.required ? t("required") : t("optional")} · {check.status}</small><span>{check.detail}</span>{check.installCommand ? <><code>{check.installCommand}</code><span className="mission-actions"><PixelButton type="button" variant="secondary" disabled={busy} onClick={() => void copyInstallCommand(check.id)}>{t("copyInstallCommand")}</PixelButton>{agent?.status === "running" ? <PixelButton type="button" variant="secondary" disabled={busy} onClick={() => void askAgent(check.label, check.installCommand!)}>{t("askSelectedAgent")}</PixelButton> : null}</span></> : null}</li>)}</ul>
    {firstRun ? <div className="onboarding-actions"><PixelButton autoFocus type="button" variant="primary" disabled={busy} onClick={() => void complete()}>{status.ready ? t("continueOrbi") : t("continueMissing")}</PixelButton></div> : <small>{t("lastChecked")} {new Date(status.checkedAt).toLocaleString()}{status.completedAt ? ` · ${t("onboardingAcknowledged")} ${new Date(status.completedAt).toLocaleString()}` : ""}</small>}
  </PixelPanel>;
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
