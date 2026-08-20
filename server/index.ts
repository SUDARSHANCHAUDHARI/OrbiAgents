import "dotenv/config";
import express from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { WebSocketServer, WebSocket } from "ws";
import { Agent, AgentState, ClientMessage, WorkflowEvent } from "./types";
import { runWorkflow } from "./orchestrator";
import { availableProviders, Provider } from "./ai";
import { runWorkflowDynamic } from "./workflowRunner";
import { availableRuntimeIds, createRuntimeExecution, RuntimeId } from "./runtimeConfig";
import { workspaceRegistry } from "./workspaceRegistry";
import { configuredWorkspaceOperations } from "./workspaceOperations";
import { Workflow } from "./workflowTypes";
import {
  createSession,
  recordFrame,
  recordEvent,
  updateSessionCost,
  getSession,
  getSessionByShareToken,
  createShareToken,
  getUserSessionUsage,
  listSessions,
} from "./sessionStore";
import { db } from "./db";
import { hashPassword, verifyPassword, signToken, protect, verifyToken } from "./auth";
import {
  cleanupRuntimeStore,
  ensureRuntimeActive,
  getOrCreateRuntime,
  requestRuntimeCancel,
  resetRuntimeAgents,
  setAgentPaused,
  touchRuntime,
  UserRuntime,
  WorkflowCancelledError,
} from "./runtimeState";
import { createRateLimit } from "./rateLimit";
import { validateServerEnv } from "./env";
import { logServerEvent, requestLogger } from "./logger";
import { buildRelevantMemoryContext, deleteMemory, listMemory, MemoryScope, updateMemory, writeMemory } from "./memoryStore";
import { markMessageRead, MessageKind, readInbox, sendMessage } from "./mailboxStore";
import { OrbiPrimeSupervisor } from "./supervisor";
import { proposeWorkflowImprovement } from "./workflowProposal";
import { listReplayBookmarks, listSharedReplayBookmarks, replaceReplayBookmarks, validateReplayBookmarks } from "./replayBookmarks";
import { getProposalPolicies, recordProposal, saveProposalPolicies, validateProposalPolicies } from "./supervisorPreferences";
import { clearEmbeddingCache, embeddingCacheLimits, pruneEmbeddingCache } from "./embeddingCache";

const app = express();
const PORT = 4000;
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? APP_URL;
const CORS_ORIGINS = new Set([CORS_ORIGIN, "http://localhost:3001", "http://localhost:3000"]);
const AUTH_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_AUTH_MAX ?? "10");
const WORKFLOW_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_WORKFLOW_MAX ?? "12");
const MAX_RUNS_PER_HOUR = Number(process.env.MAX_RUNS_PER_HOUR ?? "30");
const MAX_DAILY_COST_USD = Number(process.env.MAX_DAILY_COST_USD ?? "10");
const MAX_WORKFLOW_NODES = Number(process.env.MAX_WORKFLOW_NODES ?? "12");
const MAX_PARALLEL_AGENTS = Number(process.env.MAX_PARALLEL_AGENTS ?? "3");
let server: Server | null = null;
let wss: WebSocketServer | null = null;

app.use(express.json());
app.use(requestLogger);

