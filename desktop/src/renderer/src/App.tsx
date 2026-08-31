import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ActivityEvent, AgentSession, CreateAgentRequest, HiveSnapshot, OnboardingStatus, RuntimeAdapterDescriptor } from "../../shared/contracts";
import { AgentRoster } from "./components/AgentRoster";
import { ActivityPanel } from "./components/ActivityPanel";
import { ActivityOperationsPanel } from "./components/ActivityOperationsPanel";
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
import { AgentHiringPanel } from "./components/AgentHiringPanel";
import { CommandComposer } from "./components/CommandComposer";

const PixelOffice = lazy(() => import("./components/PixelOffice").then((module) => ({ default: module.PixelOffice })));
const TerminalPanel = lazy(() => import("./components/TerminalPanel").then((module) => ({ default: module.TerminalPanel })));
const FileEditorPanel = lazy(() => import("./components/FileEditorPanel").then((module) => ({ default: module.FileEditorPanel })));

type CommandView = "floor" | "terminals" | "files" | "github" | "tasks" | "messages" | "approvals" | "memory" | "activity" | "usage" | "recovery" | "workspaces" | "settings" | "setup";
type CommandGroup = "Operate" | "Coordinate" | "Observe" | "System";
interface CommandViewDefinition { id: CommandView; label: string; shortLabel: string; group: CommandGroup; description: string; }
const COMMAND_VIEWS: CommandViewDefinition[] = [
  { id: "floor", label: "Orbital floor", shortLabel: "Floor", group: "Operate", description: "Watch the live fleet and move between operational floors." },
  { id: "terminals", label: "Agent terminals", shortLabel: "Terminals", group: "Operate", description: "Steer a selected agent through its real terminal session." },
  { id: "files", label: "Workspace IDE", shortLabel: "Files", group: "Operate", description: "Inspect and safely edit the selected agent workspace." },
  { id: "github", label: "GitHub operations", shortLabel: "GitHub", group: "Operate", description: "Review repository issues and workflow runs through the local GitHub CLI." },
  { id: "tasks", label: "Mission board", shortLabel: "Tasks", group: "Coordinate", description: "Assign dependency-aware durable work through Orbi-Prime." },
  { id: "messages", label: "Fleet messages", shortLabel: "Messages", group: "Coordinate", description: "Inspect durable agent-to-agent delivery and replies." },
  { id: "approvals", label: "Operator approvals", shortLabel: "Approvals", group: "Coordinate", description: "Review spend, destructive-operation, and scope-expansion gates." },
  { id: "memory", label: "Project memory", shortLabel: "Memory", group: "Coordinate", description: "Capture and retrieve bounded project knowledge." },
  { id: "activity", label: "Live activity", shortLabel: "Activity", group: "Observe", description: "Filter verified runtime signals across the active fleet." },
  { id: "usage", label: "Cost ledger", shortLabel: "Costs", group: "Observe", description: "Audit durable authorization estimates and integrity status." },
  { id: "recovery", label: "Recovery center", shortLabel: "Recovery", group: "Observe", description: "Inspect interrupted work without automatically restarting it." },
  { id: "workspaces", label: "Workspace registry", shortLabel: "Workspaces", group: "Observe", description: "Find direct, isolated, and preserved agent workspaces." },
  { id: "settings", label: "Fleet settings", shortLabel: "Settings", group: "System", description: "Configure runtimes, local models, and scheduled missions." },
  { id: "setup", label: "System setup", shortLabel: "Setup", group: "System", description: "Re-run read-only prerequisite and platform checks." },
];
const COMMAND_GROUPS: CommandGroup[] = ["Operate", "Coordinate", "Observe", "System"];

