import { useEffect, useState } from "react";
import type { AgentAppearance, AgentCapability, AgentProfile, AgentRole, CreateAgentRequest, HireProfile, RuntimeAdapterDescriptor, RuntimeId } from "../../../shared/contracts";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";
import { useI18n, type MessageKey } from "../i18n";

const ROLES: Array<{ id: AgentRole; label: MessageKey; detail: MessageKey }> = [
  { id: "generalist", label: "generalist", detail: "generalistDetail" },
  { id: "planner", label: "planner", detail: "plannerDetail" },
  { id: "builder", label: "builder", detail: "builderDetail" },
  { id: "reviewer", label: "reviewer", detail: "reviewerDetail" },
  { id: "researcher", label: "researcher", detail: "researcherDetail" },
];
const CAPABILITIES: AgentCapability[] = ["planning", "coding", "review", "research", "testing"];
const APPEARANCES: AgentAppearance[] = ["cyan", "violet", "green", "gold", "rose"];
const GALLERY: HireProfile[] = [
  { name: "Orbi-Builder", runtimeId: "codex", isolateWorkspace: true, profile: { role: "builder", goal: "Implement a focused change and verify it.", capabilities: ["coding", "testing"], budgetMinutes: 60, appearance: "cyan" } },
  { name: "Orbi-Reviewer", runtimeId: "claude", isolateWorkspace: true, profile: { role: "reviewer", goal: "Review correctness, security, and regressions.", capabilities: ["review", "testing"], budgetMinutes: 60, appearance: "violet" } },
  { name: "Orbi-Researcher", runtimeId: "gemini", isolateWorkspace: true, profile: { role: "researcher", goal: "Investigate evidence and report verified findings.", capabilities: ["research", "planning"], budgetMinutes: 60, appearance: "gold" } },
];

interface AgentHiringPanelProps {
  adapters: RuntimeAdapterDescriptor[];
  initialProfile?: HireProfile | null;
  onClose(): void;
  onLaunch(request: Omit<CreateAgentRequest, "id">): Promise<void>;
}