app.use((_req, res, next) => {
  const origin = _req.headers.origin ?? "";
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGINS.has(origin) ? origin : CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// ── Agent definitions ──────────────────────────────────────────────
function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function makeAgent(
  id: string,
  name: string,
  x: number,
  y: number
): Agent {
  return {
    id,
    name,
    state: "idle",
    task: "Ready",
    paused: false,
    tokensUsed: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    lastAction: "Initialized",
    logs: [`${timestamp()} — Agent initialized`],
    x,
    y,
  };
}

function makeDefaultAgents(): Agent[] {
  return [
    makeAgent("1", "Orbi-Alpha",   90,  90),  // Planner   — top-left desk
    makeAgent("2", "Orbi-Beta",   330, 190),  // Coder     — center desk
    makeAgent("3", "Orbi-Gamma",  580, 110),  // Tester    — top-right desk
    makeAgent("4", "Orbi-Delta",  210, 330),  // Reviewer  — bottom-left desk
    makeAgent("5", "Orbi-Epsilon",460, 300),  // Debugger  — bottom-center desk
  ];
}

const runtimes = new Map<string, UserRuntime>();
const authRateLimit = createRateLimit({
  key: "auth",
  windowMs: 60_000,
  max: AUTH_RATE_LIMIT_MAX,
  message: "Too many auth attempts. Please try again in a minute.",
});
const workflowRateLimit = createRateLimit({
  key: "workflow",
  windowMs: 60_000,
  max: WORKFLOW_RATE_LIMIT_MAX,
  message: "Too many workflow requests. Please slow down and try again shortly.",
});

function getRuntime(userId: string): UserRuntime {
  return getOrCreateRuntime(runtimes, userId, makeDefaultAgents);
}

// ── Broadcast ─────────────────────────────────────────────────────
function broadcast(runtime: UserRuntime) {
  touchRuntime(runtime);
  const payload = JSON.stringify(runtime.agents);
  runtime.sockets.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  });
}

function sendRuntimeEvent(runtime: UserRuntime, payload: unknown): void {
  const serialized = JSON.stringify(payload);
  runtime.sockets.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(serialized);
  });
}

function publishWorkflowEvent(userId: string, event: WorkflowEvent): void {
  const runtime = getRuntime(userId);
  if (runtime.activeSessionId) recordEvent(runtime.activeSessionId, event);
  sendRuntimeEvent(runtime, { type: "workflow-event", event });
}

function updateAgent(userId: string, id: string, patch: Partial<Agent>) {
  const runtime = getRuntime(userId);
  runtime.agents = runtime.agents.map((a) => {
    if (a.id !== id) return a;
    const newLogs =
      patch.logs != null ? [...patch.logs, ...a.logs].slice(0, 20) : a.logs;
    return { ...a, ...patch, logs: newLogs };
  });
  broadcast(runtime);
  if (runtime.activeSessionId) recordFrame(runtime.activeSessionId, runtime.agents);
}

function isAgentPaused(userId: string, id: string): boolean {
  return getRuntime(userId).agents.find((agent) => agent.id === id)?.paused ?? false;
}

async function waitIfPaused(userId: string, id: string): Promise<void> {
  const runtime = getRuntime(userId);
  ensureRuntimeActive(runtime);
  while (isAgentPaused(userId, id)) {
    ensureRuntimeActive(runtime);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  ensureRuntimeActive(runtime);
}

function resetRuntime(userId: string): void {
  const runtime = getRuntime(userId);
  resetRuntimeAgents(runtime);
  broadcast(runtime);
}

function removeSocketFromRuntimes(socket: WebSocket): void {
  runtimes.forEach((runtime) => {
    if (runtime.sockets.delete(socket)) touchRuntime(runtime);
  });
}

function cleanupRuntimes(): void {
  cleanupRuntimeStore(runtimes);
}

async function enforceUsageGuardrails(userId: string): Promise<string | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [recentRuns, dailyUsage] = await Promise.all([
    getUserSessionUsage(userId, oneHourAgo),
    getUserSessionUsage(userId, dayStart),
  ]);

  if (recentRuns.count >= MAX_RUNS_PER_HOUR) {
    return `Hourly run limit reached (${MAX_RUNS_PER_HOUR}/hour). Please wait before starting another workflow.`;
  }

  if (dailyUsage.totalCostUsd >= MAX_DAILY_COST_USD) {
    return `Daily usage cap reached ($${MAX_DAILY_COST_USD.toFixed(2)}).`;
  }

  return null;
}

function getUserIdFromSocketRequest(req: import("http").IncomingMessage): string | null {
  const url = new URL(req.url ?? "/", "http://localhost:4000");
  const token = url.searchParams.get("token");
  if (!token) return null;
  try {
    return verifyToken(token).sub;
  } catch {
    return null;
  }
}

