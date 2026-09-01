import { join } from "node:path";
import { app, BrowserWindow, safeStorage, shell } from "electron";
import { AgentRegistry } from "./agents/agentRegistry";
import { AgentMetadataStore } from "./agents/agentMetadataStore";
import { registerIpc } from "./ipc/registerIpc";
import { nodePtyAdapter } from "./pty/nodePtyAdapter";
import { PtyManager } from "./pty/ptyManager";
import { IPC_CHANNELS } from "../shared/contracts";
import { WorkspaceManager } from "./workspaces/workspaceManager";
import { ActivityHookServer } from "./activity/activityHookServer";
import { CodexRolloutWatcher } from "./activity/codexRolloutWatcher";
import { homedir } from "node:os";
import { HiveCoordinator } from "./hive/hiveCoordinator";
import { RuntimeAdapterStore } from "./providers/runtimeAdapterStore";
import { LocalModelEndpointStore } from "./models/localModelEndpointStore";
import { LocalModelClient } from "./models/localModelClient";
import { WorkspaceFileService } from "./workspaces/workspaceFileService";
import { GitHubIngestion } from "./github/githubIngestion";
import { GitWorkspaceService } from "./git/gitWorkspaceService";
import { PrerequisiteChecker } from "./onboarding/prerequisiteChecker";
import { OnboardingStore } from "./onboarding/onboardingStore";
import { AppDataMigrator } from "./persistence/appDataMigrator";
import { RecoveryStore } from "./persistence/recoveryStore";
import { CostLedger } from "./costs/costLedger";
import { CommandHistoryStore } from "./commands/commandHistoryStore";
import { SkillCatalog } from "./skills/skillCatalog";
import { UpdateService } from "./updates/updateService";
import { decodeHireProfile } from "./agents/hireProfileCodec";
import type { HireProfile } from "../shared/contracts";
import { WebhookReceiver } from "./webhooks/webhookReceiver";
import { VoicePolicyStore } from "./voice/voicePolicyStore";
import { RemoteCatalogClient } from "./catalog/remoteCatalogClient";
import { RemoteSkillInstaller } from "./skills/remoteSkillInstaller";
import { RemoteHireGallery } from "./agents/remoteHireGallery";

let manager: PtyManager | null = null;
let activityServer: ActivityHookServer | null = null;
let primaryWindow: BrowserWindow | null = null;
let pendingHire: HireProfile | null = null;

function acceptHireLink(value: string): void { try { const profile = decodeHireProfile(value); if (primaryWindow && !primaryWindow.isDestroyed()) { primaryWindow.webContents.send(IPC_CHANNELS.hireImported, profile); primaryWindow.show(); primaryWindow.focus(); } else pendingHire = profile; } catch (error) { console.error("Rejected invalid hire link", error instanceof Error ? error.message : "invalid link"); } }

