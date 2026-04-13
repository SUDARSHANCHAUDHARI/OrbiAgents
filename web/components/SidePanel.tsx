"use client";
import type { Agent } from "@/lib/types";

interface Props {
  agent: Agent;
  onClose: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

const STATE_COLOR: Record<string, string> = {
  idle:      "#7A5230",
  thinking:  "#FCD34D",
  coding:    "#60A5FA",
  testing:   "#6EE7B7",
  reviewing: "#FCD34D",
  debugging: "#F87171",
  done:      "#6EE7B7",
};

const PALETTE_COLOR = ["#A78BFA","#60A5FA","#34D399","#FBBF24","#F87171"];

export default function SidePanel({ agent, onClose, onPause, onResume }: Props) {
  const paletteIdx = (parseInt(agent.id) - 1) % 5;
  const accentColor = PALETTE_COLOR[paletteIdx];
  const costLabel = agent.costUsd >= 0.01
    ? `$${agent.costUsd.toFixed(3)}`
    : agent.costUsd > 0 ? `$${agent.costUsd.toFixed(5)}` : "—";

  return (
    <div style={{
      width: 280,
      background: "#0d0907",
      borderLeft: "3px solid #3D2409",
      display: "flex",
      flexDirection: "column",
      fontFamily: "monospace",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "2px solid #3D2409",
        background: "#1a1208",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 10, height: 10,
            background: accentColor,
            border: `2px solid ${accentColor}`,
          }} />
          <span style={{ color: "#E9D5FF", fontSize: 10, letterSpacing: "0.1em" }}>
            {agent.name.toUpperCase()}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none",
          color: "#7A5230", cursor: "pointer", fontSize: 12, lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <Row label="STATUS">
          <span style={{
            color: agent.paused ? "#7A5230" : (STATE_COLOR[agent.state] ?? "#F5CBA7"),
            fontSize: 10, letterSpacing: "0.05em",
          }}>
            {(agent.paused ? "PAUSED" : agent.state).toUpperCase()}
          </span>
        </Row>

        <Row label="TASK">
          <span style={{ color: "#F5CBA7", fontSize: 9, lineHeight: 1.6 }}>{agent.task}</span>
        </Row>

        <Row label="LAST ACTION">
          <span style={{ color: "#7A5230", fontSize: 9 }}>{agent.lastAction}</span>
        </Row>

        <Row label="THIS RUN">
          <div style={{ display: "flex", gap: 8, fontSize: 9, fontFamily: "monospace" }}>
            <span style={{ color: "#60A5FA" }}>↓ {agent.inputTokens.toLocaleString()}</span>
            <span style={{ color: "#4A2F14" }}>in</span>
            <span style={{ color: "#6EE7B7" }}>↑ {agent.outputTokens.toLocaleString()}</span>
            <span style={{ color: "#4A2F14" }}>out</span>
          </div>
          <div style={{ color: agent.costUsd > 0 ? "#FCD34D" : "#4A2F14", fontSize: 9, marginTop: 2 }}>
            {costLabel}
          </div>
        </Row>

        <Row label="TOTAL TOKENS">
          <span style={{ color: "#F5CBA7", fontSize: 10 }}>
            {agent.tokensUsed.toLocaleString()}
          </span>
        </Row>

        <Row label="LOG">
          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {agent.logs.map((entry, i) => (
              <div key={i} style={{
                fontSize: 8, color: "#7A5230", lineHeight: 1.8,
                borderLeft: "2px solid #3D2409",
                paddingLeft: 6, marginBottom: 2,
              }}>
                {entry}
              </div>
            ))}
          </div>
        </Row>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 12px", borderTop: "2px solid #3D2409" }}>
        {agent.paused ? (
          <button onClick={() => onResume(agent.id)} style={{
            width: "100%", background: "#14532D",
            border: "2px solid #16A34A", color: "#6EE7B7",
            fontFamily: "monospace", fontSize: 8,
            letterSpacing: "0.1em", padding: "7px",
            cursor: "pointer",
          }}>▶ RESUME AGENT</button>
        ) : (
          <button onClick={() => onPause(agent.id)} style={{
            width: "100%", background: "#451A03",
            border: "2px solid #D97706", color: "#FCD34D",
            fontFamily: "monospace", fontSize: 8,
            letterSpacing: "0.1em", padding: "7px",
            cursor: "pointer",
          }}>⏸ PAUSE AGENT</button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 7, color: "#7C3AED",
        letterSpacing: "0.15em", marginBottom: 3,
        textTransform: "uppercase",
      }}>{label}</div>
      {children}
    </div>
  );
}
