import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ActivityEvent, AgentSession, CreateAgentRequest, HireProfile, HiveSnapshot, OnboardingStatus, RuntimeAdapterDescriptor } from "../../shared/contracts";
import { AgentRoster } from "./components/AgentRoster";
import { ActivityPanel } from "./components/ActivityPanel";
import { WorkspaceReview } from "./components/WorkspaceReview";
import { OnboardingPanel } from "./components/OnboardingPanel";
import { PixelButton } from "./components/ui/PixelButton";
import { AgentHiringPanel } from "./components/AgentHiringPanel";
import { CommandComposer } from "./components/CommandComposer";
import { LocalePanel } from "./components/LocalePanel";
import { useI18n, type MessageKey } from "./i18n";

const PixelOffice = lazy(() => import("./components/PixelOffice").then((module) => ({ default: module.PixelOffice })));
const TerminalPanel = lazy(() => import("./components/TerminalPanel").then((module) => ({ default: module.TerminalPanel })));
const FileEditorPanel = lazy(() => import("./components/FileEditorPanel").then((module) => ({ default: module.FileEditorPanel })));
const ActivityOperationsPanel = lazy(() => import("./components/ActivityOperationsPanel").then((module) => ({ default: module.ActivityOperationsPanel })));
const HivePanel = lazy(() => import("./components/HivePanel").then((module) => ({ default: module.HivePanel })));
const ApprovalPanel = lazy(() => import("./components/ApprovalPanel").then((module) => ({ default: module.ApprovalPanel })));
const MemoryPanel = lazy(() => import("./components/MemoryPanel").then((module) => ({ default: module.MemoryPanel })));
const MissionPanel = lazy(() => import("./components/MissionPanel").then((module) => ({ default: module.MissionPanel })));
const ProviderAdapterPanel = lazy(() => import("./components/ProviderAdapterPanel").then((module) => ({ default: module.ProviderAdapterPanel })));
const LocalModelPanel = lazy(() => import("./components/LocalModelPanel").then((module) => ({ default: module.LocalModelPanel })));
const GitHubPanel = lazy(() => import("./components/GitHubPanel").then((module) => ({ default: module.GitHubPanel })));
const RecoveryPanel = lazy(() => import("./components/RecoveryPanel").then((module) => ({ default: module.RecoveryPanel })));
const CostPanel = lazy(() => import("./components/CostPanel").then((module) => ({ default: module.CostPanel })));
const SkillsPanel = lazy(() => import("./components/SkillsPanel").then((module) => ({ default: module.SkillsPanel })));
const UpdatesPanel = lazy(() => import("./components/UpdatesPanel").then((module) => ({ default: module.UpdatesPanel })));
const WebhookPanel = lazy(() => import("./components/WebhookPanel").then((module) => ({ default: module.WebhookPanel })));
const VoicePolicyPanel = lazy(() => import("./components/VoicePolicyPanel").then((module) => ({ default: module.VoicePolicyPanel })));
const RemoteCatalogPanel = lazy(() => import("./components/RemoteCatalogPanel").then((module) => ({ default: module.RemoteCatalogPanel })));
const SlackPanel = lazy(() => import("./components/SlackPanel").then((module) => ({ default: module.SlackPanel })));

type CommandView = "floor" | "terminals" | "files" | "github" | "tasks" | "messages" | "approvals" | "memory" | "skills" | "activity" | "usage" | "recovery" | "workspaces" | "settings" | "updates" | "setup";
type CommandGroup = "Operate" | "Coordinate" | "Observe" | "System";
interface CommandViewDefinition { id: CommandView; labelKey: MessageKey; group: CommandGroup; descriptionKey: MessageKey; }
const COMMAND_VIEWS: CommandViewDefinition[] = [
  { id: "floor", labelKey: "orbitalFloorTitle", group: "Operate", descriptionKey: "orbitalFloorDescription" },
  { id: "terminals", labelKey: "agentTerminals", group: "Operate", descriptionKey: "agentTerminalsDescription" },
  { id: "files", labelKey: "workspaceIde", group: "Operate", descriptionKey: "workspaceIdeDescription" },
  { id: "github", labelKey: "repositoryIntelligence", group: "Operate", descriptionKey: "repositoryDescription" },
  { id: "tasks", labelKey: "missionBoard", group: "Coordinate", descriptionKey: "missionBoardDescription" },
  { id: "messages", labelKey: "fleetMessages", group: "Coordinate", descriptionKey: "fleetMessagesDescription" },
  { id: "approvals", labelKey: "operatorApprovals", group: "Coordinate", descriptionKey: "operatorApprovalsDescription" },
  { id: "memory", labelKey: "projectMemory", group: "Coordinate", descriptionKey: "projectMemoryDescription" },
  { id: "skills", labelKey: "skillsCatalog", group: "Coordinate", descriptionKey: "skillsCatalogDescription" },
  { id: "activity", labelKey: "liveActivity", group: "Observe", descriptionKey: "liveActivityDescription" },
  { id: "usage", labelKey: "costLedger", group: "Observe", descriptionKey: "costLedgerDescription" },
  { id: "recovery", labelKey: "recoveryCenter", group: "Observe", descriptionKey: "recoveryCenterDescription" },
  { id: "workspaces", labelKey: "workspaceRegistry", group: "Observe", descriptionKey: "workspaceRegistryDescription" },
  { id: "settings", labelKey: "fleetSettings", group: "System", descriptionKey: "fleetSettingsDescription" },
  { id: "updates", labelKey: "applicationUpdates", group: "System", descriptionKey: "applicationUpdatesDescription" },
  { id: "setup", labelKey: "systemSetup", group: "System", descriptionKey: "systemSetupDescription" },
];
const COMMAND_GROUPS: CommandGroup[] = ["Operate", "Coordinate", "Observe", "System"];
const COMMAND_VIEW_MESSAGE_KEYS: Record<CommandView, MessageKey> = { floor: "floor", terminals: "terminals", files: "files", github: "repository", tasks: "tasks", messages: "messages", approvals: "approvals", memory: "memory", skills: "skills", activity: "activity", usage: "costs", recovery: "recovery", workspaces: "workspaces", settings: "settings", updates: "updates", setup: "setup" };
const COMMAND_GROUP_MESSAGE_KEYS: Record<CommandGroup, MessageKey> = { Operate: "operate", Coordinate: "coordinate", Observe: "observe", System: "system" };

