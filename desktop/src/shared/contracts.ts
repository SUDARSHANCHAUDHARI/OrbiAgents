export const RUNTIME_IDS = ["codex", "claude", "gemini"] as const;
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

export type ActivityType = "session-starting" | "session-started" | "terminal-output" | "provider-activity" | "session-stopping" | "session-exited" | "session-failed" | "workspace-preserved" | "workspace-applied" | "workspace-cleaned";
export type AgentActivityState = "idle" | "thinking" | "reading" | "coding" | "permission-waiting" | "done" | "failed";
export type ActivitySource = "lifecycle" | "terminal" | "claude-hook" | "claude-transcript" | "codex-jsonl";

export interface ActivityEvent {
  id: string;
  agentId: string;
  type: ActivityType;
  source: ActivitySource;
  state?: AgentActivityState;
  summary: string;
  timestamp: number;
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
  };
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
  onboarding: {
    status(): Promise<OnboardingStatus>;
    refresh(): Promise<OnboardingStatus>;
    complete(): Promise<OnboardingStatus>;
  };
  recovery: { status(): Promise<RecoveryReport | null>; };
  costs: { snapshot(): Promise<CostLedgerSnapshot>; };
}

export interface LocalModelEndpoint { id: string; name: string; baseUrl: string; defaultModel?: string; hasApiKey: boolean; createdAt: number; updatedAt: number; }
export interface LocalModelEndpointCreateRequest { id: string; name: string; baseUrl: string; defaultModel?: string; }
export interface LocalModelProbeResult { models: string[]; truncated: boolean; }
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
export interface PrerequisiteCheck { id: string; label: string; required: boolean; status: "pass" | "warn" | "fail"; detail: string; }
export interface OnboardingStatus { version: number; completed: boolean; completedAt?: number; ready: boolean; checkedAt: number; checks: PrerequisiteCheck[]; }
export type RecoveryItemKind = "interrupted-session" | "unfinished-task" | "pending-approval" | "pending-mission";
export interface RecoveryItem { id: string; kind: RecoveryItemKind; projectPath?: string; relatedId: string; title: string; detail: string; detectedAt: number; }
export interface RecoveryReport { version: 1; generatedAt: number; truncated: boolean; items: RecoveryItem[]; }
export interface CostLedgerEntry { id: string; eventKey: string; kind: "authorization-estimate"; basis: "operator-approved-scheduled-mission-estimate"; currency: "USD"; amountUsd: number; projectPath: string; missionId: string; runId: string; approvalId: string; title: string; createdAt: number; previousChecksum?: string; checksum: string; }
export interface CostLedgerSnapshot { entries: CostLedgerEntry[]; totalAuthorizedEstimateUsd: number; corrupted: boolean; truncated: boolean; }

export interface MemoryRecord { id: string; title: string; content: string; source: string; authorAgentId: string; createdAt: number; condensed?: boolean; }
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
  applyWorkspace: "agents:workspace:apply",
  discardWorkspace: "agents:workspace:discard",
  hiveSnapshot: "hive:snapshot",
  hiveAssign: "hive:assign",
  hiveTransitionTask: "hive:task:transition",
  hiveDecideApproval: "hive:approval:decide",
  memoryList: "memory:list",
  memorySearch: "memory:search",
  memoryCapture: "memory:capture",
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
  fileList: "files:list",
  fileRead: "files:read",
  fileWrite: "files:write",
  fileHistory: "files:history",
  fileReadRevision: "files:revision:read",
  githubAuthStatus: "github:auth:status",
  githubSnapshot: "github:snapshot",
  onboardingStatus: "onboarding:status",
  onboardingRefresh: "onboarding:refresh",
  onboardingComplete: "onboarding:complete",
  recoveryStatus: "recovery:status",
  costSnapshot: "costs:snapshot",
  commandHistoryList: "commands:history:list",
  commandHistoryUpsert: "commands:history:upsert",
} as const;
