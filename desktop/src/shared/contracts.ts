export const RUNTIME_IDS = ["codex", "claude", "gemini", "antigravity", "grok", "kimi", "qwen", "opencode", "crush", "pi", "copilot", "cursor"] as const;
export type BuiltinRuntimeId = (typeof RUNTIME_IDS)[number];
export type RuntimeId = BuiltinRuntimeId | `custom:${string}`;

export interface RuntimeAdapterDescriptor {
  id: RuntimeId;
  name: string;
  command: string;
  args: string[];
  builtin: boolean;
}

export interface RuntimeAdapterCreateRequest {
  id: string;
  name: string;
  command: string;
  args: string[];
}

export type AgentStatus = "starting" | "running" | "stopping" | "exited" | "failed";
export type AgentRole = "generalist" | "planner" | "builder" | "reviewer" | "researcher";
export type AgentCapability = "planning" | "coding" | "review" | "research" | "testing";
export type AgentAppearance = "cyan" | "violet" | "green" | "gold" | "rose";

export interface AgentProfile {
  role: AgentRole;
  goal: string;
  capabilities: AgentCapability[];
  budgetMinutes: number;
  appearance: AgentAppearance;
}
export interface HireProfile { name: string; runtimeId: RuntimeId; isolateWorkspace: boolean; profile: AgentProfile; }

export interface CreateAgentRequest {
  id: string;
  name: string;
  runtimeId: RuntimeId;
  cwd: string;
  cols?: number;
  rows?: number;
  isolateWorkspace?: boolean;
  profile?: AgentProfile;
}

export type WorkspaceStatus = "direct" | "active" | "cleaned" | "preserved";

export interface WorkspaceChanges {
  status: string;
  diffStat: string;
  files: string[];
  untrackedFiles: string[];
}

export interface AgentWorkspace {
  sourcePath: string;
  path: string;
  branch?: string;
  status: WorkspaceStatus;
  changes?: WorkspaceChanges;
}

export type ActivityType = "session-starting" | "session-started" | "terminal-output" | "provider-activity" | "session-stopping" | "session-exited" | "session-failed" | "workspace-preserved" | "workspace-applied" | "workspace-cleaned" | "circuit-steered" | "circuit-constrained" | "circuit-opened";
export type AgentActivityState = "idle" | "thinking" | "reading" | "coding" | "permission-waiting" | "done" | "failed";
export type ActivitySource = "lifecycle" | "terminal" | "claude-hook" | "claude-transcript" | "codex-jsonl";
export interface ProviderUsage {
  scope: "event" | "session-total";
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  costUsd?: number;
}

export interface ActivityEvent {
  id: string;
  agentId: string;
  type: ActivityType;
  source: ActivitySource;
  state?: AgentActivityState;
  summary: string;
  timestamp: number;
  usage?: ProviderUsage;
}

export interface AgentSession {
  id: string;
  name: string;
  runtimeId: RuntimeId;
  cwd: string;
  status: AgentStatus;
  pid?: number;
  exitCode?: number;
  signal?: number;
  outputTail: string;
  startedAt: number;
  exitedAt?: number;
  workspace: AgentWorkspace;
  profile?: AgentProfile;
}

export interface TerminalOutputEvent {
  id: string;
  data: string;
}

export interface TerminalExitEvent {
  id: string;
  exitCode: number;
  signal?: number;
}

export interface TerminalWriteRequest {
  id: string;
  data: string;
}

export type CommandHistoryStatus = "queued" | "sending" | "sent" | "failed";
export interface CommandHistoryEntry { id: string; agentId: string; body: string; attachments?: string[]; status: CommandHistoryStatus; createdAt: number; error?: string; }

export interface TerminalResizeRequest {
  id: string;
  cols: number;
  rows: number;
}

export interface TerminalStopRequest {
  id: string;
}

export interface WorkspaceApplyRequest {
  id: string;
  files: string[];
  untrackedFiles: string[];
}

