import type { IpcRenderer } from "electron";
import { IPC_CHANNELS, type ActivityEvent, type OrbiDesktopApi, type TerminalExitEvent, type TerminalOutputEvent } from "../shared/contracts";

export function createDesktopApi(ipcRenderer: Pick<IpcRenderer, "invoke" | "on" | "removeListener">): OrbiDesktopApi {
  const agents: OrbiDesktopApi["agents"] = {
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.create, request),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.list),
    write: (request) => ipcRenderer.invoke(IPC_CHANNELS.write, request),
    resize: (request) => ipcRenderer.invoke(IPC_CHANNELS.resize, request),
    stop: (request) => ipcRenderer.invoke(IPC_CHANNELS.stop, request),
    applyWorkspace: (request) => ipcRenderer.invoke(IPC_CHANNELS.applyWorkspace, request),
    discardWorkspace: (request) => ipcRenderer.invoke(IPC_CHANNELS.discardWorkspace, request),
    onOutput: (listener) => subscribe<TerminalOutputEvent>(ipcRenderer, IPC_CHANNELS.output, listener),
    onExit: (listener) => subscribe<TerminalExitEvent>(ipcRenderer, IPC_CHANNELS.exit, listener),
    onActivity: (listener) => subscribe<ActivityEvent>(ipcRenderer, IPC_CHANNELS.activity, listener),
  };
  const commands: OrbiDesktopApi["commands"] = {
    list: (request) => ipcRenderer.invoke(IPC_CHANNELS.commandHistoryList, request),
    upsert: (request) => ipcRenderer.invoke(IPC_CHANNELS.commandHistoryUpsert, request),
  };
  const hires: OrbiDesktopApi["hires"] = { copy: (profile) => ipcRenderer.invoke(IPC_CHANNELS.hireCopy, profile), importFromClipboard: () => ipcRenderer.invoke(IPC_CHANNELS.hireImport), onImported: (listener) => subscribe(ipcRenderer, IPC_CHANNELS.hireImported, listener) };
  const hive: OrbiDesktopApi["hive"] = {
    snapshot: (request) => ipcRenderer.invoke(IPC_CHANNELS.hiveSnapshot, request),
    assign: (request) => ipcRenderer.invoke(IPC_CHANNELS.hiveAssign, request),
    transitionTask: (request) => ipcRenderer.invoke(IPC_CHANNELS.hiveTransitionTask, request),
    decideApproval: (request) => ipcRenderer.invoke(IPC_CHANNELS.hiveDecideApproval, request),
  };
  const memory: OrbiDesktopApi["memory"] = {
    list: (request) => ipcRenderer.invoke(IPC_CHANNELS.memoryList, request),
    search: (request) => ipcRenderer.invoke(IPC_CHANNELS.memorySearch, request),
    capture: (request) => ipcRenderer.invoke(IPC_CHANNELS.memoryCapture, request),
  };
  const missions: OrbiDesktopApi["missions"] = {
    list: (request) => ipcRenderer.invoke(IPC_CHANNELS.missionList, request),
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.missionCreate, request),
    setEnabled: (request) => ipcRenderer.invoke(IPC_CHANNELS.missionEnable, request),
    run: (request) => ipcRenderer.invoke(IPC_CHANNELS.missionRun, request),
  };
  const runtimeAdapters: OrbiDesktopApi["runtimeAdapters"] = {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.runtimeAdapterList),
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.runtimeAdapterCreate, request),
    remove: (request) => ipcRenderer.invoke(IPC_CHANNELS.runtimeAdapterRemove, request),
  };
  const localModels: OrbiDesktopApi["localModels"] = {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.localModelList),
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.localModelCreate, request),
    remove: (request) => ipcRenderer.invoke(IPC_CHANNELS.localModelRemove, request),
    saveCredentialFromClipboard: (request) => ipcRenderer.invoke(IPC_CHANNELS.localModelSaveCredential, request),
    clearCredential: (request) => ipcRenderer.invoke(IPC_CHANNELS.localModelClearCredential, request),
    probe: (request) => ipcRenderer.invoke(IPC_CHANNELS.localModelProbe, request),
  };
  const files: OrbiDesktopApi["files"] = {
    list: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileList, request),
    read: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileRead, request),
    write: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileWrite, request),
    history: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileHistory, request),
    readRevision: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileReadRevision, request),
  };
  const github: OrbiDesktopApi["github"] = {
    authStatus: () => ipcRenderer.invoke(IPC_CHANNELS.githubAuthStatus),
    snapshot: (request) => ipcRenderer.invoke(IPC_CHANNELS.githubSnapshot, request),
  };
  const git: OrbiDesktopApi["git"] = { snapshot: (request) => ipcRenderer.invoke(IPC_CHANNELS.gitSnapshot, request) };
  const onboarding: OrbiDesktopApi["onboarding"] = {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.onboardingStatus),
    refresh: () => ipcRenderer.invoke(IPC_CHANNELS.onboardingRefresh),
    complete: () => ipcRenderer.invoke(IPC_CHANNELS.onboardingComplete),
  };
  const recovery: OrbiDesktopApi["recovery"] = { status: () => ipcRenderer.invoke(IPC_CHANNELS.recoveryStatus) };
  const costs: OrbiDesktopApi["costs"] = { snapshot: () => ipcRenderer.invoke(IPC_CHANNELS.costSnapshot) };
  const skills: OrbiDesktopApi["skills"] = { list: (request) => ipcRenderer.invoke(IPC_CHANNELS.skillList, request), remove: (request) => ipcRenderer.invoke(IPC_CHANNELS.skillRemove, request) };
  const updates: OrbiDesktopApi["updates"] = {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.updateStatus),
    check: () => ipcRenderer.invoke(IPC_CHANNELS.updateCheck),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.updateDownload),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.updateInstall),
  };
  const webhooks: OrbiDesktopApi["webhooks"] = { status: () => ipcRenderer.invoke(IPC_CHANNELS.webhookStatus), start: () => ipcRenderer.invoke(IPC_CHANNELS.webhookStart), stop: () => ipcRenderer.invoke(IPC_CHANNELS.webhookStop), copySecret: () => ipcRenderer.invoke(IPC_CHANNELS.webhookCopySecret) };
  const voice: OrbiDesktopApi["voice"] = { policy: () => ipcRenderer.invoke(IPC_CHANNELS.voicePolicy), updatePolicy: (request) => ipcRenderer.invoke(IPC_CHANNELS.voiceUpdatePolicy, request), status: () => ipcRenderer.invoke(IPC_CHANNELS.voiceStatus), chooseModel: () => ipcRenderer.invoke(IPC_CHANNELS.voiceChooseModel), transcribe: (request) => ipcRenderer.invoke(IPC_CHANNELS.voiceTranscribe, request) };
  const catalogs: OrbiDesktopApi["catalogs"] = { review: (request) => ipcRenderer.invoke(IPC_CHANNELS.catalogReview, request), installSkill: (request) => ipcRenderer.invoke(IPC_CHANNELS.catalogInstallSkill, request), importHire: (request) => ipcRenderer.invoke(IPC_CHANNELS.catalogImportHire, request) };
  const slack: OrbiDesktopApi["slack"] = { status: () => ipcRenderer.invoke(IPC_CHANNELS.slackStatus), saveTokenFromClipboard: () => ipcRenderer.invoke(IPC_CHANNELS.slackSaveToken), clear: () => ipcRenderer.invoke(IPC_CHANNELS.slackClear), test: () => ipcRenderer.invoke(IPC_CHANNELS.slackTest), send: (request) => ipcRenderer.invoke(IPC_CHANNELS.slackSend, request) };
  return Object.freeze({
    agents: Object.freeze(agents),
    hires: Object.freeze(hires),
    commands: Object.freeze(commands),
    hive: Object.freeze(hive),
    memory: Object.freeze(memory),
    missions: Object.freeze(missions),
    runtimeAdapters: Object.freeze(runtimeAdapters),
    localModels: Object.freeze(localModels),
    files: Object.freeze(files),
    github: Object.freeze(github),
    git: Object.freeze(git),
    onboarding: Object.freeze(onboarding),
    recovery: Object.freeze(recovery),
    costs: Object.freeze(costs),
    skills: Object.freeze(skills),
    updates: Object.freeze(updates),
    webhooks: Object.freeze(webhooks),
    voice: Object.freeze(voice),
    catalogs: Object.freeze(catalogs),
    slack: Object.freeze(slack),
  });
}

function subscribe<T>(
  ipcRenderer: Pick<IpcRenderer, "on" | "removeListener">,
  channel: string,
  listener: (event: T) => void,
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}
