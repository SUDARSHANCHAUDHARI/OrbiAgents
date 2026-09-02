import { clipboard, dialog, ipcMain, type BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { IPC_CHANNELS } from "../../shared/contracts";
import type { PtyManager } from "../pty/ptyManager";
import type { HiveCoordinator } from "../hive/hiveCoordinator";
import type { RuntimeAdapterStore } from "../providers/runtimeAdapterStore";
import type { LocalModelEndpointStore } from "../models/localModelEndpointStore";
import type { LocalModelClient } from "../models/localModelClient";
import type { WorkspaceFileService } from "../workspaces/workspaceFileService";
import type { GitHubIngestion } from "../github/githubIngestion";
import type { GitWorkspaceService } from "../git/gitWorkspaceService";
import type { PrerequisiteChecker } from "../onboarding/prerequisiteChecker";
import { ONBOARDING_VERSION, type OnboardingStore } from "../onboarding/onboardingStore";
import type { RecoveryStore } from "../persistence/recoveryStore";
import type { CommandHistoryStore } from "../commands/commandHistoryStore";
import type { SkillCatalog } from "../skills/skillCatalog";
import type { UpdateService } from "../updates/updateService";
import type { WebhookReceiver } from "../webhooks/webhookReceiver";
import type { VoicePolicyStore } from "../voice/voicePolicyStore";
import type { LocalTranscriptionService } from "../voice/localTranscriptionService";
import type { RemoteCatalogClient } from "../catalog/remoteCatalogClient";
import type { RemoteSkillInstaller } from "../skills/remoteSkillInstaller";
import type { RemoteHireGallery } from "../agents/remoteHireGallery";
import type { SlackStore } from "../slack/slackStore";
import type { SlackClient } from "../slack/slackClient";
import { DocumentKnowledgeGraphBuilder } from "../memory/documentKnowledgeGraph";
import { activityTraceJson } from "../activity/activityTrace";
import { decodeHireProfile, encodeHireProfile } from "../agents/hireProfileCodec";
import {
  validateAgentId,
  validateCreateAgentRequest,
  validateDimension,
  validateTerminalInput,
  validateRelativeFiles,
  validateRuntimeId,
  validateWorkspace,
} from "../security/validators";

export function registerIpc(window: BrowserWindow, manager: PtyManager, hive: HiveCoordinator, runtimeAdapters: RuntimeAdapterStore, localModels: LocalModelEndpointStore, localModelClient: LocalModelClient, files: WorkspaceFileService, github: GitHubIngestion, git: GitWorkspaceService, prerequisites: PrerequisiteChecker, onboarding: OnboardingStore, recovery: RecoveryStore, commandHistory: CommandHistoryStore, skills: SkillCatalog, updates: UpdateService, webhooks: WebhookReceiver, voice: VoicePolicyStore, transcription: LocalTranscriptionService, catalogs: RemoteCatalogClient, remoteSkills: RemoteSkillInstaller, remoteHires: RemoteHireGallery, slackStore: SlackStore, slack: SlackClient): () => void {
  const documentGraph = new DocumentKnowledgeGraphBuilder(files);
  const assertTrustedSender = (senderId: number) => {
    if (senderId !== window.webContents.id) throw new Error("Untrusted IPC sender");
  };
  ipcMain.handle(IPC_CHANNELS.create, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    return manager.create(await validateCreateAgentRequest(value));
  });
  ipcMain.handle(IPC_CHANNELS.hireCopy, (event, value: unknown) => { assertTrustedSender(event.sender.id); clipboard.writeText(encodeHireProfile(value as never)); });
  ipcMain.handle(IPC_CHANNELS.hireImport, (event) => { assertTrustedSender(event.sender.id); return decodeHireProfile(clipboard.readText()); });
  ipcMain.handle(IPC_CHANNELS.list, (event) => {
    assertTrustedSender(event.sender.id);
    return manager.list();
  });
  ipcMain.handle(IPC_CHANNELS.activityTraceCopy, (event, value: unknown) => { assertTrustedSender(event.sender.id); clipboard.writeText(activityTraceJson(asRecord(value).events)); });
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
  ipcMain.handle(IPC_CHANNELS.memoryDocumentGraph, (event, value: unknown) => { assertTrustedSender(event.sender.id); return documentGraph.build(manager.workspaceRoot(validateAgentId(asRecord(value).agentId))); });
  ipcMain.handle(IPC_CHANNELS.memoryDocumentQuery, (event, value: unknown) => { assertTrustedSender(event.sender.id); const request = asRecord(value); return documentGraph.query(manager.workspaceRoot(validateAgentId(request.agentId)), request.query, request.limit); });
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
  ipcMain.handle(IPC_CHANNELS.gitSnapshot, (event, value: unknown) => { assertTrustedSender(event.sender.id); const agentId = validateAgentId(asRecord(value).agentId); return git.snapshot(manager.workspaceRoot(agentId)); });
  ipcMain.handle(IPC_CHANNELS.gitBranches, (event, value: unknown) => { assertTrustedSender(event.sender.id); return git.branches(manager.workspaceRoot(validateAgentId(asRecord(value).agentId))); });
  ipcMain.handle(IPC_CHANNELS.gitCompare, (event, value: unknown) => { assertTrustedSender(event.sender.id); const request = asRecord(value); return git.compare(manager.workspaceRoot(validateAgentId(request.agentId)), request.branch); });
  ipcMain.handle(IPC_CHANNELS.gitCheckout, (event, value: unknown) => { assertTrustedSender(event.sender.id); const request = asRecord(value); return git.checkout(manager.workspaceRoot(validateAgentId(request.agentId)), request.branch); });
  const onboardingStatus = async () => { const report = await prerequisites.check(); const saved = onboarding.get(); return { version: ONBOARDING_VERSION, completed: saved?.version === ONBOARDING_VERSION, completedAt: saved?.completedAt, ...report }; };
  ipcMain.handle(IPC_CHANNELS.onboardingStatus, (event) => { assertTrustedSender(event.sender.id); return onboardingStatus(); });
  ipcMain.handle(IPC_CHANNELS.onboardingRefresh, (event) => { assertTrustedSender(event.sender.id); return onboardingStatus(); });
  ipcMain.handle(IPC_CHANNELS.onboardingComplete, async (event) => { assertTrustedSender(event.sender.id); await onboarding.complete(); return onboardingStatus(); });
  ipcMain.handle(IPC_CHANNELS.onboardingCopyInstall, async (event, value: unknown) => { assertTrustedSender(event.sender.id); const id = asRecord(value).id; if (typeof id !== "string") throw new Error("Prerequisite is invalid"); const check = (await prerequisites.check()).checks.find((candidate) => candidate.id === id); if (!check?.installCommand) throw new Error("No installation command is available"); clipboard.writeText(check.installCommand); });
  ipcMain.handle(IPC_CHANNELS.recoveryStatus, (event) => { assertTrustedSender(event.sender.id); return recovery.load(); });
  ipcMain.handle(IPC_CHANNELS.costSnapshot, (event) => { assertTrustedSender(event.sender.id); return hive.costSnapshot(); });
  ipcMain.handle(IPC_CHANNELS.commandHistoryList, (event, value: unknown) => { assertTrustedSender(event.sender.id); return commandHistory.list(validateAgentId(asRecord(value).agentId)); });
  ipcMain.handle(IPC_CHANNELS.commandHistoryUpsert, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    const request = asRecord(value); const agentId = validateAgentId(request.agentId);
    if (!manager.list().some((agent) => agent.id === agentId)) throw new Error("Unknown command history agent");
    if (request.attachments !== undefined) {
      if (!Array.isArray(request.attachments)) throw new Error("Command attachments are invalid");
      const allowed = new Set((await files.list(manager.workspaceRoot(agentId))).filter((entry) => entry.type === "file").map((entry) => entry.path));
      if (request.attachments.some((file) => typeof file !== "string" || !allowed.has(file))) throw new Error("Command attachment is outside the safe workspace file list");
    }
    return commandHistory.upsert({ ...request, agentId });
  });
  ipcMain.handle(IPC_CHANNELS.skillList, (event, value: unknown) => {
    assertTrustedSender(event.sender.id);
    if (value === undefined) return skills.list();
    const query = asRecord(value).query;
    if (query !== undefined && (typeof query !== "string" || query.length > 200)) throw new Error("Skill query is invalid");
    return skills.list(query as string | undefined);
  });
  ipcMain.handle(IPC_CHANNELS.skillRemove, (event, value: unknown) => { assertTrustedSender(event.sender.id); return skills.remove(asRecord(value).id); });
  ipcMain.handle(IPC_CHANNELS.updateStatus, (event) => { assertTrustedSender(event.sender.id); return updates.status(); });
  ipcMain.handle(IPC_CHANNELS.updateCheck, (event) => { assertTrustedSender(event.sender.id); return updates.check(); });
  ipcMain.handle(IPC_CHANNELS.updateDownload, (event) => { assertTrustedSender(event.sender.id); return updates.download(); });
  ipcMain.handle(IPC_CHANNELS.updateInstall, (event) => { assertTrustedSender(event.sender.id); return updates.install(); });
  ipcMain.handle(IPC_CHANNELS.webhookStatus, (event) => { assertTrustedSender(event.sender.id); return webhooks.status(); });
  ipcMain.handle(IPC_CHANNELS.webhookStart, (event) => { assertTrustedSender(event.sender.id); return webhooks.start(); });
  ipcMain.handle(IPC_CHANNELS.webhookStop, (event) => { assertTrustedSender(event.sender.id); return webhooks.stop(); });
  ipcMain.handle(IPC_CHANNELS.webhookCopySecret, (event) => { assertTrustedSender(event.sender.id); clipboard.writeText(webhooks.copySecret()); });
  ipcMain.handle(IPC_CHANNELS.webhookLaunchWorker, async (event, value: unknown) => {
    assertTrustedSender(event.sender.id); const request = asRecord(value); const templateId = validateAgentId(request.templateAgentId); const source = webhooks.event(validateWebhookEventId(request.eventId));
    const template = manager.list().find((agent) => agent.id === templateId); if (!template) throw new Error("Worker template agent was not found");
    const workerId = `webhook-${randomUUID().slice(0, 12)}`;
    await manager.create({ id: workerId, name: `Webhook: ${source.title}`.slice(0, 80), runtimeId: template.runtimeId, cwd: template.workspace.sourcePath, cols: 100, rows: 30, isolateWorkspace: true, profile: { role: "generalist", goal: source.title, capabilities: ["planning", "coding", "testing"], budgetMinutes: 30, appearance: template.profile?.appearance ?? "cyan" } });
    try { manager.write(workerId, `Handle this authenticated webhook event as a one-shot task. Do not contact external systems unless the operator explicitly authorizes it.\n\nSource: ${source.source}\nTitle: ${source.title}\nDetail:\n${source.detail}\n`); }
    catch (error) { manager.stop(workerId); throw error; }
    return webhooks.attachWorker(source.id, workerId);
  });
  ipcMain.handle(IPC_CHANNELS.webhookCompleteWorker, (event, value: unknown) => { assertTrustedSender(event.sender.id); const completed = webhooks.completeWorker(validateWebhookEventId(asRecord(value).eventId)); manager.stop(completed.workerAgentId); return completed.status; });
  ipcMain.handle(IPC_CHANNELS.voicePolicy, (event) => { assertTrustedSender(event.sender.id); return voice.get(); });
  ipcMain.handle(IPC_CHANNELS.voiceUpdatePolicy, async (event, value: unknown) => { assertTrustedSender(event.sender.id); const policy = await voice.update(value); if (!policy.consent || policy.retention === "none") await transcription.clearRetained(); return policy; });
  ipcMain.handle(IPC_CHANNELS.voiceStatus, (event) => { assertTrustedSender(event.sender.id); return transcription.status(); });
  ipcMain.handle(IPC_CHANNELS.voiceChooseModel, async (event) => { assertTrustedSender(event.sender.id); const result = await dialog.showOpenDialog(window, { title: "Choose whisper.cpp GGML model", properties: ["openFile"], filters: [{ name: "GGML model", extensions: ["bin"] }] }); return result.canceled || !result.filePaths[0] ? transcription.status() : transcription.setModel(result.filePaths[0]); });
  ipcMain.handle(IPC_CHANNELS.voiceTranscribe, (event, value: unknown) => { assertTrustedSender(event.sender.id); return transcription.transcribe(value); });
  ipcMain.handle(IPC_CHANNELS.catalogReview, (event, value: unknown) => { assertTrustedSender(event.sender.id); return catalogs.review(value); });
  ipcMain.handle(IPC_CHANNELS.catalogInstallSkill, (event, value: unknown) => { assertTrustedSender(event.sender.id); return remoteSkills.install(value); });
  ipcMain.handle(IPC_CHANNELS.catalogImportHire, (event, value: unknown) => { assertTrustedSender(event.sender.id); return remoteHires.importProfile(value); });
  ipcMain.handle(IPC_CHANNELS.slackStatus, (event) => { assertTrustedSender(event.sender.id); return slackStore.status(); });
  ipcMain.handle(IPC_CHANNELS.slackSaveToken, (event) => { assertTrustedSender(event.sender.id); return slackStore.setToken(clipboard.readText()); });
  ipcMain.handle(IPC_CHANNELS.slackSaveSigningSecret, (event) => { assertTrustedSender(event.sender.id); return slackStore.setSigningSecret(clipboard.readText()); });
  ipcMain.handle(IPC_CHANNELS.slackClear, (event) => { assertTrustedSender(event.sender.id); return slackStore.clear(); });
  ipcMain.handle(IPC_CHANNELS.slackTest, (event) => { assertTrustedSender(event.sender.id); return slack.test(); });
  ipcMain.handle(IPC_CHANNELS.slackSend, (event, value: unknown) => { assertTrustedSender(event.sender.id); return slack.send(value); });

  const dispose = () => {
    for (const channel of Object.values(IPC_CHANNELS)) {
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
function validateWebhookEventId(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) throw new Error("Webhook event id is invalid"); return value; }

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error("Request payload is required");
  return value as Record<string, unknown>;
}