export interface OrbiDesktopApi {
  agents: {
    create(request: CreateAgentRequest): Promise<AgentSession>;
    list(): Promise<AgentSession[]>;
    write(request: TerminalWriteRequest): Promise<void>;
    resize(request: TerminalResizeRequest): Promise<void>;
    stop(request: TerminalStopRequest): Promise<void>;
    applyWorkspace(request: WorkspaceApplyRequest): Promise<AgentSession>;
    discardWorkspace(request: TerminalStopRequest): Promise<AgentSession>;
    onOutput(listener: (event: TerminalOutputEvent) => void): () => void;
    onExit(listener: (event: TerminalExitEvent) => void): () => void;
    onActivity(listener: (event: ActivityEvent) => void): () => void;
    copyActivityTrace(request: { events: ActivityEvent[] }): Promise<void>;
  };
  hires: { copy(profile: HireProfile): Promise<void>; importFromClipboard(): Promise<HireProfile>; onImported(listener: (profile: HireProfile) => void): () => void; };
  commands: {
    list(request: { agentId: string }): Promise<CommandHistoryEntry[]>;
    upsert(request: CommandHistoryEntry): Promise<CommandHistoryEntry[]>;
  };
  hive: {
    snapshot(request: HiveProjectRequest): Promise<HiveSnapshot>;
    assign(request: HiveAssignRequest): Promise<HiveSnapshot>;
    transitionTask(request: HiveTaskTransitionRequest): Promise<HiveSnapshot>;
    decideApproval(request: HiveApprovalDecisionRequest): Promise<HiveSnapshot>;
  };
  memory: {
    list(request: MemoryProjectRequest): Promise<MemoryRecord[]>;
    search(request: MemorySearchRequest): Promise<MemoryRecord[]>;
    capture(request: MemoryCaptureRequest): Promise<MemoryRecord[]>;
    semanticStatus(): Promise<SemanticMemoryStatus>;
    semanticIndex(request: MemoryProjectRequest): Promise<SemanticMemoryStatus>;
    semanticSearch(request: MemorySearchRequest): Promise<SemanticMemoryResult>;
    documentGraph(request: WorkspaceFileAgentRequest): Promise<DocumentKnowledgeGraph>;
    queryDocuments(request: DocumentKnowledgeQueryRequest): Promise<DocumentKnowledgeResult[]>;
  };
  missions: {
    list(request: MissionProjectRequest): Promise<ScheduledMission[]>;
    create(request: MissionCreateRequest): Promise<ScheduledMission[]>;
    setEnabled(request: MissionEnableRequest): Promise<ScheduledMission[]>;
    run(request: MissionRunRequest): Promise<ScheduledMission[]>;
  };
  runtimeAdapters: {
    list(): Promise<RuntimeAdapterDescriptor[]>;
    create(request: RuntimeAdapterCreateRequest): Promise<RuntimeAdapterDescriptor[]>;
    remove(request: { id: RuntimeId }): Promise<RuntimeAdapterDescriptor[]>;
  };
  localModels: {
    list(): Promise<LocalModelEndpoint[]>;
    create(request: LocalModelEndpointCreateRequest): Promise<LocalModelEndpoint[]>;
    remove(request: { id: string }): Promise<LocalModelEndpoint[]>;
    saveCredentialFromClipboard(request: { id: string }): Promise<LocalModelEndpoint[]>;
    clearCredential(request: { id: string }): Promise<LocalModelEndpoint[]>;
    probe(request: { id: string }): Promise<LocalModelProbeResult>;
    complete(request: LocalModelCompletionRequest): Promise<LocalModelCompletionResult>;
    cancel(request: { requestId: string }): Promise<void>;
  };
  files: {
    list(request: WorkspaceFileAgentRequest): Promise<WorkspaceFileEntry[]>;
    read(request: WorkspaceFileRequest): Promise<WorkspaceFileDocument>;
    write(request: WorkspaceFileWriteRequest): Promise<WorkspaceFileDocument>;
    history(request: WorkspaceFileRequest): Promise<WorkspaceFileRevision[]>;
    readRevision(request: WorkspaceFileRevisionRequest): Promise<WorkspaceFileDocument>;
  };
  github: {
    authStatus(): Promise<GitHubAuthStatus>;
    snapshot(request: WorkspaceFileAgentRequest): Promise<GitHubSnapshot>;
  };
  git: { snapshot(request: WorkspaceFileAgentRequest): Promise<GitWorkspaceSnapshot>; branches(request: WorkspaceFileAgentRequest): Promise<string[]>; compare(request: WorkspaceGitBranchRequest): Promise<string>; checkout(request: WorkspaceGitBranchRequest): Promise<GitWorkspaceSnapshot>; };
  onboarding: {
    status(): Promise<OnboardingStatus>;
    refresh(): Promise<OnboardingStatus>;
    complete(): Promise<OnboardingStatus>;
    copyInstallCommand(request: { id: string }): Promise<void>;
  };
  recovery: { status(): Promise<RecoveryReport | null>; };
  costs: { snapshot(): Promise<CostLedgerSnapshot>; };
  skills: { list(request?: { query?: string }): Promise<SkillCatalogEntry[]>; remove(request: { id: string }): Promise<SkillCatalogEntry[]>; };
  updates: { status(): Promise<UpdateState>; check(): Promise<UpdateState>; download(): Promise<UpdateState>; install(): Promise<void>; };
  webhooks: { status(): Promise<WebhookStatus>; start(): Promise<WebhookStatus>; stop(): Promise<WebhookStatus>; copySecret(): Promise<void>; launchWorker(request: WebhookLaunchWorkerRequest): Promise<WebhookStatus>; completeWorker(request: WebhookCompleteWorkerRequest): Promise<WebhookStatus>; };
  voice: { policy(): Promise<VoicePolicy>; updatePolicy(request: VoicePolicyUpdate): Promise<VoicePolicy>; status(): Promise<VoiceTranscriptionStatus>; chooseModel(): Promise<VoiceTranscriptionStatus>; transcribe(request: VoiceTranscriptionRequest): Promise<VoiceTranscript>; };
  catalogs: { review(request: RemoteCatalogReviewRequest): Promise<RemoteCatalogReview>; installSkill(request: RemoteSkillInstallRequest): Promise<RemoteSkillInstallResult>; importHire(request: RemoteHireImportRequest): Promise<HireProfile>; };
  slack: { status(): Promise<SlackStatus>; saveTokenFromClipboard(): Promise<SlackStatus>; saveSigningSecretFromClipboard(): Promise<SlackStatus>; clear(): Promise<SlackStatus>; test(): Promise<SlackStatus>; send(request: SlackSendRequest): Promise<SlackSendResult>; };
}