function broadcastSimulation() {
  runtimes.forEach((runtime) => {
    if (runtime.workflowRunning) return;
    let changed = false;
    runtime.agents = runtime.agents.map((a) => {
      if (a.paused) return a;
      const newState = pick(SIM_STATES);
      const taskList = SIM_TASKS[newState] ?? SIM_TASKS.idle;
      const actionList = SIM_ACTIONS[newState] ?? SIM_ACTIONS.idle;
      const action = pick(actionList);
      changed = true;
      return {
        ...a,
        state: newState,
        task: pick(taskList),
        lastAction: action,
        tokensUsed: a.tokensUsed + Math.floor(Math.random() * 800) + 100,
        logs: [`${timestamp()} — [${newState}] ${action}`, ...a.logs].slice(0, 20),
      };
    });
    if (changed) broadcast(runtime);
  });
}

// ── Random simulation ─────────────────────────────────────────────
const SIM_STATES: AgentState[] = ["idle", "thinking", "reading", "coding", "done"];
const SIM_TASKS: Record<string, string[]> = {
  idle: ["Waiting for task...", "Standing by", "Ready"],
  thinking: ["Planning architecture", "Analyzing requirements", "Reviewing codebase"],
  reading: ["Reading source files", "Searching codebase", "Fetching docs"],
  coding: ["Writing components", "Implementing handler", "Fixing type errors"],
  testing: ["Running test suite", "Checking coverage"],
  reviewing: ["Reviewing PR", "Checking patterns"],
  debugging: ["Tracing errors", "Fixing issues"],
  done: ["Feature complete", "PR ready", "Tests passing"],
};
const SIM_ACTIONS: Record<string, string[]> = {
  idle: ["Checked queue", "Pinged server"],
  thinking: ["Outlined plan", "Analyzed task"],
  reading: ["Read 14 files", "Searched codebase", "Fetched 3 docs"],
  coding: ["Wrote 42 lines", "Ran type check"],
  testing: ["Ran 20 tests", "Checked snapshots"],
  reviewing: ["Flagged 2 issues", "Approved PR"],
  debugging: ["Fixed 3 bugs", "Added null checks"],
  done: ["Committed changes", "Pushed branch"],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const simulationInterval = setInterval(() => {
  broadcastSimulation();
}, 2000);
simulationInterval.unref();

const runtimeCleanupInterval = setInterval(() => {
  cleanupRuntimes();
}, 60 * 1000);
runtimeCleanupInterval.unref();

// ── Auth ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptimeSec: Math.round(process.uptime()),
    runtimes: runtimes.size,
    timestamp: Date.now(),
  });
});

app.post("/signup", authRateLimit, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: "Valid email and password (≥8 chars) required" }); return;
  }
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) { res.status(409).json({ error: "Email already registered" }); return; }
  const hashed = await hashPassword(password);
  const user = await db.user.create({ data: { email, password: hashed } });
  res.status(201).json({ token: signToken(user.id), user: { id: user.id, email } });
});

app.post("/login", authRateLimit, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.password))) {
    res.status(401).json({ error: "Invalid credentials" }); return;
  }
  res.json({ token: signToken(user.id), user: { id: user.id, email } });
});

// ── Saved workflows ────────────────────────────────────────────────
app.post("/workflows/save", protect, async (req, res) => {
  const { id, name, data } = req.body as { id?: string; name?: string; data?: unknown };
  if (!name || !data) { res.status(400).json({ error: "name and data required" }); return; }
  const saved = id
    ? await db.savedWorkflow.updateMany({
        where: { id, userId: req.userId! },
        data: { name, data: JSON.stringify(data) },
      })
    : null;
  if (id && (!saved || saved.count === 0)) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  const workflow = id
    ? await db.savedWorkflow.findFirst({
        where: { id, userId: req.userId! },
      })
    : await db.savedWorkflow.create({
        data: { name, data: JSON.stringify(data), userId: req.userId! },
      });
  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.status(id ? 200 : 201).json({
    id: workflow.id,
    name: workflow.name,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
  });
});