export function AgentHiringPanel({ adapters, initialProfile, onClose, onLaunch }: AgentHiringPanelProps) {
  const { t } = useI18n();
  const [name, setName] = useState("Orbi-Alpha");
  const [runtimeId, setRuntimeId] = useState<RuntimeId>(adapters[0]?.id ?? "codex");
  const [cwd, setCwd] = useState("");
  const [role, setRole] = useState<AgentRole>("builder");
  const [goal, setGoal] = useState("");
  const [capabilities, setCapabilities] = useState<AgentCapability[]>(["coding", "testing"]);
  const [budgetMinutes, setBudgetMinutes] = useState(60);
  const [appearance, setAppearance] = useState<AgentAppearance>("cyan");
  const [isolateWorkspace, setIsolateWorkspace] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  function apply(next: HireProfile, message: string) { setName(next.name); setRuntimeId(next.runtimeId); setIsolateWorkspace(next.isolateWorkspace); setRole(next.profile.role); setGoal(next.profile.goal); setCapabilities(next.profile.capabilities); setBudgetMinutes(next.profile.budgetMinutes); setAppearance(next.profile.appearance); setNotice(message); }
  useEffect(() => { if (initialProfile) apply(initialProfile, t("hireLinkImported")); }, [initialProfile, t]);

  function currentProfile(): HireProfile { return { name, runtimeId, isolateWorkspace, profile: { role, goal, capabilities, budgetMinutes, appearance } }; }
  async function copyHire() { setSubmitting(true); try { await window.orbi.hires.copy(currentProfile()); setNotice(t("hireLinkCopied")); } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); } finally { setSubmitting(false); } }
  async function importHire() { setSubmitting(true); try { apply(await window.orbi.hires.importFromClipboard(), t("profileImported")); } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); } finally { setSubmitting(false); } }

  function toggleCapability(capability: AgentCapability): void {
    setCapabilities((current) => current.includes(capability) ? current.length === 1 ? current : current.filter((item) => item !== capability) : [...current, capability]);
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault(); setSubmitting(true);
    const profile: AgentProfile = { role, goal, capabilities, budgetMinutes, appearance };
    try { await onLaunch({ name, runtimeId, cwd, isolateWorkspace, profile }); }
    finally { setSubmitting(false); }
  }

  return <div className="hiring-overlay" role="dialog" aria-modal="true" aria-labelledby="hiring-title">
    <PixelPanel title={t("hireTitle")} eyebrow={t("fleetConfiguration")} className="hiring-panel">
      <form onSubmit={(event) => void submit(event)}>
        <div className="hiring-heading"><div><h2 id="hiring-title">{t("configureSpecialist")}</h2><p>{t("profileRetention")}</p></div><div><PixelButton type="button" variant="ghost" disabled={submitting} onClick={() => void importHire()}>{t("importHire")}</PixelButton><PixelButton type="button" variant="secondary" disabled={submitting} onClick={() => void copyHire()}>{t("copyHire")}</PixelButton><PixelButton type="button" variant="ghost" onClick={onClose}>{t("close")}</PixelButton></div></div>
        {notice ? <p aria-live="polite">{notice}</p> : null}
        <fieldset><legend>{t("localGallery")}</legend>{GALLERY.map((preset) => <PixelButton key={preset.profile.role} type="button" variant="secondary" disabled={submitting} onClick={() => apply(preset, `${preset.name}: ${t("profileSelected")}`)}>{t(preset.profile.role)}</PixelButton>)}</fieldset>
        <fieldset className="role-picker"><legend>{t("role")}</legend>{ROLES.map((option) => <label key={option.id} className={role === option.id ? "selected" : ""}><input aria-label={`${t(option.label)} ${t("roleSuffix")}`} type="radio" name="agent-role" value={option.id} checked={role === option.id} onChange={() => setRole(option.id)} /><strong>{t(option.label)}</strong><small>{t(option.detail)}</small></label>)}</fieldset>
        <div className="hiring-grid">
          <label>{t("callSign")}<input aria-label={t("agentName")} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required /></label>
          <label>{t("runtime")}<select aria-label={t("agentRuntime")} value={runtimeId} onChange={(event) => setRuntimeId(event.target.value as RuntimeId)}>{adapters.map((adapter) => <option key={adapter.id} value={adapter.id}>{adapter.name}</option>)}</select></label>
          <label className="hiring-workspace">{t("workspace")}<input aria-label={t("workspacePath")} value={cwd} onChange={(event) => setCwd(event.target.value)} placeholder={t("workspacePlaceholder")} required /></label>
          <label>{t("timebox")}<select aria-label={t("planningTimebox")} value={budgetMinutes} onChange={(event) => setBudgetMinutes(Number(event.target.value))}><option value={30}>{t("minutes30")}</option><option value={60}>{t("hour1")}</option><option value={120}>{t("hours2")}</option><option value={240}>{t("hours4")}</option></select></label>
          <label className="hiring-goal">{t("missionGoal")}<textarea aria-label={t("missionGoalLabel")} value={goal} maxLength={2000} onChange={(event) => setGoal(event.target.value)} placeholder={t("missionGoalPlaceholder")} /></label>
        </div>
        <fieldset className="capability-picker"><legend>{t("capabilities")}</legend>{CAPABILITIES.map((capability) => <label key={capability}><input aria-label={`${t(capability)} ${t("capabilitySuffix")}`} type="checkbox" checked={capabilities.includes(capability)} onChange={() => toggleCapability(capability)} /><span>{t(capability)}</span></label>)}</fieldset>
        <fieldset className="appearance-picker"><legend>{t("signalColor")}</legend>{APPEARANCES.map((color) => <label key={color} title={t(color)}><input aria-label={`${t(color)} ${t("colorSuffix")}`} type="radio" name="agent-appearance" checked={appearance === color} onChange={() => setAppearance(color)} /><i className={`appearance-${color}`} /><span>{t(color)}</span></label>)}</fieldset>
        <div className="hiring-actions"><label className="isolation-field"><span>{t("isolatedWorktree")}</span><input aria-label={t("useIsolatedWorktree")} type="checkbox" checked={isolateWorkspace} onChange={(event) => setIsolateWorkspace(event.target.checked)} /></label><PixelButton type="submit" variant="primary" disabled={submitting || adapters.length === 0}>{submitting ? t("launching") : t("launchAgent")}</PixelButton></div>
      </form>
    </PixelPanel>
  </div>;
}