export interface WebhookEvent { id: string; title: string; detail: string; source: string; receivedAt: number; replyChannel?: string; replyThreadTimestamp?: string; workerAgentId?: string; completedAt?: number; }
export interface WebhookStatus { enabled: boolean; endpoint?: string; slackEndpoint?: string; events: WebhookEvent[]; }
export interface WebhookLaunchWorkerRequest { eventId: string; templateAgentId: string; }
export interface WebhookCompleteWorkerRequest { eventId: string; }
export type VoiceRetention = "none" | "session" | "24-hours";
export interface VoicePolicy { consent: boolean; retention: VoiceRetention; captureEnabled: boolean; updatedAt: number; }
export interface VoicePolicyUpdate { consent: boolean; retention: VoiceRetention; }
export interface VoiceTranscriptionStatus { available: boolean; modelConfigured: boolean; modelName?: string; detail: string; }
export interface VoiceTranscriptionRequest { audio: Uint8Array; mimeType: "audio/webm" | "audio/mp4"; }
export interface VoiceTranscript { text: string; createdAt: number; retainedUntil?: number; }
export type RemoteCatalogEntryKind = "skill" | "hire-profile";
export interface RemoteCatalogEntry { id: string; kind: RemoteCatalogEntryKind; name: string; description: string; version: string; artifactUrl: string; sha256: string; size: number; }
export interface RemoteCatalogReviewRequest { url: string; publisherId: string; keyId: string; publicKey: string; }
export interface RemoteCatalogReview { publisherId: string; keyId: string; issuedAt: string; expiresAt: string; entries: RemoteCatalogEntry[]; fetchedAt: number; fromCache: boolean; }
export interface RemoteSkillInstallRequest { catalog: RemoteCatalogReviewRequest; entryId: string; confirmed: true; }
export interface RemoteSkillProvenance { schemaVersion: 1; publisherId: string; keyId: string; catalogUrl: string; entryId: string; version: string; sha256: string; installedAt: number; }
export interface RemoteSkillInstallResult { skill: SkillCatalogEntry; provenance: RemoteSkillProvenance; }
export interface RemoteHireImportRequest { catalog: RemoteCatalogReviewRequest; entryId: string; }
export interface SlackStatus { configured: boolean; signingConfigured: boolean; team?: string; botUser?: string; updatedAt: number; }
export interface SlackSendRequest { channel: string; text: string; threadTimestamp?: string; }
export interface SlackSendResult { channel: string; timestamp: string; }
export interface SemanticMemoryStatus { available: boolean; active: boolean; provider: "mempalace" | "keyword"; model: "minilm"; detail: string; }
export interface SemanticMemoryResult { status: SemanticMemoryStatus; output: string; }