app.get("/workflows", protect, async (req, res) => {
  const workflows = await db.savedWorkflow.findMany({
    where: { userId: req.userId! },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json(workflows);
});

app.get("/workflows/:id", protect, async (req, res) => {
  const wf = await db.savedWorkflow.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (!wf) { res.status(404).json({ error: "Workflow not found" }); return; }
  res.json({ id: wf.id, name: wf.name, data: JSON.parse(wf.data) as unknown });
});

// ── Agent memory and mailbox ──────────────────────────────────────
app.post("/memory", protect, async (req, res) => {
  const { projectKey, scope, agentId, content, retentionDays } = req.body as {
    projectKey?: string;
    scope?: MemoryScope;
    agentId?: string;
    content?: string;
    retentionDays?: number;
  };
  if (scope !== "agent" && scope !== "shared") {
    res.status(400).json({ error: "scope must be agent or shared" }); return;
  }
  try {
    const memory = await writeMemory({ userId: req.userId!, projectKey, scope, agentId, content: content ?? "", retentionDays });
    res.status(201).json(memory);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/memory", protect, async (req, res) => {
  const scope = req.query.scope === "agent" || req.query.scope === "shared" ? req.query.scope : undefined;
  res.json(await listMemory(req.userId!, {
    projectKey: typeof req.query.projectKey === "string" ? req.query.projectKey : undefined,
    scope,
    agentId: typeof req.query.agentId === "string" ? req.query.agentId : undefined,
  }));
});

app.patch("/memory/:id", protect, async (req, res) => {
  try {
    const memory = await updateMemory(req.userId!, req.params.id, req.body?.content ?? "", req.body?.retentionDays);
    if (!memory) { res.status(404).json({ error: "Memory not found" }); return; }
    res.json(memory);
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : String(error) }); }
});

app.delete("/memory/:id", protect, async (req, res) => {
  if (!await deleteMemory(req.userId!, req.params.id)) { res.status(404).json({ error: "Memory not found" }); return; }
  res.status(204).end();
});

app.post("/messages", protect, async (req, res) => {
  const body = req.body as {
    projectKey?: string;
    senderAgentId?: string;
    recipientAgentId?: string;
    kind?: MessageKind;
    body?: string;
    conversationId?: string;
    replyToId?: string;
    hopCount?: number;
  };
  try {
    const message = await sendMessage({
      userId: req.userId!,
      projectKey: body.projectKey,
      senderAgentId: body.senderAgentId ?? "",
      recipientAgentId: body.recipientAgentId ?? "",
      kind: body.kind ?? "inform",
      body: body.body ?? "",
      conversationId: body.conversationId,
      replyToId: body.replyToId,
      hopCount: body.hopCount,
    });
    publishWorkflowEvent(req.userId!, {
      type: "mailbox-message",
      timestamp: Date.now(),
      detail: message.kind,
      senderAgentId: message.senderAgentId,
      recipientAgentId: message.recipientAgentId,
    });
    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/messages/:agentId", protect, async (req, res) => {
  res.json(await readInbox(req.userId!, req.params.agentId, {
    projectKey: typeof req.query.projectKey === "string" ? req.query.projectKey : undefined,
    includeRead: req.query.includeRead === "true",
  }));
});

app.post("/messages/:id/read", protect, async (req, res) => {
  const message = await markMessageRead(req.userId!, req.params.id);
  if (!message) { res.status(404).json({ error: "Message not found" }); return; }
  res.json(message);
});

app.delete("/workflows/:id", protect, async (req, res) => {
  const deleted = await db.savedWorkflow.deleteMany({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (deleted.count === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ── Available providers ────────────────────────────────────────────
app.get("/providers", (_req, res) => {
  res.json({ providers: availableProviders(), default: process.env.DEFAULT_PROVIDER ?? "anthropic" });
});

app.get("/runtimes", (_req, res) => {
  res.json({ runtimes: availableRuntimeIds(), default: "provider-api" });
});

app.get("/workspaces", protect, async (req, res) => {
  res.json(await workspaceRegistry.list(req.userId!));
});

app.get("/workspaces/:id/changes", protect, async (req, res) => {
  const workspace = await workspaceRegistry.get(req.userId!, req.params.id);
  if (!workspace) { res.status(404).json({ error: "Workspace not found" }); return; }
  try {
    res.json(await configuredWorkspaceOperations().inspect(workspace.path));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.delete("/workspaces/:id", protect, async (req, res) => {
  if (req.body?.confirm !== true) {
    res.status(400).json({ error: "confirm must be true to discard a workspace" }); return;
  }
  const workspace = await workspaceRegistry.get(req.userId!, req.params.id);
  if (!workspace) { res.status(404).json({ error: "Workspace not found" }); return; }
  try {
    await configuredWorkspaceOperations().discard(workspace.path);
    await workspaceRegistry.remove(req.userId!, workspace.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/workspaces/:id/apply", protect, async (req, res) => {
  if (req.body?.confirm !== true || !Array.isArray(req.body?.files) || !Array.isArray(req.body?.untrackedFiles ?? [])) {
    res.status(400).json({ error: "confirm must be true and file selections must be arrays" }); return;
  }
  const workspace = await workspaceRegistry.get(req.userId!, req.params.id);
  if (!workspace) { res.status(404).json({ error: "Workspace not found" }); return; }
  try {
    await configuredWorkspaceOperations().applyFiles(workspace.path, req.body.files, req.body.untrackedFiles ?? []);
    res.json({ status: "applied", files: req.body.files, untrackedFiles: req.body.untrackedFiles ?? [] });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/usage", protect, async (req, res) => {
  const userId = req.userId!;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [daily, hourly] = await Promise.all([
    getUserSessionUsage(userId, dayStart),
    getUserSessionUsage(userId, oneHourAgo),
  ]);
  res.json({
    dailyCostUsd: daily.totalCostUsd,
    maxDailyCostUsd: MAX_DAILY_COST_USD,
    hourlyRuns: hourly.count,
    maxRunsPerHour: MAX_RUNS_PER_HOUR,
  });
});

// ── AI workflow — fixed planner→coder ─────────────────────────────
app.post("/run", protect, workflowRateLimit, async (req, res) => {
  const { task, provider } = req.body as { task?: string; provider?: Provider };
  if (!task?.trim()) { res.status(400).json({ error: "task is required" }); return; }
  const userId = req.userId!;
  const usageError = await enforceUsageGuardrails(userId);
  if (usageError) { res.status(429).json({ error: usageError }); return; }
  const runtime = getRuntime(userId);
  if (runtime.workflowRunning) { res.status(409).json({ error: "Workflow already running" }); return; }

  const sessionId = Date.now().toString();
  await createSession(sessionId, task.trim(), userId, provider);
  runtime.activeSessionId = sessionId;
  runtime.workflowRunning = true;
  runtime.workflowAbortController = new AbortController();
  runtime.cancelRequested = false;
  touchRuntime(runtime);
  res.status(202).json({ status: "started", sessionId });

  try {
    const result = await runWorkflow(
      task.trim(),
      (id, patch) => updateAgent(userId, id, patch),
      (id) => waitIfPaused(userId, id),
      provider,
      runtime.workflowAbortController.signal
    );
    updateSessionCost(sessionId, result.totalCostUsd);
    runtime.sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "result", sessionId, ...result }));
    });
  } catch (err) {
    if (err instanceof WorkflowCancelledError || runtime.cancelRequested) {
      resetRuntime(userId);
      runtime.sockets.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "stopped", message: "Workflow stopped" }));
        }
      });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    runtime.sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "error", message: msg }));
    });
    resetRuntime(userId);
  } finally {
    runtime.workflowRunning = false;
    runtime.workflowAbortController = null;
    runtime.activeSessionId = null;
    touchRuntime(runtime);
  }
});

