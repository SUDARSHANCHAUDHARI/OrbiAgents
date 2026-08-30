import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ActivityEvent, AgentSession, HiveSnapshot, OnboardingStatus, RuntimeAdapterDescriptor, RuntimeId } from "../../shared/contracts";
import { AgentRoster } from "./components/AgentRoster";
import { ActivityPanel } from "./components/ActivityPanel";
import { WorkspaceReview } from "./components/WorkspaceReview";
import { HivePanel } from "./components/HivePanel";
import { ApprovalPanel } from "./components/ApprovalPanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { MissionPanel } from "./components/MissionPanel";
import { ProviderAdapterPanel } from "./components/ProviderAdapterPanel";
import { LocalModelPanel } from "./components/LocalModelPanel";
import { GitHubPanel } from "./components/GitHubPanel";
import { OnboardingPanel } from "./components/OnboardingPanel";
import { RecoveryPanel } from "./components/RecoveryPanel";
import { CostPanel } from "./components/CostPanel";
import { PixelButton } from "./components/ui/PixelButton";

const PixelOffice = lazy(() => import("./components/PixelOffice").then((module) => ({ default: module.PixelOffice })));
const TerminalPanel = lazy(() => import("./components/TerminalPanel").then((module) => ({ default: module.TerminalPanel })));
const FileEditorPanel = lazy(() => import("./components/FileEditorPanel").then((module) => ({ default: module.FileEditorPanel })));

type CommandView = "floor" | "terminals" | "files" | "github" | "tasks" | "messages" | "approvals" | "memory" | "activity" | "usage" | "recovery" | "workspaces" | "settings" | "setup";
const COMMAND_VIEWS: Array<{ id: CommandView; label: string }> = [
  { id: "floor", label: "Floor" }, { id: "terminals", label: "Terminals" }, { id: "files", label: "Files" }, { id: "github", label: "GitHub" }, { id: "tasks", label: "Tasks" },
  { id: "messages", label: "Messages" }, { id: "approvals", label: "Approvals" }, { id: "memory", label: "Memory" },
  { id: "activity", label: "Activity" }, { id: "usage", label: "Costs" }, { id: "recovery", label: "Recovery" }, { id: "workspaces", label: "Workspaces" }, { id: "settings", label: "Settings" }, { id: "setup", label: "Setup" },
];

