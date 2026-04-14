import "dotenv/config";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { Agent, AgentState, ClientMessage } from "./types";
import { runWorkflow } from "./orchestrator";
import { runWorkflowDynamic } from "./workflowRunner";
import { Workflow } from "./workflowTypes";
import {
  createSession,
  recordFrame,
  updateSessionCost,
  getSession,
  getSessionByShareToken,
  createShareToken,
  listSessions,
} from "./sessionStore";
import { db } from "./db";
import { hashPassword, verifyPassword, signToken, protect } from "./auth";

const app = express();
const PORT = 4000;

app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

const server = app.listen(PORT, () =>
  console.log(`OrbiAgents server running on http://localhost:${PORT}`)
);

const wss = new WebSocketServer({ server });

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

let agents: Agent[] = [
  makeAgent("1", "Orbi-Alpha",   90,  90),  // Planner   — top-left desk
  makeAgent("2", "Orbi-Beta",   330, 190),  // Coder     — center desk
  makeAgent("3", "Orbi-Gamma",  580, 110),  // Tester    — top-right desk
  makeAgent("4", "Orbi-Delta",  210, 330),  // Reviewer  — bottom-left desk
  makeAgent("5", "Orbi-Epsilon",460, 300),  // Debugger  — bottom-center desk
];

let workflowRunning = false;
let activeSessionId: string | null = null;

// ── Broadcast ─────────────────────────────────────────────────────
function broadcast(data: Agent[]) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(payload);
  });
}

function updateAgent(id: string, patch: Partial<Agent>) {
  agents = agents.map((a) => {
    if (a.id !== id) return a;
    const newLogs =
      patch.logs != null ? [...patch.logs, ...a.logs].slice(0, 20) : a.logs;
    return { ...a, ...patch, logs: newLogs };
  });
  broadcast(agents);
  if (activeSessionId) recordFrame(activeSessionId, agents);
}

// ── Random simulation ─────────────────────────────────────────────
const SIM_STATES: AgentState[] = ["idle", "thinking", "coding", "done"];
const SIM_TASKS: Record<string, string[]> = {
  idle: ["Waiting for task...", "Standing by", "Ready"],
  thinking: ["Planning architecture", "Analyzing requirements", "Reviewing codebase"],
  coding: ["Writing components", "Implementing handler", "Fixing type errors"],
  testing: ["Running test suite", "Checking coverage"],
  reviewing: ["Reviewing PR", "Checking patterns"],
  debugging: ["Tracing errors", "Fixing issues"],
  done: ["Feature complete", "PR ready", "Tests passing"],
};
const SIM_ACTIONS: Record<string, string[]> = {
  idle: ["Checked queue", "Pinged server"],
  thinking: ["Read 14 files", "Searched codebase"],
  coding: ["Wrote 42 lines", "Ran type check"],
  testing: ["Ran 20 tests", "Checked snapshots"],
  reviewing: ["Flagged 2 issues", "Approved PR"],
  debugging: ["Fixed 3 bugs", "Added null checks"],
  done: ["Committed changes", "Pushed branch"],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

setInterval(() => {
  if (workflowRunning) return;
  let changed = false;
  agents = agents.map((a) => {
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
  if (changed) broadcast(agents);
}, 2000);

// ── Auth ───────────────────────────────────────────────────────────
app.post("/signup", async (req, res) => {
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

app.post("/login", async (req, res) => {
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
  const { name, data } = req.body as { name?: string; data?: unknown };
  if (!name || !data) { res.status(400).json({ error: "name and data required" }); return; }
  const saved = await db.savedWorkflow.create({
    data: { name, data: JSON.stringify(data), userId: req.userId! },
  });
  res.status(201).json({ id: saved.id, name: saved.name, createdAt: saved.createdAt });
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

app.delete("/workflows/:id", protect, async (req, res) => {
  const deleted = await db.savedWorkflow.deleteMany({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (deleted.count === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ── AI workflow — fixed planner→coder ─────────────────────────────
app.post("/run", async (req, res) => {
  const { task } = req.body as { task?: string };
  if (!task?.trim()) { res.status(400).json({ error: "task is required" }); return; }
  if (workflowRunning) { res.status(409).json({ error: "Workflow already running" }); return; }

  const sessionId = Date.now().toString();
  createSession(sessionId, task.trim());
  activeSessionId = sessionId;
  workflowRunning = true;
  res.status(202).json({ status: "started", sessionId });

  try {
    const result = await runWorkflow(task.trim(), updateAgent);
    updateSessionCost(sessionId, result.totalCostUsd);
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN)
        c.send(JSON.stringify({ type: "result", sessionId, ...result }));
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN)
        c.send(JSON.stringify({ type: "error", message: msg }));
    });
    agents = agents.map((a) => ({ ...a, state: "idle" as AgentState, task: "Ready" }));
    broadcast(agents);
  } finally {
    workflowRunning = false;
    activeSessionId = null;
  }
});

// ── Dynamic workflow ──────────────────────────────────────────────
app.post("/workflow", async (req, res) => {
  const { workflow, task } = req.body as { workflow?: Workflow; task?: string };
  if (!workflow || !task?.trim()) {
    res.status(400).json({ error: "workflow and task required" }); return;
  }
  if (workflowRunning) { res.status(409).json({ error: "Workflow already running" }); return; }

  const sessionId = Date.now().toString();
  createSession(sessionId, task.trim());
  activeSessionId = sessionId;
  workflowRunning = true;
  res.status(202).json({ status: "started", sessionId });

  try {
    const result = await runWorkflowDynamic(workflow, task.trim(), updateAgent);
    updateSessionCost(sessionId, result.totalCostUsd);
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN)
        c.send(JSON.stringify({ type: "workflow-result", sessionId, outputs: result.outputs, totalCostUsd: result.totalCostUsd }));
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    wss.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN)
        c.send(JSON.stringify({ type: "error", message: msg }));
    });
    agents = agents.map((a) => ({ ...a, state: "idle" as AgentState, task: "Ready" }));
    broadcast(agents);
  } finally {
    workflowRunning = false;
    activeSessionId = null;
  }
});

// ── Replay API ─────────────────────────────────────────────────────
app.get("/sessions", (_req, res) => {
  res.json(listSessions());
});

app.get("/replay/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(session);
});

// Create share link (auth required to share your own sessions)
app.post("/replay/:id/share", (_req, res) => {
  try {
    const token = createShareToken(_req.params.id);
    const url = `http://localhost:3000/replay/${token}`;
    res.json({ token, url });
  } catch {
    res.status(404).json({ error: "Session not found" });
  }
});

// Public replay via share token — no auth needed
app.get("/replay/public/:token", (req, res) => {
  const session = getSessionByShareToken(req.params.token);
  if (!session) { res.status(404).json({ error: "Share link invalid or expired" }); return; }
  res.json(session);
});

// ── WebSocket ──────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  ws.send(JSON.stringify(agents));

  ws.on("message", (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString());
      if (msg.type === "pause") {
        agents = agents.map((a) => a.id === msg.agentId ? { ...a, paused: true } : a);
      } else if (msg.type === "resume") {
        agents = agents.map((a) => a.id === msg.agentId ? { ...a, paused: false } : a);
      }
      broadcast(agents);
    } catch { /* ignore malformed */ }
  });
});