export default function App() {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runtimeAdapters, setRuntimeAdapters] = useState<RuntimeAdapterDescriptor[]>([]);
  const [hiringOpen, setHiringOpen] = useState(false);
  const [importedHire, setImportedHire] = useState<HireProfile | null>(null);
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
    const removeHire = window.orbi.hires.onImported((profile) => { setImportedHire(profile); setHiringOpen(true); });
    return () => {
      removeOutput();
      removeExit();
      removeActivity();
      removeHire();
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
          <span className="eyebrow">{t("orbitalAgentOperations")}</span>
          <h1><i aria-hidden="true">OA</i> OrbiAgents</h1>
          <small className="topbar-subtitle">{t("subtitle")}</small>
        </div>
        <div className="fleet-actions"><span>{agents.filter((agent) => agent.status === "running").length} {t("active")}</span><PixelButton type="button" variant="primary" onClick={() => setHiringOpen(true)}>{t("hire")}</PixelButton></div>
      </header>
      {error ? <div className="error-banner" role="alert">{error}</div> : null}
      {hiringOpen ? <AgentHiringPanel adapters={runtimeAdapters} initialProfile={importedHire} onClose={() => { setHiringOpen(false); setImportedHire(null); }} onLaunch={launch} /> : null}
      {firstRun && onboarding ? <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><OnboardingPanel status={onboarding} firstRun onChanged={setOnboarding} onError={(message) => setError(message || null)} /></div> : null}
      <section className="workspace" inert={firstRun}>
        <div className="left-rail"><AgentRoster agents={agents} selectedId={selectedId} onSelect={setSelectedId} /><ActivityPanel events={activity} /></div>
        <div className="terminal-column">
          <nav className="command-tabs" aria-label={t("commandCenter")} role="tablist">
            {COMMAND_GROUPS.map((group) => <div className="command-tab-group" key={group}><span>{t(COMMAND_GROUP_MESSAGE_KEYS[group])}</span><div>{COMMAND_VIEWS.filter((view) => view.group === group).map((view) => <CommandTab key={view.id} {...view} translatedLabel={t(COMMAND_VIEW_MESSAGE_KEYS[view.id])} active={commandView} select={setCommandView} />)}</div></div>)}
          </nav>
          <header className="command-context"><div><span>{t(COMMAND_GROUP_MESSAGE_KEYS[activeView.group])}</span><h2>{t(activeView.labelKey)}</h2></div><p>{t(activeView.descriptionKey)}</p>{selected ? <small>{selected.name} · {selected.runtimeId} · {selected.status}</small> : <small>{t("noAgentSelected")}</small>}</header>
          <section id={`command-${commandView}`} className="command-view" role="tabpanel" aria-labelledby={`command-tab-${commandView}`}>
            <Suspense fallback={<CommandFallback label={`${t("loading")}…`} />}>
            {commandView === "floor" ? <Suspense fallback={<CommandFallback label={`${t("loadingPixelOffice")}…`} />}><PixelOffice agents={agents} activity={activity} hive={hiveSnapshot} selectedId={selectedId} onSelect={setSelectedId} /></Suspense> : null}
            {commandView === "terminals" ? <>
              <div className="agent-detail" aria-label={t("selectedAgentDetails")}>{selected ? <><strong>{selected.name}</strong><span>{selected.runtimeId} · {selected.status}</span><span>{selected.workspace.status} {t("workspaceSuffix")} · {selected.cwd}</span></> : <span>{t("noAgentSelected")}</span>}</div>
              <div className="terminal-toolbar"><span>{selected ? `${selected.name} · ${selected.cwd}` : t("terminal")}</span><button type="button" onClick={() => void stop()} disabled={!selected || selected.status !== "running"}>{t("stop")}</button></div>
              <CommandComposer agent={selected} onError={(message) => setError(message || null)} />
              <Suspense fallback={<CommandFallback label={`${t("loadingTerminal")}…`} />}><TerminalPanel agent={selected} /></Suspense>
              {selected?.workspace.status === "preserved" ? <WorkspaceReview key={`${selected.id}-${selected.exitedAt ?? 0}`} agent={selected} onChanged={refresh} onError={(message) => setError(message || null)} /> : null}
            </> : null}
            {commandView === "files" ? <Suspense fallback={<CommandFallback label={`${t("loadingWorkspaceEditor")}…`} />}><FileEditorPanel agentId={selectedId} onError={(message) => setError(message || null)} /></Suspense> : null}
            {commandView === "github" ? <GitHubPanel agentId={selectedId} onError={(message) => setError(message || null)} /> : null}
            {commandView === "tasks" ? <HivePanel projectPath={selectedProject} agents={agents} onSnapshot={setHiveSnapshot} onError={(message) => setError(message || null)} /> : null}
            {commandView === "messages" ? <CommandList title={t("primeInbox")} empty={t("noDurableMessages")} items={hiveSnapshot?.primeInbox.map((message) => ({ id: message.id, title: `${message.senderAgentId} → ${message.recipientAgentId}`, meta: `${message.kind} · ${message.status}`, detail: message.body })) ?? []} /> : null}
            {commandView === "approvals" ? <ApprovalPanel projectPath={selectedProject} snapshot={hiveSnapshot} onSnapshot={setHiveSnapshot} onError={(message) => setError(message || null)} /> : null}
            {commandView === "memory" ? <MemoryPanel projectPath={selectedProject} agentId={selectedId} onError={(message) => setError(message || null)} /> : null}
            {commandView === "skills" ? <SkillsPanel onError={(message) => setError(message || null)} /> : null}
            {commandView === "activity" ? <ActivityOperationsPanel events={activity} agents={agents} onError={(message) => setError(message || null)} /> : null}
            {commandView === "usage" ? <CostPanel events={activity} agents={agents} onError={(message) => setError(message || null)} /> : null}
            {commandView === "recovery" ? <RecoveryPanel onError={(message) => setError(message || null)} /> : null}
            {commandView === "workspaces" ? <CommandList title={t("agentWorkspaces")} empty={t("noAgentWorkspaces")} items={agents.map((agent) => ({ id: agent.id, title: agent.name, meta: `${agent.workspace.status} · ${agent.workspace.branch ?? t("direct")}`, detail: agent.workspace.path }))} /> : null}
            {commandView === "settings" ? <div className="settings-panels"><LocalePanel /><RemoteCatalogPanel onError={(message) => setError(message || null)} onHireProfile={(profile) => { setImportedHire(profile); setHiringOpen(true); }} /><SlackPanel onError={(message) => setError(message || null)} /><WebhookPanel templateAgentId={selectedId} onError={(message) => setError(message || null)} /><VoicePolicyPanel projectPath={selectedProject} agents={agents} onError={(message) => setError(message || null)} /><ProviderAdapterPanel onChanged={setRuntimeAdapters} onError={(message) => setError(message || null)} /><LocalModelPanel onError={(message) => setError(message || null)} /><MissionPanel projectPath={selectedProject} agents={agents} onError={(message) => setError(message || null)} /></div> : null}
            {commandView === "updates" ? <UpdatesPanel onError={(message) => setError(message || null)} /> : null}
            {commandView === "setup" && onboarding ? <OnboardingPanel status={onboarding} agent={selected} onChanged={setOnboarding} onError={(message) => setError(message || null)} /> : null}
            </Suspense>
          </section>
        </div>
      </section>
    </main>
  );
}

