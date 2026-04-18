"use client";
import { useEffect, useRef } from "react";
import type { Agent } from "@/lib/types";

interface Props {
  agent: Agent;
  compact?: boolean;
  onClose: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

const STATE_COLOR: Record<string, string> = {
  idle:      "#9CA3AF",
  thinking:  "#FCD34D",
  coding:    "#60A5FA",
  testing:   "#6EE7B7",
  reviewing: "#FCD34D",
  debugging: "#F87171",
  done:      "#6EE7B7",
};

const PALETTE_COLOR = ["#A78BFA","#60A5FA","#34D399","#FBBF24","#F87171"];

export default function SidePanel({ agent, compact = false, onClose, onPause, onResume }: Props) {
  const paletteIdx = (parseInt(agent.id) - 1) % 5;
  const accentColor = PALETTE_COLOR[paletteIdx];
  const costLabel = agent.costUsd >= 0.01
    ? `$${agent.costUsd.toFixed(3)}`
    : agent.costUsd > 0 ? `$${agent.costUsd.toFixed(5)}` : "—";
  const panelBg = "#0F172A";
  const panelBgMid = "#111827";
  const panelBgTop = "#172033";
  const panelBorder = "#374151";
  const bodyCard = "#1F2937";
  const bodyCardBorder = "#374151";
  const textPrimary = "#E5E7EB";
  const textSecondary = "#9CA3AF";
  const textMuted = "#6B7280";
  const logRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    const el = logRef.current;
    if (!el || !autoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [agent.id, agent.logs]);

  return (
    <div style={{
      width: compact ? 272 : 320,
      maxWidth: compact ? 272 : 320,
      flexShrink: 0,
      height: "100vh",
      background: `linear-gradient(180deg, ${panelBgTop} 0%, ${panelBg} 24%, ${panelBg} 100%)`,
      borderLeft: `1px solid ${panelBorder}`,
      display: "flex",
      flexDirection: "column",
      fontFamily: "Inter, system-ui, sans-serif",
      boxShadow: "inset 1px 0 0 rgba(255,255,255,0.04), -10px 0 30px rgba(0,0,0,0.18)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px",
        borderBottom: `1px solid ${panelBorder}`,
        background: panelBgMid,
        boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 10, height: 10,
            background: accentColor,
            borderRadius: 999,
          }} />
          <span style={{ color: textPrimary, fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {agent.name.toUpperCase()}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none",
          color: textMuted, cursor: "pointer", fontSize: 16, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <Row label="STATUS">
          <span style={{
            color: agent.paused ? "#EF4444" : (STATE_COLOR[agent.state] ?? textPrimary),
            fontSize: 20, letterSpacing: "-0.01em",
            fontWeight: 700,
          }}>
            {(agent.paused ? "PAUSED" : agent.state).toUpperCase()}
          </span>
        </Row>

        <Row label="TASK">
          <span style={{ color: textPrimary, fontSize: 14, lineHeight: 1.6 }}>{agent.task}</span>
        </Row>

        <Row label="LAST ACTION">
          <span style={{ color: textSecondary, fontSize: 14, lineHeight: 1.6 }}>{agent.lastAction}</span>
        </Row>

        <Row label="THIS RUN">
          <div style={{ display: "flex", gap: 8, fontSize: 14, fontFamily: "Inter, system-ui, sans-serif", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#60A5FA" }}>↓ {agent.inputTokens.toLocaleString()}</span>
            <span style={{ color: textSecondary }}>in</span>
            <span style={{ color: "#6EE7B7" }}>↑ {agent.outputTokens.toLocaleString()}</span>
            <span style={{ color: textSecondary }}>out</span>
          </div>
          <div style={{ color: agent.costUsd > 0 ? "#F59E0B" : textSecondary, fontSize: 14, marginTop: 4 }}>
            {costLabel}
          </div>
        </Row>

        <Row label="TOTAL TOKENS">
          <span style={{ color: textPrimary, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {agent.tokensUsed.toLocaleString()}
          </span>
        </Row>

        <Row label="LOG">
          <div style={{
            maxHeight: 280,
            overflowY: "auto",
            background: bodyCard,
            border: `1px solid ${bodyCardBorder}`,
            borderRadius: 12,
            padding: "12px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
          ref={logRef}
          onScroll={(event) => {
            const el = event.currentTarget;
            autoScrollRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 18;
          }}>
            {agent.logs.map((entry, i) => {
              const tone = getLogTone(entry);
              const latest = i === agent.logs.length - 1;
              return (
                <div key={i} style={{
                  fontSize: 13,
                  color: latest ? "#F7FEFF" : tone.text,
                  lineHeight: 1.6,
                  borderLeft: `2px solid ${tone.border}`,
                  padding: "6px 0 6px 8px",
                  marginBottom: 8,
                  background: latest ? "rgba(255,255,255,0.04)" : "transparent",
                  borderRadius: 6,
                }}>
                  {entry}
                </div>
              );
            })}
          </div>
        </Row>
      </div>

      {/* Footer */}
      <div style={{ padding: "16px", borderTop: `1px solid ${panelBorder}`, background: panelBgMid }}>
        {agent.paused ? (
          <button onClick={() => onResume(agent.id)} style={{
            width: "100%", minHeight: 40, background: "#14532D",
            border: "1px solid #16A34A", borderRadius: 8, color: "#6EE7B7",
            fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, fontWeight: 600,
            padding: "0 12px",
            cursor: "pointer",
          }}>▶ RESUME AGENT</button>
        ) : (
          <button onClick={() => onPause(agent.id)} style={{
            width: "100%", minHeight: 40, background: "#2563EB",
            border: "1px solid #1D4ED8", borderRadius: 8, color: "#F8FAFC",
            fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, fontWeight: 600,
            padding: "0 12px",
            cursor: "pointer",
          }}>⏸ PAUSE AGENT</button>
        )}
      </div>
    </div>
  );
}

function getLogTone(entry: string): { text: string; border: string } {
  if (entry.includes("[thinking]")) return { text: "#FDE68A", border: "#FCD34D" };
  if (entry.includes("[coding]")) return { text: "#BFDBFE", border: "#60A5FA" };
  if (entry.includes("[done]")) return { text: "#BBF7D0", border: "#34D399" };
  if (entry.includes("[idle]")) return { text: "#CBD5E1", border: "#94A3B8" };
  return { text: "#D3F4FB", border: "#7CDCF6" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12,
        color: "#9CA3AF",
        letterSpacing: "0.08em",
        marginBottom: 6,
        textTransform: "uppercase",
        fontWeight: 700,
      }}>{label}</div>
      {children}
    </div>
  );
}
