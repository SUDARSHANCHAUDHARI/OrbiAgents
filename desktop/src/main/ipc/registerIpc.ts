import { clipboard, ipcMain, type BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../../shared/contracts";
import type { PtyManager } from "../pty/ptyManager";
import type { HiveCoordinator } from "../hive/hiveCoordinator";
import type { RuntimeAdapterStore } from "../providers/runtimeAdapterStore";
import type { LocalModelEndpointStore } from "../models/localModelEndpointStore";
import type { LocalModelClient } from "../models/localModelClient";
import type { WorkspaceFileService } from "../workspaces/workspaceFileService";
import type { GitHubIngestion } from "../github/githubIngestion";
import type { PrerequisiteChecker } from "../onboarding/prerequisiteChecker";
import { ONBOARDING_VERSION, type OnboardingStore } from "../onboarding/onboardingStore";
import type { RecoveryStore } from "../persistence/recoveryStore";
import {
  validateAgentId,
  validateCreateAgentRequest,
  validateDimension,
  validateTerminalInput,
  validateRelativeFiles,
  validateRuntimeId,
  validateWorkspace,
} from "../security/validators";

export function registerIpc(window: BrowserWindow, manager: PtyManager, hive: HiveCoordinator, runtimeAdapters: RuntimeAdapterStore, localModels: LocalModelEndpointStore, localModelClient: LocalModelClient, files: WorkspaceFileService, github: GitHubIngestion, prerequisites: PrerequisiteChecker, onboarding: OnboardingStore, recovery: RecoveryStore): () => void {
  const assertTrustedSender = (senderId: number) => {
    if (senderId !== window.webContents.id) throw new Error("Untrusted IPC sender");
  };
  ipcMain.handle(IPC_CHANNELS.create, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    return manager.create(await validateCreateAgentRequest(value));
  });
  ipcMain.handle(IPC_CHANNELS.list, (event) => {
    assertTrustedSender(event.sender.id);
    return manager.list();
  });
  ipcMain.handle(IPC_CHANNELS.write, (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value);
    manager.write(validateAgentId(request.id), validateTerminalInput(request.data));
  });
  ipcMain.handle(IPC_CHANNELS.resize, (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value);
    manager.resize(
      validateAgentId(request.id),
      validateDimension(request.cols, 100),
      validateDimension(request.rows, 30),
    );
  });
  ipcMain.handle(IPC_CHANNELS.stop, (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value);
    manager.stop(validateAgentId(request.id));
  });
  ipcMain.handle(IPC_CHANNELS.applyWorkspace, (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value);
    return manager.applyWorkspace(validateAgentId(request.id), validateRelativeFiles(request.files), validateRelativeFiles(request.untrackedFiles));
  });
  ipcMain.handle(IPC_CHANNELS.discardWorkspace, (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    return manager.discardWorkspace(validateAgentId(asRecord(value).id));
  });
  ipcMain.handle(IPC_CHANNELS.hiveSnapshot, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    return hive.snapshot(await validateWorkspace(asRecord(value).projectPath));
  });
  ipcMain.handle(IPC_CHANNELS.hiveAssign, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value);
    return hive.assign(await validateWorkspace(request.projectPath), { title: validateBoundedText(request.title, "Task title", 300), detail: validateBoundedText(request.detail, "Task detail", 20_000, true), agentId: validateAgentId(request.agentId) });
  });
  ipcMain.handle(IPC_CHANNELS.hiveTransitionTask, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value);
    if (!["start", "block", "retry", "complete"].includes(String(request.action))) throw new Error("Invalid task action");
    return hive.transitionTask(await validateWorkspace(request.projectPath), validateUuid(request.taskId), request.action as "start" | "block" | "retry" | "complete", request.agentId === undefined ? undefined : validateAgentId(request.agentId), request.result === undefined ? undefined : validateBoundedText(request.result, "Task result", 50_000));
  });
  ipcMain.handle(IPC_CHANNELS.hiveDecideApproval, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value);
    if (request.decision !== "approved" && request.decision !== "rejected") throw new Error("Invalid approval decision");
    return hive.decideApproval(await validateWorkspace(request.projectPath), validateUuid(request.id), request.decision, validateBoundedText(request.reason, "Decision reason", 2_000));
  });
  ipcMain.handle(IPC_CHANNELS.memoryList, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    return hive.listMemory(await validateWorkspace(asRecord(value).projectPath));
  });
  ipcMain.handle(IPC_CHANNELS.memorySearch, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value);
    return hive.searchMemory(await validateWorkspace(request.projectPath), validateBoundedText(request.query, "Memory query", 500), validateLimit(request.limit));
  });
  ipcMain.handle(IPC_CHANNELS.memoryCapture, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value);
    return hive.captureMemory(await validateWorkspace(request.projectPath), { title: validateBoundedText(request.title, "Memory title", 200), content: validateBoundedText(request.content, "Memory content", 20_000), source: validateBoundedText(request.source, "Memory source", 128), authorAgentId: validateAgentId(request.authorAgentId) });
  });
  ipcMain.handle(IPC_CHANNELS.missionList, async (event, value: unknown) => { assertTrustedSender(event.sender.id); return hive.listMissions(await validateWorkspace(asRecord(value).projectPath)); });
  ipcMain.handle(IPC_CHANNELS.missionCreate, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id); const request = asRecord(value);
    return hive.createMission(await validateWorkspace(request.projectPath), { title: validateBoundedText(request.title, "Mission title", 200), detail: validateBoundedText(request.detail, "Mission detail", 20_000), agentId: validateAgentId(request.agentId), intervalMinutes: validateMissionInterval(request.intervalMinutes), estimatedCostUsd: validateMissionCost(request.estimatedCostUsd) });
  });
  ipcMain.handle(IPC_CHANNELS.missionEnable, async (event, value: unknown) => { assertTrustedSender(event.sender.id); const request = asRecord(value); if (typeof request.enabled !== "boolean") throw new Error("Mission enabled state is invalid"); return hive.setMissionEnabled(await validateWorkspace(request.projectPath), validateUuid(request.id), request.enabled); });
  ipcMain.handle(IPC_CHANNELS.missionRun, async (event, value: unknown) => { assertTrustedSender(event.sender.id); const request = asRecord(value); return hive.runMission(await validateWorkspace(request.projectPath), validateUuid(request.id)); });
  ipcMain.handle(IPC_CHANNELS.runtimeAdapterList, (event) => { assertTrustedSender(event.sender.id); return runtimeAdapters.list(); });
  ipcMain.handle(IPC_CHANNELS.runtimeAdapterCreate, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id); const request = asRecord(value);
    return runtimeAdapters.create({ id: request.id as string, name: request.name as string, command: request.command as string, args: request.args as string[] });
  });
  ipcMain.handle(IPC_CHANNELS.runtimeAdapterRemove, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id); const id = validateRuntimeId(asRecord(value).id);
    return runtimeAdapters.remove(id, (runtimeId) => manager.isRuntimeInUse(runtimeId));
  });
  ipcMain.handle(IPC_CHANNELS.localModelList, (event) => { assertTrustedSender(event.sender.id); return localModels.list(); });
  ipcMain.handle(IPC_CHANNELS.localModelCreate, async (event, value: unknown) => { assertTrustedSender(event.sender.id); const request = asRecord(value); return localModels.create({ id: request.id as string, name: request.name as string, baseUrl: request.baseUrl as string, defaultModel: request.defaultModel as string | undefined }); });
  ipcMain.handle(IPC_CHANNELS.localModelRemove, async (event, value: unknown) => { assertTrustedSender(event.sender.id); return localModels.remove(asRecord(value).id); });
  ipcMain.handle(IPC_CHANNELS.localModelSaveCredential, async (event, value: unknown) => { assertTrustedSender(event.sender.id); return localModels.setCredential(asRecord(value).id, clipboard.readText()); });
  ipcMain.handle(IPC_CHANNELS.localModelClearCredential, async (event, value: unknown) => { assertTrustedSender(event.sender.id); return localModels.clearCredential(asRecord(value).id); });
  ipcMain.handle(IPC_CHANNELS.localModelProbe, async (event, value: unknown) => { assertTrustedSender(event.sender.id); return localModelClient.probe(asRecord(value).id as string); });
  const fileRequest = (value: unknown) => { const request = asRecord(value); const agentId = validateAgentId(request.agentId); return { request, root: manager.workspaceRoot(agentId) }; };
  ipcMain.handle(IPC_CHANNELS.fileList, (event, value: unknown) => { assertTrustedSender(event.sender.id); const { root } = fileRequest(value); return files.list(root); });
  ipcMain.handle(IPC_CHANNELS.fileRead, (event, value: unknown) => { assertTrustedSender(event.sender.id); const { request, root } = fileRequest(value); return files.read(root, request.path); });
  ipcMain.handle(IPC_CHANNELS.fileWrite, (event, value: unknown) => { assertTrustedSender(event.sender.id); const { request, root } = fileRequest(value); return files.write(root, request.path, request.content, request.expectedHash); });
  ipcMain.handle(IPC_CHANNELS.fileHistory, (event, value: unknown) => { assertTrustedSender(event.sender.id); const { request, root } = fileRequest(value); return files.history(root, request.path); });
  ipcMain.handle(IPC_CHANNELS.fileReadRevision, (event, value: unknown) => { assertTrustedSender(event.sender.id); const { request, root } = fileRequest(value); return files.readRevision(root, request.path, request.revision); });
  ipcMain.handle(IPC_CHANNELS.githubAuthStatus, (event) => { assertTrustedSender(event.sender.id); return github.authStatus(); });
  ipcMain.handle(IPC_CHANNELS.githubSnapshot, (event, value: unknown) => { assertTrustedSender(event.sender.id); const agentId = validateAgentId(asRecord(value).agentId); return github.snapshot(manager.workspaceRoot(agentId)); });
  const onboardingStatus = async () => { const report = await prerequisites.check(); const saved = onboarding.get(); return { version: ONBOARDING_VERSION, completed: saved?.version === ONBOARDING_VERSION, completedAt: saved?.completedAt, ...report }; };
  ipcMain.handle(IPC_CHANNELS.onboardingStatus, (event) => { assertTrustedSender(event.sender.id); return onboardingStatus(); });
  ipcMain.handle(IPC_CHANNELS.onboardingRefresh, (event) => { assertTrustedSender(event.sender.id); return onboardingStatus(); });
  ipcMain.handle(IPC_CHANNELS.onboardingComplete, async (event) => { assertTrustedSender(event.sender.id); await onboarding.complete(); return onboardingStatus(); });
  ipcMain.handle(IPC_CHANNELS.recoveryStatus, (event) => { assertTrustedSender(event.sender.id); return recovery.load(); });
  ipcMain.handle(IPC_CHANNELS.costSnapshot, (event) => { assertTrustedSender(event.sender.id); return hive.costSnapshot(); });

  const dispose = () => {
    for (const channel of [IPC_CHANNELS.create, IPC_CHANNELS.list, IPC_CHANNELS.write, IPC_CHANNELS.resize, IPC_CHANNELS.stop, IPC_CHANNELS.applyWorkspace, IPC_CHANNELS.discardWorkspace, IPC_CHANNELS.hiveSnapshot, IPC_CHANNELS.hiveAssign, IPC_CHANNELS.hiveTransitionTask, IPC_CHANNELS.hiveDecideApproval, IPC_CHANNELS.memoryList, IPC_CHANNELS.memorySearch, IPC_CHANNELS.memoryCapture, IPC_CHANNELS.missionList, IPC_CHANNELS.missionCreate, IPC_CHANNELS.missionEnable, IPC_CHANNELS.missionRun, IPC_CHANNELS.runtimeAdapterList, IPC_CHANNELS.runtimeAdapterCreate, IPC_CHANNELS.runtimeAdapterRemove, IPC_CHANNELS.localModelList, IPC_CHANNELS.localModelCreate, IPC_CHANNELS.localModelRemove, IPC_CHANNELS.localModelSaveCredential, IPC_CHANNELS.localModelClearCredential, IPC_CHANNELS.localModelProbe, IPC_CHANNELS.fileList, IPC_CHANNELS.fileRead, IPC_CHANNELS.fileWrite, IPC_CHANNELS.fileHistory, IPC_CHANNELS.fileReadRevision, IPC_CHANNELS.githubAuthStatus, IPC_CHANNELS.githubSnapshot, IPC_CHANNELS.onboardingStatus, IPC_CHANNELS.onboardingRefresh, IPC_CHANNELS.onboardingComplete, IPC_CHANNELS.recoveryStatus, IPC_CHANNELS.costSnapshot]) {
      ipcMain.removeHandler(channel);
    }
  };
  window.once("closed", dispose);
  return dispose;
}

function validateLimit(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 50) throw new Error("Memory search limit is invalid");
  return Number(value);
}
function validateMissionInterval(value: unknown): number { if (!Number.isInteger(value) || Number(value) < 5 || Number(value) > 10_080) throw new Error("Mission interval is invalid"); return Number(value); }
function validateMissionCost(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1_000) throw new Error("Mission estimated cost is invalid"); return value; }

function validateBoundedText(value: unknown, label: string, maxLength: number, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`${label} is required`);
  const text = value.trim();
  if ((!allowEmpty && !text) || text.length > maxLength) throw new Error(`${label} is invalid`);
  return text;
}

function validateUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) throw new Error("Invalid approval id");
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error("Request payload is required");
  return value as Record<string, unknown>;
}
