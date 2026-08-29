import { useState } from "react";
import type { OnboardingStatus } from "../../../shared/contracts";

export function OnboardingPanel({ status, firstRun = false, onChanged, onError }: { status: OnboardingStatus; firstRun?: boolean; onChanged(status: OnboardingStatus): void; onError(message: string): void }) {
  const [busy, setBusy] = useState(false);
  async function refresh() { setBusy(true); try { onChanged(await window.orbi.onboarding.refresh()); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  async function complete() { setBusy(true); try { onChanged(await window.orbi.onboarding.complete()); onError(""); } catch (error) { onError(message(error)); } finally { setBusy(false); } }
  return <section className={`command-panel onboarding-panel${firstRun ? " onboarding-first-run" : ""}`} aria-label="OrbiAgents setup">
    <div className="section-title"><h2 id={firstRun ? "onboarding-title" : undefined}>{firstRun ? "Welcome to OrbiAgents" : "Setup and prerequisites"}</h2><button type="button" disabled={busy} onClick={() => void refresh()}>Run checks again</button></div>
    <p className="mission-policy">These checks inspect executable access and platform capabilities only. OrbiAgents will not install software, change PATH, authenticate accounts, or block access to the Command Center.</p>
    <p><strong>{status.ready ? "Core prerequisites are ready." : "Some core prerequisites are missing."}</strong></p>
    <ul>{status.checks.map((check) => <li key={check.id}><strong>{check.status === "pass" ? "✓" : check.status === "fail" ? "✕" : "!"} {check.label}</strong><small>{check.required ? "required" : "optional"} · {check.status}</small><span>{check.detail}</span></li>)}</ul>
    {firstRun ? <div className="onboarding-actions"><button autoFocus type="button" disabled={busy} onClick={() => void complete()}>{status.ready ? "Continue to OrbiAgents" : "Continue without missing tools"}</button></div> : <small>Last checked {new Date(status.checkedAt).toLocaleString()}{status.completedAt ? ` · onboarding acknowledged ${new Date(status.completedAt).toLocaleString()}` : ""}</small>}
  </section>;
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
