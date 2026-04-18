"use client";

import { useEffect, useRef } from "react";
import { Agent } from "@/lib/types";

interface LogEntry {
  agentId: string;
  agentName: string;
  text: string;
  ts: number;
}

interface Props {
  agents: Agent[];
  onClose: () => void;
}

const PALETTE_COLOR = ["#A78BFA", "#60A5FA", "#34D399", "#FBBF24", "#F87171"];

function agentColor(id: string): string {
  const n = parseInt(id) || 0;
  return PALETTE_COLOR[n % PALETTE_COLOR.length];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AgentLogsPanel({ agents, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLogsRef = useRef<Map<string, string[]>>(new Map());
  const entriesRef = useRef<LogEntry[]>([]);

  // Detect new log lines and append with timestamp
  const now = Date.now();
  for (const agent of agents) {
    const prev = prevLogsRef.current.get(agent.id) ?? [];
    if (agent.logs.length > prev.length) {
      const newLines = agent.logs.slice(prev.length);
      for (const line of newLines) {
        entriesRef.current.push({ agentId: agent.id, agentName: agent.name, text: line, ts: now });
      }
    }
    prevLogsRef.current.set(agent.id, [...agent.logs]);
  }
  // keep last 200 entries
  if (entriesRef.current.length > 200) entriesRef.current = entriesRef.current.slice(-200);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  const chrome = {
    bg: "rgba(11, 17, 32, 0.97)",
    border: "#374151",
    text: "#E5E7EB",
    textMuted: "#9CA3AF",
    card: "#1F2937",
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 72,
        left: "50%",
        transform: "translateX(-50%)",
        width: 640,
        maxHeight: 340,
        background: chrome.bg,
        border: `1px solid ${chrome.border}`,
        borderRadius: 14,
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        zIndex: 15,
        fontFamily: "Inter, system-ui, sans-serif",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: `1px solid ${chrome.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: chrome.text, fontSize: 13, fontWeight: 600 }}>ALL AGENTS — LIVE LOG</span>
          <span style={{ color: chrome.textMuted, fontSize: 11 }}>L to toggle</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: chrome.textMuted, cursor: "pointer", fontSize: 16 }}
        >
          ✕
        </button>
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4 }}
      >
        {entriesRef.current.length === 0 ? (
          <div style={{ color: chrome.textMuted, fontSize: 13, padding: "8px 0" }}>
            No log entries yet — start a workflow to see live output here.
          </div>
        ) : (
          entriesRef.current.map((entry, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, lineHeight: 1.5 }}>
              <span style={{ color: "#4B5563", fontFamily: "monospace", flexShrink: 0, paddingTop: 1 }}>
                {formatTime(entry.ts)}
              </span>
              <span
                style={{
                  color: agentColor(entry.agentId),
                  fontWeight: 600,
                  flexShrink: 0,
                  minWidth: 80,
                }}
              >
                {entry.agentName}
              </span>
              <span style={{ color: chrome.text }}>{entry.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