function CommandTab({ id, translatedLabel, active, select }: CommandViewDefinition & { translatedLabel: string; active: CommandView; select(view: CommandView): void }) {
  function move(direction: number) {
    const index = COMMAND_VIEWS.findIndex((view) => view.id === id);
    const next = COMMAND_VIEWS[(index + direction + COMMAND_VIEWS.length) % COMMAND_VIEWS.length]!.id;
    select(next);
    requestAnimationFrame(() => document.getElementById(`command-tab-${next}`)?.focus());
  }
  return <PixelButton id={`command-tab-${id}`} type="button" variant={active === id ? "primary" : "ghost"} role="tab" aria-selected={active === id} aria-controls={`command-${id}`} tabIndex={active === id ? 0 : -1} onClick={() => select(id)} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); move(1); } else if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); } }}>{translatedLabel}</PixelButton>;
}

function CommandList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; title: string; meta: string; detail: string }> }) {
  return <section className="command-panel"><div className="section-title">{title}</div>{items.length ? <ul>{items.map((item) => <li key={item.id}><strong>{item.title}</strong><small>{item.meta}</small><span>{item.detail}</span></li>)}</ul> : <p className="empty">{empty}</p>}</section>;
}

function CommandFallback({ label }: { label: string }) { return <div className="command-loading" role="status">{label}</div>; }
