"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Agent,
  ClientMessage,
  Provider,
  RuntimeId,
  Session,
  SessionMeta,
  Workflow,
  WorkflowEvent,
  WorkflowStepResult,
} from "@/lib/types";
import {
  authHeaders,
  clearToken,
  createReplayShareLink,
  getSessionDetails,
  getToken,
  listProviders,
  listRuntimes,
  listSessions,
} from "@/lib/auth";
import { getApiBaseUrl, getWebSocketBaseUrl } from "@/lib/config";
import { useAlerts } from "@/lib/useAlerts";
import { getUsage, UsageStats } from "@/lib/auth";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { estimateRunCost, formatEstimate } from "@/lib/costEstimate";
import LayoutEditor from "@/components/LayoutEditor";
import SidePanel from "@/components/SidePanel";
import ResultPanel from "@/components/ResultPanel";
import ReplayBar, { ReplaySpeed } from "@/components/ReplayBar";
import WorkflowBuilder from "@/components/WorkflowBuilder";
import SessionHistoryPanel from "@/components/SessionHistoryPanel";
import SessionDetailsPanel from "@/components/SessionDetailsPanel";
import AlertSettings from "@/components/AlertSettings";
import ShareModal from "@/components/ShareModal";
import AgentLogsPanel from "@/components/AgentLogsPanel";
import WorkflowActivityPanel from "@/components/WorkflowActivityPanel";
import WorkspaceReviewPanel from "@/components/WorkspaceReviewPanel";
import AgentContextPanel from "@/components/AgentContextPanel";
import WorkflowProposalPanel from "@/components/WorkflowProposalPanel";
import { eventsThroughFrame, replayDelay } from "@/lib/replayTiming";

interface WorkflowResult {
  sessionId: string;
  steps: WorkflowStepResult[];
  totalCostUsd?: number;
  runtimeId?: RuntimeId;
}

const DEFAULT_WORKFLOW: Workflow = {
  nodes: [
    { id: "planner-default", type: "planner", label: "Planner" },
    { id: "coder-default", type: "coder", label: "Coder" },
  ],
  edges: [{ from: "planner-default", to: "coder-default" }],
};

