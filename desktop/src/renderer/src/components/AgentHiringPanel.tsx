import { useEffect, useState } from "react";
import type { AgentAppearance, AgentCapability, AgentProfile, AgentRole, CreateAgentRequest, HireProfile, RuntimeAdapterDescriptor, RuntimeId } from "../../../shared/contracts";
import { PixelButton } from "./ui/PixelButton";
import { PixelPanel } from "./ui/PixelPanel";

const ROLES: Array<{ id: AgentRole; label: string; detail: string }> = [
  { id: "generalist", label: "Generalist", detail: "Balanced execution" },
  { id: "planner", label: "Planner", detail: "Break down missions" },
  { id: "builder", label: "Builder", detail: "Implement changes" },
  { id: "reviewer", label: "Reviewer", detail: "Audit and verify" },
  { id: "researcher", label: "Researcher", detail: "Investigate evidence" },
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
  useEffect(() => { if (initialProfile) apply(initialProfile, "Hire link imported. Review it and choose a workspace before launching."); }, [initialProfile]);

  function currentProfile(): HireProfile { return { name, runtimeId, isolateWorkspace, profile: { role, goal, capabilities, budgetMinutes, appearance } }; }
  async function copyHire() { setSubmitting(true); try { await window.orbi.hires.copy(currentProfile()); setNotice("Hire link copied. Workspace paths and credentials are never included."); } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); } finally { setSubmitting(false); } }
  async function importHire() { setSubmitting(true); try { apply(await window.orbi.hires.importFromClipboard(), "Profile imported. Review it and choose a workspace before launching."); } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); } finally { setSubmitting(false); } }

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
    <PixelPanel title="Hire orbital agent" eyebrow="Fleet configuration" className="hiring-panel">
      <form onSubmit={(event) => void submit(event)}>
        <div className="hiring-heading"><div><h2 id="hiring-title">Configure a specialist</h2><p>Profiles are validated and retained with the local agent session.</p></div><div><PixelButton type="button" variant="ghost" disabled={submitting} onClick={() => void importHire()}>Import hire</PixelButton><PixelButton type="button" variant="secondary" disabled={submitting} onClick={() => void copyHire()}>Copy hire</PixelButton><PixelButton type="button" variant="ghost" onClick={onClose}>Close</PixelButton></div></div>
        {notice ? <p aria-live="polite">{notice}</p> : null}
        <fieldset><legend>Local agent gallery</legend>{GALLERY.map((preset) => <PixelButton key={preset.profile.role} type="button" variant="secondary" disabled={submitting} onClick={() => apply(preset, `${preset.name} profile selected. Review before launching.`)}>{preset.profile.role}</PixelButton>)}</fieldset>
        <fieldset className="role-picker"><legend>Role</legend>{ROLES.map((option) => <label key={option.id} className={role === option.id ? "selected" : ""}><input aria-label={`${option.label} role`} type="radio" name="agent-role" value={option.id} checked={role === option.id} onChange={() => setRole(option.id)} /><strong>{option.label}</strong><small>{option.detail}</small></label>)}</fieldset>
        <div className="hiring-grid">
          <label>Call sign<input aria-label="Agent name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Runtime<select aria-label="Agent runtime" value={runtimeId} onChange={(event) => setRuntimeId(event.target.value as RuntimeId)}>{adapters.map((adapter) => <option key={adapter.id} value={adapter.id}>{adapter.name}</option>)}</select></label>
          <label className="hiring-workspace">Workspace<input aria-label="Agent workspace path" value={cwd} onChange={(event) => setCwd(event.target.value)} placeholder="/absolute/path/to/project" required /></label>
          <label>Timebox<select aria-label="Agent planning timebox" value={budgetMinutes} onChange={(event) => setBudgetMinutes(Number(event.target.value))}><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={120}>2 hours</option><option value={240}>4 hours</option></select></label>
          <label className="hiring-goal">Mission goal<textarea aria-label="Agent mission goal" value={goal} maxLength={2000} onChange={(event) => setGoal(event.target.value)} placeholder="Describe the outcome this agent owns" /></label>
        </div>
        <fieldset className="capability-picker"><legend>Capabilities</legend>{CAPABILITIES.map((capability) => <label key={capability}><input aria-label={`${capability} capability`} type="checkbox" checked={capabilities.includes(capability)} onChange={() => toggleCapability(capability)} /><span>{capability}</span></label>)}</fieldset>
        <fieldset className="appearance-picker"><legend>Signal color</legend>{APPEARANCES.map((color) => <label key={color} title={color}><input aria-label={`${color} signal color`} type="radio" name="agent-appearance" checked={appearance === color} onChange={() => setAppearance(color)} /><i className={`appearance-${color}`} /><span>{color}</span></label>)}</fieldset>
        <div className="hiring-actions"><label className="isolation-field"><span>Isolated worktree</span><input aria-label="Use isolated worktree" type="checkbox" checked={isolateWorkspace} onChange={(event) => setIsolateWorkspace(event.target.checked)} /></label><PixelButton type="submit" variant="primary" disabled={submitting || adapters.length === 0}>{submitting ? "Launching…" : "Launch agent"}</PixelButton></div>
      </form>
    </PixelPanel>
  </div>;
}
