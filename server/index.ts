import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { Agent, AgentState, ClientMessage } from "./types";

const app = express();
const PORT = 4000;

const server = app.listen(PORT, () => {
  console.log(`OrbiAgents server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

const STATES: AgentState[] = ["idle", "thinking", "coding", "done"];

const TASKS: Record<AgentState, string[]> = {
  idle: ["Waiting for task...", "Standing by", "Ready"],
  thinking: [
    "Planning architecture",
    "Analyzing requirements",
    "Reviewing codebase",
    "Designing API schema",
  ],
  coding: [
    "Writing dashboard.tsx",
    "Implementing WebSocket handler",
    "Building AgentCard component",
    "Fixing type errors",
    "Updating state machine",
  ],
  done: [
    "Feature complete",
    "PR ready for review",
    "Tests passing",
    "Deployed to staging",
  ],
};

const ACTIONS: Record<AgentState, string[]> = {
  idle: ["Checked queue", "Pinged server", "Loaded config"],
  thinking: ["Read 14 files", "Searched codebase", "Fetched docs"],
  coding: ["Wrote 42 lines", "Edited 3 files", "Ran type check"],
  done: ["Committed changes", "Pushed branch", "Notified team"],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let agents: Agent[] = [
  {
    id: "1",
    name: "Orbi-Alpha",
    state: "idle",
    task: pick(TASKS.idle),
    paused: false,
    tokensUsed: 0,
    lastAction: "Initialized",
    x: 80,
    y: 80,
  },
  {
    id: "2",
    name: "Orbi-Beta",
    state: "idle",
    task: pick(TASKS.idle),
    paused: false,
    tokensUsed: 0,
    lastAction: "Initialized",
    x: 320,
    y: 180,
  },
];

function broadcast(data: Agent[]) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

setInterval(() => {
  let changed = false;

  agents = agents.map((agent) => {
    if (agent.paused) return agent;

    const newState = pick(STATES);
    const tokenDelta = Math.floor(Math.random() * 800) + 100;

    changed = true;
    return {
      ...agent,
      state: newState,
      task: pick(TASKS[newState]),
      lastAction: pick(ACTIONS[newState]),
      tokensUsed: agent.tokensUsed + tokenDelta,
    };
  });

  if (changed) broadcast(agents);
}, 2000);

wss.on("connection", (ws) => {
  ws.send(JSON.stringify(agents));

  ws.on("message", (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString());

      if (msg.type === "pause") {
        agents = agents.map((a) =>
          a.id === msg.agentId ? { ...a, paused: true } : a
        );
      } else if (msg.type === "resume") {
        agents = agents.map((a) =>
          a.id === msg.agentId ? { ...a, paused: false } : a
        );
      }

      broadcast(agents);
    } catch {
      // ignore malformed messages
    }
  });
});