export default function Home() {
  const sky = {
    pageBg: "var(--app-bg)",
    hudBg: "#0F172A",
    hudBgAlt: "#1F2937",
    border: "#374151",
    borderSoft: "#374151",
    text: "#E5E7EB",
    textMuted: "#9CA3AF",
    primary: "#2563EB",
    primaryText: "#F8FAFC",
    dangerBg: "#7F1D1D",
    dangerBorder: "#EF4444",
  };
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow>(DEFAULT_WORKFLOW);
  const [isAuthed, setIsAuthed] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("anthropic");
  const [providersLoading, setProvidersLoading] = useState(false);
  const [runtimes, setRuntimes] = useState<RuntimeId[]>(["provider-api"]);
  const [selectedRuntime, setSelectedRuntime] = useState<RuntimeId>("provider-api");
  const [useMemory, setUseMemory] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([]);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // Replay state — declared before any early return (rules of hooks)
  const [replaySession, setReplaySession] = useState<Session | null>(null);
  const [replayFrame, setReplayFrame] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayBookmarks, setReplayBookmarks] = useState<number[]>([]);
  const [replayEventFilter, setReplayEventFilter] = useState("all");
  const replayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replaySpeedRef = useRef<ReplaySpeed>(1);
  const replayIndexRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const liveAgentsRef = useRef<Agent[]>([]);
  const { checkAgents, alertWorkflowError, resetAlertState } = useAlerts();

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
        checkAgents(agentList);
        if (!replayRef.current) {
          setAgents(agentList);
          setSelected((prev) =>
            prev ? agentList.find((a) => a.id === prev.id) ?? null : null
          );
        }
        return;
      }

      if (data.type === "workflow-event") {
        const event = data.event as WorkflowEvent;
        setWorkflowEvents((previous) => [...previous, event].slice(-100));
      } else if (data.type === "result") {
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
          runtimeId: "provider-api",
        });
        setRunning(false);
        setStopping(false);
        void loadSessions();
        void loadUsage();
      } else if (data.type === "workflow-result") {
        setResult({
          sessionId: data.sessionId as string,
          steps: (data.steps as WorkflowStepResult[] | undefined) ?? [],
          totalCostUsd: data.totalCostUsd as number | undefined,
          runtimeId: (data.runtimeId as RuntimeId | undefined) ?? "provider-api",
        });
        setRunning(false);
        setStopping(false);
        void loadSessions();
        void loadUsage();
      } else if (data.type === "stopped") {
        setRunning(false);
        setStopping(false);
        setResult(null);
        setSelectedSession(null);
        setHistoryMessage((data.message as string | undefined) ?? "Workflow stopped");
        void loadSessions();
      } else if (data.type === "error") {
        const msg = data.message as string;
        setError(msg);
        alertWorkflowError(msg);
        setRunning(false);
        setStopping(false);
      }
    };

    return () => ws.close();
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    void loadProviders();
    void loadRuntimes();
    void loadSessions();
    void loadUsage();
  }, [isAuthed]);

  useEffect(() => {
    if (!historyMessage) return;
    const timeout = setTimeout(() => setHistoryMessage(null), 3000);
    return () => clearTimeout(timeout);
  }, [historyMessage]);

  const isReplaying = replaySession !== null;
  const replayEventTypes = Array.from(new Set(replaySession?.events?.map((event) => event.type) ?? []));
  const replayVisibleEvents = replaySession ? eventsThroughFrame(replaySession.events ?? [], replaySession.frames[replayFrame - 1], replayFrame === replaySession.frames.length).filter((event) => replayEventFilter === "all" || event.type === replayEventFilter) : [];

  useKeyboardShortcuts({
    enabled: isAuthed,
    onRun: () => { if (!running && !isReplaying) { showBuilder ? void handleWorkflowRun() : void handleRun(); } },
    onStop: () => { if (running) void handleStopRun(); else if (isReplaying) stopReplay(); },
    onTogglePause: () => {
      if (selected) {
        selected.paused ? send({ type: "resume", agentId: selected.id }) : send({ type: "pause", agentId: selected.id });
      }
    },
    onClosePanel: () => {
      if (selected) setSelected(null);
      else if (result) setResult(null);
      else if (selectedSession) setSelectedSession(null);
      else if (isReplaying) stopReplay();
    },
    onToggleLogs: () => setShowLogs((v) => !v),
  });

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

  async function loadRuntimes() {
    try {
      const data = await listRuntimes();
      setRuntimes(data.runtimes);
      setSelectedRuntime((current) => data.runtimes.includes(current) ? current : data.default);
    } catch {
      setRuntimes(["provider-api"]);
      setSelectedRuntime("provider-api");
    }
  }

  async function loadUsage() {
    try {
      const data = await getUsage();
      setUsage(data);
    } catch {
      // non-fatal
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
    setStopping(false);
    setResult(null);
    setError(null);
    setWorkflowEvents([]);
    resetAlertState();

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
    setStopping(false);
    setResult(null);
    setError(null);
    setWorkflowEvents([]);
    resetAlertState();

    try {
      const res = await fetch(`${getApiBaseUrl()}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ workflow, task: task.trim(), provider: selectedProvider, runtimeId: selectedRuntime, memory: { enabled: useMemory } }),
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
      setReplayBookmarks([]); setReplayEventFilter("all");
      setSelected(null);
      setResult(null);
      setSelectedSession(null);

      replaySpeedRef.current = replaySpeed;
      playReplay(session, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start replay");
    }
  }

  async function handleShareSession(sessionId: string) {
    try {
      const data = await createReplayShareLink(sessionId);
      setShareUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create share link");
    }
  }

  async function handleInspectSession(sessionId: string) {
    setDetailsLoading(true);
    setError(null);
    try {
      const session = await getSessionDetails(sessionId);
      setSelected(null);
      setResult(null);
      setSelectedSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load session");
    } finally {
      setDetailsLoading(false);
    }
  }

  function stopReplay() {
    clearReplayTimer();
    setReplaySession(null);
    setReplayFrame(0);
    setReplayPlaying(false);
    setAgents(liveAgentsRef.current);
  }

  function clearReplayTimer() {
    if (replayRef.current) clearTimeout(replayRef.current as unknown as ReturnType<typeof setTimeout>);
    replayRef.current = null;
  }

  function showReplayFrame(session: Session, index: number) {
    const safeIndex = Math.max(0, Math.min(index, session.frames.length - 1));
    replayIndexRef.current = safeIndex; setAgents(session.frames[safeIndex].agents); setReplayFrame(safeIndex + 1);
  }

  function playReplay(session: Session, startIndex: number) {
    clearReplayTimer(); setReplayPlaying(true);
    let index = Math.max(0, Math.min(startIndex, session.frames.length - 1));
    const tick = () => {
      showReplayFrame(session, index);
      if (index >= session.frames.length - 1) { replayRef.current = null; setReplayPlaying(false); return; }
      const delay = replayDelay(session.frames, index, replaySpeedRef.current); index += 1;
      replayRef.current = setTimeout(tick, delay) as unknown as ReturnType<typeof setInterval>;
    };
    tick();
  }

  function seekReplay(frame: number) {
    if (!replaySession) return;
    clearReplayTimer(); setReplayPlaying(false); showReplayFrame(replaySession, frame - 1);
  }

  function toggleReplayPlaying() {
    if (!replaySession) return;
    if (replayPlaying) { clearReplayTimer(); setReplayPlaying(false); }
    else playReplay(replaySession, replayIndexRef.current >= replaySession.frames.length - 1 ? 0 : replayIndexRef.current);
  }

  function handleReplaySpeedChange(speed: ReplaySpeed) {
    setReplaySpeed(speed);
    replaySpeedRef.current = speed;
  }

  async function handleStopRun() {
    if (!running || stopping) return;
    setStopping(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/workflow/stop`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Could not stop workflow");
      }
    } catch (err) {
      setStopping(false);
      setError(err instanceof Error ? err.message : "Could not stop workflow");
    }
  }

  const thinkingCount = agents.filter((agent) => agent.state === "thinking").length;
  const codingCount = agents.filter((agent) => agent.state === "coding").length;
  const activeSummary = [
    { label: `${agents.length} AGENTS`, color: "#E5E7EB" },
    { label: `${thinkingCount} THINKING`, color: "#FDE68A" },
    { label: `${codingCount} CODING`, color: "#BFDBFE" },
  ];

  return (
    <div
      className="flex h-screen text-white"
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        color: "#ffffff",
        background: sky.pageBg,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
        }}
      >

        {/* ── Header — pixel art HUD ─────────────────────────── */}
        <header
          className="relative flex items-center justify-between gap-4 z-20 px-4 py-2"
          style={{
            position: "relative",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            padding: "12px 18px",
            flexShrink: 0,
            background: sky.hudBg,
            minHeight: 64,
            borderBottom: `1px solid ${sky.border}`,
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.18)",
          }}
        >
          {/* Logo */}
          <div
            className="flex items-center gap-2 shrink-0"
            style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
          >
            <div
              style={{
                width: 36, height: 36,
                background: "#111827",
                border: `1px solid ${sky.border}`,
                borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700,
                color: sky.text,
              }}
            >O</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: sky.text, letterSpacing: "-0.01em" }}>
                OrbiAgents
              </div>
              <div style={{ fontSize: 12, color: sky.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                WORKSPACE
              </div>
            </div>
            {showBuilder && (
              <div style={{ background: sky.hudBgAlt, border: `1px solid ${sky.borderSoft}`, borderRadius: 8, padding: "0 12px", minHeight: 40, display: "flex", alignItems: "center" }}>
                <label htmlFor="runtime-select" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Workflow runtime</label>
                <select
                  id="runtime-select"
                  value={selectedRuntime}
                  onChange={(event) => setSelectedRuntime(event.target.value as RuntimeId)}
                  disabled={running || isReplaying}
                  title="Execution runtime for dynamic workflows"
                  style={{ background: "transparent", border: "none", color: sky.text, fontSize: 14, fontWeight: 500, outline: "none" }}
                >
                  {runtimes.map((runtimeId) => (
                    <option key={runtimeId} value={runtimeId} style={{ color: "#111827" }}>
                      {runtimeId === "provider-api" ? "API" : runtimeId === "codex-cli" ? "CODEX CLI" : "CLAUDE CLI"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showBuilder && <label style={{ color: sky.textMuted, fontSize: 12 }}><input type="checkbox" checked={useMemory} onChange={(event) => setUseMemory(event.target.checked)} disabled={running || isReplaying} /> Use memory</label>}
          </div>

          {/* Task input */}
          <div
            className="flex-1 flex items-center gap-2 max-w-2xl"
            style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, maxWidth: "52rem", minWidth: 0 }}
          >
            <input
              className="orbi-input"
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (showBuilder ? handleWorkflowRun() : handleRun())}
              placeholder="Give the agents a task..."
              disabled={running || isReplaying}
              style={{
                flex: 1,
                minHeight: 40,
                background: sky.hudBgAlt,
                border: `1px solid ${sky.borderSoft}`,
                borderRadius: 8,
                padding: "0 16px",
                color: sky.text,
                fontSize: 16,
                fontWeight: 500,
                outline: "none",
                opacity: running || isReplaying ? 0.4 : 1,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px transparent",
              }}
            />
            {!showBuilder && (
              <>
                <button
                  className="orbi-control"
                  onClick={handleRun}
                  disabled={running || stopping || !task.trim() || isReplaying}
                  style={{
                    minHeight: 40,
                    background: running ? "#2A6E96" : sky.primary,
                    border: "1px solid",
                    borderColor: running ? sky.borderSoft : sky.border,
                    borderRadius: 8,
                    color: sky.primaryText,
                    fontSize: 16,
                    fontWeight: 600,
                    padding: "0 18px",
                    cursor: running || stopping || !task.trim() ? "not-allowed" : "pointer",
                    opacity: !task.trim() ? 0.4 : 1,
                    whiteSpace: "nowrap",
                    boxShadow: running ? "none" : "0 10px 20px rgba(37,99,235,0.24)",
                  }}
                >
                  {stopping ? "STOPPING..." : running ? "RUNNING..." : "▶ RUN"}
                </button>
                {task.trim() && !running && !isReplaying && (
                  <div
                    title="Estimated cost (rough, based on task length)"
                    style={{
                      fontSize: 11,
                      color: sky.textMuted,
                      whiteSpace: "nowrap",
                      fontFamily: "monospace",
                      padding: "0 4px",
                    }}
                  >
                    {formatEstimate(estimateRunCost(task, selectedProvider))}
                  </div>
                )}
              </>
            )}
            <div
              style={{
                background: sky.hudBgAlt,
                border: `1px solid ${sky.borderSoft}`,
                borderRadius: 8,
                padding: "0 12px",
                opacity: running || isReplaying ? 0.5 : 1,
                minHeight: 40,
                display: "flex",
                alignItems: "center",
              }}
            >
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as Provider)}
                disabled={running || isReplaying || providersLoading || providers.length === 0}
                style={{
                  background: "transparent",
                  border: "none",
                  color: sky.text,
                  fontSize: 16,
                  fontWeight: 500,
                  padding: "0",
                  outline: "none",
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
          <div
            className="flex items-center gap-3 shrink-0"
            style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}
          >
            <button
              className="orbi-control"
              onClick={() => setShowContext((value) => !value)}
              style={{ minHeight: 40, background: showContext ? "#374151" : sky.hudBgAlt, border: `1px solid ${sky.borderSoft}`, color: showContext ? sky.text : sky.textMuted, borderRadius: 8, fontSize: 14, fontWeight: 500, padding: "0 14px", cursor: "pointer" }}
            >CONTEXT</button>

            <button
              className="orbi-control"
              onClick={() => setShowWorkspaces((value) => !value)}
              style={{ minHeight: 40, background: showWorkspaces ? "#374151" : sky.hudBgAlt, border: `1px solid ${sky.borderSoft}`, color: showWorkspaces ? sky.text : sky.textMuted, borderRadius: 8, fontSize: 14, fontWeight: 500, padding: "0 14px", cursor: "pointer" }}
            >
              WORKSPACES
            </button>

            <button
              className="orbi-control"
              onClick={() => setShowBuilder((v) => !v)}
              disabled={running || stopping || isReplaying}
              style={{
                minHeight: 40,
                background: showBuilder ? "#374151" : sky.hudBgAlt,
                border: "1px solid",
                borderColor: showBuilder ? sky.border : sky.borderSoft,
                color: showBuilder ? sky.text : sky.textMuted,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                padding: "0 16px",
                cursor: "pointer",
                opacity: running || stopping || isReplaying ? 0.3 : 1,
              }}
            >
              ⬡ WORKFLOW
            </button>
            {showBuilder && <button className="orbi-control" onClick={() => setShowProposal(true)} disabled={running || isReplaying} style={{minHeight:40,background:"#4C1D95",border:"1px solid #7C3AED",color:"white",borderRadius:8,padding:"0 14px"}}>ORBI-PRIME</button>}

            <button
              className="orbi-control"
              onClick={() => setShowLogs((v) => !v)}
              style={{
                minHeight: 40,
                background: showLogs ? "#374151" : sky.hudBgAlt,
                border: `1px solid ${sky.borderSoft}`,
                color: showLogs ? sky.text : sky.textMuted,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                padding: "0 14px",
                cursor: "pointer",
              }}
            >
              ≡ LOGS
            </button>

            <button
              className="orbi-control"
              onClick={() => setShowAlertSettings(true)}
              style={{
                minHeight: 40,
                background: sky.hudBgAlt,
                border: `1px solid ${sky.borderSoft}`,
                color: sky.textMuted,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                padding: "0 14px",
                cursor: "pointer",
              }}
            >
              🔔 ALERTS
            </button>

            <button
              className="orbi-control"
              onClick={() => setCompactSidebar((value) => !value)}
              style={{
                minHeight: 40,
                background: compactSidebar ? "#374151" : sky.hudBgAlt,
                border: `1px solid ${sky.borderSoft}`,
                color: compactSidebar ? sky.text : sky.textMuted,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                padding: "0 14px",
                cursor: "pointer",
              }}
            >
              {compactSidebar ? "EXPAND" : "COMPACT"}
            </button>

            {running && !isReplaying && (
              <button
                onClick={() => void handleStopRun()}
                disabled={stopping}
                style={{
                  background: sky.dangerBg,
                  minHeight: 40,
                  border: `1px solid ${sky.dangerBorder}`,
                  borderRadius: 8,
                  color: "#FFF0F7",
                  fontSize: 16,
                  fontWeight: 600,
                  padding: "0 14px",
                  cursor: stopping ? "not-allowed" : "pointer",
                  opacity: stopping ? 0.5 : 1,
                }}
              >
                {stopping ? "..." : "■ STOP"}
              </button>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{
                background: sky.hudBgAlt,
                minHeight: 40,
                border: `1px solid ${sky.borderSoft}`,
                borderRadius: 8,
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                fontSize: 14,
                fontWeight: 500,
              }}>
                {isReplaying ? (
                  <span style={{ color: sky.text }}>▶ REPLAY</span>
                ) : stopping ? (
                  <span style={{ color: "#FFF0F7" }}>■ STOPPING</span>
                ) : running ? (
                  <span style={{ color: sky.border }}>● RUNNING</span>
                ) : (
                  <span style={{ color: "#86EFAC" }}>● READY</span>
                )}
              </div>
              {activeSummary.map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: sky.hudBgAlt,
                    minHeight: 40,
                    border: `1px solid ${sky.borderSoft}`,
                    borderRadius: 8,
                    padding: "0 12px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: 16,
                    fontWeight: 500,
                    color: item.color,
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>

            {result?.totalCostUsd != null && !running && (
              <div style={{
                background: sky.hudBgAlt,
                minHeight: 40,
                border: `1px solid ${sky.border}`,
                borderRadius: 8,
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                fontSize: 14,
                fontWeight: 500,
                color: sky.text,
              }}>
                ${result.totalCostUsd.toFixed(4)}
              </div>
            )}

            <button
              className="orbi-control"
              onClick={() => { clearToken(); router.push("/login"); }}
              style={{
                background: "transparent",
                border: `1px solid ${sky.borderSoft}`,
                minHeight: 40,
                borderRadius: 8,
                color: sky.textMuted,
                fontSize: 16,
                fontWeight: 500,
                padding: "0 14px",
                cursor: "pointer",
              }}
            >
              LOGOUT
            </button>
          </div>
        </header>

        {/* ── Daily budget bar ───────────────────────────────── */}
        {usage && (
          <div style={{ flexShrink: 0 }}>
            {(() => {
              const pct = Math.min(100, (usage.dailyCostUsd / usage.maxDailyCostUsd) * 100);
              const warn = pct >= 80;
              const barColor = pct >= 95 ? "#EF4444" : pct >= 80 ? "#F59E0B" : "#22C55E";
              return (
                <div
                  title={`Daily spend: $${usage.dailyCostUsd.toFixed(4)} / $${usage.maxDailyCostUsd.toFixed(2)} — ${usage.hourlyRuns}/${usage.maxRunsPerHour} runs this hour`}
                  style={{ position: "relative", height: 4, background: "#111827", cursor: "default" }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: barColor,
                      transition: "width 0.6s ease, background 0.4s",
                      boxShadow: warn ? `0 0 6px ${barColor}` : "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: 8,
                      top: 6,
                      fontSize: 10,
                      color: warn ? barColor : "#6B7280",
                      fontWeight: 600,
                      pointerEvents: "none",
                    }}
                  >
                    ${usage.dailyCostUsd.toFixed(3)} / ${usage.maxDailyCostUsd.toFixed(2)} today
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Office floor — HTML5 Canvas game renderer ──────── */}
        <main
          className="flex-1 relative overflow-hidden"
          style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", background: "var(--map-bg)", padding: 24 }}
        >
          <LayoutEditor
            agents={agents}
            selectedId={selected?.id ?? null}
            isReplaying={isReplaying}
            workflow={workflow}
            events={isReplaying ? replayVisibleEvents : workflowEvents}
            onAgentClick={isReplaying ? () => {} : setSelected}
          />

          <WorkflowActivityPanel
            agents={agents}
            events={isReplaying ? replayVisibleEvents : workflowEvents}
          />

          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent 0px, transparent 5px, rgba(255,255,255,0.012) 5px, rgba(255,255,255,0.012) 6px)",
              zIndex: 5,
            }}
          />

          {error && (
            <div
              className="absolute z-20"
              style={{
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                background: "#7F1D1D",
                border: "1px solid #DC2626",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 14,
                fontWeight: 500,
                color: "#FECACA",
                whiteSpace: "nowrap",
                boxShadow: "0 14px 28px rgba(0,0,0,0.24)",
              }}
            >
              ✖ {error}
            </div>
          )}

          {historyMessage && !error && (
            <div
              className="absolute z-20"
              style={{
                top: 16,
                right: 16,
                background: "#14532D",
                border: "1px solid #22C55E",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
                fontWeight: 500,
                color: "#BBF7D0",
                boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
              }}
            >
              ✓ {historyMessage}
            </div>
          )}

          {showLogs && (
            <AgentLogsPanel agents={agents} onClose={() => setShowLogs(false)} />
          )}

          {showWorkspaces && <WorkspaceReviewPanel onClose={() => setShowWorkspaces(false)} />}
          {showContext && <AgentContextPanel onClose={() => setShowContext(false)} />}
          {showProposal && <WorkflowProposalPanel workflow={workflow} onApply={setWorkflow} onClose={() => setShowProposal(false)} />}

          {isReplaying && replaySession && (
            <ReplayBar
              task={replaySession.task}
              current={replayFrame}
              total={replaySession.frames.length}
              speed={replaySpeed}
              playing={replayPlaying}
              onStop={stopReplay}
              onSpeedChange={handleReplaySpeedChange}
              onTogglePlaying={toggleReplayPlaying}
              onSeek={seekReplay}
              onStep={(delta) => seekReplay(replayFrame + delta)}
              bookmarked={replayBookmarks.includes(replayFrame)}
              onToggleBookmark={() => setReplayBookmarks((current) => current.includes(replayFrame) ? current.filter((frame) => frame !== replayFrame) : [...current, replayFrame].sort((a,b)=>a-b))}
              eventTypes={replayEventTypes}
              eventFilter={replayEventFilter}
              onEventFilterChange={setReplayEventFilter}
            />
          )}
        </main>

        {/* Workflow builder panel (slides in at bottom) */}
        {showBuilder && (
          <WorkflowBuilder
            workflow={workflow}
            onChange={setWorkflow}
            onRun={handleWorkflowRun}
            running={running || stopping}
          />
        )}
      </div>

      {/* Side panels */}
      {result && !selected && !isReplaying && (
        <ResultPanel
          result={result}
          compact={compactSidebar}
          provider={result.runtimeId === "provider-api" || !result.runtimeId ? selectedProvider : result.runtimeId}
          onClose={() => setResult(null)}
          onReplay={startReplay}
        />
      )}

      {selected && !isReplaying && (
        <SidePanel
          agent={selected}
          compact={compactSidebar}
          onClose={() => setSelected(null)}
          onPause={(id) => send({ type: "pause", agentId: id })}
          onResume={(id) => send({ type: "resume", agentId: id })}
        />
      )}

      {selectedSession && !selected && !result && !isReplaying && (
        <SessionDetailsPanel
          session={selectedSession}
          compact={compactSidebar}
          onClose={() => setSelectedSession(null)}
          onReplay={startReplay}
          onShare={handleShareSession}
        />
      )}

      {!selected && !result && !isReplaying && !selectedSession && (
        <SessionHistoryPanel
          sessions={sessions}
          loading={sessionsLoading}
          compact={compactSidebar}
          activeSessionId={null}
          selectedSessionId={null}
          onReplay={startReplay}
          onShare={handleShareSession}
          onInspect={handleInspectSession}
          onRefresh={loadSessions}
        />
      )}

      {showAlertSettings && (
        <AlertSettings onClose={() => setShowAlertSettings(false)} />
      )}

      {shareUrl && (
        <ShareModal url={shareUrl} onClose={() => setShareUrl(null)} />
      )}

      {detailsLoading && !selected && !result && !isReplaying && !selectedSession && (
        <aside
          className="w-[340px] shrink-0"
          style={{
            width: 320,
            background: "#0F172A",
            borderLeft: "1px solid #374151",
            padding: 16,
            color: "#9CA3AF",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 14,
          }}
        >
          Loading session details...
        </aside>
      )}
    </div>
  );
}