export interface SkillCatalogEntry { id: string; name: string; description: string; source: string; relativePath: string; }
export type UpdatePhase = "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
export interface UpdateState { phase: UpdatePhase; currentVersion: string; availableVersion?: string; releaseName?: string; releaseNotes?: string; artifactSize?: number; message?: string; }

export interface LocalModelEndpoint { id: string; name: string; baseUrl: string; defaultModel?: string; hasApiKey: boolean; createdAt: number; updatedAt: number; }
export interface LocalModelEndpointCreateRequest { id: string; name: string; baseUrl: string; defaultModel?: string; }
export interface LocalModelProbeResult { models: string[]; truncated: boolean; }
export interface LocalModelCompletionRequest { id: string; requestId: string; model?: string; prompt: string; }
export interface LocalModelCompletionResult { text: string; model: string; }
export interface WorkspaceFileAgentRequest { agentId: string; }
export interface WorkspaceFileRequest extends WorkspaceFileAgentRequest { path: string; }
export interface WorkspaceFileWriteRequest extends WorkspaceFileRequest { content: string; expectedHash: string; }
export interface WorkspaceFileRevisionRequest extends WorkspaceFileRequest { revision: string; }
export interface WorkspaceFileEntry { path: string; name: string; type: "file" | "directory"; depth: number; size?: number; editable?: boolean; }
export interface WorkspaceFileDocument { path: string; content: string; hash: string; language: string; readOnly?: boolean; }
export interface WorkspaceFileRevision { revision: string; timestamp: number; subject: string; }
export interface GitHubAuthStatus { installed: boolean; authenticated: boolean; }
export interface GitHubIssue { number: number; title: string; state: string; updatedAt: string; url: string; labels: string[]; }
export interface GitHubRun { id: number; name: string; workflowName: string; status: string; conclusion: string; headBranch: string; event: string; updatedAt: string; url: string; }
export interface GitHubSnapshot { repository: { nameWithOwner: string; url: string }; issues: GitHubIssue[]; runs: GitHubRun[]; fetchedAt: number; }
export interface GitWorkspaceSnapshot { branch: string; upstream?: string; ahead: number; behind: number; changes: Array<{ status: string; path: string }>; commits: Array<{ hash: string; parentHashes: string[]; timestamp: number; subject: string }>; diffStat: string; diff: string; fetchedAt: number; truncated: boolean; }
export interface WorkspaceGitBranchRequest extends WorkspaceFileAgentRequest { branch: string; }
export interface PrerequisiteCheck { id: string; label: string; required: boolean; status: "pass" | "warn" | "fail"; detail: string; installCommand?: string; }
export interface OnboardingStatus { version: number; completed: boolean; completedAt?: number; ready: boolean; checkedAt: number; checks: PrerequisiteCheck[]; }
export type RecoveryItemKind = "interrupted-session" | "unfinished-task" | "pending-approval" | "pending-mission";
export interface RecoveryItem { id: string; kind: RecoveryItemKind; projectPath?: string; relatedId: string; title: string; detail: string; detectedAt: number; }
export interface RecoveryReport { version: 1; generatedAt: number; truncated: boolean; items: RecoveryItem[]; }
export interface CostLedgerEntry { id: string; eventKey: string; kind: "authorization-estimate"; basis: "operator-approved-scheduled-mission-estimate"; currency: "USD"; amountUsd: number; projectPath: string; missionId: string; runId: string; approvalId: string; title: string; createdAt: number; previousChecksum?: string; checksum: string; }
export interface CostLedgerSnapshot { entries: CostLedgerEntry[]; totalAuthorizedEstimateUsd: number; corrupted: boolean; truncated: boolean; }