async function createWindow(): Promise<void> {
  const userData = app.getPath("userData");
  const migrator = new AppDataMigrator(userData, ["agents.json", "runtime-adapters.json", "local-model-endpoints.json", "onboarding.json", "recovery.json", "command-history.json", "voice-policy.json", "costs", "hive", "skills"], [{ fromVersion: 0, toVersion: 1, async migrate() { /* Version 1 adopts existing unversioned state without rewriting it. */ } }]);
  await migrator.run(1);
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#08101d",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });
  primaryWindow = window;

  const metadata = new AgentMetadataStore(join(userData, "agents.json"));
  const runtimeAdapters = new RuntimeAdapterStore(join(userData, "runtime-adapters.json"));
  await runtimeAdapters.load();
  const localModels = new LocalModelEndpointStore(join(userData, "local-model-endpoints.json"), { isAvailable: () => safeStorage.isEncryptionAvailable(), encrypt: (value) => safeStorage.encryptString(value), decrypt: (value) => safeStorage.decryptString(value) });
  await localModels.load();
  const localModelClient = new LocalModelClient(localModels);
  const workspaceFiles = new WorkspaceFileService();
  const github = new GitHubIngestion();
  const git = new GitWorkspaceService();
  const prerequisites = new PrerequisiteChecker({ encryptionAvailable: () => safeStorage.isEncryptionAvailable() });
  const onboarding = new OnboardingStore(join(userData, "onboarding.json"));
  await onboarding.load();
  const commandHistory = new CommandHistoryStore(join(userData, "command-history.json"), { isAvailable: () => safeStorage.isEncryptionAvailable(), encrypt: (value) => safeStorage.encryptString(value), decrypt: (value) => safeStorage.decryptString(value) });
  await commandHistory.load();
  const skills = new SkillCatalog([
    { label: "Codex", path: join(homedir(), ".codex", "skills") },
    { label: "Agent", path: join(homedir(), ".agents", "skills") },
    { label: "Orbi", path: join(userData, "skills") },
  ], { trash: (target) => shell.trashItem(target) });
  const catalogs = new RemoteCatalogClient();
  const remoteSkills = new RemoteSkillInstaller(catalogs, join(userData, "skills"));
  const remoteHires = new RemoteHireGallery(catalogs);
  const workspaceManager = new WorkspaceManager(join(userData, "worktrees"));
  const loadedMetadata = await metadata.loadWithRecovery();
  const loaded = loadedMetadata.sessions;
  const recovered = await Promise.all(loaded.map(async (session) => {
    if (session.workspace.status !== "preserved") return session;
    try { return { ...session, workspace: await workspaceManager.inspectPreserved(session.workspace) }; }
    catch { return session; }
  }));
  await metadata.save(recovered);
  const registry = new AgentRegistry(recovered, (sessions) => {
    void metadata.save(sessions).catch((error) => console.error("Failed to persist agent metadata", error));
  });
  let windowManager: PtyManager;
  const windowActivityServer = new ActivityHookServer((provider, payload) => {
    if (provider === "claude" || provider === "codex") windowManager?.ingestProviderEvent(provider, payload);
  });
  const hookConfig = await windowActivityServer.start();
  activityServer = windowActivityServer;
  windowManager = new PtyManager(nodePtyAdapter, registry, {
    output: (event) => window.webContents.send(IPC_CHANNELS.output, event),
    exit: (event) => window.webContents.send(IPC_CHANNELS.exit, event),
    activity: (event) => window.webContents.send(IPC_CHANNELS.activity, event),
  }, process.env, workspaceManager, hookConfig, runtimeAdapters);
  const rolloutWatcher = new CodexRolloutWatcher(join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "sessions"), (cwd, modifiedAt) => windowManager.resolveRunningCodex(cwd, modifiedAt), (agentId, event) => windowManager.ingestCodexRollout(agentId, event));
  rolloutWatcher.start();
  manager = windowManager;
  const hive = new HiveCoordinator(join(userData, "hive"), windowManager, new CostLedger(join(userData, "costs")));
  const updates = new UpdateService(undefined, async () => {
    const sessions = windowManager.list(); const reasons: string[] = [];
    if (sessions.some((session) => ["starting", "running", "stopping"].includes(session.status))) reasons.push("an agent is active");
    if (sessions.some((session) => session.workspace.status === "preserved")) reasons.push("a preserved workspace awaits review");
    const paths = [...new Set(sessions.map((session) => session.workspace.sourcePath))];
    try {
      for (const projectPath of paths) {
        const [snapshot, missions] = await Promise.all([hive.snapshot(projectPath), hive.listMissions(projectPath)]);
        if (snapshot.approvals.some((approval) => approval.status === "pending")) reasons.push("an operator approval is pending");
        if (missions.some((mission) => mission.pendingRunId)) reasons.push("a scheduled mission run is pending");
      }
    } catch { reasons.push("project safety state could not be verified"); }
    return [...new Set(reasons)];
  });
  const webhooks = new WebhookReceiver();
  const voice = new VoicePolicyStore(join(userData, "voice-policy.json"));
  await voice.load();
  const projectPaths = [...new Set(recovered.map((session) => session.workspace.sourcePath))];
  const recovery = new RecoveryStore(join(userData, "recovery.json"));
  await recovery.create(loadedMetadata.interrupted, await Promise.all(projectPaths.map((projectPath) => hive.recoveryState(projectPath))));
  hive.startHeartbeat();
  registerIpc(window, windowManager, hive, runtimeAdapters, localModels, localModelClient, workspaceFiles, github, git, prerequisites, onboarding, recovery, commandHistory, skills, updates, webhooks, voice, catalogs, remoteSkills, remoteHires);

  window.once("ready-to-show", () => { window.show(); if (pendingHire) { window.webContents.send(IPC_CHANNELS.hireImported, pendingHire); pendingHire = null; } });
  window.once("closed", () => {
    windowManager.stopAll();
    void windowActivityServer.stop();
    rolloutWatcher.stop();
    hive.stopHeartbeat();
    void webhooks.stop();
    if (activityServer === windowActivityServer) activityServer = null;
    if (manager === windowManager) manager = null;
    if (primaryWindow === window) primaryWindow = null;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else app.on("second-instance", (_event, argv) => { const link = argv.find((value) => value.startsWith("orbiagents://hire")); if (link) acceptHireLink(link); else { primaryWindow?.show(); primaryWindow?.focus(); } });
app.on("open-url", (event, url) => { event.preventDefault(); acceptHireLink(url); });

if (hasLock) app.whenReady().then(() => {
  if (app.isPackaged) app.setAsDefaultProtocolClient("orbiagents");
  const initialLink = process.argv.find((value) => value.startsWith("orbiagents://hire")); if (initialLink) acceptHireLink(initialLink);
  void createWindow().catch((error) => {
    console.error("Failed to create OrbiAgents window", error);
    app.quit();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch((error) => console.error("Failed to recreate OrbiAgents window", error));
    }
  });
});

app.on("before-quit", () => manager?.stopAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
