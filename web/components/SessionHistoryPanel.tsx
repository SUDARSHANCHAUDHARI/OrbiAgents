"use client";

import { useState } from "react";
import { SessionMeta } from "@/lib/types";

interface Props {
  sessions: SessionMeta[];
  loading: boolean;
  activeSessionId?: string | null;
  selectedSessionId?: string | null;
  compact?: boolean;
  onReplay: (sessionId: string) => void;
  onShare: (sessionId: string) => Promise<void>;
  onInspect: (sessionId: string) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
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

export default function SessionHistoryPanel({
  sessions,
  loading,
  activeSessionId,
  selectedSessionId,
  compact = false,
  onReplay,
  onShare,
  onInspect,
  onRefresh,
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
  const [sharingId, setSharingId] = useState<string | null>(null);

  async function handleShare(sessionId: string) {
    setSharingId(sessionId);
    try {
      await onShare(sessionId);
    } finally {
      setSharingId(null);
    }
  }

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
        boxShadow: "inset 1px 0 0 rgba(255,255,255,0.04), -10px 0 30px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          padding: "16px",
          borderBottom: `1px solid ${chrome.border}`,
          background: chrome.bgMid,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ color: chrome.text, fontSize: compact ? 16 : 18, fontWeight: 600 }}>
            SESSION LOG
          </div>
          <div style={{ color: chrome.textMuted, fontSize: compact ? 13 : 14 }}>
            Replay and share recent runs
          </div>
        </div>
        <button
          onClick={() => void onRefresh()}
          style={{
            background: chrome.card,
            minHeight: 40,
            border: `1px solid ${chrome.border}`,
            borderRadius: 8,
            color: chrome.text,
            fontSize: 14,
            fontWeight: 500,
            padding: "0 14px",
            cursor: "pointer",
          }}
        >
          ↻ REFRESH
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div className="orbi-shimmer-bar" style={{ height: 72, borderRadius: 12, border: `2px solid ${chrome.border}` }} />
        ) : sessions.length === 0 ? (
          <div
            style={{
              border: `1px dashed ${chrome.accent}`,
              borderRadius: 12,
              color: chrome.textMuted,
              fontSize: 14,
              padding: compact ? 14 : 16,
              textAlign: "center",
            }}
          >
            No runs yet.
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
              Start a task to build your first replay, share link, and session timeline.
            </div>
          </div>
        ) : (
          sessions.map((session) => {
            const active = session.id === activeSessionId;
            const selected = session.id === selectedSessionId;
            return (
              <div
                key={session.id}
                style={{
                  background: active || selected ? "#21739A" : chrome.card,
                  border: `1px solid ${active ? "#60A5FA" : selected ? chrome.accent : chrome.border}`,
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  boxShadow: active || selected ? "0 12px 24px rgba(0,0,0,0.18)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: chrome.text,
                        fontSize: 14,
                        fontWeight: 500,
                        lineHeight: 1.6,
                        wordBreak: "break-word",
                      }}
                    >
                      {session.task}
                    </div>
                    <div style={{ color: chrome.textMuted, fontSize: 12 }}>
                      {formatDate(session.createdAt)}
                    </div>
                    {session.provider && (
                      <div style={{ color: "#93C5FD", fontSize: 12, marginTop: 4, fontWeight: 600, textTransform: "uppercase" }}>
                        {session.provider}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      color: "#FFF3B0",
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCost(session.totalCostUsd)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => void onInspect(session.id)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      background: "#1F2937",
                      border: `1px solid ${chrome.border}`,
                      borderRadius: 8,
                      color: chrome.text,
                      fontSize: 14,
                      fontWeight: 500,
                      padding: "0 10px",
                      cursor: "pointer",
                    }}
                  >
                    DETAILS
                  </button>
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
                      padding: "0 10px",
                      cursor: "pointer",
                    }}
                  >
                    ▶ REPLAY
                  </button>
                  <button
                    onClick={() => void handleShare(session.id)}
                    disabled={sharingId === session.id}
                    style={{
                      flex: 1,
                      background: chrome.bgMid,
                      minHeight: 40,
                      border: `1px solid ${chrome.border}`,
                      borderRadius: 8,
                      color: chrome.text,
                      fontSize: 14,
                      fontWeight: 500,
                      padding: "0 10px",
                      cursor: "pointer",
                      opacity: sharingId === session.id ? 0.5 : 1,
                    }}
                  >
                    {sharingId === session.id ? "COPYING..." : "SHARE"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
