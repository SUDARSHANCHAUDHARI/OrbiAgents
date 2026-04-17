"use client";

import { useState } from "react";
import { SessionMeta } from "@/lib/types";

interface Props {
  sessions: SessionMeta[];
  loading: boolean;
  activeSessionId?: string | null;
  onReplay: (sessionId: string) => void;
  onShare: (sessionId: string) => Promise<void>;
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
  onReplay,
  onShare,
  onRefresh,
}: Props) {
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
      className="w-[300px] shrink-0"
      style={{
        background: "#120d08",
        borderLeft: "3px solid #3D2409",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "2px solid #3D2409",
          background: "#1a1208",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ color: "#E9D5FF", fontSize: 10, letterSpacing: "0.1em", fontFamily: "monospace" }}>
            SESSION LOG
          </div>
          <div style={{ color: "#7A5230", fontSize: 8, fontFamily: "monospace" }}>
            Replay and share recent runs
          </div>
        </div>
        <button
          onClick={() => void onRefresh()}
          style={{
            background: "#1C1208",
            border: "2px solid #4A2F14",
            color: "#A78BFA",
            fontFamily: "monospace",
            fontSize: 7,
            letterSpacing: "0.08em",
            padding: "5px 8px",
            cursor: "pointer",
          }}
        >
          ↻ REFRESH
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div className="orbi-shimmer-bar" style={{ height: 72, borderRadius: 12, border: "2px solid #3D2409" }} />
        ) : sessions.length === 0 ? (
          <div
            style={{
              border: "2px dashed #3D2409",
              color: "#7A5230",
              fontFamily: "monospace",
              fontSize: 8,
              padding: 16,
              textAlign: "center",
            }}
          >
            No sessions yet. Run a task and it will show up here.
          </div>
        ) : (
          sessions.map((session) => {
            const active = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                style={{
                  background: active ? "#21120d" : "#17100b",
                  border: `2px solid ${active ? "#7C3AED" : "#3D2409"}`,
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  boxShadow: active ? "0 0 0 1px #A78BFA33" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: "#F5CBA7",
                        fontFamily: "monospace",
                        fontSize: 8,
                        lineHeight: 1.6,
                        wordBreak: "break-word",
                      }}
                    >
                      {session.task}
                    </div>
                    <div style={{ color: "#7A5230", fontFamily: "monospace", fontSize: 7 }}>
                      {formatDate(session.createdAt)}
                    </div>
                  </div>
                  <div
                    style={{
                      color: "#FCD34D",
                      fontFamily: "monospace",
                      fontSize: 7,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCost(session.totalCostUsd)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => onReplay(session.id)}
                    style={{
                      flex: 1,
                      background: "#2e1065",
                      border: "2px solid #7C3AED",
                      color: "#C4B5FD",
                      fontFamily: "monospace",
                      fontSize: 7,
                      padding: "5px 7px",
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
                      background: "#1C1208",
                      border: "2px solid #4A2F14",
                      color: "#A78BFA",
                      fontFamily: "monospace",
                      fontSize: 7,
                      padding: "5px 7px",
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