export default function App() {
  const [agents, setAgents] = useState<AgentSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runtimeAdapters, setRuntimeAdapters] = useState<RuntimeAdapterDescriptor[]>([]);
  const [hiringOpen, setHiringOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [hiveSnapshot, setHiveSnapshot] = useState<HiveSnapshot | null>(null);
  const [commandView, setCommandView] = useState<CommandView>("floor");
  const [error, setError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const firstRun = Boolean(onboarding && !onboarding.completed);
  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? null, [agents, selectedId]);
  const activeView = COMMAND_VIEWS.find((view) => view.id === commandView)!;
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

  async function launch(request: Omit<CreateAgentRequest, "id">) {
    setError(null);
    try {
      const id = `agent-${Date.now().toString(36)}`;
      const agent = await window.orbi.agents.create({ id, ...request });
      await refresh();
      setSelectedId(agent.id);
      setHiringOpen(false);
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
        <div className="fleet-actions"><span>{agents.filter((agent) => agent.status === "running").length} active</span><PixelButton type="button" variant="primary" onClick={() => setHiringOpen(true)}>Hire agent</PixelButton></div>
      </header>
      {error ? <div className="error-banner" role="alert">{error}</div> : null}
      {hiringOpen ? <AgentHiringPanel adapters={runtimeAdapters} onClose={() => setHiringOpen(false)} onLaunch={launch} /> : null}
      {firstRun && onboarding ? <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><OnboardingPanel status={onboarding} firstRun onChanged={setOnboarding} onError={(message) => setError(message || null)} /></div> : null}
      <section className="workspace" inert={firstRun}>
        <div className="left-rail"><AgentRoster agents={agents} selectedId={selectedId} onSelect={setSelectedId} /><ActivityPanel events={activity} /></div>
        <div className="terminal-column">
          <nav className="command-tabs" aria-label="Command Center" role="tablist">
            {COMMAND_GROUPS.map((group) => <div className="command-tab-group" key={group}><span>{group}</span><div>{COMMAND_VIEWS.filter((view) => view.group === group).map((view) => <CommandTab key={view.id} {...view} active={commandView} select={setCommandView} />)}</div></div>)}
          </nav>
          <header className="command-context"><div><span>{activeView.group}</span><h2>{activeView.label}</h2></div><p>{activeView.description}</p>{selected ? <small>{selected.name} · {selected.runtimeId} · {selected.status}</small> : <small>No agent selected</small>}</header>
          <section id={`command-${commandView}`} className="command-view" role="tabpanel" aria-labelledby={`command-tab-${commandView}`}>
            {commandView === "floor" ? <Suspense fallback={<CommandFallback label="Loading pixel office…" />}><PixelOffice agents={agents} activity={activity} hive={hiveSnapshot} selectedId={selectedId} onSelect={setSelectedId} /></Suspense> : null}
            {commandView === "terminals" ? <>
              <div className="agent-detail" aria-label="Selected agent details">{selected ? <><strong>{selected.name}</strong><span>{selected.runtimeId} · {selected.status}</span><span>{selected.workspace.status} workspace · {selected.cwd}</span></> : <span>No agent selected</span>}</div>
              <div className="terminal-toolbar"><span>{selected ? `${selected.name} · ${selected.cwd}` : "Terminal"}</span><button type="button" onClick={() => void stop()} disabled={!selected || selected.status !== "running"}>Stop</button></div>
              <CommandComposer agent={selected} onError={(message) => setError(message || null)} />
              <Suspense fallback={<CommandFallback label="Loading terminal…" />}><TerminalPanel agent={selected} /></Suspense>
              {selected?.workspace.status === "preserved" ? <WorkspaceReview key={`${selected.id}-${selected.exitedAt ?? 0}`} agent={selected} onChanged={refresh} onError={(message) => setError(message || null)} /> : null}
            </> : null}
            {commandView === "files" ? <Suspense fallback={<CommandFallback label="Loading workspace editor…" />}><FileEditorPanel agentId={selectedId} onError={(message) => setError(message || null)} /></Suspense> : null}
            {commandView === "github" ? <GitHubPanel agentId={selectedId} onError={(message) => setError(message || null)} /> : null}
            {commandView === "tasks" ? <HivePanel projectPath={selectedProject} agents={agents} onSnapshot={setHiveSnapshot} onError={(message) => setError(message || null)} /> : null}
            {commandView === "messages" ? <CommandList title="Prime inbox" empty="No durable messages for this project." items={hiveSnapshot?.primeInbox.map((message) => ({ id: message.id, title: `${message.senderAgentId} → ${message.recipientAgentId}`, meta: `${message.kind} · ${message.status}`, detail: message.body })) ?? []} /> : null}
            {commandView === "approvals" ? <ApprovalPanel projectPath={selectedProject} snapshot={hiveSnapshot} onSnapshot={setHiveSnapshot} onError={(message) => setError(message || null)} /> : null}
            {commandView === "memory" ? <MemoryPanel projectPath={selectedProject} onError={(message) => setError(message || null)} /> : null}
            {commandView === "activity" ? <ActivityOperationsPanel events={activity} agents={agents} /> : null}
            {commandView === "usage" ? <CostPanel onError={(message) => setError(message || null)} /> : null}
            {commandView === "recovery" ? <RecoveryPanel onError={(message) => setError(message || null)} /> : null}
            {commandView === "workspaces" ? <CommandList title="Agent workspaces" empty="No agent workspaces recorded." items={agents.map((agent) => ({ id: agent.id, title: agent.name, meta: `${agent.workspace.status} · ${agent.workspace.branch ?? "direct"}`, detail: agent.workspace.path }))} /> : null}
            {commandView === "settings" ? <div className="settings-panels"><ProviderAdapterPanel onChanged={setRuntimeAdapters} onError={(message) => setError(message || null)} /><LocalModelPanel onError={(message) => setError(message || null)} /><MissionPanel projectPath={selectedProject} agents={agents} onError={(message) => setError(message || null)} /></div> : null}
            {commandView === "setup" && onboarding ? <OnboardingPanel status={onboarding} onChanged={setOnboarding} onError={(message) => setError(message || null)} /> : null}
          </section>
        </div>
      </section>
    </main>
  );
}

function CommandTab({ id, shortLabel, active, select }: CommandViewDefinition & { active: CommandView; select(view: CommandView): void }) {
  function move(direction: number) {
    const index = COMMAND_VIEWS.findIndex((view) => view.id === id);
    const next = COMMAND_VIEWS[(index + direction + COMMAND_VIEWS.length) % COMMAND_VIEWS.length]!.id;
    select(next);
    requestAnimationFrame(() => document.getElementById(`command-tab-${next}`)?.focus());
  }
  return <PixelButton id={`command-tab-${id}`} type="button" variant={active === id ? "primary" : "ghost"} role="tab" aria-selected={active === id} aria-controls={`command-${id}`} tabIndex={active === id ? 0 : -1} onClick={() => select(id)} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); move(1); } else if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); } }}>{shortLabel}</PixelButton>;
}

function CommandList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; meta: string; detail: string }> }) {
  return <section className="command-panel"><div className="section-title">{title}</div>{items.length ? <ul>{items.map((item) => <li key={item.id}><strong>{item.title}</strong><small>{item.meta}</small><span>{item.detail}</span></li>)}</ul> : <p className="empty">{empty}</p>}</section>;
}

function CommandFallback({ label }: { label: string }) { return <div className="command-loading" role="status">{label}</div>; }