export interface MemoryRecord { id: string; title: string; content: string; source: string; authorAgentId: string; createdAt: number; condensed?: boolean; }
export interface DocumentKnowledgeGraph {
  nodes: Array<{ id: string; path: string; title: string; terms: string[] }>;
  edges: Array<{ sourceId: string; targetId: string; sharedTerms: string[] }>;
  truncated: boolean;
}
export interface DocumentKnowledgeQueryRequest extends WorkspaceFileAgentRequest { query: string; limit?: number; }
export interface DocumentKnowledgeResult { path: string; title: string; snippet: string; matchedTerms: string[]; }
export interface MemoryProjectRequest { projectPath: string; }
export interface MemorySearchRequest extends MemoryProjectRequest { query: string; limit?: number; }
export interface MemoryCaptureRequest extends MemoryProjectRequest { title: string; content: string; source: string; authorAgentId: string; }
export interface ScheduledMission { id: string; title: string; detail: string; agentId: string; intervalMinutes: number; estimatedCostUsd: number; enabled: boolean; nextRunAt: number; createdAt: number; updatedAt: number; pendingRunId?: string; pendingApprovalId?: string; pendingTaskId?: string; lastRunAt?: number; }
export interface MissionProjectRequest { projectPath: string; }
export interface MissionCreateRequest extends MissionProjectRequest { title: string; detail: string; agentId: string; intervalMinutes: number; estimatedCostUsd: number; }
export interface MissionEnableRequest extends MissionProjectRequest { id: string; enabled: boolean; }
export interface MissionRunRequest extends MissionProjectRequest { id: string; }

export interface HiveProjectRequest { projectPath: string; }
export interface HiveAssignRequest extends HiveProjectRequest { title: string; detail: string; agentId: string; }
export interface HiveApprovalDecisionRequest extends HiveProjectRequest { id: string; decision: "approved" | "rejected"; reason: string; }
export interface HiveTaskTransitionRequest extends HiveProjectRequest { taskId: string; action: "start" | "block" | "retry" | "complete"; agentId?: string; result?: string; }
export interface HiveSnapshot {
  tasks: Array<{ id: string; title: string; detail: string; status: string; assigneeAgentId?: string; dependencyIds: string[]; attempt: number; maxAttempts: number; createdAt: number; updatedAt: number }>;
  approvals: Array<{ id: string; category: string; title: string; rationale: string; requestedByAgentId: string; status: string; createdAt: number; decisionReason?: string }>;
  blackboard: Record<string, { key: string; value: string; authorAgentId: string; version: number; updatedAt: number }>;
  primeInbox: Array<{ id: string; senderAgentId: string; recipientAgentId: string; kind: string; body: string; status: string; createdAt: number }>;
}

