"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Agent,
  ClientMessage,
  Provider,
  Session,
  SessionMeta,
  Workflow,
  WorkflowStepResult,
} from "@/lib/types";
import {
  authHeaders,
  clearToken,
  createReplayShareLink,
  getToken,
  listProviders,
  listSessions,
} from "@/lib/auth";
import { getApiBaseUrl, getWebSocketBaseUrl } from "@/lib/config";
import GameCanvas from "@/components/GameCanvas";
import SidePanel from "@/components/SidePanel";
import ResultPanel from "@/components/ResultPanel";
import ReplayBar from "@/components/ReplayBar";
import WorkflowBuilder from "@/components/WorkflowBuilder";
import SessionHistoryPanel from "@/components/SessionHistoryPanel";

interface WorkflowResult {
  sessionId: string;
  steps: WorkflowStepResult[];
  totalCostUsd?: number;
}

const DEFAULT_WORKFLOW: Workflow = {
  nodes: [
    { id: "planner-default", type: "planner", label: "Planner" },
    { id: "coder-default", type: "coder", label: "Coder" },
  ],
  edges: [{ from: "planner-default", to: "coder-default" }],
};

export default function Home() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow>(DEFAULT_WORKFLOW);
  const [isAuthed, setIsAuthed] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("anthropic");
  const [providersLoading, setProvidersLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);

  // Replay state — declared before any early return (rules of hooks)
  const [replaySession, setReplaySession] = useState<Session | null>(null);
  const [replayFrame, setReplayFrame] = useState(0);
  const replayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const liveAgentsRef = useRef<Agent[]>([]);

  // Auth gate — redirect to /login if no token
  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    } else {
      setIsAuthed(true);
    }
  }, [router]);

  // WebSocket — all hooks must be before any conditional return
  useEffect(() => {
    if (!isAuthed) return;
    const token = getToken();
    if (!token) return;
    const ws = new WebSocket(`${getWebSocketBaseUrl()}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data as string);

      if (Array.isArray(data)) {
        const agentList = data as Agent[];
        liveAgentsRef.current = agentList;
        if (!replayRef.current) {
          setAgents(agentList);
          setSelected((prev) =>
            prev ? agentList.find((a) => a.id === prev.id) ?? null : null
          );
        }
        return;
      }

      if (data.type === "result") {
        setResult({
          sessionId: data.sessionId as string,
          steps: [
            {
              nodeId: "planner-default",
              type: "planner",
              label: "Planner",
              output: data.plan as string,
            },
            {
              nodeId: "coder-default",
              type: "coder",
              label: "Coder",
              output: data.code as string,
            },
          ],
          totalCostUsd: data.totalCostUsd as number | undefined,
        });
        setRunning(false);
        void loadSessions();
      } else if (data.type === "workflow-result") {
        setResult({
          sessionId: data.sessionId as string,
          steps: (data.steps as WorkflowStepResult[] | undefined) ?? [],
          totalCostUsd: data.totalCostUsd as number | undefined,
        });
        setRunning(false);
        void loadSessions();
      } else if (data.type === "error") {
        setError(data.message as string);
        setRunning(false);
      }
    };

    return () => ws.close();
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    void loadProviders();
    void loadSessions();
  }, [isAuthed]);

  useEffect(() => {
    if (!historyMessage) return;
    const timeout = setTimeout(() => setHistoryMessage(null), 3000);
    return () => clearTimeout(timeout);
  }, [historyMessage]);

  if (!isAuthed) return null; // avoid flash before redirect

  async function loadProviders() {
    setProvidersLoading(true);
    try {
      const data = await listProviders();
      setProviders(data.providers);
      setSelectedProvider((prev) =>
        data.providers.includes(prev) ? prev : data.default
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load providers");
    } finally {
      setProvidersLoading(false);
    }
  }

  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const data = await listSessions();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }

  function send(msg: ClientMessage) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  // Quick run (fixed planner→coder via /run)
  async function handleRun() {
    if (!task.trim() || running) return;
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ task: task.trim(), provider: selectedProvider }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Run failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach server. Is it running?");
      setRunning(false);
    }
  }

  // Dynamic workflow run via /workflow
  async function handleWorkflowRun() {
    if (!task.trim() || running) return;
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ workflow, task: task.trim(), provider: selectedProvider }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Workflow run failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach server. Is it running?");
      setRunning(false);
    }
  }

  // ── Replay ──────────────────────────────────────────────────────
  async function startReplay(sessionId: string) {
    stopReplay();
    setError(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/replay/${sessionId}`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Replay unavailable");
      }
      const session = (await res.json()) as Session;
      if (session.frames.length === 0) {
        throw new Error("Replay has no frames yet");
      }

      setReplaySession(session);
      setReplayFrame(0);
      setSelected(null);
      setResult(null);

      let i = 0;
      const interval = setInterval(() => {
        if (i >= session.frames.length) {
          stopReplay();
          setAgents(liveAgentsRef.current);
          return;
        }
        setAgents(session.frames[i].agents);
        setReplayFrame(i + 1);
        i++;
      }, 900);

      replayRef.current = interval;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start replay");
    }
  }

  async function handleShareSession(sessionId: string) {
    try {
      const data = await createReplayShareLink(sessionId);
      await navigator.clipboard.writeText(data.url);
      setHistoryMessage("Share link copied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create share link");
    }
  }

  function stopReplay() {
    if (replayRef.current) {
      clearInterval(replayRef.current);
      replayRef.current = null;
    }
    setReplaySession(null);
    setReplayFrame(0);
    setAgents(liveAgentsRef.current);
  }

  const isReplaying = replayRef.current !== null;

  return (
    <div className="flex h-screen text-white" style={{ background: "#1a1208", fontFamily: "var(--font-pixel, monospace)" }}>
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Header — pixel art HUD ─────────────────────────── */}
        <header
          className="relative flex items-center justify-between gap-4 z-20 px-4 py-2"
          style={{
            background: "#0d0907",
            borderBottom: "3px solid #3D2409",
            boxShadow: "0 3px 0 #1C1208",
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              style={{
                width: 28, height: 28,
                background: "#7C3AED",
                border: "2px solid #A78BFA",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-pixel, monospace)",
                fontSize: 12, fontWeight: "bold",
                imageRendering: "pixelated",
                color: "#EDE9FE",
              }}
            >O</div>
            <div>
              <div style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "#E9D5FF", letterSpacing: "0.05em" }}>
                OrbiAgents
              </div>
              <div style={{ fontFamily: "var(--font-pixel)", fontSize: 5, color: "#7C3AED", letterSpacing: "0.2em" }}>
                WORKSPACE
              </div>
            </div>
          </div>

          {/* Task input */}
          <div className="flex-1 flex items-center gap-2 max-w-2xl">
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (showBuilder ? handleWorkflowRun() : handleRun())}
              placeholder="Give the agents a task..."
              disabled={running || isReplaying}
              style={{
                flex: 1,
                background: "#1C1208",
                border: "2px solid #4A2F14",
                padding: "6px 10px",
                color: "#F5CBA7",
                fontFamily: "var(--font-pixel, monospace)",
                fontSize: 7,
                outline: "none",
                letterSpacing: "0.05em",
                opacity: running || isReplaying ? 0.4 : 1,
              }}
            />
            {!showBuilder && (
              <button
                onClick={handleRun}
                disabled={running || !task.trim() || isReplaying}
                style={{
                  background: running ? "#4A2F14" : "#6D28D9",
                  border: "2px solid",
                  borderColor: running ? "#7A5230" : "#A78BFA",
                  color: "#EDE9FE",
                  fontFamily: "var(--font-pixel, monospace)",
                  fontSize: 7,
                  padding: "6px 14px",
                  cursor: running || !task.trim() ? "not-allowed" : "pointer",
                  opacity: !task.trim() ? 0.4 : 1,
                  letterSpacing: "0.1em",
                  whiteSpace: "nowrap",
                  boxShadow: running ? "none" : "0 3px 0 #3730A3",
                }}
              >
                {running ? "RUNNING..." : "▶ RUN"}
              </button>
            )}
            <div
              style={{
                background: "#1C1208",
                border: "2px solid #4A2F14",
                padding: "0 8px",
                opacity: running || isReplaying ? 0.5 : 1,
              }}
            >
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as Provider)}
                disabled={running || isReplaying || providersLoading || providers.length === 0}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#C4B5FD",
                  fontFamily: "var(--font-pixel, monospace)",
                  fontSize: 7,
                  padding: "6px 0",
                  outline: "none",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {(providers.length > 0 ? providers : [selectedProvider]).map((provider) => (
                  <option key={provider} value={provider} style={{ color: "#111827" }}>
                    {provider.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowBuilder((v) => !v)}
              disabled={running || isReplaying}
              style={{
                background: showBuilder ? "#3730A3" : "#1C1208",
                border: "2px solid",
                borderColor: showBuilder ? "#818CF8" : "#4A2F14",
                color: showBuilder ? "#C7D2FE" : "#7A5230",
                fontFamily: "var(--font-pixel, monospace)",
                fontSize: 6,
                padding: "5px 10px",
                cursor: "pointer",
                letterSpacing: "0.1em",
                opacity: running || isReplaying ? 0.3 : 1,
              }}
            >
              ⬡ WORKFLOW
            </button>

            {/* Status display */}
            <div style={{
              background: "#1C1208",
              border: "2px solid #3D2409",
              padding: "4px 8px",
              fontFamily: "var(--font-pixel, monospace)",
              fontSize: 6,
              letterSpacing: "0.05em",
            }}>
              {isReplaying ? (
                <span style={{ color: "#C084FC" }}>▶ REPLAY</span>
              ) : running ? (
                <span style={{ color: "#818CF8" }}>● RUNNING</span>
              ) : (
                <span style={{ color: "#6EE7B7" }}>● {agents.length} AGENTS</span>
              )}
            </div>

            {result?.totalCostUsd != null && !running && (
              <div style={{
                background: "#1C1208",
                border: "2px solid #92400E",
                padding: "4px 8px",
                fontFamily: "var(--font-pixel, monospace)",
                fontSize: 6,
                color: "#FCD34D",
                letterSpacing: "0.05em",
              }}>
                ${result.totalCostUsd.toFixed(4)}
              </div>
            )}

            <button
              onClick={() => { clearToken(); router.push("/login"); }}
              style={{
                background: "transparent",
                border: "1px solid #3D2409",
                color: "#7A5230",
                fontFamily: "var(--font-pixel, monospace)",
                fontSize: 6,
                padding: "4px 8px",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              LOGOUT
            </button>
          </div>
        </header>

        {/* ── Office floor — HTML5 Canvas game renderer ──────── */}
        <main className="flex-1 relative overflow-hidden" style={{ background: "#1a1208" }}>
          <GameCanvas
            agents={agents}
            selectedId={selected?.id ?? null}
            isReplaying={isReplaying}
            onAgentClick={isReplaying ? () => {} : setSelected}
          />

          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 4px)",
              zIndex: 5,
            }}
          />

          {error && (
            <div
              className="absolute z-20"
              style={{
                top: 12, left: "50%", transform: "translateX(-50%)",
                background: "#7F1D1D",
                border: "2px solid #DC2626",
                padding: "6px 14px",
                fontFamily: "monospace",
                fontSize: 7,
                color: "#FCA5A5",
                letterSpacing: "0.05em",
                whiteSpace: "nowrap",
              }}
            >
              ✖ {error}
            </div>
          )}

          {historyMessage && !error && (
            <div
              className="absolute z-20"
              style={{
                top: 12,
                right: 12,
                background: "#14532D",
                border: "2px solid #22C55E",
                padding: "6px 12px",
                fontFamily: "monospace",
                fontSize: 7,
                color: "#BBF7D0",
                letterSpacing: "0.05em",
              }}
            >
              ✓ {historyMessage}
            </div>
          )}

          {isReplaying && replaySession && (
            <ReplayBar
              task={replaySession.task}
              current={replayFrame}
              total={replaySession.frames.length}
              onStop={stopReplay}
            />
          )}
        </main>

        {/* Workflow builder panel (slides in at bottom) */}
        {showBuilder && (
          <WorkflowBuilder
            workflow={workflow}
            onChange={setWorkflow}
            onRun={handleWorkflowRun}
            running={running}
          />
        )}
      </div>

      {/* Side panels */}
      {result && !selected && !isReplaying && (
        <ResultPanel
          result={result}
          onClose={() => setResult(null)}
          onReplay={startReplay}
        />
      )}

      {selected && !isReplaying && (
        <SidePanel
          agent={selected}
          onClose={() => setSelected(null)}
          onPause={(id) => send({ type: "pause", agentId: id })}
          onResume={(id) => send({ type: "resume", agentId: id })}
        />
      )}

      {!selected && !result && !isReplaying && (
        <SessionHistoryPanel
          sessions={sessions}
          loading={sessionsLoading}
          activeSessionId={replaySession?.id ?? null}
          onReplay={startReplay}
          onShare={handleShareSession}
          onRefresh={loadSessions}
        />
      )}
    </div>
  );
}