// ── Dynamic workflow ──────────────────────────────────────────────
app.post("/workflow/proposal", protect, async (req, res) => {
  try {
    const proposal = proposeWorkflowImprovement(req.body?.workflow as Workflow, MAX_WORKFLOW_NODES, await getProposalPolicies(req.userId!));
    if (!proposal.changed) { res.json(proposal); return; }
    const history = await recordProposal(req.userId!, proposal); res.json({ ...proposal, id: history.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/workflow/proposal/settings", protect, async (req, res) => { res.json({ enabledPolicies: await getProposalPolicies(req.userId!) }); });
app.put("/workflow/proposal/settings", protect, async (req, res) => {
  try { const enabledPolicies = validateProposalPolicies(req.body?.enabledPolicies); res.json({ enabledPolicies: await saveProposalPolicies(req.userId!, enabledPolicies) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid policies" }); }
});
app.get("/workflow/proposal/history", protect, async (req, res) => { res.json(await db.workflowProposalHistory.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "desc" }, take: 50 })); });
app.patch("/workflow/proposal/history/:id", protect, async (req, res) => {
  if (!["applied", "dismissed"].includes(req.body?.status)) { res.status(400).json({ error: "Invalid proposal status" }); return; }
  const result = await db.workflowProposalHistory.updateMany({ where: { id: req.params.id, userId: req.userId! }, data: { status: req.body.status } });
  if (!result.count) { res.status(404).json({ error: "Proposal not found" }); return; } res.json({ status: req.body.status });
});
app.get("/memory/embedding-cache", protect, async (req, res) => { res.json({ ...(await pruneEmbeddingCache(req.userId!)), ...embeddingCacheLimits() }); });
app.delete("/memory/embedding-cache", protect, async (req, res) => { res.json({ removed: await clearEmbeddingCache(req.userId!) }); });

app.post("/workflow", protect, workflowRateLimit, async (req, res) => {
  const { workflow, task, provider, runtimeId = "provider-api", memory } = req.body as {
    workflow?: Workflow;
    task?: string;
    provider?: Provider;
    runtimeId?: RuntimeId;
    memory?: { enabled?: boolean; projectKey?: string };
  };
  if (!workflow || !task?.trim()) {
    res.status(400).json({ error: "workflow and task required" }); return;
  }
  if (workflow.nodes.length > MAX_WORKFLOW_NODES) {
    res.status(400).json({ error: `Workflow exceeds node limit (${MAX_WORKFLOW_NODES})` }); return;
  }
  if (!["provider-api", "codex-cli", "claude-cli"].includes(runtimeId)) {
    res.status(400).json({ error: "Invalid runtimeId" }); return;
  }
  let execution;
  try {
    execution = createRuntimeExecution(runtimeId);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) }); return;
  }
  const userId = req.userId!;
  const usageError = await enforceUsageGuardrails(userId);
  if (usageError) { res.status(429).json({ error: usageError }); return; }
  const runtime = getRuntime(userId);
  if (runtime.workflowRunning) { res.status(409).json({ error: "Workflow already running" }); return; }

  const sessionId = Date.now().toString();
  await createSession(sessionId, task.trim(), userId, provider);
  runtime.activeSessionId = sessionId;
  runtime.workflowRunning = true;
  runtime.workflowAbortController = new AbortController();
  runtime.cancelRequested = false;
  touchRuntime(runtime);
  res.status(202).json({ status: "started", sessionId });

  try {
    const result = await runWorkflowDynamic(
      workflow,
      task.trim(),
      (id, patch) => updateAgent(userId, id, patch),
      (id) => waitIfPaused(userId, id),
      provider,
      {
        maxConcurrency: MAX_PARALLEL_AGENTS,
        runtime: execution.runtime,
        workspaceIsolation: execution.workspaceIsolation,
        runId: `${userId}-${sessionId}`,
        onWorkspacePreserved: async ({ runId, nodeId, path }) => {
          await workspaceRegistry.register({ userId, runId, nodeId, path });
        },
        supervisor: new OrbiPrimeSupervisor((event) => publishWorkflowEvent(userId, event)),
        signal: runtime.workflowAbortController.signal,
        getMemoryContext: memory?.enabled
          ? (node, agentId) => buildRelevantMemoryContext(userId, memory.projectKey?.trim() || "default", agentId, `${task.trim()} ${node.label ?? node.type}`)
          : undefined,
      }
    );
    updateSessionCost(sessionId, result.totalCostUsd);
    runtime.sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({
          type: "workflow-result",
          sessionId,
          outputs: result.outputs,
          steps: result.steps,
          totalCostUsd: result.totalCostUsd,
          runtimeId,
        }));
    });
  } catch (err) {
    if (err instanceof WorkflowCancelledError || runtime.cancelRequested) {
      resetRuntime(userId);
      runtime.sockets.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "stopped", message: "Workflow stopped" }));
        }
      });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    runtime.sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "error", message: msg }));
    });
    resetRuntime(userId);
  } finally {
    runtime.workflowRunning = false;
    runtime.workflowAbortController = null;
    runtime.activeSessionId = null;
    touchRuntime(runtime);
  }
});