export const IPC_CHANNELS = {
  create: "agents:create",
  list: "agents:list",
  write: "agents:write",
  resize: "agents:resize",
  stop: "agents:stop",
  output: "agents:output",
  exit: "agents:exit",
  activity: "agents:activity",
  activityTraceCopy: "agents:activity-trace:copy",
  applyWorkspace: "agents:workspace:apply",
  discardWorkspace: "agents:workspace:discard",
  hiveSnapshot: "hive:snapshot",
  hiveAssign: "hive:assign",
  hiveTransitionTask: "hive:task:transition",
  hiveDecideApproval: "hive:approval:decide",
  memoryList: "memory:list",
  memorySearch: "memory:search",
  memoryCapture: "memory:capture",
  memorySemanticStatus: "memory:semantic:status",
  memorySemanticIndex: "memory:semantic:index",
  memorySemanticSearch: "memory:semantic:search",
  memoryDocumentGraph: "memory:document-graph",
  memoryDocumentQuery: "memory:document-query",
  missionList: "missions:list",
  missionCreate: "missions:create",
  missionEnable: "missions:enable",
  missionRun: "missions:run",
  runtimeAdapterList: "runtime-adapters:list",
  runtimeAdapterCreate: "runtime-adapters:create",
  runtimeAdapterRemove: "runtime-adapters:remove",
  localModelList: "local-models:list",
  localModelCreate: "local-models:create",
  localModelRemove: "local-models:remove",
  localModelSaveCredential: "local-models:credential:save",
  localModelClearCredential: "local-models:credential:clear",
  localModelProbe: "local-models:probe",
  localModelComplete: "local-models:complete",
  localModelCancel: "local-models:cancel",
  fileList: "files:list",
  fileRead: "files:read",
  fileWrite: "files:write",
  fileHistory: "files:history",
  fileReadRevision: "files:revision:read",
  githubAuthStatus: "github:auth:status",
  githubSnapshot: "github:snapshot",
  gitSnapshot: "git:snapshot",
  gitBranches: "git:branches",
  gitCompare: "git:compare",
  gitCheckout: "git:checkout",
  onboardingStatus: "onboarding:status",
  onboardingRefresh: "onboarding:refresh",
  onboardingComplete: "onboarding:complete",
  onboardingCopyInstall: "onboarding:install:copy",
  recoveryStatus: "recovery:status",
  costSnapshot: "costs:snapshot",
  commandHistoryList: "commands:history:list",
  commandHistoryUpsert: "commands:history:upsert",
  skillList: "skills:list",
  skillRemove: "skills:remove",
  hireCopy: "hires:copy",
  hireImport: "hires:import",
  hireImported: "hires:imported",
  updateStatus: "updates:status",
  updateCheck: "updates:check",
  updateDownload: "updates:download",
  updateInstall: "updates:install",
  webhookStatus: "webhooks:status",
  webhookStart: "webhooks:start",
  webhookStop: "webhooks:stop",
  webhookCopySecret: "webhooks:secret:copy",
  webhookLaunchWorker: "webhooks:worker:launch",
  webhookCompleteWorker: "webhooks:worker:complete",
  voicePolicy: "voice:policy",
  voiceUpdatePolicy: "voice:policy:update",
  voiceStatus: "voice:status",
  voiceChooseModel: "voice:model:choose",
  voiceTranscribe: "voice:transcribe",
  catalogReview: "catalogs:review",
  catalogInstallSkill: "catalogs:skill:install",
  catalogImportHire: "catalogs:hire:import",
  slackStatus: "slack:status",
  slackSaveToken: "slack:token:save",
  slackSaveSigningSecret: "slack:signing-secret:save",
  slackClear: "slack:clear",
  slackTest: "slack:test",
  slackSend: "slack:send",
} as const;