export default function App() {
  const [agents, setAgents] = useState<AgentSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("Orbi-Alpha");
  const [runtimeId, setRuntimeId] = useState<RuntimeId>("codex");
  const [runtimeAdapters, setRuntimeAdapters] = useState<RuntimeAdapterDescriptor[]>([]);
  const [cwd, setCwd] = useState("");
  const [isolateWorkspace, setIsolateWorkspace] = useState(true);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [hiveSnapshot, setHiveSnapshot] = useState<HiveSnapshot | null>(null);
  const [commandView, setCommandView] = useState<CommandView>("floor");
  const [error, setError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const firstRun = Boolean(onboarding && !onboarding.completed);
  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? null, [agents, selectedId]);
  const selectedProject = selected?.workspace.sourcePath ?? "";

  async function refresh() {
    const next = await window.orbi.agents.list();
    setAgents(next);
    setSelectedId((current) => current ?? next[0]?.id ?? null);
  }

  useEffect(() => {
    void refresh();
    void window.orbi.runtimeAdapters.list().then(setRuntimeAdapters).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    void window.orbi.onboarding.status().then(setOnboarding).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    const removeOutput = window.orbi.agents.onOutput((event) => {
      setAgents((current) => current.map((agent) => agent.id === event.id
        ? { ...agent, outputTail: (agent.outputTail + event.data).slice(-256 * 1024) }
        : agent));
    });
    const removeExit = window.orbi.agents.onExit(() => void refresh());
    const removeActivity = window.orbi.agents.onActivity((event) => setActivity((current) => [...current, event].slice(-100)));
    return () => {
      removeOutput();
      removeExit();
      removeActivity();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHiveSnapshot(null);
    if (selectedProject) void window.orbi.hive.snapshot({ projectPath: selectedProject }).then((snapshot) => { if (!cancelled) setHiveSnapshot(snapshot); }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { cancelled = true; };
  }, [selectedProject]);

  async function launch(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const id = `agent-${Date.now().toString(36)}`;
      const agent = await window.orbi.agents.create({ id, name, runtimeId, cwd, isolateWorkspace });
      await refresh();
      setSelectedId(agent.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function stop() {
    if (!selected) return;
    setError(null);
    try {
      await window.orbi.agents.stop({ id: selected.id });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar" inert={firstRun}>
        <div>
          <span className="eyebrow">ORBITAL AGENT OPERATIONS</span>
          <h1><i aria-hidden="true">OA</i> OrbiAgents</h1>
          <small className="topbar-subtitle">Local command deck · authenticated runtime telemetry</small>
        </div>
        <form className="launch-form" onSubmit={launch}>
          <label>Name<input aria-label="Agent name" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Runtime<select aria-label="Agent runtime" value={runtimeId} onChange={(event) => setRuntimeId(event.target.value as RuntimeId)}>{runtimeAdapters.map((adapter) => <option key={adapter.id} value={adapter.id}>{adapter.name}</option>)}</select></label>
          <label className="workspace-field">Workspace<input aria-label="Agent workspace path" value={cwd} onChange={(event) => setCwd(event.target.value)} placeholder="/absolute/path/to/project" required /></label>
          <label className="isolation-field"><span>Isolated worktree</span><input aria-label="Use isolated worktree" type="checkbox" checked={isolateWorkspace} onChange={(event) => setIsolateWorkspace(event.target.checked)} /></label>
          <PixelButton type="submit" variant="primary">Launch agent</PixelButton>
        </form>
      </header>
      {error ? <div className="error-banner" role="alert">{error}</div> : null}
      {firstRun && onboarding ? <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><OnboardingPanel status={onboarding} firstRun onChanged={setOnboarding} onError={(message) => setError(message || null)} /></div> : null}
      <section className="workspace" inert={firstRun}>
        <div className="left-rail"><AgentRoster agents={agents} selectedId={selectedId} onSelect={setSelectedId} /><ActivityPanel events={activity} /></div>
        <div className="terminal-column">
          <nav className="command-tabs" aria-label="Command Center" role="tablist">
            {COMMAND_VIEWS.map((view) => <CommandTab key={view.id} {...view} active={commandView} select={setCommandView} />)}
          </nav>
          <section id={`command-${commandView}`} className="command-view" role="tabpanel" aria-labelledby={`command-tab-${commandView}`}>
            {commandView === "floor" ? <Suspense fallback={<CommandFallback label="Loading pixel office…" />}><PixelOffice agents={agents} activity={activity} hive={hiveSnapshot} selectedId={selectedId} onSelect={setSelectedId} /></Suspense> : null}
            {commandView === "terminals" ? <>
              <div className="agent-detail" aria-label="Selected agent details">{selected ? <><strong>{selected.name}</strong><span>{selected.runtimeId} · {selected.status}</span><span>{selected.workspace.status} workspace · {selected.cwd}</span></> : <span>No agent selected</span>}</div>
              <div className="terminal-toolbar"><span>{selected ? `${selected.name} · ${selected.cwd}` : "Terminal"}</span><button type="button" onClick={() => void stop()} disabled={!selected || selected.status !== "running"}>Stop</button></div>
              <Suspense fallback={<CommandFallback label="Loading terminal…" />}><TerminalPanel agent={selected} /></Suspense>
              {selected?.workspace.status === "preserved" ? <WorkspaceReview key={`${selected.id}-${selected.exitedAt ?? 0}`} agent={selected} onChanged={refresh} onError={(message) => setError(message || null)} /> : null}
            </> : null}
            {commandView === "files" ? <Suspense fallback={<CommandFallback label="Loading workspace editor…" />}><FileEditorPanel agentId={selectedId} onError={(message) => setError(message || null)} /></Suspense> : null}
            {commandView === "github" ? <GitHubPanel agentId={selectedId} onError={(message) => setError(message || null)} /> : null}
            {commandView === "tasks" ? <HivePanel projectPath={selectedProject} agents={agents} onSnapshot={setHiveSnapshot} onError={(message) => setError(message || null)} /> : null}
            {commandView === "messages" ? <CommandList title="Prime inbox" empty="No durable messages for this project." items={hiveSnapshot?.primeInbox.map((message) => ({ id: message.id, title: `${message.senderAgentId} → ${message.recipientAgentId}`, meta: `${message.kind} · ${message.status}`, detail: message.body })) ?? []} /> : null}
            {commandView === "approvals" ? <ApprovalPanel projectPath={selectedProject} snapshot={hiveSnapshot} onSnapshot={setHiveSnapshot} onError={(message) => setError(message || null)} /> : null}
            {commandView === "memory" ? <MemoryPanel projectPath={selectedProject} onError={(message) => setError(message || null)} /> : null}
            {commandView === "activity" ? <CommandList title="Normalized runtime activity" empty="No runtime activity recorded in this desktop session." items={activity.slice().reverse().map((event) => ({ id: event.id, title: `${event.agentId} · ${event.state ?? event.type}`, meta: `${event.source} · ${new Date(event.timestamp).toLocaleTimeString()}`, detail: event.summary }))} /> : null}
            {commandView === "usage" ? <CostPanel onError={(message) => setError(message || null)} /> : null}
            {commandView === "recovery" ? <RecoveryPanel onError={(message) => setError(message || null)} /> : null}
            {commandView === "workspaces" ? <CommandList title="Agent workspaces" empty="No agent workspaces recorded." items={agents.map((agent) => ({ id: agent.id, title: agent.name, meta: `${agent.workspace.status} · ${agent.workspace.branch ?? "direct"}`, detail: agent.workspace.path }))} /> : null}
            {commandView === "settings" ? <div className="settings-panels"><ProviderAdapterPanel onChanged={(adapters) => { setRuntimeAdapters(adapters); if (!adapters.some((adapter) => adapter.id === runtimeId)) setRuntimeId("codex"); }} onError={(message) => setError(message || null)} /><LocalModelPanel onError={(message) => setError(message || null)} /><MissionPanel projectPath={selectedProject} agents={agents} onError={(message) => setError(message || null)} /></div> : null}
            {commandView === "setup" && onboarding ? <OnboardingPanel status={onboarding} onChanged={setOnboarding} onError={(message) => setError(message || null)} /> : null}
          </section>
        </div>
      </section>
    </main>
  );
}

function CommandTab({ id, label, active, select }: { id: CommandView; label: string; active: CommandView; select(view: CommandView): void }) {
  function move(direction: number) {
    const index = COMMAND_VIEWS.findIndex((view) => view.id === id);
    const next = COMMAND_VIEWS[(index + direction + COMMAND_VIEWS.length) % COMMAND_VIEWS.length]!.id;
    select(next);
    requestAnimationFrame(() => document.getElementById(`command-tab-${next}`)?.focus());
  }
  return <PixelButton id={`command-tab-${id}`} type="button" variant={active === id ? "primary" : "ghost"} role="tab" aria-selected={active === id} aria-controls={`command-${id}`} tabIndex={active === id ? 0 : -1} onClick={() => select(id)} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); move(1); } else if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); } }}>{label}</PixelButton>;
}

function CommandList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; meta: string; detail: string }> }) {
  return <section className="command-panel"><div className="section-title">{title}</div>{items.length ? <ul>{items.map((item) => <li key={item.id}><strong>{item.title}</strong><small>{item.meta}</small><span>{item.detail}</span></li>)}</ul> : <p className="empty">{empty}</p>}</section>;
}

function CommandFallback({ label }: { label: string }) { return <div className="command-loading" role="status">{label}</div>; }