app.post("/workflow/stop", protect, async (req, res) => {
  const runtime = getRuntime(req.userId!);
  if (!runtime.workflowRunning) {
    res.status(409).json({ error: "No workflow is currently running" });
    return;
  }

  requestRuntimeCancel(runtime);
  touchRuntime(runtime);
  broadcast(runtime);
  res.json({ status: "stopping" });
});

// ── Replay API ─────────────────────────────────────────────────────
app.get("/sessions", protect, async (req, res) => {
  res.json(await listSessions(req.userId));
});

app.get("/replay/:id", protect, async (req, res) => {
  const session = await getSession(req.params.id, req.userId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(session);
});

app.get("/replay/:id/bookmarks", protect, async (req, res) => {
  const session = await getSession(req.params.id, req.userId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json({ bookmarks: await listReplayBookmarks(req.userId!, session.id) });
});

app.put("/replay/:id/bookmarks", protect, async (req, res) => {
  const session = await getSession(req.params.id, req.userId);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  try {
    const frames = validateReplayBookmarks(req.body?.bookmarks ?? req.body?.frames, session.frames.length);
    res.json({ bookmarks: await replaceReplayBookmarks(req.userId!, session.id, frames) });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid bookmarks" }); }
});

// Create share link (auth required to share your own sessions)
app.post("/replay/:id/share", protect, async (_req, res) => {
  try {
    const token = await createShareToken(_req.params.id, _req.userId);
    const url = `${APP_URL}/replay/${token}`;
    res.json({ token, url });
  } catch {
    res.status(404).json({ error: "Session not found" });
  }
});

// Public replay via share token — no auth needed
app.get("/replay/public/:token", async (req, res) => {
  const session = await getSessionByShareToken(req.params.token);
  if (!session) { res.status(404).json({ error: "Share link invalid or expired" }); return; }
  res.json({ ...session, bookmarks: await listSharedReplayBookmarks(session.id) });
});

// ── WebSocket ──────────────────────────────────────────────────────
function attachWebSocketHandlers(wsServer: WebSocketServer): void {
  wsServer.on("connection", (ws, req) => {
    const userId = getUserIdFromSocketRequest(req);
    if (!userId) {
      ws.close(1008, "Unauthorized");
      return;
    }

    const runtime = getRuntime(userId);
    runtime.sockets.add(ws);
    touchRuntime(runtime);
    ws.send(JSON.stringify(runtime.agents));

    ws.on("message", (raw) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString());
        if (msg.type === "pause") {
          setAgentPaused(runtime, msg.agentId, true);
        } else if (msg.type === "resume") {
          setAgentPaused(runtime, msg.agentId, false);
        }
        touchRuntime(runtime);
        broadcast(runtime);
      } catch { /* ignore malformed */ }
    });

    ws.on("close", () => {
      runtime.sockets.delete(ws);
      touchRuntime(runtime);
      removeSocketFromRuntimes(ws);
    });
  });
}

export function startServer(port: number = PORT): { server: Server; port: number } {
  if (server && wss) {
    const address = server.address() as AddressInfo | null;
    return { server, port: address?.port ?? port };
  }

  validateServerEnv();

  server = app.listen(port, () => {
    const address = server?.address() as AddressInfo | null;
    const actualPort = address?.port ?? port;
    logServerEvent(`OrbiAgents server running on http://localhost:${actualPort}`);
  });
  wss = new WebSocketServer({ server });
  attachWebSocketHandlers(wss);

  const address = server.address() as AddressInfo | null;
  return { server, port: address?.port ?? port };
}

export async function stopServer(): Promise<void> {
  runtimes.forEach((runtime) => {
    runtime.sockets.forEach((socket) => socket.close());
    runtime.sockets.clear();
  });

  if (wss) {
    const wsServer = wss;
    wss = null;
    await new Promise<void>((resolve, reject) => {
      wsServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  if (server) {
    const httpServer = server;
    server = null;
    if (!httpServer.listening) return;
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

if (require.main === module) {
  startServer();
}
