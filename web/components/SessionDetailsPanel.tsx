"use client";

import { Session } from "@/lib/types";

interface Props {
  session: Session;
  compact?: boolean;
  onClose: () => void;
  onReplay: (sessionId: string) => void;
  onShare: (sessionId: string) => Promise<void>;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCost(cost?: number): string {
  if (cost == null) return "—";
  return cost >= 0.01 ? `$${cost.toFixed(3)}` : `$${cost.toFixed(5)}`;
}

export default function SessionDetailsPanel({
  session,
  compact = false,
  onClose,
  onReplay,
  onShare,
}: Props) {
  const chrome = {
    bg: "#0F172A",
    bgMid: "#111827",
    card: "#1F2937",
    border: "#374151",
    text: "#E5E7EB",
    textMuted: "#9CA3AF",
    accent: "#3B82F6",
  };
  const stateTone: Record<string, string> = {
    idle: "#9CA3AF",
    thinking: "#F59E0B",
    coding: "#3B82F6",
    testing: "#22C55E",
    reviewing: "#F59E0B",
    debugging: "#EF4444",
    done: "#22C55E",
  };
  const firstFrame = session.frames[0];
  const lastFrame = session.frames[session.frames.length - 1];
  const durationMs =
    firstFrame && lastFrame ? Math.max(0, lastFrame.timestamp - firstFrame.timestamp) : 0;
  const finalAgents = lastFrame?.agents ?? [];
  const analytics = finalAgents
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      tokens: agent.tokensUsed,
      input: agent.inputTokens,
      output: agent.outputTokens,
      cost: agent.costUsd,
    }))
    .sort((a, b) => b.tokens - a.tokens);
  const maxTokens = Math.max(1, ...analytics.map((agent) => agent.tokens));

  return (
    <aside
      style={{
        width: compact ? 272 : 320,
        flexShrink: 0,
        height: "100vh",
        background: chrome.bg,
        borderLeft: `1px solid ${chrome.border}`,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          borderBottom: `1px solid ${chrome.border}`,
          background: chrome.bgMid,
        }}
      >
        <div>
          <div style={{ color: chrome.text, fontSize: 18, fontWeight: 600 }}>
            SESSION DETAILS
          </div>
          <div style={{ color: chrome.textMuted, fontSize: 14 }}>
            Final state and replay metadata
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: chrome.textMuted, cursor: "pointer", fontSize: 16 }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{ color: chrome.text, fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
          {session.task}
        </div>

        <DetailRow label="Created">{formatDate(session.createdAt)}</DetailRow>
        <DetailRow label="Frames">{session.frames.length.toString()}</DetailRow>
        <DetailRow label="Duration">{durationMs > 0 ? `${Math.round(durationMs / 100) / 10}s` : "—"}</DetailRow>
        <DetailRow label="Cost">{formatCost(session.totalCostUsd)}</DetailRow>
        <DetailRow label="Provider">{session.provider?.toUpperCase() ?? "—"}</DetailRow>

        <div style={{ marginTop: 18 }}>
          <div style={{ color: chrome.textMuted, fontSize: 12, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase", fontWeight: 700 }}>
            SESSION ANALYTICS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analytics.map((agent) => (
              <div
                key={agent.id}
                style={{
                  background: chrome.card,
                  border: `1px solid ${chrome.border}`,
                  borderRadius: 12,
                  padding: compact ? 10 : 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div style={{ color: chrome.text, fontSize: 14, fontWeight: 600 }}>{agent.name}</div>
                  <div style={{ color: chrome.textMuted, fontSize: 12 }}>{agent.tokens.toLocaleString()} tokens</div>
                </div>
                <div style={{ marginTop: 8, height: 6, background: chrome.bgMid, borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${(agent.tokens / maxTokens) * 100}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #2563EB, #60A5FA)",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8, fontSize: 12, color: chrome.textMuted }}>
                  <span>↓ {agent.input.toLocaleString()}</span>
                  <span>↑ {agent.output.toLocaleString()}</span>
                  <span>{formatCost(agent.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ color: chrome.textMuted, fontSize: 12, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase", fontWeight: 700 }}>
            FINAL AGENT SNAPSHOT
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {finalAgents.length === 0 ? (
              <div style={{ color: chrome.textMuted, fontSize: 14 }}>
                No frames were recorded for this session.
              </div>
            ) : (
              finalAgents.map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    background: chrome.card,
                    border: `1px solid ${chrome.border}`,
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ color: chrome.text, fontSize: 14, fontWeight: 600 }}>{agent.name}</div>
                    <div style={{ color: stateTone[agent.state] ?? chrome.textMuted, fontSize: 12, fontWeight: 700 }}>
                      {agent.state.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ color: chrome.text, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
                    {agent.task}
                  </div>
                  <div style={{ color: chrome.textMuted, fontSize: 12, marginTop: 6 }}>
                    {agent.lastAction}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "16px", borderTop: `1px solid ${chrome.border}`, display: "flex", gap: 8 }}>
        <button
          onClick={() => onReplay(session.id)}
          style={{
            flex: 1,
            minHeight: 40,
            background: "#2563EB",
            border: `1px solid #1D4ED8`,
            borderRadius: 8,
            color: "#F8FAFC",
            fontSize: 14,
            fontWeight: 600,
            padding: "0 12px",
            cursor: "pointer",
          }}
        >
          ▶ REPLAY
        </button>
        <button
          onClick={() => void onShare(session.id)}
          style={{
            flex: 1,
            background: chrome.bgMid,
            minHeight: 40,
            border: `1px solid ${chrome.border}`,
            borderRadius: 8,
            color: chrome.text,
            fontSize: 14,
            fontWeight: 500,
            padding: "0 12px",
            cursor: "pointer",
          }}
        >
          SHARE
        </button>
      </div>
    </aside>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: "#9CA3AF", fontSize: 12, letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ color: "#E5E7EB", fontSize: 14 }}>{children}</div>
    </div>
  );
}
